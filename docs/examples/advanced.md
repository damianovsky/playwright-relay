# Advanced Patterns

## Cross-File Dependencies

Reference tests from other files using the format: `filename.spec.ts > test name`

### Format

```
@depends <filename.spec.ts> > <test title>
```

### Example

```typescript
// tests/auth.spec.ts
import { test, storeTestResult } from 'playwright-relay';

test('login', async ({ api }) => {
  const session = await api.post('/auth/login', {
    email: 'test@example.com',
    password: 'password'
  });
  
  storeTestResult('login', 'passed', session);
});
```

```typescript
// tests/profile.spec.ts
import { test, expect } from 'playwright-relay';

/**
 * @depends auth.spec.ts > login
 */
test('get profile', async ({ relay, api }) => {
  const session = relay.from('auth.spec.ts > login');
  
  const profile = await api.get('/profile', {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  
  expect(profile.email).toBe('test@example.com');
});
```

### Important Notes

- Both files must be included in the same test run
- Use the exact filename (not path): `auth.spec.ts`, not `tests/auth.spec.ts`

### Common Mistakes

```typescript
// ❌ Wrong - using path instead of filename
/** @depends tests/auth.spec.ts > login */

// ❌ Wrong - missing filename for cross-file deps  
/** @depends login */  // Only works for same-file dependencies

// ❌ Wrong - wrong separator
/** @depends auth.spec.ts: login */  // Use " > " not ":"

// ✅ Correct
/** @depends auth.spec.ts > login */
```

---

## Three Ways to Declare Dependencies

### 1. JSDoc Comments (Recommended)

```typescript
/**
 * @depends create user
 * @depends create product
 */
test('create order', async ({ relay }) => {
  const user = relay.from('create user');
  const product = relay.from('create product');
});
```

### 2. Playwright Annotations

Useful when you need to add dependencies programmatically:

```typescript
test('create order', async ({ relay }, testInfo) => {
  testInfo.annotations.push(
    { type: 'depends', description: 'create user' },
    { type: 'depends', description: 'create product' }
  );
  
  const user = relay.from('create user');
  const product = relay.from('create product');
});
```

### 3. relay.require() - Dynamic Dependencies

Execute a dependency on-demand:

```typescript
test('create order', async ({ relay }) => {
  // Will execute 'create user' if not already run
  const user = await relay.require('create user');
  const product = await relay.require('create product');
});
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
    cacheFilePath: './test-results/relay-cache.json',
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

---

## Fuzzy Matching

The relay supports **fuzzy matching** for cross-file dependencies. If a test is stored with a prefix, you don't need to include it:

```typescript
// setup.spec.ts
test('[setup] create user', async ({ api }) => {
  const user = await api.createUser();
  storeTestResult('[setup] create user', 'passed', user);
});

// api.spec.ts - @depends without prefix works!
/**
 * @depends setup.spec.ts > create user
 */
test('update user', async ({ relay }) => {
  // This finds "[setup] create user" automatically
  const user = relay.from('setup.spec.ts > create user');
});
```

---

## Lifecycle Hooks

Monitor and debug dependency resolution:

```typescript
export default defineConfig(withRelay({
  relay: {
    hooks: {
      onBeforeTest: ({ testKey, dependencies }) => {
        console.log(`Starting ${testKey}`);
        console.log(`Dependencies: ${dependencies.map(d => d.fullKey).join(', ')}`);
      },
      
      onDependencyResolved: ({ testKey, dependency, data }) => {
        console.log(`✓ ${testKey} resolved ${dependency}`);
      },
      
      onDependencyFailed: ({ testKey, dependency, error }) => {
        console.error(`✗ ${testKey} dependency ${dependency} failed`);
        console.error(error.message);
      },
    }
  }
}));
```

---

## Validation in CI

Validate dependencies before running tests:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { withRelay, validateDependenciesOrThrow } from 'playwright-relay';

// Validate on startup
validateDependenciesOrThrow(['./tests/**/*.spec.ts']);

export default defineConfig(withRelay({
  testDir: './tests',
}));
```

Or enable in config:

```typescript
export default defineConfig(withRelay({
  relay: {
    validateDependencies: true, // Throws on invalid @depends
  }
}));
```
