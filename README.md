<p align="center">
  <h1 align="center">playwright-relay</h1>
  <p align="center">
    Pass data between Playwright tests using <code>@depends</code> annotations
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/playwright-relay"><img src="https://img.shields.io/npm/v/playwright-relay.svg" alt="npm version"></a>
    <a href="https://github.com/damianovsky/playwright-relay/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/playwright-relay.svg" alt="license"></a>
  </p>
</p>

---

## Features

- 🔗 **Test Dependencies** - Chain tests with `@depends` annotations
- 📦 **Data Passing** - Return data from one test, use it in another  
- 🔄 **Auto-ordering** - Tests run in dependency order automatically
- ⚡ **Cached Results** - Each test runs once, results are cached
- 🎯 **Zero Config** - Works out of the box with Playwright

## Installation

```bash
npm install playwright-relay
```

## Quick Start

```typescript
import { test, expect, storeTestResult } from 'playwright-relay';

// Test that produces data
test('create user', async ({ api }) => {
  const user = await api.createUser({ name: 'John' });
  storeTestResult('create user', 'passed', user);
});

// Test that consumes data
/**
 * @depends create user
 */
test('update user', async ({ relay, api }) => {
  const user = relay.from('create user');
  await api.updateUser(user.id, { name: 'Jane' });
});
```

## Documentation

📖 **[Full Documentation](./docs/index.md)**

## License

MIT
