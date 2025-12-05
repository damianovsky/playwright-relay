import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DependencyGraph, 
  CircularDependencyError,
} from '../src/graph';
import type { TestInfo } from '../src/types';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('addTest', () => {
    it('should add a test to the graph', () => {
      const testInfo: TestInfo = {
        id: 'test-1',
        title: 'should create account',
        file: 'test.spec.ts',
        dependencies: [],
      };

      graph.addTest(testInfo);

      expect(graph.hasTest('test-1')).toBe(true);
      expect(graph.getTest('test-1')).toEqual(testInfo);
    });
  });

  describe('addDependency', () => {
    it('should add a dependency edge', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Test 2', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addDependency('test-2', 'test-1'); // test-2 depends on test-1

      expect(graph.getDependencies('test-2')).toContain('test-1');
      expect(graph.getDependents('test-1')).toContain('test-2');
    });
  });

  describe('topologicalSort', () => {
    it('should sort tests in dependency order', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Create', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Update', file: 'test.spec.ts', dependencies: [] };
      const test3: TestInfo = { id: 'test-3', title: 'Delete', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addTest(test3);
      graph.addDependency('test-2', 'test-1'); // Update depends on Create
      graph.addDependency('test-3', 'test-2'); // Delete depends on Update

      const order = graph.topologicalSort();

      expect(order.indexOf('test-1')).toBeLessThan(order.indexOf('test-2'));
      expect(order.indexOf('test-2')).toBeLessThan(order.indexOf('test-3'));
    });

    it('should handle multiple dependencies', () => {
      const test1: TestInfo = { id: 'test-1', title: 'FTP', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'MySQL', file: 'test.spec.ts', dependencies: [] };
      const test3: TestInfo = { id: 'test-3', title: 'WordPress', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addTest(test3);
      graph.addDependency('test-3', 'test-1'); // WordPress depends on FTP
      graph.addDependency('test-3', 'test-2'); // WordPress depends on MySQL

      const order = graph.topologicalSort();

      expect(order.indexOf('test-1')).toBeLessThan(order.indexOf('test-3'));
      expect(order.indexOf('test-2')).toBeLessThan(order.indexOf('test-3'));
    });

    it('should handle independent tests', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Test 2', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);

      const order = graph.topologicalSort();

      expect(order).toContain('test-1');
      expect(order).toContain('test-2');
      expect(order.length).toBe(2);
    });
  });

  describe('validateNoCycles', () => {
    it('should detect circular dependency', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Test 2', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addDependency('test-1', 'test-2');
      graph.addDependency('test-2', 'test-1'); // Circular!

      expect(() => graph.validateNoCycles()).toThrow(CircularDependencyError);
    });

    it('should detect longer circular dependency chains', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Test 2', file: 'test.spec.ts', dependencies: [] };
      const test3: TestInfo = { id: 'test-3', title: 'Test 3', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addTest(test3);
      graph.addDependency('test-1', 'test-3');
      graph.addDependency('test-2', 'test-1');
      graph.addDependency('test-3', 'test-2'); // Circular: 1 -> 3 -> 2 -> 1

      expect(() => graph.validateNoCycles()).toThrow(CircularDependencyError);
    });

    it('should pass for valid dependency graph', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Test 2', file: 'test.spec.ts', dependencies: [] };
      const test3: TestInfo = { id: 'test-3', title: 'Test 3', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addTest(test3);
      graph.addDependency('test-2', 'test-1');
      graph.addDependency('test-3', 'test-1');
      graph.addDependency('test-3', 'test-2');

      expect(() => graph.validateNoCycles()).not.toThrow();
    });
  });

  describe('getExecutionOrder', () => {
    it('should return execution order for a specific test', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Create', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Update', file: 'test.spec.ts', dependencies: [] };
      const test3: TestInfo = { id: 'test-3', title: 'Delete', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addTest(test3);
      graph.addDependency('test-2', 'test-1');
      graph.addDependency('test-3', 'test-2');

      const order = graph.getExecutionOrder('test-3');

      expect(order).toEqual(['test-1', 'test-2', 'test-3']);
    });

    it('should return only the test itself if no dependencies', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);

      const order = graph.getExecutionOrder('test-1');

      expect(order).toEqual(['test-1']);
    });
  });

  describe('fromTests', () => {
    it('should build graph from test info array', () => {
      const tests: TestInfo[] = [
        { 
          id: 'should create account', 
          title: 'should create account', 
          file: 'test.spec.ts', 
          dependencies: [] 
        },
        { 
          id: 'should update account', 
          title: 'should update account', 
          file: 'test.spec.ts', 
          dependencies: [{ testTitle: 'should create account', fullKey: 'should create account' }] 
        },
      ];

      const newGraph = DependencyGraph.fromTests(tests);

      expect(newGraph.hasTest('should create account')).toBe(true);
      expect(newGraph.hasTest('should update account')).toBe(true);
      expect(newGraph.getDependencies('should update account')).toContain('should create account');
    });
  });

  describe('clear', () => {
    it('should clear all nodes and edges', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test 1', file: 'test.spec.ts', dependencies: [] };
      graph.addTest(test1);
      
      graph.clear();
      
      expect(graph.hasTest('test-1')).toBe(false);
      expect(graph.getAllTestIds()).toHaveLength(0);
    });
  });

  describe('toMermaid', () => {
    it('should generate valid Mermaid flowchart', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Create User', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Update User', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addDependency('test-2', 'test-1');

      const mermaid = graph.toMermaid();

      expect(mermaid).toContain('flowchart TB');
      expect(mermaid).toContain('Create User');
      expect(mermaid).toContain('Update User');
      expect(mermaid).toContain('-->');
    });

    it('should support different directions', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test', file: 'test.spec.ts', dependencies: [] };
      graph.addTest(test1);

      expect(graph.toMermaid('LR')).toContain('flowchart LR');
      expect(graph.toMermaid('BT')).toContain('flowchart BT');
      expect(graph.toMermaid('RL')).toContain('flowchart RL');
    });

    it('should escape special characters in labels', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Test "with" quotes', file: 'test.spec.ts', dependencies: [] };
      graph.addTest(test1);

      const mermaid = graph.toMermaid();

      expect(mermaid).not.toContain('"with"');
      expect(mermaid).toContain("'with'");
    });
  });

  describe('toAscii', () => {
    it('should generate ASCII representation', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Create User', file: 'test.spec.ts', dependencies: [] };
      const test2: TestInfo = { id: 'test-2', title: 'Update User', file: 'test.spec.ts', dependencies: [] };

      graph.addTest(test1);
      graph.addTest(test2);
      graph.addDependency('test-2', 'test-1');

      const ascii = graph.toAscii();

      expect(ascii).toContain('Create User');
      expect(ascii).toContain('Update User');
      expect(ascii).toContain('depends on');
    });

    it('should mark tests without dependencies differently', () => {
      const test1: TestInfo = { id: 'test-1', title: 'Independent Test', file: 'test.spec.ts', dependencies: [] };
      graph.addTest(test1);

      const ascii = graph.toAscii();

      expect(ascii).toContain('○');
    });
  });
});
