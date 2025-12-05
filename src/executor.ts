/**
 * Dynamic test executor for cross-file dependencies
 * @module executor
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { DependencyDefinition } from './types.js';
import { resultStore } from './store.js';
import { parseTestKey, resolveFilePath, parseTestFile } from './parser.js';

// Cache for loaded test modules
const moduleCache = new Map<string, Map<string, () => Promise<unknown>>>();

// Track which files have been executed via subprocess
const executedFiles = new Set<string>();

// Regex to extract test blocks with their bodies
const TEST_BLOCK_REGEX = /(?:\/\*\*[\s\S]*?\*\/\s*)?test\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*async\s*\([^)]*\)\s*=>\s*\{/g;

interface TestDefinition {
  title: string;
  startIndex: number;
  bodyStartIndex: number;
}

/**
 * Find matching closing brace for a code block
 */
function findClosingBrace(source: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;
  
  while (i < source.length && depth > 0) {
    const char = source[i];
    
    // Skip strings
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i++; // Skip escaped chars
        i++;
      }
    }
    // Skip comments
    else if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    }
    else if (char === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
    }
    else if (char === '{') {
      depth++;
    }
    else if (char === '}') {
      depth--;
    }
    
    i++;
  }
  
  return i;
}

/**
 * Extract test definitions from source code
 */
function extractTestDefinitions(source: string): TestDefinition[] {
  const tests: TestDefinition[] = [];
  TEST_BLOCK_REGEX.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  while ((match = TEST_BLOCK_REGEX.exec(source)) !== null) {
    tests.push({
      title: match[2],
      startIndex: match.index,
      bodyStartIndex: match.index + match[0].length,
    });
  }
  
  return tests;
}

/**
 * Extract the body of a specific test from source
 */
function extractTestBody(source: string, testTitle: string): string | null {
  const tests = extractTestDefinitions(source);
  const testDef = tests.find(t => t.title === testTitle);
  
  if (!testDef) return null;
  
  const bodyEnd = findClosingBrace(source, testDef.bodyStartIndex);
  // Extract body without the outer braces
  return source.substring(testDef.bodyStartIndex, bodyEnd - 1);
}

/**
 * Create an executable function from test body
 * This creates a minimal execution context for the test
 */
function createTestFunction(
  testBody: string,
  filePath: string
): () => Promise<unknown> {
  return async () => {
    // Create a minimal relay-like object for executing dependencies
    const { createRelay, storeTestResult } = await import('./relay.js');
    const relay = createRelay(filePath);
    
    // Create execution context
    const context = {
      relay,
      storeTestResult,
      // Add commonly used globals
      console,
      Math,
      Date,
      JSON,
      Promise,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    };
    
    // We need to evaluate the test body
    // This is a simplified approach - in production you might want to use vm module
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    
    try {
      // Create function with relay and storeTestResult in scope
      const fn = new AsyncFunction(
        'relay', 
        'storeTestResult',
        'console',
        'Math',
        'Date', 
        'JSON',
        testBody
      );
      
      return await fn(
        context.relay,
        context.storeTestResult,
        context.console,
        context.Math,
        context.Date,
        context.JSON
      );
    } catch (error) {
      // Re-throw with more context
      const err = error as Error;
      throw new Error(`Failed to execute test body: ${err.message}`);
    }
  };
}

/**
 * Load and cache test functions from a file
 */
export function loadTestsFromFile(filePath: string): Map<string, () => Promise<unknown>> {
  if (moduleCache.has(filePath)) {
    return moduleCache.get(filePath)!;
  }
  
  const tests = new Map<string, () => Promise<unknown>>();
  
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const testDefs = extractTestDefinitions(source);
    
    for (const testDef of testDefs) {
      const body = extractTestBody(source, testDef.title);
      if (body) {
        tests.set(testDef.title, createTestFunction(body, filePath));
      }
    }
  } catch (error) {
    console.warn(`Failed to load tests from ${filePath}:`, error);
  }
  
  moduleCache.set(filePath, tests);
  return tests;
}

/**
 * Execute a dependency test, loading from file if necessary
 */
export async function executeDependency(
  dep: DependencyDefinition,
  currentFile: string
): Promise<unknown> {
  const { file, testTitle } = parseTestKey(dep.fullKey);
  
  // Check if already executed
  const keys = [dep.fullKey, testTitle];
  if (file) keys.push(`${file} > ${testTitle}`);
  
  for (const key of keys) {
    if (resultStore.has(key)) {
      const status = resultStore.getStatus(key);
      if (status === 'passed') {
        return resultStore.getData(key);
      }
      if (status === 'failed') {
        throw new Error(`Dependency "${key}" failed`);
      }
      if (status === 'running') {
        // Wait for pending execution
        const pending = resultStore.getPending(key);
        if (pending) return pending;
      }
    }
  }
  
  // If this is a cross-file dependency, try to execute it via subprocess
  if (file) {
    const targetFile = resolveFilePath(currentFile, file);
    
    if (fs.existsSync(targetFile)) {
      // Execute the dependency file via Playwright subprocess
      await executeFileViaPlaywright(targetFile, testTitle);
      
      // Check if the dependency was executed successfully
      for (const key of keys) {
        if (resultStore.has(key)) {
          const status = resultStore.getStatus(key);
          if (status === 'passed') {
            return resultStore.getData(key);
          }
          if (status === 'failed') {
            throw new Error(`Dependency "${key}" failed during execution`);
          }
        }
      }
    }
    
    throw new Error(
      `Cross-file dependency "${dep.fullKey}" could not be executed. ` +
      `File "${targetFile}" ${fs.existsSync(targetFile) ? 'exists but test was not found' : 'does not exist'}.`
    );
  }
  
  // For same-file dependencies, try to load and execute from source
  const tests = loadTestsFromFile(currentFile);
  const testFn = tests.get(testTitle);
  
  if (!testFn) {
    throw new Error(
      `Dependency "${dep.fullKey}" not found. Make sure the test exists and is properly formatted.`
    );
  }
  
  return executeTestFunction(dep.fullKey, testFn);
}

