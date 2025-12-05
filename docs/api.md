# API Reference

## Test Extension

### `test`

Extended Playwright test with `relay` fixture.

```typescript
import { test } from 'playwright-relay';

test('my test', async ({ relay }) => {
  // relay is available
});
```

### `expect`

Re-exported Playwright expect (unchanged).

```typescript
import { expect } from 'playwright-relay';
```

---

## Relay Fixture

The `relay` fixture provides methods to access data from other tests.

### `relay.from<T>(testKey)`

Get data from an executed test synchronously.

```typescript
const user = relay.from<User>('create user');
```

**Parameters:**

- `testKey` - Test title or `"file.spec.ts > title"` for cross-file

**Returns:** The stored data

**Throws:** If test hasn't executed or failed

---

### `relay.require<T>(testKey)`

Get data, executing the dependency if needed.

```typescript
const user = await relay.require<User>('create user');
```

**Parameters:**

- `testKey` - Test title or `"file.spec.ts > title"`

**Returns:** Promise with the data

---

### `relay.hasRun(testKey)`

Check if a test has completed.

```typescript
if (relay.hasRun('create user')) {
  // safe to use relay.from()
}
```

**Returns:** `boolean`

---

### `relay.status(testKey)`

Get current test status.

```typescript
const status = relay.status('create user');
// 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
```

---

### `relay.all()`

Get all cached results.

```typescript
const results = relay.all(); // Map<string, unknown>
```

---

### `relay.rerun<T>(testKey)`

Force re-execution of a test.

```typescript
const freshData = await relay.rerun<User>('create user');
```

---

## Helper Functions

### `storeTestResult<T>(key, status, data?, error?)`

Store a test result for other tests. Uses generics for type safety.

```typescript
import { storeTestResult } from 'playwright-relay';

interface User {
  id: string;
  name: string;
}

test('create user', async () => {
  const user = await createUser();
  storeTestResult<User>('create user', 'passed', user);
});
```

---

### `getTestResult<T>(key)`

Get a stored test result data.

```typescript
import { getTestResult } from 'playwright-relay';

const user = getTestResult<User>('create user');
// Returns undefined if not found
```

---

### `getTestResultOrThrow<T>(key)`

Get a stored test result or throw if not found/failed.

```typescript
import { getTestResultOrThrow } from 'playwright-relay';

// Throws if 'create user' hasn't run or failed
const user = getTestResultOrThrow<User>('create user');
```

---

### `initializeRelay(config)`

Initialize relay with configuration. **Cache is automatically loaded** when `persistCache` is true.

```typescript
import { initializeRelay } from 'playwright-relay';

initializeRelay({
  persistCache: true,
  cacheFilePath: './cache.json',
  validateDependencies: true,
  hooks: {
    onCacheLoaded: ({ count }) => console.log(`Loaded ${count} results`)
  }
});
```

---

### `validateDependencies(testFiles)`

Validate all `@depends` annotations before running tests.

```typescript
import { validateDependencies } from 'playwright-relay';

const testFiles = ['./tests/auth.spec.ts', './tests/profile.spec.ts'];
const result = validateDependencies(testFiles);

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`${error.testKey}: ${error.message}`);
  }
}
```

---

### `validateDependenciesOrThrow(testFiles)`

Validate dependencies and throw descriptive error if any are invalid.

```typescript
import { validateDependenciesOrThrow } from 'playwright-relay';

// Throws if dependencies are invalid - good for CI
validateDependenciesOrThrow(['./tests/**/*.spec.ts']);
```

---

### `withRelay(config)`

Wrap Playwright config with relay options.

```typescript
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  testDir: './tests',
  relay: {
    dependencyTimeout: 60000,
    persistCache: true, // Auto-loads cache on startup
  }
}));
```

---

### `clearJsDocCache()`

Clear the JSDoc dependencies cache. Useful for testing or when source files change.

```typescript
import { clearJsDocCache } from 'playwright-relay';

clearJsDocCache();
```

---

### `relayTest(title, fn)`

Alternative test wrapper with auto-storage.

```typescript
import { relayTest } from 'playwright-relay';

relayTest('create user', async ({ api }) => {
  const user = await api.createUser();
  return user; // automatically stored
});
```

---

## Types

### `Relay`

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

### `TestStatus`

```typescript
type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
```

### `RelayConfig`

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

### `LifecycleHooks`

```typescript
interface LifecycleHooks {
  onStoreInit?: () => void | Promise<void>;
  onBeforeTest?: (data: { testKey: string; dependencies: DependencyDefinition[] }) => void | Promise<void>;
  onAfterTest?: (data: { testKey: string; status: TestStatus; data?: unknown }) => void | Promise<void>;
  onDependencyResolved?: (data: { testKey: string; dependency: string; data?: unknown }) => void | Promise<void>;
  onDependencyFailed?: (data: { testKey: string; dependency: string; error: Error }) => void | Promise<void>;
  onCacheLoaded?: (data: { count: number }) => void | Promise<void>;
  onCacheSaved?: (data: { count: number }) => void | Promise<void>;
}
```

### `DependencyValidationResult`

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

### `TestResult<T>`

```typescript
interface TestResult<T = unknown> {
  status: TestStatus;
  data?: T;
  error?: Error;
  timestamp: number;
}
```
