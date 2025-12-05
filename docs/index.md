# playwright-relay

Pass data between Playwright tests using `@depends` annotations.

## What is it?

**playwright-relay** is a Playwright plugin that allows tests to share data with each other. Instead of duplicating setup code, you can chain tests together - one test creates data, another uses it.

Think of it like PHPUnit's `@depends` annotation, but for Playwright.

## Why use it?

- **Reduce duplication** - Create a resource once, use it in multiple tests
- **Better test organization** - Each test does one thing
- **Faster test runs** - No redundant setup operations
- **Clear dependencies** - Explicit test relationships

## Quick Example

```typescript
import { test, storeTestResult } from 'playwright-relay';

// Test 1: Creates data
test('create user', async ({ api }) => {
  const user = await api.createUser({ name: 'John' });
  storeTestResult('create user', 'passed', user);
});

// Test 2: Uses data from Test 1
/**
 * @depends create user
 */
test('update user', async ({ relay, api }) => {
  const user = relay.from('create user');
  await api.updateUser(user.id, { name: 'Jane' });
});
```

## Installation

```bash
npm install playwright-relay
```

## Next Steps

- [Getting Started](getting-started.md) - Set up your first relay tests
- [API Reference](api.md) - Full API documentation
- [Examples](examples.md) - Real-world usage patterns
