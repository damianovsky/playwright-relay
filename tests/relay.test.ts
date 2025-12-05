import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createRelay, 
  storeTestResult, 
  clearResults,
  registerTest,
  clearTestRegistry,
  setRelayConfig,
  getTestResult,
  getTestResultOrThrow,
  initializeRelay,
  validateDependencies,
  validateDependenciesOrThrow,
} from '../src/relay';
import { resultStore } from '../src/store';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Relay', () => {
  beforeEach(() => {
    clearResults();
    clearTestRegistry();
    setRelayConfig({
      dependencyTimeout: 5000,
      onDependencyFailure: 'skip',
      persistCache: false,
    });
  });

  describe('from', () => {
    it('should return data from executed test', () => {
      const relay = createRelay();
      const testData = { username: 'testuser', password: 'testpass' };
      
      storeTestResult('should create account', 'passed', testData);
      
      const result = relay.from<typeof testData>('should create account');
      
      expect(result).toEqual(testData);
    });

    it('should throw if test has not been executed', () => {
      const relay = createRelay();
      
      expect(() => relay.from('nonexistent test')).toThrow();
    });

    it('should throw if test failed', () => {
      const relay = createRelay();
      
      storeTestResult('failed test', 'failed', undefined, new Error('Test failed'));
      
      expect(() => relay.from('failed test')).toThrow('failed');
    });
  });

  describe('hasRun', () => {
    it('should return true for executed tests', () => {
      const relay = createRelay();
      
      storeTestResult('my test', 'passed');
      
      expect(relay.hasRun('my test')).toBe(true);
    });

    it('should return false for pending tests', () => {
      const relay = createRelay();
      
      expect(relay.hasRun('pending test')).toBe(false);
    });

    it('should return false for running tests', () => {
      const relay = createRelay();
      
      resultStore.set('running test', 'running');
      
      expect(relay.hasRun('running test')).toBe(false);
    });
  });

  describe('status', () => {
    it('should return pending for unknown tests', () => {
      const relay = createRelay();
      
      expect(relay.status('unknown')).toBe('pending');
    });

    it('should return correct status for known tests', () => {
      const relay = createRelay();
      
      storeTestResult('passed test', 'passed');
      storeTestResult('failed test', 'failed');
      resultStore.set('running test', 'running');
      
      expect(relay.status('passed test')).toBe('passed');
      expect(relay.status('failed test')).toBe('failed');
      expect(relay.status('running test')).toBe('running');
    });
  });

  describe('all', () => {
    it('should return all passed results with data', () => {
      const relay = createRelay();
      
      storeTestResult('test1', 'passed', { a: 1 });
      storeTestResult('test2', 'passed', { b: 2 });
      storeTestResult('test3', 'failed');
      
      const all = relay.all();
      
      expect(all.size).toBe(2);
      expect(all.get('test1')).toEqual({ a: 1 });
      expect(all.get('test2')).toEqual({ b: 2 });
    });
  });

  describe('require', () => {
    it('should return cached result if already executed', async () => {
      const relay = createRelay();
      const testData = { value: 42 };
      
      storeTestResult('cached test', 'passed', testData);
      
      const result = await relay.require<typeof testData>('cached test');
      
      expect(result).toEqual(testData);
    });

    it('should execute registered test if not cached', async () => {
      const relay = createRelay();
      const testData = { value: 'created' };
      
      registerTest('new test', async () => testData, []);
      
      const result = await relay.require<typeof testData>('new test');
      
      expect(result).toEqual(testData);
      expect(relay.status('new test')).toBe('passed');
    });

    it('should throw if test not found', async () => {
      const relay = createRelay();
      
      await expect(relay.require('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('rerun', () => {
    it('should clear previous result and re-execute', async () => {
      const relay = createRelay();
      let callCount = 0;
      
      registerTest('rerunnable', async () => {
        callCount++;
        return { count: callCount };
      }, []);
      
      await relay.require('rerunnable');
      expect(callCount).toBe(1);
      
      const result = await relay.rerun<{ count: number }>('rerunnable');
      
      expect(callCount).toBe(2);
      expect(result.count).toBe(2);
    });
  });

  describe('cross-file dependencies', () => {
    it('should find test by full key with file', () => {
      const relay = createRelay('/path/to/test.spec.ts');
      const testData = { id: 123 };
      
      storeTestResult('auth.spec.ts > should login', 'passed', testData);
      
      const result = relay.from<typeof testData>('auth.spec.ts > should login');
      
      expect(result).toEqual(testData);
    });
  });

  describe('getTestResult', () => {
    it('should return typed data', () => {
      interface User { id: string; name: string; }
      storeTestResult<User>('create user', 'passed', { id: '1', name: 'John' });
      
      const user = getTestResult<User>('create user');
      expect(user?.id).toBe('1');
      expect(user?.name).toBe('John');
    });

    it('should return undefined for non-existing tests', () => {
      expect(getTestResult('nonexistent')).toBeUndefined();
    });
  });

  describe('getTestResultOrThrow', () => {
    it('should return data for passed tests', () => {
      storeTestResult('test', 'passed', { value: 42 });
      expect(getTestResultOrThrow<{ value: number }>('test')).toEqual({ value: 42 });
    });

    it('should throw for non-existing tests', () => {
      expect(() => getTestResultOrThrow('nonexistent')).toThrow();
    });

    it('should throw for failed tests', () => {
      storeTestResult('failed', 'failed', undefined, new Error('Test failed'));
      expect(() => getTestResultOrThrow('failed')).toThrow('failed');
    });
  });

  describe('initializeRelay', () => {
    it('should set config and initialize store when persistCache is true', () => {
      initializeRelay({ persistCache: true });
      expect(resultStore.isInitialized()).toBe(true);
    });
  });

  describe('validateDependencies', () => {
    const tempDir = os.tmpdir();
    const testFile1 = path.join(tempDir, 'relay-test1.spec.ts');
    const testFile2 = path.join(tempDir, 'relay-test2.spec.ts');

    beforeEach(() => {
      // Clean up temp files
      try { fs.unlinkSync(testFile1); } catch { /* ignore */ }
      try { fs.unlinkSync(testFile2); } catch { /* ignore */ }
    });

    it('should return valid for tests with valid dependencies', () => {
      fs.writeFileSync(testFile1, `
import { test } from 'playwright-relay';
test('create user', async () => {});
/**
 * @depends create user
 */
test('update user', async () => {});
      `);

      const result = validateDependencies([testFile1]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing cross-file dependencies', () => {
      fs.writeFileSync(testFile1, `
import { test } from 'playwright-relay';
/**
 * @depends missing-file.spec.ts > login
 */
test('update user', async () => {});
      `);

      const result = validateDependencies([testFile1]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].dependency).toBe('missing-file.spec.ts > login');
    });

    it('should validate cross-file dependencies', () => {
      fs.writeFileSync(testFile1, `
import { test } from 'playwright-relay';
test('login', async () => {});
      `);
      fs.writeFileSync(testFile2, `
import { test } from 'playwright-relay';
/**
 * @depends relay-test1.spec.ts > login
 */
test('get profile', async () => {});
      `);

      const result = validateDependencies([testFile1, testFile2]);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDependenciesOrThrow', () => {
    const tempDir = os.tmpdir();
    const testFile = path.join(tempDir, 'relay-invalid.spec.ts');

    it('should throw for missing cross-file dependencies', () => {
      fs.writeFileSync(testFile, `
import { test } from 'playwright-relay';
/**
 * @depends nonexistent.spec.ts > missing
 */
test('test', async () => {});
      `);

      expect(() => validateDependenciesOrThrow([testFile])).toThrow('Dependency validation failed');
    });
  });
});
