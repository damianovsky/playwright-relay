# Quick Start

## 1. Configure Playwright

Update your `playwright.config.ts` to include Relay:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { withRelay } from 'playwright-relay';

export default defineConfig(withRelay({
  testDir: './tests',
}, {
  // Relay options (all optional)
  dependencyTimeout: 60000,
  onDependencyFailure: 'skip',
  persistCache: false,
}));
```

## 2. Import from playwright-relay

Replace your Playwright imports:

```typescript
// Before
import { test, expect } from '@playwright/test';

// After
import { test, expect, storeTestResult } from 'playwright-relay';
```

## 3. Create a Test That Produces Data

```typescript
test('create user', async ({ api }) => {
  const user = await api.post('/users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  
  // Store the result for other tests
  storeTestResult('create user', 'passed', user);
});
```

## 4. Create a Dependent Test

Use the `@depends` annotation in a JSDoc comment:

```typescript
/**
 * @depends create user
 */
test('update user', async ({ relay, api }) => {
  // Get data from the dependency
  const user = relay.from('create user');
  
  await api.patch(`/users/${user.id}`, {
    name: 'Jane Doe'
  });
});
```

## 5. Run Tests

```bash
npx playwright test
```

## How It Works

```
┌──────────────────┐
│   create user    │ ─── runs first, stores data
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   update user    │ ─── runs second, uses data
└──────────────────┘
```

1. **Automatic JSDoc parsing** - Dependencies are read from `@depends` comments automatically
2. **Data caching** - Each test runs once, results are cached
3. **Relay fixture** - Access cached data via the `relay` fixture

## Next Steps

- [Configuration Options](../configuration/options.md)
- [API Reference](../api/fixture.md)
- [Examples](../examples/basic.md)
