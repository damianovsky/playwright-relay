/**
 * Dependency graph with topological sorting
 * @module graph
 */

import type { TestInfo } from './types.js';

export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class DependencyNotFoundError extends Error {
  constructor(public readonly testKey: string, public readonly dependency: string) {
    super(`Dependency "${dependency}" not found for test "${testKey}"`);
    this.name = 'DependencyNotFoundError';
  }
}

export class DependencyGraph {
  private readonly nodes = new Map<string, TestInfo>();
  private readonly edges = new Map<string, Set<string>>();
  private readonly reverseEdges = new Map<string, Set<string>>();

  addTest(info: TestInfo): void {
    this.nodes.set(info.id, info);
    this.edges.set(info.id, this.edges.get(info.id) ?? new Set());
    this.reverseEdges.set(info.id, this.reverseEdges.get(info.id) ?? new Set());
  }

  addDependency(from: string, to: string): void {
    const fromEdges = this.edges.get(from) ?? new Set();
    const toReverse = this.reverseEdges.get(to) ?? new Set();

    fromEdges.add(to);
    toReverse.add(from);

    this.edges.set(from, fromEdges);
    this.reverseEdges.set(to, toReverse);
  }

  getDependencies(testId: string): string[] {
    return [...(this.edges.get(testId) ?? [])];
  }

  getDependents(testId: string): string[] {
    return [...(this.reverseEdges.get(testId) ?? [])];
  }

  getTest(testId: string): TestInfo | undefined {
    return this.nodes.get(testId);
  }

  hasTest(testId: string): boolean {
    return this.nodes.has(testId);
  }

  getAllTestIds(): string[] {
    return [...this.nodes.keys()];
  }

  validateNoCycles(): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (node: string, path: string[]): void => {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        throw new CircularDependencyError([...path.slice(cycleStart), node]);
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      for (const dep of this.edges.get(node) ?? []) {
        visit(dep, [...path, node]);
      }

      stack.delete(node);
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) visit(node, []);
    }
  }

  topologicalSort(): string[] {
    this.validateNoCycles();

    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (node: string): void => {
      if (visited.has(node)) return;
      visited.add(node);

      for (const dep of this.edges.get(node) ?? []) {
        visit(dep);
      }
      result.push(node);
    };

    for (const node of this.nodes.keys()) {
      visit(node);
    }

    return result;
  }

  getExecutionOrder(testId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (node: string): void => {
      if (visited.has(node)) return;
      visited.add(node);

      for (const dep of this.edges.get(node) ?? []) {
        visit(dep);
      }
      result.push(node);
    };

    visit(testId);
    return result;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.reverseEdges.clear();
  }

  static fromTests(tests: TestInfo[]): DependencyGraph {
    const graph = new DependencyGraph();

    for (const test of tests) {
      graph.addTest(test);
    }

    for (const test of tests) {
      for (const dep of test.dependencies) {
        let depId = dep.fullKey;

        if (!graph.hasTest(depId)) {
          const match = tests.find(t => t.title === dep.testTitle);
          if (match) depId = match.id;
        }

        if (graph.hasTest(depId)) {
          graph.addDependency(test.id, depId);
        }
      }
    }

    return graph;
  }
}

export const dependencyGraph = new DependencyGraph();