/**
 * Execute a specific test from a file via Playwright subprocess
 * This ensures proper Playwright context (page, fixtures, etc.)
 */
async function executeFileViaPlaywright(
  filePath: string,
  testTitle?: string
): Promise<void> {
  // Skip if already executed this file
  const fileKey = testTitle ? `${filePath}:${testTitle}` : filePath;
  if (executedFiles.has(fileKey)) {
    return;
  }
  
  executedFiles.add(fileKey);
  
  // First, check if the target test has its own dependencies and execute them
  const fileDeps = parseTestFile(filePath);
  const testDeps = testTitle ? fileDeps.get(testTitle) : undefined;
  
  if (testDeps && testDeps.length > 0) {
    for (const dep of testDeps) {
      await executeDependency(dep, filePath);
    }
  }
  
  try {
    // Build the playwright command
    const grepArg = testTitle ? `--grep "${escapeRegex(testTitle)}"` : '';
    const command = `npx playwright test "${filePath}" ${grepArg} --reporter=json 2>/dev/null || true`;
    
    // Execute Playwright in subprocess
    const output = execSync(command, {
      cwd: findProjectRoot(filePath),
      encoding: 'utf-8',
      timeout: 60000,
      env: {
        ...process.env,
        // Pass shared state location if using file-based persistence
        PLAYWRIGHT_RELAY_SUBPROCESS: 'true',
      },
    });
    
    // Try to parse JSON output to get test results
    try {
      const jsonStart = output.indexOf('{');
      if (jsonStart >= 0) {
        const result = JSON.parse(output.substring(jsonStart));
        processPlaywrightResults(result, filePath);
      }
    } catch {
      // JSON parsing failed, test might have passed without structured output
      // The results should be in shared store if using file persistence
    }
  } catch (error) {
    const err = error as Error;
    console.warn(`Failed to execute dependency file ${filePath}: ${err.message}`);
  }
}

/**
 * Process Playwright JSON reporter output and store results
 */
function processPlaywrightResults(result: any, filePath: string): void {
  if (!result.suites) return;
  
  const processSpecs = (specs: any[]) => {
    for (const spec of specs) {
      if (spec.tests) {
        for (const test of spec.tests) {
          const title = spec.title;
          const status = test.status === 'expected' || test.status === 'passed' 
            ? 'passed' 
            : test.status === 'skipped' ? 'skipped' : 'failed';
          
          // Store under multiple keys for flexible lookup
          const fileName = path.basename(filePath);
          resultStore.set(title, status);
          resultStore.set(`${fileName} > ${title}`, status);
        }
      }
      
      if (spec.suites) {
        processSpecs(spec.suites);
      }
      if (spec.specs) {
        processSpecs(spec.specs);
      }
    }
  };
  
  processSpecs(result.suites);
}

/**
 * Find project root by looking for package.json or playwright.config
 */
function findProjectRoot(startPath: string): string {
  let current = path.dirname(startPath);
  
  while (current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, 'package.json')) ||
      fs.existsSync(path.join(current, 'playwright.config.ts')) ||
      fs.existsSync(path.join(current, 'playwright.config.js'))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  
  return path.dirname(startPath);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Execute a test function and store the result
 */
async function executeTestFunction(
  key: string,
  fn: () => Promise<unknown>
): Promise<unknown> {
  // Check for pending execution
  const pending = resultStore.getPending(key);
  if (pending) return pending;
  
  // Mark as running
  resultStore.set(key, 'running');
  
  const promise = (async () => {
    try {
      const result = await fn();
      resultStore.set(key, 'passed', result);
      return result;
    } catch (error) {
      resultStore.set(key, 'failed', undefined, error as Error);
      throw error;
    } finally {
      resultStore.removePending(key);
    }
  })();
  
  resultStore.setPending(key, promise);
  return promise;
}

/**
 * Clear the module cache and executed files tracking
 */
export function clearModuleCache(): void {
  moduleCache.clear();
  executedFiles.clear();
}

/**
 * Execute all dependencies for a test
 */
export async function executeAllDependencies(
  deps: DependencyDefinition[],
  currentFile: string
): Promise<void> {
  for (const dep of deps) {
    await executeDependency(dep, currentFile);
  }
}
