/**
 * Type definitions for playwright-relay
 * @module types
 */

/** Possible states of a test in the relay system */
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/** Behavior when a dependency fails */
export type DependencyFailureAction = 'skip' | 'fail';

/** Stored result of a test execution */
export interface TestResult<T = unknown> {
  status: TestStatus;
  data?: T;
  error?: Error;
  timestamp: number;
}

/** Configuration options for playwright-relay */
export interface RelayConfig {
  /** Timeout for dependency tests (ms). Default: 60000 */
  dependencyTimeout?: number;
  /** Action when dependency fails. Default: 'skip' */
  onDependencyFailure?: DependencyFailureAction;
  /** Cache results between runs. Default: false */
  persistCache?: boolean;
}

/** Required version of RelayConfig with all fields */
export type RequiredRelayConfig = Required<RelayConfig>;

/** Dependency definition from @depends annotation */
export interface DependencyDefinition {
  /** Source file (for cross-file deps) */
  file?: string;
  /** Test title to depend on */
  testTitle: string;
  /** Full key: "file > title" or just "title" */
  fullKey: string;
}

/** Test metadata in dependency graph */
export interface TestInfo {
  id: string;
  title: string;
  file: string;
  dependencies: DependencyDefinition[];
  fn?: (...args: unknown[]) => Promise<unknown> | unknown;
}

/** Relay fixture interface */
export interface Relay {
  /** Get data from executed dependency (sync) */
  from<T = unknown>(testKey: string): T;
  /** Get data, executing dependency if needed (async) */
  require<T = unknown>(testKey: string): Promise<T>;
  /** Check if dependency has completed */
  hasRun(testKey: string): boolean;
  /** Get all cached results */
  all(): Map<string, unknown>;
  /** Force re-execution of a dependency */
  rerun<T = unknown>(testKey: string): Promise<T>;
  /** Get current status of a test */
  status(testKey: string): TestStatus;
}

/** Test function signature for relayTest */
export type RelayTestFn<T = void> = (
  fixtures: Record<string, unknown> & { relay: Relay }
) => Promise<T> | T;

/** Registered test entry */
export interface RegisteredTest {
  fn: () => Promise<unknown>;
  dependencies: DependencyDefinition[];
}

/** Result lookup response */
export interface ResultLookup<T = unknown> {
  found: boolean;
  data?: T;
  status: TestStatus;
}
