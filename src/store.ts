/**
 * Result store - singleton for caching test results
 * @module store
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { TestResult, TestStatus } from './types.js';

// Shared file path for cross-process communication
const SHARED_STORE_PATH = path.join(os.tmpdir(), 'playwright-relay-store.json');

// Only use shared store when explicitly enabled via env var
// This is set when executing cross-file dependencies via subprocess
const isPlaywrightRun = process.env.PLAYWRIGHT_RELAY_SUBPROCESS === 'true';

interface SerializedStore {
  results: Record<string, TestResult>;
}

class ResultStore {
  private readonly results = new Map<string, TestResult>();
  private readonly pendingExecutions = new Map<string, Promise<unknown>>();
  private useSharedStore: boolean;

  constructor(enableSharedStore = false) {
    // Only use shared store if explicitly enabled or this is the singleton
    this.useSharedStore = enableSharedStore;
    
    if (this.useSharedStore) {
      this.loadFromSharedStore();
    }
  }

  /** Enable or disable shared store (useful for cross-file dependencies) */
  setSharedStoreEnabled(enabled: boolean): void {
    this.useSharedStore = enabled;
    if (enabled) {
      this.loadFromSharedStore();
    }
  }

  set<T>(key: string, status: TestStatus, data?: T, error?: Error): void {
    this.results.set(key, { status, data, error, timestamp: Date.now() });
    // Persist to shared store for cross-process access
    if (this.useSharedStore) {
      this.saveToSharedStore();
    }
  }

  get<T>(key: string): TestResult<T> | undefined {
    // Try local first, then check shared store
    if (!this.results.has(key) && this.useSharedStore) {
      this.loadFromSharedStore();
    }
    return this.results.get(key) as TestResult<T> | undefined;
  }

  has(key: string): boolean {
    if (this.results.has(key)) return true;
    // Check shared store
    if (this.useSharedStore) {
      this.loadFromSharedStore();
      return this.results.has(key);
    }
    return false;
  }

  getStatus(key: string): TestStatus {
    if (!this.results.has(key) && this.useSharedStore) {
      this.loadFromSharedStore();
    }
    return this.results.get(key)?.status ?? 'pending';
  }

  getData<T>(key: string): T | undefined {
    if (!this.results.has(key) && this.useSharedStore) {
      this.loadFromSharedStore();
    }
    return this.results.get(key)?.data as T | undefined;
  }

  getAll(): Map<string, unknown> {
    if (this.useSharedStore) {
      this.loadFromSharedStore();
    }
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
    if (this.useSharedStore) {
      this.saveToSharedStore();
    }
  }

  clear(): void {
    this.results.clear();
    this.pendingExecutions.clear();
    if (this.useSharedStore) {
      this.clearSharedStore();
    }
  }

  keys(): string[] {
    if (this.useSharedStore) {
      this.loadFromSharedStore();
    }
    return [...this.results.keys()];
  }

  // Shared store operations for cross-process communication
  private loadFromSharedStore(): void {
    try {
      if (fs.existsSync(SHARED_STORE_PATH)) {
        const data = fs.readFileSync(SHARED_STORE_PATH, 'utf-8');
        const parsed: SerializedStore = JSON.parse(data);
        
        // Merge with existing results (shared store takes precedence for new keys)
        for (const [key, value] of Object.entries(parsed.results)) {
          if (!this.results.has(key) || this.results.get(key)?.status === 'pending') {
            this.results.set(key, value);
          }
        }
      }
    } catch {
      // Ignore read errors - file might be locked or corrupted
    }
  }

  private saveToSharedStore(): void {
    try {
      // Read existing data first to merge
      let existing: SerializedStore = { results: {} };
      try {
        if (fs.existsSync(SHARED_STORE_PATH)) {
          existing = JSON.parse(fs.readFileSync(SHARED_STORE_PATH, 'utf-8'));
        }
      } catch {
        // Ignore read errors
      }

      // Merge current results with existing
      const merged: SerializedStore = {
        results: {
          ...existing.results,
          ...Object.fromEntries(
            [...this.results.entries()].map(([k, v]) => [k, {
              status: v.status,
              data: v.data,
              timestamp: v.timestamp,
              // Don't serialize error objects
            }])
          ),
        },
      };

      fs.writeFileSync(SHARED_STORE_PATH, JSON.stringify(merged, null, 2));
    } catch {
      // Ignore write errors
    }
  }

  private clearSharedStore(): void {
    try {
      if (fs.existsSync(SHARED_STORE_PATH)) {
        fs.unlinkSync(SHARED_STORE_PATH);
      }
    } catch {
      // Ignore delete errors
    }
  }
}

// Singleton instance with shared store enabled for Playwright runs
export const resultStore = new ResultStore(isPlaywrightRun);
export { ResultStore };
