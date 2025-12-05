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
  clearResults,
  registerTest,
  unregisterTest,
  getRegisteredTest,
  clearTestRegistry,
  setRelayConfig,
  getRelayConfig,
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

// Store
export { resultStore, ResultStore } from './store.js';
