# Examples

## CRUD Operations

A common pattern: create → read → update → delete.

```typescript
import { test, expect, storeTestResult } from 'playwright-relay';

test.describe('User CRUD', () => {
  
  test('create user', async ({ api }) => {
    const user = await api.post('/users', {
      name: 'John Doe',
      email: 'john@example.com'
    });
    
    expect(user.id).toBeDefined();
    storeTestResult('create user', 'passed', user);
  });

  /**
   * @depends create user
   */
  test('read user', async ({ relay, api }) => {
    const user = relay.from('create user');
    
    const fetched = await api.get(`/users/${user.id}`);
    expect(fetched.name).toBe('John Doe');
  });

  /**
   * @depends create user
   */
  test('update user', async ({ relay, api }) => {
    const user = relay.from('create user');
    
    const updated = await api.patch(`/users/${user.id}`, {
      name: 'Jane Doe'
    });
    
    expect(updated.name).toBe('Jane Doe');
    storeTestResult('update user', 'passed', updated);
  });

  /**
   * @depends create user
   */
  test('delete user', async ({ relay, api }) => {
    const user = relay.from('create user');
    
    await api.delete(`/users/${user.id}`);
    
    const response = await api.get(`/users/${user.id}`);
    expect(response.status).toBe(404);
  });
});
```

---

## Multiple Dependencies

Tests can depend on multiple other tests.

```typescript
/**
 * @depends create user
 * @depends create product
 */
test('create order', async ({ relay, api }) => {
  const user = relay.from('create user');
  const product = relay.from('create product');
  
  const order = await api.post('/orders', {
    userId: user.id,
    productId: product.id,
    quantity: 1
  });
  
  expect(order.total).toBe(product.price);
});
```

---

## Cross-File Dependencies

Reference tests from other files using the format: `filename.spec.ts > test name`

> **Important**: For cross-file dependencies to work:
> 1. Both files must be included in the same test run
> 2. Use the exact filename (not path): `auth.spec.ts`, not `tests/auth.spec.ts`

### Format

```
@depends <filename.spec.ts> > <test title>
```

### Fuzzy Matching

The relay supports **fuzzy matching** for cross-file dependencies. If a test is stored with a prefix (like `[setup]`), you don't need to include the prefix in the `@depends` annotation:

```typescript
// setup.spec.ts - test stored with prefix
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
 * Cross-file dependency format: "filename.spec.ts > test name"
 * @depends auth.spec.ts > login
 */
test('get profile', async ({ relay, api }) => {
  // Use the same format to retrieve the data
  const session = relay.from('auth.spec.ts > login');
  
  const profile = await api.get('/profile', {
    headers: { Authorization: `Bearer ${session.token}` }
  });
  
  expect(profile.email).toBe('test@example.com');
});
```

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

### Same-File Dependencies

For dependencies within the same file, you can use just the test title:

```typescript
// tests/user.spec.ts

test('create user', async () => {
  // ...
});

/** @depends create user */  // No filename needed for same file
test('update user', async ({ relay }) => {
  const user = relay.from('create user');
});
```

---

## Dependency Chains

Tests can chain multiple levels deep.

```typescript
// Level 1
test('create organization', async ({ api }) => {
  const org = await api.post('/orgs', { name: 'Acme Inc' });
  storeTestResult('create organization', 'passed', org);
});

// Level 2 - depends on Level 1
/**
 * @depends create organization
 */
test('create team', async ({ relay, api }) => {
  const org = relay.from('create organization');
  
  const team = await api.post(`/orgs/${org.id}/teams`, {
    name: 'Engineering'
  });
  
  storeTestResult('create team', 'passed', team);
});

// Level 3 - depends on Level 2 (which depends on Level 1)
/**
 * @depends create team
 */
test('add team member', async ({ relay, api }) => {
  const team = relay.from('create team');
  
  await api.post(`/teams/${team.id}/members`, {
    email: 'dev@example.com'
  });
});
```

---

## Three Ways to Declare Dependencies

### 1. JSDoc Comments (Recommended)

The simplest and most common approach. Dependencies are automatically detected:

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

Execute a dependency on-demand (useful for conditional logic):

```typescript
test('create order', async ({ relay }) => {
  // Will execute 'create user' if not already run
  const user = await relay.require('create user');
  const product = await relay.require('create product');
});
```

---

## Conditional Dependencies

Use `hasRun` for optional dependencies.

```typescript
test('cleanup resources', async ({ relay }) => {
  if (relay.hasRun('create user')) {
    const user = relay.from('create user');
    await cleanup(user.id);
  }
  
  if (relay.hasRun('create product')) {
    const product = relay.from('create product');
    await cleanup(product.id);
  }
});
```

---

## TypeScript Types

Type your data for better IDE support.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

/**
 * @depends create user
 * @depends create product
 */
test('typed example', async ({ relay }) => {
  const user = relay.from<User>('create user');
  const product = relay.from<Product>('create product');
  
  // Full type safety
  console.log(user.email);   // ✓
  console.log(product.price); // ✓
});
```
