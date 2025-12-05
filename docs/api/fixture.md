# relay Fixture

The `relay` fixture provides access to data from other tests within your tests.

## Usage

```typescript
import { test, expect } from 'playwright-relay';

/**
 * @depends create user
 */
test('example', async ({ relay }) => {
  const user = relay.from('create user');
  console.log(user);
});
```

## Methods

### `from<T>(testKey)`

Get data from an executed test synchronously.

```typescript
const user = relay.from<User>('create user');
```

**Parameters:**

- `testKey` - Test title or `"file.spec.ts > title"` for cross-file

**Returns:** The stored data

**Throws:** If test hasn't executed or failed

---

### `require<T>(testKey)`

Get data, executing the dependency if needed.

```typescript
const user = await relay.require<User>('create user');
```

**Parameters:**

- `testKey` - Test title or `"file.spec.ts > title"`

**Returns:** Promise with the data

---

### `hasRun(testKey)`

Check if a test has completed.

```typescript
if (relay.hasRun('create user')) {
  const user = relay.from('create user');
}
```

**Returns:** `boolean`

---

### `status(testKey)`

Get current test status.

```typescript
const status = relay.status('create user');
// 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
```

---

### `all()`

Get all cached results.

```typescript
const results = relay.all();
// Returns: Map<string, unknown>
```

---

### `rerun<T>(testKey)`

Force re-execution of a test.

```typescript
const freshData = await relay.rerun<User>('create user');
```

---

## Example with Types

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * @depends create user
 */
test('update user', async ({ relay, api }) => {
  const user = relay.from<User>('create user');
  
  // Full type safety
  await api.patch(`/users/${user.id}`, {
    name: 'Updated Name'
  });
});
```
