# Configuration

## Basic Setup

Wrap your Playwright config with `withRelay`:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  testDir: './tests',
  
  relay: {
    dependencyTimeout: 60000,
    onDependencyFailure: 'skip',
    persistCache: false
  }
}));
```

---

## Options

### `dependencyTimeout`

Maximum time (ms) to wait for a dependency to execute.

| Type | Default |
|------|---------|
| `number` | `60000` |

```typescript
relay: {
  dependencyTimeout: 30000 // 30 seconds
}
```

---

### `onDependencyFailure`

What to do when a dependency fails.

| Type | Default | Options |
|------|---------|---------|
| `string` | `'skip'` | `'skip'`, `'fail'` |

**`'skip'`** - Skip dependent tests (mark as skipped)

```typescript
relay: {
  onDependencyFailure: 'skip'
}
```

**`'fail'`** - Fail dependent tests with error

```typescript
relay: {
  onDependencyFailure: 'fail'
}
```

---

### `persistCache`

Keep cached results between test runs. Useful in watch mode.

| Type | Default |
|------|---------|
| `boolean` | `false` |

```typescript
relay: {
  persistCache: true // Keep cache in watch mode
}
```

---

## Best Practices

### 1. Single Worker

For consistent dependency ordering, use single worker:

```typescript
export default defineConfig(withRelay({
  workers: 1,
  fullyParallel: false,
  
  relay: { ... }
}));
```

### 2. Serial Execution

Or use serial mode for test files with dependencies:

```typescript
// In your test file
test.describe.configure({ mode: 'serial' });
```

### 3. Explicit Dependencies

Always declare dependencies explicitly:

```typescript
// ✓ Good - explicit dependency
/**
 * @depends create user
 */
test('update user', async ({ relay }) => {
  const user = relay.from('create user');
});

// ✗ Bad - implicit assumption
test('update user', async ({ relay }) => {
  const user = relay.from('create user'); // May fail!
});
```

### 4. Type Safety

Use generics for type safety:

```typescript
interface User {
  id: string;
  name: string;
}

const user = relay.from<User>('create user');
// user.id is typed as string
```
