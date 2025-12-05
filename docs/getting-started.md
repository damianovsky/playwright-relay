# Getting Started

## Installation

```bash
npm install playwright-relay
```

## Basic Usage

### 1. Import from playwright-relay

Replace your Playwright imports:

```typescript
// Before
import { test, expect } from '@playwright/test';

// After
import { test, expect, storeTestResult } from 'playwright-relay';
```

### 2. Create a test that produces data

```typescript
test('create account', async ({ api }) => {
  const account = await api.createAccount({
    name: 'Test Account',
    email: 'test@example.com'
  });
  
  // Store the result for other tests
  storeTestResult('create account', 'passed', account);
});
```

### 3. Create a dependent test

Use the `@depends` annotation in a JSDoc comment:

```typescript
/**
 * @depends create account
 */
test('update account', async ({ relay, api }) => {
  // Get data from the dependency
  const account = relay.from('create account');
  
  await api.updateAccount(account.id, {
    name: 'Updated Name'
  });
});
```

## How It Works

1. **Automatic JSDoc parsing** - Dependencies are read from `@depends` comments automatically
2. **Data caching** - Each test runs once, results are cached
3. **Relay fixture** - Access cached data via the `relay` fixture

### Dependency Sources

playwright-relay reads dependencies from three sources (in order of priority):

| Source | Example | Auto-detected |
|--------|---------|---------------|
| JSDoc comments | `/** @depends create user */` | ✅ Yes |
| Playwright annotations | `test.info().annotations` | ✅ Yes |
| `relay.require()` | `await relay.require('test')` | At runtime |

```
┌──────────────────┐
│  create account  │ ─── runs first, stores data
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  update account  │ ─── runs second, uses data
└──────────────────┘
```

## Configuration (Optional)

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  testDir: './tests',
  
  relay: {
    dependencyTimeout: 60000,    // Timeout for dependencies
    onDependencyFailure: 'skip', // 'skip' or 'fail'
    persistCache: false          // Cache between runs
  }
}));
```

## Next Steps

- [API Reference](api.md) - Full API documentation
- [Examples](examples.md) - Real-world patterns
- [Configuration](configuration.md) - All options
