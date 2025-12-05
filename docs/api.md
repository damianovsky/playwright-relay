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

### `storeTestResult(key, status, data?, error?)`

Store a test result for other tests.

```typescript
import { storeTestResult } from 'playwright-relay';

test('create user', async () => {
  const user = await createUser();
  storeTestResult('create user', 'passed', user);
});
```

---

### `withRelay(config)`

Wrap Playwright config with relay options.

```typescript
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  testDir: './tests',
  relay: {
    dependencyTimeout: 60000
  }
}));
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
}
```
