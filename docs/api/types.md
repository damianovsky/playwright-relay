# Types

## `Relay`

The relay fixture interface.

```typescript
interface Relay {
  from<T>(testKey: string): T;
  require<T>(testKey: string): Promise<T>;
  hasRun(testKey: string): boolean;
  status(testKey: string): TestStatus;
  all(): Map<string, unknown>;
  rerun<T>(testKey: string): Promise<T>;
}
```

---

## `TestStatus`

Status of a test execution.

```typescript
type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
```

---

## `RelayConfig`

Configuration options for relay.

```typescript
interface RelayConfig {
  dependencyTimeout?: number;
  onDependencyFailure?: 'skip' | 'fail';
  persistCache?: boolean;
  cacheFilePath?: string;
  validateDependencies?: boolean;
  hooks?: LifecycleHooks;
}
```

---

## `LifecycleHooks`

Hooks for monitoring relay lifecycle.

```typescript
interface LifecycleHooks {
  onStoreInit?: () => void | Promise<void>;
  onBeforeTest?: (data: { 
    testKey: string; 
    dependencies: DependencyDefinition[] 
  }) => void | Promise<void>;
  onAfterTest?: (data: { 
    testKey: string; 
    status: TestStatus; 
    data?: unknown 
  }) => void | Promise<void>;
  onDependencyResolved?: (data: { 
    testKey: string; 
    dependency: string; 
    data?: unknown 
  }) => void | Promise<void>;
  onDependencyFailed?: (data: { 
    testKey: string; 
    dependency: string; 
    error: Error 
  }) => void | Promise<void>;
  onCacheLoaded?: (data: { count: number }) => void | Promise<void>;
  onCacheSaved?: (data: { count: number }) => void | Promise<void>;
}
```

---

## `DependencyDefinition`

Definition of a test dependency.

```typescript
interface DependencyDefinition {
  testTitle: string;
  file?: string;
  fullKey: string;
}
```

---

## `DependencyValidationResult`

Result of dependency validation.

```typescript
interface DependencyValidationResult {
  valid: boolean;
  errors: DependencyValidationError[];
}

interface DependencyValidationError {
  testKey: string;
  dependency: string;
  message: string;
  file?: string;
}
```

---

## `TestResult<T>`

Stored test result.

```typescript
interface TestResult<T = unknown> {
  status: TestStatus;
  data?: T;
  error?: Error;
  timestamp: number;
}
```
