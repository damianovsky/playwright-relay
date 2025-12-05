<p align="center">
  <h1 align="center">playwright-relay</h1>
  <p align="center">
    Pass data between Playwright tests using <code>@depends</code> annotations
  </p>
  <p align="center">
    <a href="https://github.com/damianovsky/playwright-relay/releases"><img src="https://img.shields.io/github/v/release/damianovsky/playwright-relay?include_prereleases" alt="GitHub release"></a>
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
- 📊 **Dependency Graph** - Visualize test dependencies with Mermaid diagrams

## Installation

```bash
npm install playwright-relay
```

## Quick Start

### 1. Import from playwright-relay

```typescript
// Replace your Playwright imports
import { test, expect, storeTestResult } from 'playwright-relay';
```

### 2. Create a test that produces data

```typescript
test('create user', async ({ api }) => {
  const user = await api.createUser({ name: 'John' });
  storeTestResult('create user', 'passed', user);
});
```

### 3. Create a dependent test

```typescript
/**
 * @depends create user
 */
test('update user', async ({ relay, api }) => {
  const user = relay.from('create user');
  await api.updateUser(user.id, { name: 'Jane' });
});
```

## Configuration

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

## API Reference

### `relay` Fixture

```typescript
interface Relay {
  from<T>(testKey: string): T;           // Get data synchronously
  require<T>(testKey: string): Promise<T>; // Get data, run if needed
  hasRun(testKey: string): boolean;      // Check if test completed
  status(testKey: string): TestStatus;   // Get test status
  all(): Map<string, unknown>;           // Get all cached results
}
```

### Dependency Sources

| Source | Example | Auto-detected |
|--------|---------|---------------|
| JSDoc comments | `/** @depends create user */` | ✅ Yes |
| Playwright annotations | `test.info().annotations` | ✅ Yes |
| `relay.require()` | `await relay.require('test')` | At runtime |

## Dependency Graph

Visualize your test dependencies:

```bash
# Mermaid diagram
npx playwright-relay graph "tests/**/*.spec.ts"

# ASCII diagram
npx playwright-relay graph "tests/**/*.spec.ts" --format ascii

# Interactive HTML
npx playwright-relay graph "tests/**/*.spec.ts" --format html --output graph.html
```

## Documentation

📖 **[Full Documentation](https://damianovsky.github.io/playwright-relay)**
