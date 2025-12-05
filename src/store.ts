/**
 * Result store - singleton for caching test results
 * @module store
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { TestResult, TestStatus, LifecycleHooks } from './types.js';

// Default shared file path for cross-process communication
const DEFAULT_SHARED_STORE_PATH = path.join(os.tmpdir(), 'playwright-relay-store.json');

// Only use shared store when explicitly enabled via env var
// This is set when executing cross-file dependencies via subprocess
const isPlaywrightRun = process.env.PLAYWRIGHT_RELAY_SUBPROCESS === 'true';

// Can be overridden via environment variable for Playwright projects support
const ENV_STORE_PATH = process.env.PLAYWRIGHT_RELAY_STORE_PATH;

interface SerializedStore {
  results: Record<string, TestResult>;
}

/** Options for initializing the store */
export interface StoreInitOptions {
  /** Enable persistent file storage */
  persistCache?: boolean;
  /** Custom path for the cache file */
  cacheFilePath?: string;
  /** Lifecycle hooks */
  hooks?: LifecycleHooks;
}

class ResultStore {
  private readonly results = new Map<string, TestResult>();
  private readonly pendingExecutions = new Map<string, Promise<unknown>>();
  private useSharedStore: boolean;
  private sharedStorePath: string;
  private hooks?: LifecycleHooks;
  private initialized = false;

  constructor(enableSharedStore = false, customPath?: string) {
    this.sharedStorePath = customPath ?? ENV_STORE_PATH ?? DEFAULT_SHARED_STORE_PATH;
    // Only use shared store if explicitly enabled or this is the singleton
    this.useSharedStore = enableSharedStore;
    
    if (this.useSharedStore) {
      this.loadFromSharedStore();
    }
  }

  /**
   * Initialize the store with configuration options.
   * This is the recommended way to set up the store.
   * Automatically loads cache if persistCache is true.
   */
  initialize(options: StoreInitOptions): void {
    this.hooks = options.hooks;
    
    if (options.cacheFilePath) {
      this.sharedStorePath = options.cacheFilePath;
    }
    
    if (options.persistCache) {
      this.useSharedStore = true;
      this.loadFromSharedStore();
      this.initialized = true;
      this.hooks?.onStoreInit?.();
    }
  }

  /**
   * Load cache from file explicitly.
   * Use this if you need manual control over when cache is loaded.
   */
  loadFromFile(filePath?: string): void {
    if (filePath) {
      this.sharedStorePath = filePath;
    }
    this.loadFromSharedStore();
  }

  /**
   * Alias for initialize - more intuitive name for cache initialization
   */
  initializeCache(options?: Omit<StoreInitOptions, 'persistCache'>): void {
    this.initialize({ ...options, persistCache: true });
  }

  /**
   * Check if store has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current cache file path
   */
  getCacheFilePath(): string {
    return this.sharedStorePath;
  }

  /**
   * Set lifecycle hooks
   */
  setHooks(hooks: LifecycleHooks): void {
    this.hooks = hooks;
  }

  /** 
   * Enable or disable shared store (useful for cross-file dependencies)
   * @deprecated Use initialize({ persistCache: true }) instead
   */
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

  /**
   * Get data with type safety. Throws if key doesn't exist or test failed.
   */
  getDataOrThrow<T>(key: string): T {
    const result = this.get<T>(key);
    if (!result) {
      throw new Error(`No result found for "${key}". Make sure the dependency has run.`);
    }
    if (result.status === 'failed') {
      throw new Error(`Dependency "${key}" failed: ${result.error?.message ?? 'Unknown error'}`);
    }
    if (result.status !== 'passed') {
      throw new Error(`Dependency "${key}" is in status "${result.status}", expected "passed".`);
    }
    return result.data as T;
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

  /**
   * Get all results with full metadata
   */
  getAllResults<T = unknown>(): Map<string, TestResult<T>> {
    if (this.useSharedStore) {
      this.loadFromSharedStore();
    }
    return new Map(this.results) as Map<string, TestResult<T>>;
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

  /**
   * Get the count of stored results
   */
  size(): number {
    if (this.useSharedStore) {
      this.loadFromSharedStore();
    }
    return this.results.size;
  }

  // Shared store operations for cross-process communication
  private loadFromSharedStore(): void {
    try {
      if (fs.existsSync(this.sharedStorePath)) {
        const data = fs.readFileSync(this.sharedStorePath, 'utf-8');
        const parsed: SerializedStore = JSON.parse(data);
        
        let loadedCount = 0;
        // Merge with existing results (shared store takes precedence for new keys)
        for (const [key, value] of Object.entries(parsed.results)) {
          if (!this.results.has(key) || this.results.get(key)?.status === 'pending') {
            this.results.set(key, value);
            loadedCount++;
          }
        }
        
        if (loadedCount > 0) {
          this.hooks?.onCacheLoaded?.({ count: loadedCount });
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
        if (fs.existsSync(this.sharedStorePath)) {
          existing = JSON.parse(fs.readFileSync(this.sharedStorePath, 'utf-8'));
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

      fs.writeFileSync(this.sharedStorePath, JSON.stringify(merged, null, 2));
      this.hooks?.onCacheSaved?.({ count: this.results.size });
    } catch {
      // Ignore write errors
    }
  }

  private clearSharedStore(): void {
    try {
      if (fs.existsSync(this.sharedStorePath)) {
        fs.unlinkSync(this.sharedStorePath);
      }
    } catch {
      // Ignore delete errors
    }
  }
}

// Singleton instance with shared store enabled for Playwright runs
export const resultStore = new ResultStore(isPlaywrightRun, ENV_STORE_PATH);
export { ResultStore };
