# Basic Patterns

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

// Level 3 - depends on Level 2
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
  console.log(user.email);    // ✓
  console.log(product.price); // ✓
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
