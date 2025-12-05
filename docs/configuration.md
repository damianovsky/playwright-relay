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
    persistCache: false,
    validateDependencies: false,
  }
}));
```

## Alternative: Manual Initialization

For more control, use `initializeRelay` directly:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { initializeRelay } from 'playwright-relay';

// Initialize before tests run - cache is auto-loaded when persistCache is true
initializeRelay({
  persistCache: true,
  cacheFilePath: './test-results/relay-cache.json',
  validateDependencies: true,
});

export default defineConfig({
  testDir: './tests',
});
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

Keep cached results between test runs. When enabled, cache is **automatically loaded** on startup.

| Type | Default |
|------|---------|
| `boolean` | `false` |

```typescript
relay: {
  persistCache: true // Auto-loads and saves cache
}
```

> **Note**: With `persistCache: true`, you no longer need to manually call `loadFromFile()` or `setSharedStoreEnabled()`. The cache is loaded automatically when the config is set.

---

### `cacheFilePath`

Custom path for the cache file. By default, cache is stored in the system temp directory.

| Type | Default |
|------|---------|
| `string` | `<tmpdir>/playwright-relay-store.json` |

```typescript
relay: {
  persistCache: true,
  cacheFilePath: './test-results/relay-cache.json'
}
```

---

### `validateDependencies`

Validate all `@depends` annotations before running tests. This catches missing dependencies early.

| Type | Default |
|------|---------|
| `boolean` | `false` |

```typescript
relay: {
  validateDependencies: true
}
```

When enabled, validation errors will look like:

```
Dependency validation failed:
  - auth.spec.ts > get profile: Dependency "nonexistent.spec.ts > login" not found.
    Cross-file dependency format: "nonexistent.spec.ts > login". Make sure the file exists.

Tip: For cross-file dependencies, use format: "@depends otherfile.spec.ts > test name"
```

---

### `hooks`

Lifecycle hooks for monitoring and debugging.

```typescript
relay: {
  hooks: {
    onStoreInit: () => console.log('Store initialized'),
    onBeforeTest: ({ testKey, dependencies }) => {
      console.log(`Starting ${testKey} with deps:`, dependencies);
    },
    onAfterTest: ({ testKey, status, data }) => {
      console.log(`${testKey}: ${status}`, data);
    },
    onDependencyResolved: ({ testKey, dependency, data }) => {
      console.log(`${testKey} resolved ${dependency}`);
    },
    onDependencyFailed: ({ testKey, dependency, error }) => {
      console.error(`${testKey} dependency ${dependency} failed:`, error);
    },
    onCacheLoaded: ({ count }) => {
      console.log(`Loaded ${count} cached results`);
    },
    onCacheSaved: ({ count }) => {
      console.log(`Saved ${count} results to cache`);
    },
  }
}
```

---

## Environment Variables

### `PLAYWRIGHT_RELAY_STORE_PATH`

Override the cache file path via environment variable. Useful for CI/CD and Playwright projects.

```bash
PLAYWRIGHT_RELAY_STORE_PATH=./shared-cache.json npx playwright test
```

---

## Playwright Projects Integration

When using Playwright's `projects` with `dependencies`, use a shared cache file:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  relay: {
    persistCache: true,
    cacheFilePath: './test-results/relay-cache.json', // Shared between projects
  },
  
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'tests',
      dependencies: ['setup'],
      testMatch: /.*\.spec\.ts/,
    },
  ],
}));
```

Or use the environment variable:

```bash
# Ensures all Playwright projects share the same cache
PLAYWRIGHT_RELAY_STORE_PATH=./shared-cache.json npx playwright test
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

Always declare dependencies explicitly using one of these methods:

```typescript
// ✓ Best - JSDoc comment (auto-parsed)
/**
 * @depends create user
 */
test('update user', async ({ relay }) => {
  const user = relay.from('create user');
});

// ✓ Good - Playwright annotation
test('update user', async ({ relay }, testInfo) => {
  testInfo.annotations.push({ type: 'depends', description: 'create user' });
  const user = relay.from('create user');
});

// ✓ Good - relay.require() for dynamic dependencies
test('update user', async ({ relay }) => {
  const user = await relay.require('create user');
});

// ✗ Bad - implicit assumption (no dependency declared)
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
