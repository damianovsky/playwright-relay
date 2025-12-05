# Architecture

This document explains how playwright-relay works internally, including the data flow, component interactions, and key design decisions.

## Overview

playwright-relay consists of several interconnected modules that work together to enable test dependencies:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test File (.spec.ts)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  /**                                                     │    │
│  │   * @depends create user                                 │    │
│  │   */                                                     │    │
│  │  test('update user', async ({ relay }) => {              │    │
│  │    const user = relay.from('create user');               │    │
│  │  });                                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Parser                                  │
│  • Extracts @depends annotations from JSDoc comments            │
│  • Parses cross-file references (file.spec.ts > test name)      │
│  • Caches parsed results per file                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Relay Fixture                               │
│  • Injected into each test via Playwright fixtures              │
│  • Provides from(), require(), status(), hasRun() methods       │
│  • Orchestrates dependency execution                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Result Store                               │
│  • In-memory cache for test results                             │
│  • Shared file store for cross-process communication            │
│  • Tracks status: pending | running | passed | failed | skipped │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Executor                                  │
│  • Handles cross-file dependency execution                      │
│  • Spawns Playwright subprocess for external test files         │
│  • Manages dependency resolution order                          │
└─────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Parser (`src/parser.ts`)

The parser is responsible for extracting dependency information from test source files.

**Key Functions:**

- `parseTestSource(source)` - Parses a test file and returns a map of test titles to their dependencies
- `parseDependsAnnotations(comment)` - Extracts `@depends` values from a JSDoc comment
- `parseDependsValue(value)` - Parses a single dependency value, handling cross-file references

**How it works:**

1. Uses regex to find all `test('title', ...)` calls in the source
2. For each test, looks for the immediately preceding JSDoc comment
3. Extracts any `@depends` annotations from that comment
4. Returns a `Map<testTitle, DependencyDefinition[]>`

```typescript
// Input source
/**
 * @depends create user
 * @depends auth.spec.ts > login
 */
test('update profile', async ({ relay }) => { ... });

// Output
Map {
  'update profile' => [
    { testTitle: 'create user', fullKey: 'create user' },
    { testTitle: 'login', file: 'auth.spec.ts', fullKey: 'auth.spec.ts > login' }
  ]
}
```

**Important:** The parser only captures comments **immediately before** a test declaration. Comments separated by blank lines or other code are not associated with the test.

---

### 2. Result Store (`src/store.ts`)

The result store is a singleton that caches test results during a test run.

**Data Structure:**

```typescript
interface TestResult<T = unknown> {
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  data?: T;           // Result data from storeTestResult()
  error?: Error;      // Error if test failed
  timestamp: number;  // When the result was recorded
}
```

**Key Features:**

- **In-memory storage** - Fast access during test execution
- **Shared file storage** - For cross-process communication (cross-file dependencies)
- **Multiple key lookup** - Results can be found by test title or `file > title` format

**Shared Store:**

When executing cross-file dependencies, the store uses a temporary JSON file (`/tmp/playwright-relay-store.json`) to share results between the main Playwright process and subprocess:

```
Main Process                    Subprocess
     │                              │
     │  writes to shared file       │
     │ ─────────────────────────────>
     │                              │
     │                         executes test
     │                              │
     │  reads from shared file      │
     │ <─────────────────────────────
     │                              │
```

---

### 3. Relay Fixture (`src/relay.ts`)

The relay is injected into tests via Playwright's fixture system. It provides the main API for accessing dependency data.

**Methods:**

| Method | Description |
|--------|-------------|
| `from<T>(key)` | Get data from an executed dependency (throws if not found) |
| `require<T>(key)` | Execute dependency if needed, return result |
| `hasRun(key)` | Check if a test has completed |
| `status(key)` | Get current status of a test |
| `all()` | Get all passed results |
| `rerun<T>(key)` | Clear cached result and re-execute |

**Key Normalization:**

The relay normalizes test keys to handle different reference formats:

```typescript
// All of these refer to the same test:
relay.from('create user')
relay.from('users.spec.ts > create user')

// Internally normalized to try multiple keys:
['create user', 'users.spec.ts > create user']
```

---

### 4. Test Extension (`src/test.ts`)

This module extends Playwright's `test` with the relay fixture and dependency handling.

**Lifecycle:**

```
beforeEach
    │
    ├─► Mark test as 'running' in store
    │
    ├─► Parse JSDoc dependencies from source file
    │
    ├─► Merge with Playwright annotation dependencies
    │
    ├─► Execute all dependencies (if not already executed)
    │
    ├─► Check dependency statuses:
    │   ├─ If any 'failed' → skip or fail test
    │   └─ If any 'pending' → skip or fail test
    │
    └─► Inject relay fixture into test

test execution
    │
    └─► Test uses relay.from() to access dependency data

afterEach
    │
    └─► Store final test status in result store
```

**Dependency Validation:**

Before a test runs, all its dependencies are validated:

