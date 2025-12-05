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
} from './types.js';
import { resultStore } from './store.js';
import { parseTestKey } from './parser.js';

const DEFAULT_CONFIG: RequiredRelayConfig = {
  dependencyTimeout: 60000,
  onDependencyFailure: 'skip',
  persistCache: false,
};

let config: RequiredRelayConfig = { ...DEFAULT_CONFIG };
const testRegistry = new Map<string, RegisteredTest>();

// Configuration
export function setRelayConfig(newConfig: RelayConfig): void {
  config = { ...DEFAULT_CONFIG, ...newConfig };
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

function findResult<T>(key: string, currentFile?: string): ResultLookup<T> {
  for (const k of normalizeKey(key, currentFile)) {
    if (resultStore.has(k)) {
      return {
        found: true,
        data: resultStore.getData<T>(k),
        status: resultStore.getStatus(k),
      };
    }
  }
  return { found: false, status: 'pending' };
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
}

export function getTestResult<T>(key: string): T | undefined {
  return resultStore.getData<T>(key);
}

export function clearResults(): void {
  if (!config.persistCache) resultStore.clear();
}
