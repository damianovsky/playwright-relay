# Helper Functions

## `storeTestResult<T>(key, status, data?, error?)`

Store a test result for other tests.

```typescript
import { storeTestResult } from 'playwright-relay';

test('create user', async () => {
  const user = await createUser();
  storeTestResult('create user', 'passed', user);
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `string` | Yes | Test identifier |
| `status` | `TestStatus` | Yes | `'passed'`, `'failed'`, `'skipped'` |
| `data` | `T` | No | Data to store |
| `error` | `Error` | No | Error if failed |

---

## `getTestResult<T>(key)`

Get a stored test result data.

```typescript
import { getTestResult } from 'playwright-relay';

const user = getTestResult<User>('create user');
// Returns undefined if not found
```

---

## `getTestResultOrThrow<T>(key)`

Get a stored test result or throw if not found/failed.

```typescript
import { getTestResultOrThrow } from 'playwright-relay';

// Throws if 'create user' hasn't run or failed
const user = getTestResultOrThrow<User>('create user');
```

---

## `initializeRelay(config)`

Initialize relay with configuration. Called automatically by `withRelay()`.

```typescript
import { initializeRelay } from 'playwright-relay';

initializeRelay({
  persistCache: true,
  cacheFilePath: './cache.json',
  validateDependencies: true,
});
```

---

## `withRelay(config)`

Wrap Playwright config with relay options.

```typescript
import { defineConfig } from '@playwright/test';
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  testDir: './tests',
}, {
  dependencyTimeout: 60000,
  persistCache: true,
}));
```

---

## `validateDependencies(testFiles)`

Validate all `@depends` annotations before running tests.

```typescript
import { validateDependencies } from 'playwright-relay';

const result = validateDependencies(['./tests/**/*.spec.ts']);

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`${error.testKey}: ${error.message}`);
  }
}
```

---

## `validateDependenciesOrThrow(testFiles)`

Validate dependencies and throw if any are invalid.

```typescript
import { validateDependenciesOrThrow } from 'playwright-relay';

// Throws if dependencies are invalid - good for CI
validateDependenciesOrThrow(['./tests/**/*.spec.ts']);
```

---

## `clearJsDocCache()`

Clear the JSDoc dependencies cache.

```typescript
import { clearJsDocCache } from 'playwright-relay';

clearJsDocCache();
```

---

## `relayTest(title, fn)`

Alternative test wrapper with auto-storage.

```typescript
import { relayTest } from 'playwright-relay';

relayTest('create user', async ({ api }) => {
  const user = await api.createUser();
  return user; // automatically stored
});
```
