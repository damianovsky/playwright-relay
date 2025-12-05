/**
 * playwright-relay - Pass data between Playwright tests
 * @packageDocumentation
 */

// Types
export type {
  Relay,
  RelayConfig,
  TestStatus,
  TestResult,
  DependencyDefinition,
  TestInfo,
  RelayTestFn,
  RegisteredTest,
  ResultLookup,
  RequiredRelayConfig,
  DependencyFailureAction,
  LifecycleHooks,
  LifecycleHook,
  LifecycleHookWithData,
  DependencyValidationResult,
  DependencyValidationError,
} from './types.js';

// Test extension
export {
  test,
  expect,
  relayTest,
  captureResult,
  withRelay,
  clearJsDocCache,
  clearModuleCache,
  RelayFixtures,
} from './test.js';

// Relay core
export {
  createRelay,
  storeTestResult,
  getTestResult,
  getTestResultOrThrow,
  clearResults,
  registerTest,
  unregisterTest,
  getRegisteredTest,
  clearTestRegistry,
  setRelayConfig,
  getRelayConfig,
  initializeRelay,
  validateDependencies,
  validateDependenciesOrThrow,
} from './relay.js';

// Parser
export {
  parseDependsAnnotations,
  parseDependsValue,
  parseTestSource,
  parseTestFile,
  parseTestKey,
  generateTestKey,
  resolveFilePath,
} from './parser.js';

// Executor
export {
  executeDependency,
  executeAllDependencies,
  loadTestsFromFile,
} from './executor.js';

// Graph
export {
  DependencyGraph,
  CircularDependencyError,
  DependencyNotFoundError,
  dependencyGraph,
} from './graph.js';

// Visualization
export {
  generateGraph,
  generateHtmlGraph,
  buildGraphFromFiles,
} from './visualize.js';
export type { GraphOptions, GraphResult } from './visualize.js';

// Store
export { resultStore, ResultStore } from './store.js';
export type { StoreInitOptions } from './store.js';
