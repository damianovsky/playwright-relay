import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createRelay, 
  storeTestResult, 
  clearResults,
  registerTest,
  clearTestRegistry,
  setRelayConfig,
} from '../src/relay';
import { resultStore } from '../src/store';

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
});
