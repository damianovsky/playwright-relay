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
import { parseDependsValue } from './parser.js';
import { resultStore } from './store.js';

export interface RelayFixtures {
  relay: Relay;
}

function extractDependencies(testInfo: PlaywrightTestInfo): DependencyDefinition[] {
  return testInfo.annotations
    .filter(a => a.type === 'depends' && typeof a.description === 'string')
    .map(a => parseDependsValue(a.description as string));
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
    
    // beforeEach: mark test as running
    resultStore.set(testKey, 'running');
    resultStore.set(testInfo.title, 'running');

    const relay = createRelay(testInfo.file);
    const deps = extractDependencies(testInfo);

    for (const dep of deps) {
      if (relay.status(dep.fullKey) === 'failed') {
        const { onDependencyFailure } = getRelayConfig();
        if (onDependencyFailure === 'skip') {
          testInfo.skip(true, `Dependency "${dep.fullKey}" failed`);
          return;
        }
        throw new Error(`Dependency "${dep.fullKey}" failed`);
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
