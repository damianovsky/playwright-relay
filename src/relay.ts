/**
 * Relay implementation - core logic for test data sharing
 * @module relay
 */

import type {
  Relay,
  TestStatus,
  DependencyDefinition,
  RelayConfig,
  RequiredRelayConfig,
  RegisteredTest,
  ResultLookup,
  DependencyValidationResult,
  DependencyValidationError,
} from './types.js';
import { resultStore } from './store.js';
import { parseTestKey, parseTestFile } from './parser.js';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_CONFIG: RequiredRelayConfig = {
  dependencyTimeout: 60000,
  onDependencyFailure: 'skip',
  persistCache: false,
  validateDependencies: false,
};

let config: RequiredRelayConfig = { ...DEFAULT_CONFIG };
let configInitialized = false;
const testRegistry = new Map<string, RegisteredTest>();

// Configuration
export function setRelayConfig(newConfig: RelayConfig): void {
  config = { ...DEFAULT_CONFIG, ...newConfig };
  
  // Auto-initialize store when persistCache is enabled
  if (config.persistCache && !configInitialized) {
    resultStore.initialize({
      persistCache: true,
      cacheFilePath: config.cacheFilePath,
      hooks: config.hooks,
    });
    configInitialized = true;
  }
}

/**
 * Initialize relay with config - recommended entry point.
 * Automatically loads cache when persistCache is true.
 */
export function initializeRelay(newConfig: RelayConfig): void {
  setRelayConfig(newConfig);
}

export function getRelayConfig(): RequiredRelayConfig {
  return config;
}

// Test Registry
export function registerTest(
  key: string,
  fn: () => Promise<unknown>,
  dependencies: DependencyDefinition[] = []
): void {
  testRegistry.set(key, { fn, dependencies });
}

export function unregisterTest(key: string): void {
  testRegistry.delete(key);
}

export function getRegisteredTest(key: string): RegisteredTest | undefined {
  return testRegistry.get(key);
}

export function clearTestRegistry(): void {
  testRegistry.clear();
}

// Key normalization
function normalizeKey(key: string, currentFile?: string): string[] {
  const { file, testTitle } = parseTestKey(key);
  const keys = [key];

  if (file) {
    keys.push(`${file} > ${testTitle}`, testTitle);
  } else if (currentFile) {
    const fileName = currentFile.split('/').pop() ?? currentFile;
    keys.push(`${fileName} > ${testTitle}`);
  }

  return keys;
}

/**
 * Find a result by key with fuzzy matching for cross-file dependencies.
 * Supports finding tests with prefixes like [setup] when the @depends annotation
 * doesn't include the prefix.
 * 
 * E.g., @depends setup.spec.ts > my test will match:
 * - "setup.spec.ts > my test" (exact)
 * - "setup.spec.ts > [setup] my test" (fuzzy - ends with test title)
 */
function findResultWithFuzzyMatch<T>(key: string, currentFile?: string): ResultLookup<T> {
  // First try exact match with normalized keys
  for (const k of normalizeKey(key, currentFile)) {
    if (resultStore.has(k)) {
      return {
        found: true,
        data: resultStore.getData<T>(k),
        status: resultStore.getStatus(k),
      };
    }
  }
  
  // If no exact match and this is a cross-file dependency, try fuzzy matching
  const { file, testTitle } = parseTestKey(key);
  if (file && testTitle) {
    // Look for keys that match the pattern: file > [anything] testTitle
    // This handles cases like: "setup.spec.ts > [setup] my test" matching "setup.spec.ts > my test"
    const allKeys = resultStore.keys();
    for (const storedKey of allKeys) {
      const parsed = parseTestKey(storedKey);
      if (parsed.file === file && parsed.testTitle.endsWith(testTitle)) {
        return {
          found: true,
          data: resultStore.getData<T>(storedKey),
          status: resultStore.getStatus(storedKey),
        };
      }
      // Also check if stored key without file prefix ends with test title
      if (storedKey.includes(file) && storedKey.endsWith(testTitle)) {
        return {
          found: true,
          data: resultStore.getData<T>(storedKey),
          status: resultStore.getStatus(storedKey),
        };
      }
    }
  }
  
  return { found: false, status: 'pending' };
}

