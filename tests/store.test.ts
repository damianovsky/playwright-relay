import { describe, it, expect, beforeEach } from 'vitest';
import { ResultStore } from '../src/store';

describe('ResultStore', () => {
  let store: ResultStore;

  beforeEach(() => {
    store = new ResultStore();
  });

  describe('set and get', () => {
    it('should store and retrieve a test result', () => {
      store.set('test-1', 'passed', { foo: 'bar' });
      
      const result = store.get('test-1');
      expect(result).toBeDefined();
      expect(result?.status).toBe('passed');
      expect(result?.data).toEqual({ foo: 'bar' });
    });

    it('should store result with error', () => {
      const error = new Error('Test failed');
      store.set('test-1', 'failed', undefined, error);
      
      const result = store.get('test-1');
      expect(result?.status).toBe('failed');
      expect(result?.error).toBe(error);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      store.set('test-1', 'passed');
      const after = Date.now();
      
      const result = store.get('test-1');
      expect(result?.timestamp).toBeGreaterThanOrEqual(before);
      expect(result?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('has', () => {
    it('should return true for existing results', () => {
      store.set('test-1', 'passed');
      expect(store.has('test-1')).toBe(true);
    });

    it('should return false for non-existing results', () => {
      expect(store.has('test-1')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return the status of a stored result', () => {
      store.set('test-1', 'running');
      expect(store.getStatus('test-1')).toBe('running');
    });

    it('should return pending for non-existing results', () => {
      expect(store.getStatus('test-1')).toBe('pending');
    });
  });

  describe('getData', () => {
    it('should return data from a stored result', () => {
      store.set('test-1', 'passed', { value: 42 });
      expect(store.getData('test-1')).toEqual({ value: 42 });
    });

    it('should return undefined for non-existing results', () => {
      expect(store.getData('test-1')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all passed results with data', () => {
      store.set('test-1', 'passed', { a: 1 });
      store.set('test-2', 'passed', { b: 2 });
      store.set('test-3', 'failed');
      store.set('test-4', 'passed'); // no data
      
      const all = store.getAll();
      expect(all.size).toBe(2);
      expect(all.get('test-1')).toEqual({ a: 1 });
      expect(all.get('test-2')).toEqual({ b: 2 });
    });
  });

  describe('pending executions', () => {
    it('should store and retrieve pending executions', async () => {
      const promise = Promise.resolve('result');
      store.setPending('test-1', promise);
      
      expect(store.isPending('test-1')).toBe(true);
      expect(store.getPending('test-1')).toBe(promise);
    });

    it('should remove pending executions', () => {
      store.setPending('test-1', Promise.resolve());
      store.removePending('test-1');
      
      expect(store.isPending('test-1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all results and pending executions', () => {
      store.set('test-1', 'passed');
      store.setPending('test-2', Promise.resolve());
      
      store.clear();
      
      expect(store.has('test-1')).toBe(false);
      expect(store.isPending('test-2')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a specific result', () => {
      store.set('test-1', 'passed');
      store.set('test-2', 'passed');
      
      store.delete('test-1');
      
      expect(store.has('test-1')).toBe(false);
      expect(store.has('test-2')).toBe(true);
    });
  });

  describe('keys', () => {
    it('should return all stored keys', () => {
      store.set('test-1', 'passed');
      store.set('test-2', 'failed');
      
      const keys = store.keys();
      expect(keys).toContain('test-1');
      expect(keys).toContain('test-2');
      expect(keys.length).toBe(2);
    });
  });
});
