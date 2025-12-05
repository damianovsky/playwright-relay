# Configuration Options

## Full Configuration Example

```typescript
import { defineConfig } from '@playwright/test';
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  // Playwright config
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
}, {
  // Relay config
  dependencyTimeout: 60000,
  onDependencyFailure: 'skip',
  persistCache: false,
  cacheFilePath: './test-results/relay-cache.json',
  validateDependencies: false,
  
  hooks: {
    onStoreInit: () => console.log('Store initialized'),
    onBeforeTest: ({ testKey }) => console.log(`Starting ${testKey}`),
    onAfterTest: ({ testKey, status }) => console.log(`${testKey}: ${status}`),
    onCacheLoaded: ({ count }) => console.log(`Loaded ${count} results`),
    onCacheSaved: ({ count }) => console.log(`Saved ${count} results`),
  },
}));
```

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dependencyTimeout` | `number` | `60000` | Max time (ms) to wait for a dependency |
| `onDependencyFailure` | `string` | `'skip'` | Action when dependency fails: `skip` or `fail` |
| `persistCache` | `boolean` | `false` | Keep cached results between test runs |
| `cacheFilePath` | `string` | `<tmpdir>/...` | Custom path for cache file |
| `validateDependencies` | `boolean` | `false` | Validate `@depends` annotations before running |

---

## `dependencyTimeout`

Maximum time (ms) to wait for a dependency to execute.

```typescript
relay: {
  dependencyTimeout: 30000 // 30 seconds
}
```

---

## `onDependencyFailure`

What to do when a dependency fails.

| Value | Description |
|-------|-------------|
| `'skip'` | Skip dependent tests (mark as skipped) |
| `'fail'` | Fail dependent tests with error |

```typescript
relay: {
  onDependencyFailure: 'fail'
}
```

---

## `persistCache`

Keep cached results between test runs. When enabled, cache is **automatically loaded** on startup.

```typescript
relay: {
  persistCache: true
}
```

---

## `cacheFilePath`

Custom path for the cache file.

```typescript
relay: {
  persistCache: true,
  cacheFilePath: './test-results/relay-cache.json'
}
```

---

## `validateDependencies`

Validate all `@depends` annotations before running tests.

```typescript
relay: {
  validateDependencies: true
}
```

When enabled, validation errors will look like:

```
Dependency validation failed:
  - auth.spec.ts > get profile: Dependency "nonexistent.spec.ts > login" not found.
```

---

## Lifecycle Hooks

```typescript
relay: {
  hooks: {
    onStoreInit: () => void | Promise<void>;
    onBeforeTest: ({ testKey, dependencies }) => void | Promise<void>;
    onAfterTest: ({ testKey, status, data }) => void | Promise<void>;
    onDependencyResolved: ({ testKey, dependency, data }) => void | Promise<void>;
    onDependencyFailed: ({ testKey, dependency, error }) => void | Promise<void>;
    onCacheLoaded: ({ count }) => void | Promise<void>;
    onCacheSaved: ({ count }) => void | Promise<void>;
  }
}
```

---

## Environment Variables

### `PLAYWRIGHT_RELAY_STORE_PATH`

Override the cache file path via environment variable.

```bash
PLAYWRIGHT_RELAY_STORE_PATH=./shared-cache.json npx playwright test
```

---

## Best Practices

### Single Worker Mode

For consistent dependency ordering, use single worker:

```typescript
export default defineConfig(withRelay({
  workers: 1,
  fullyParallel: false,
}));
```

### Serial Execution

Or use serial mode for test files with dependencies:

```typescript
// In your test file
test.describe.configure({ mode: 'serial' });
```
