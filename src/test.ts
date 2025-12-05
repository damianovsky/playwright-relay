/**
 * Playwright test extension with relay fixture
 * @module test
 */

import { test as base, expect as playwrightExpect } from '@playwright/test';
import type { TestInfo as PlaywrightTestInfo } from '@playwright/test';
import type { Relay, DependencyDefinition, RelayConfig } from './types.js';
import {
  createRelay,
  storeTestResult,
  setRelayConfig,
  getRelayConfig,
} from './relay.js';
import { parseDependsValue, parseTestFile } from './parser.js';
import { resultStore } from './store.js';
import { executeAllDependencies, clearModuleCache } from './executor.js';

// Cache for parsed JSDoc dependencies per file
const jsDocDepsCache = new Map<string, Map<string, DependencyDefinition[]>>();

function getJsDocDependencies(filePath: string, testTitle: string): DependencyDefinition[] {
  if (!filePath) return [];
  
  if (!jsDocDepsCache.has(filePath)) {
    try {
      const parsed = parseTestFile(filePath);
      jsDocDepsCache.set(filePath, parsed);
    } catch {
      // If file cannot be parsed, cache empty map
      jsDocDepsCache.set(filePath, new Map());
    }
  }
  
  return jsDocDepsCache.get(filePath)?.get(testTitle) ?? [];
}

export interface RelayFixtures {
  relay: Relay;
}

function extractDependencies(testInfo: PlaywrightTestInfo): DependencyDefinition[] {
  // 1. Get dependencies from Playwright annotations
  const annotationDeps = testInfo.annotations
    .filter(a => a.type === 'depends' && typeof a.description === 'string')
    .map(a => parseDependsValue(a.description as string));
  
  // 2. Get dependencies from JSDoc comments in source file
  const jsDocDeps = getJsDocDependencies(testInfo.file, testInfo.title);
  
  // 3. Merge both sources, avoiding duplicates by fullKey
  const seen = new Set<string>();
  const allDeps: DependencyDefinition[] = [];
  
  for (const dep of [...annotationDeps, ...jsDocDeps]) {
    if (!seen.has(dep.fullKey)) {
      seen.add(dep.fullKey);
      allDeps.push(dep);
    }
  }
  
  return allDeps;
}

function getTestKey(testInfo: PlaywrightTestInfo): string {
  const titlePath = testInfo.titlePath.slice(1).join(' > ');
  return titlePath || testInfo.title;
}

function mapTestStatus(status: string | undefined): 'passed' | 'failed' | 'skipped' | 'pending' {
  switch (status) {
    case 'passed': return 'passed';
    case 'failed': return 'failed';
    case 'skipped': return 'skipped';
    default: return 'pending';
  }
}

export const test = base.extend<RelayFixtures>({
  relay: async ({}, use, testInfo) => {
    const testKey = getTestKey(testInfo);
    
    // Ensure cache is loaded when persistCache is enabled
    // This is critical for cross-project dependencies in Playwright
    const relayConfig = getRelayConfig();
    if (relayConfig.persistCache && !resultStore.isInitialized()) {
      resultStore.initialize({ persistCache: true, cacheFilePath: relayConfig.cacheFilePath });
    }
    
    // Auto-set namespace based on baseURL to isolate data between different environments
    // This prevents tests running against different servers from overwriting each other's results
    if (!resultStore.getNamespace()) {
      const baseURL = testInfo.project?.use?.baseURL;
      if (baseURL) {
        // Use baseURL as namespace (e.g., "https://api.server1.com" -> "https://api.server1.com")
        resultStore.setNamespace(baseURL);
      }
    }
    
    // beforeEach: mark test as running
    resultStore.set(testKey, 'running');
    resultStore.set(testInfo.title, 'running');

    const relay = createRelay(testInfo.file);
    const deps = extractDependencies(testInfo);

    // Execute all dependencies before the test runs
    // This handles the case when running with --grep and dependencies aren't scheduled
    if (deps.length > 0 && testInfo.file) {
      try {
        await executeAllDependencies(deps, testInfo.file);
      } catch (error) {
        const { onDependencyFailure } = getRelayConfig();
        if (onDependencyFailure === 'skip') {
          testInfo.skip(true, `Dependency execution failed: ${(error as Error).message}`);
          return;
        }
        throw error;
      }
    }

    // Check if any dependency failed or is still pending
    for (const dep of deps) {
      const depStatus = relay.status(dep.fullKey);
      
      if (depStatus === 'failed') {
        const { onDependencyFailure } = getRelayConfig();
        if (onDependencyFailure === 'skip') {
          testInfo.skip(true, `Dependency "${dep.fullKey}" failed`);
          return;
        }
        throw new Error(`Dependency "${dep.fullKey}" failed`);
      }
      
      if (depStatus === 'pending') {
        const { onDependencyFailure } = getRelayConfig();
        const errorMsg = `Dependency "${dep.fullKey}" was not executed. ` +
          (dep.file 
            ? `Cross-file dependencies require both files to be included in the same test run.`
            : `Make sure the dependency test exists and runs before this test.`);
        
        if (onDependencyFailure === 'skip') {
          testInfo.skip(true, errorMsg);
          return;
        }
        throw new Error(errorMsg);
      }
    }

    await use(relay);

    // afterEach: store final status if not already set by relay.pass/fail
    if (resultStore.getStatus(testKey) === 'running') {
      const status = mapTestStatus(testInfo.status);
      resultStore.set(testKey, status);
      resultStore.set(testInfo.title, status);
    }
  },
});

export const expect = playwrightExpect;

export function relayTest<T>(
  title: string,
  fn: (fixtures: RelayFixtures & { [key: string]: unknown }) => Promise<T> | T
): void {
  test(title, async (fixtures) => {
    const testInfo = (test as any).info?.();
    const testKey = testInfo ? getTestKey(testInfo) : title;

    try {
      const result = await fn(fixtures as unknown as RelayFixtures & { [key: string]: unknown });
      const status = 'passed';
      storeTestResult(testKey, status, result ?? undefined);
      storeTestResult(title, status, result ?? undefined);
    } catch (error) {
      storeTestResult(testKey, 'failed', undefined, error as Error);
      storeTestResult(title, 'failed', undefined, error as Error);
      throw error;
    }
  });
}

export function withRelay<T extends object>(config: T & { relay?: RelayConfig }): T {
  const { relay: relayConfig, ...rest } = config;
  if (relayConfig) setRelayConfig(relayConfig);
  return rest as T;
}

export function captureResult<T, F extends (...args: any[]) => Promise<T>>(
  fn: F
): (...args: Parameters<F>) => Promise<T> {
  return async (...args) => {
    const result = await fn(...args);
    const testInfo = (base as any).info?.() as PlaywrightTestInfo | undefined;

    if (testInfo) {
      const testKey = getTestKey(testInfo);
      storeTestResult(testKey, 'passed', result);
      storeTestResult(testInfo.title, 'passed', result);
    }

    return result;
  };
}

/** Clear the JSDoc dependencies cache. Useful for testing. */
export function clearJsDocCache(): void {
  jsDocDepsCache.clear();
}

/** Clear the module cache. Useful for testing. */
export { clearModuleCache } from './executor.js';
