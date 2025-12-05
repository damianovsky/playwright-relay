# playwright-relay

Pass data between Playwright tests using `@depends` annotations.

## What is it?

**playwright-relay** is a Playwright plugin that allows tests to share data with each other. Instead of duplicating setup code, you can chain tests together - one test creates data, another uses it.

Think of it like PHPUnit's `@depends` annotation, but for Playwright.

## Features

- 🔗 **Test Dependencies** - Chain tests with `@depends` annotations
- 📦 **Data Passing** - Return data from one test, use it in another
- 🔄 **Auto-ordering** - Tests run in dependency order automatically
- ⚡ **Cached Results** - Each test runs once, results are cached
- 🎯 **Zero Config** - Works out of the box with Playwright

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

- [Installation](getting-started/installation.md) - Requirements and setup
- [Quick Start](getting-started/quick-start.md) - Get started in 5 minutes
- [Configuration](configuration/options.md) - All configuration options
- [API Reference](api/fixture.md) - Full API documentation
- [Examples](examples/basic.md) - Real-world usage patterns
