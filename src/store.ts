/**
 * Result store - singleton for caching test results
 * @module store
 */

import type { TestResult, TestStatus } from './types.js';

class ResultStore {
  private readonly results = new Map<string, TestResult>();
  private readonly pendingExecutions = new Map<string, Promise<unknown>>();

  set<T>(key: string, status: TestStatus, data?: T, error?: Error): void {
    this.results.set(key, { status, data, error, timestamp: Date.now() });
  }

  get<T>(key: string): TestResult<T> | undefined {
    return this.results.get(key) as TestResult<T> | undefined;
  }

  has(key: string): boolean {
    return this.results.has(key);
  }

  getStatus(key: string): TestStatus {
    return this.results.get(key)?.status ?? 'pending';
  }

  getData<T>(key: string): T | undefined {
    return this.results.get(key)?.data as T | undefined;
  }

  getAll(): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (const [key, { status, data }] of this.results) {
      if (status === 'passed' && data !== undefined) {
        result.set(key, data);
      }
    }
    return result;
  }

  setPending(key: string, promise: Promise<unknown>): void {
    this.pendingExecutions.set(key, promise);
  }

  getPending(key: string): Promise<unknown> | undefined {
    return this.pendingExecutions.get(key);
  }

  removePending(key: string): void {
    this.pendingExecutions.delete(key);
  }

  isPending(key: string): boolean {
    return this.pendingExecutions.has(key);
  }

  delete(key: string): void {
    this.results.delete(key);
    this.pendingExecutions.delete(key);
  }

  clear(): void {
    this.results.clear();
    this.pendingExecutions.clear();
  }

  keys(): string[] {
    return [...this.results.keys()];
  }
}

export const resultStore = new ResultStore();
export { ResultStore };