```typescript
for (const dep of deps) {
  const status = relay.status(dep.fullKey);
  
  if (status === 'failed') {
    // Dependency failed - skip or fail this test
  }
  
  if (status === 'pending') {
    // Dependency never ran - skip or fail this test
    // This happens with cross-file deps when the file wasn't included
  }
}
```

---

### 5. Executor (`src/executor.ts`)

The executor handles running dependencies, especially cross-file dependencies.

**Same-File Dependencies:**

For dependencies in the same file, tests are simply executed in order by Playwright. The result store tracks which tests have run.

**Cross-File Dependencies:**

When a test depends on a test in another file:

1. Check if the dependency has already been executed
2. If not, spawn a Playwright subprocess to run just that test:

```bash
npx playwright test "other-file.spec.ts" --grep "test name" --reporter=json
```

3. Parse the subprocess output for results
4. Store results in shared file store
5. Main process reads results and continues

**Subprocess Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ Main Playwright Process                                      │
│                                                              │
│  test('my test', async ({ relay }) => {                     │
│    // @depends other.spec.ts > setup                        │
│    │                                                         │
│    └──► executeDependency('other.spec.ts > setup')          │
│         │                                                    │
│         ├─► Check result store (not found)                  │
│         │                                                    │
│         └─► executeFileViaPlaywright('other.spec.ts')       │
│              │                                               │
│              └─► spawn: npx playwright test other.spec.ts   │
│                   --grep "setup" --reporter=json            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Subprocess (PLAYWRIGHT_RELAY_SUBPROCESS=true)               │
│                                                              │
│  • Loads shared store from temp file                        │
│  • Executes 'setup' test                                    │
│  • Stores result with storeTestResult()                     │
│  • Writes to shared store file                              │
│  • Exits                                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Main Process (continued)                                     │
│                                                              │
│  • Reads shared store file                                  │
│  • Gets 'setup' result                                      │
│  • Continues with 'my test'                                 │
│  • relay.from('other.spec.ts > setup') works!               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete Example

```typescript
// auth.spec.ts
test('login', async ({ api }) => {
  const session = await api.login('user', 'pass');
  storeTestResult('login', 'passed', session);
});

// profile.spec.ts
/**
 * @depends auth.spec.ts > login
 */
test('update profile', async ({ relay, api }) => {
  const session = relay.from('auth.spec.ts > login');
  await api.updateProfile(session.token, { name: 'New Name' });
});
```

**Execution Flow:**

```
1. Playwright starts profile.spec.ts

2. Test fixture initializes:
   - Parser reads profile.spec.ts
   - Finds: 'update profile' depends on 'auth.spec.ts > login'

3. Dependency execution:
   - Check store for 'auth.spec.ts > login' → not found
   - Executor spawns: npx playwright test auth.spec.ts --grep "login"

4. Subprocess runs auth.spec.ts:
   - 'login' test executes
   - storeTestResult() saves session to store
   - Store writes to /tmp/playwright-relay-store.json

5. Back in main process:
   - Reads shared store file
   - Finds 'login' with status 'passed'
   - Validation passes

6. Test runs:
   - relay.from('auth.spec.ts > login') returns session
   - Test uses session.token
```

---

## Key Design Decisions

### Why JSDoc Comments?

1. **Declarative** - Dependencies are visible without running code
2. **Static analysis** - Can be parsed before test execution
3. **Familiar** - Similar to PHPUnit's `@depends`
4. **IDE support** - JSDoc is recognized by editors

### Why In-Memory + File Store?

- **In-memory** is fast for same-process access
- **File store** enables cross-process sharing without complex IPC
- **Simple** - JSON file is easy to debug and understand

### Why Subprocess for Cross-File?

- **Isolation** - Each file runs in proper Playwright context
- **Fixtures** - Subprocess gets all Playwright fixtures (page, context, etc.)
- **Reliability** - Uses Playwright's own test runner

### Limitations

1. **Cross-file performance** - Spawning subprocess adds overhead
2. **Data serialization** - Only JSON-serializable data can be shared cross-file
3. **Parallel execution** - Cross-file deps may cause race conditions in parallel mode

---

## Module Dependencies

```
src/index.ts          ─── exports public API
    │
    ├── src/test.ts   ─── test fixture, extends Playwright
    │       │
    │       ├── src/relay.ts    ─── relay implementation
    │       │       │
    │       │       └── src/store.ts   ─── result storage
    │       │
    │       ├── src/parser.ts   ─── JSDoc parsing
    │       │
    │       └── src/executor.ts ─── dependency execution
    │               │
    │               ├── src/store.ts
    │               └── src/parser.ts
    │
    └── src/types.ts  ─── TypeScript interfaces
```

---

## Configuration

The relay behavior can be configured via `withRelay()`:

```typescript
export default defineConfig(withRelay({
  // Playwright config...
  
  relay: {
    // Max time to wait for a dependency to complete
    dependencyTimeout: 60000,
    
    // What to do when dependency fails: 'skip' or 'fail'
    onDependencyFailure: 'skip',
    
    // Keep results between test runs (experimental)
    persistCache: false,
  }
}));
```

See [Configuration](configuration.md) for details.