function findResult<T>(key: string, currentFile?: string): ResultLookup<T> {
  return findResultWithFuzzyMatch<T>(key, currentFile);
}

// Dependency execution
async function executeDependencies(
  deps: DependencyDefinition[],
  currentFile?: string
): Promise<void> {
  for (const dep of deps) {
    let executed = false;

    for (const key of normalizeKey(dep.fullKey, currentFile)) {
      if (resultStore.has(key)) {
        if (resultStore.getStatus(key) === 'failed' && config.onDependencyFailure === 'fail') {
          throw new Error(`Dependency "${key}" failed`);
        }
        executed = true;
        break;
      }

      const registered = testRegistry.get(key);
      if (registered) {
        await executeTest(key, registered.fn, registered.dependencies, currentFile);
        executed = true;
        break;
      }
    }

    if (!executed) {
      console.warn(`Dependency "${dep.fullKey}" not found`);
    }
  }
}

async function executeTest(
  key: string,
  fn: () => Promise<unknown>,
  deps: DependencyDefinition[] = [],
  currentFile?: string
): Promise<unknown> {
  // Return pending execution
  const pending = resultStore.getPending(key);
  if (pending) return pending;

  // Return cached result
  if (resultStore.has(key)) {
    const status = resultStore.getStatus(key);
    if (status === 'passed') return resultStore.getData(key);
    if (status === 'failed') {
      if (config.onDependencyFailure === 'fail') {
        throw new Error(`Dependency "${key}" previously failed`);
      }
      return undefined;
    }
  }

  await executeDependencies(deps, currentFile);

  resultStore.set(key, 'running');

  const promise = (async () => {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${config.dependencyTimeout}ms`)),
            config.dependencyTimeout
          )
        ),
      ]);
      resultStore.set(key, 'passed', result);
      return result;
    } catch (error) {
      resultStore.set(key, 'failed', undefined, error as Error);
      if (config.onDependencyFailure === 'fail') throw error;
      return undefined;
    } finally {
      resultStore.removePending(key);
    }
  })();

  resultStore.setPending(key, promise);
  return promise;
}

// Relay factory
export function createRelay(currentFile?: string): Relay {
  return {
    from<T>(testKey: string): T {
      const result = findResult<T>(testKey, currentFile);

      if (!result.found) {
        throw new Error(
          `Dependency "${testKey}" not executed. Use relay.require() or @depends annotation.`
        );
      }
      if (result.status === 'failed') {
        throw new Error(`Dependency "${testKey}" failed`);
      }

      return result.data as T;
    },

    async require<T>(testKey: string): Promise<T> {
      const result = findResult<T>(testKey, currentFile);
      if (result.found && result.status === 'passed') {
        return result.data as T;
      }

      for (const key of normalizeKey(testKey, currentFile)) {
        const registered = testRegistry.get(key);
        if (registered) {
          return (await executeTest(key, registered.fn, registered.dependencies, currentFile)) as T;
        }
      }

      throw new Error(`Test "${testKey}" not found in registry`);
    },

    hasRun(testKey: string): boolean {
      const { found, status } = findResult(testKey, currentFile);
      return found && status !== 'pending' && status !== 'running';
    },

    all(): Map<string, unknown> {
      return resultStore.getAll();
    },

    async rerun<T>(testKey: string): Promise<T> {
      for (const key of normalizeKey(testKey, currentFile)) {
        resultStore.delete(key);
      }
      return this.require<T>(testKey);
    },

    status(testKey: string): TestStatus {
      return findResult(testKey, currentFile).status;
    },
  };
}

// Result management
export function storeTestResult<T>(
  key: string,
  status: TestStatus,
  data?: T,
  error?: Error
): void {
  resultStore.set(key, status, data, error);
  
  // Call lifecycle hook
  if (status === 'passed' || status === 'failed') {
    config.hooks?.onAfterTest?.({ testKey: key, status, data });
  }
}

/**
 * Get test result data with type safety
 */
export function getTestResult<T>(key: string): T | undefined {
  return resultStore.getData<T>(key);
}

/**
 * Get test result data or throw if not found/failed
 */
export function getTestResultOrThrow<T>(key: string): T {
  return resultStore.getDataOrThrow<T>(key);
}

export function clearResults(): void {
  if (!config.persistCache) resultStore.clear();
}

/**
 * Validate all dependencies in test files before running tests.
 * Returns validation result with list of errors.
 * 
 * @param testFiles - Array of test file paths to validate
 */
export function validateDependencies(testFiles: string[]): DependencyValidationResult {
  const errors: DependencyValidationError[] = [];
  // Map from full key (file > title) to test info, to properly track cross-file deps
  const allTests = new Map<string, { file: string; title: string }>();
  // Also track just test titles within each file
  const testsByFile = new Map<string, Set<string>>();
  
  // First pass: collect all test definitions
  for (const filePath of testFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    
    try {
      const fileName = path.basename(filePath);
      const fileTests = new Set<string>();
      
      // Parse test titles from source
      const content = fs.readFileSync(filePath, 'utf-8');
      const testMatches = content.matchAll(/test\s*\(\s*['"`]([^'"`]+)['"`]/g);
      for (const match of testMatches) {
        const title = match[1];
        fileTests.add(title);
        allTests.set(`${fileName} > ${title}`, { file: filePath, title });
      }
      
      testsByFile.set(fileName, fileTests);
      testsByFile.set(filePath, fileTests);
    } catch {
      // Skip files that can't be parsed
    }
  }
  
  // Second pass: validate dependencies
  for (const filePath of testFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    
    try {
      const deps = parseTestFile(filePath);
      const fileName = path.basename(filePath);
      const currentFileTests = testsByFile.get(fileName) ?? new Set();
      
      for (const [testTitle, dependencies] of deps) {
        const testKey = `${fileName} > ${testTitle}`;
        
        for (const dep of dependencies) {
          let depExists = false;
          
          if (dep.file) {
            // Cross-file dependency - must check the specific file
            const depFileTests = testsByFile.get(dep.file);
            depExists = depFileTests?.has(dep.testTitle) ?? false;
            
            // Also check by full key
            if (!depExists) {
              depExists = allTests.has(`${dep.file} > ${dep.testTitle}`);
            }
          } else {
            // Same-file dependency - check within current file only
            depExists = currentFileTests.has(dep.testTitle);
          }
          
          if (!depExists) {
            errors.push({
              testKey,
              dependency: dep.fullKey,
              file: filePath,
              message: `Dependency "${dep.fullKey}" not found. ` +
                (dep.file 
                  ? `Cross-file dependency format: "${dep.file} > ${dep.testTitle}". Make sure the file "${dep.file}" is included in the test run and contains the test.`
                  : `Make sure the test "${dep.testTitle}" exists in the same file or use cross-file format: "filename.spec.ts > test name".`),
            });
          }
        }
      }
    } catch {
      // Skip files that can't be parsed
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate dependencies and throw if any are invalid.
 * Call this before running tests if you want early validation.
 * 
 * @param testFiles - Array of test file paths to validate
 */
export function validateDependenciesOrThrow(testFiles: string[]): void {
  const result = validateDependencies(testFiles);
  
  if (!result.valid) {
    const errorMessages = result.errors
      .map(e => `  - ${e.testKey}: ${e.message}`)
      .join('\n');
    
    throw new Error(
      `Dependency validation failed:\n${errorMessages}\n\n` +
      `Tip: For cross-file dependencies, use format: "@depends otherfile.spec.ts > test name"`
    );
  }
}
