/**
 * Dependency graph visualization utilities
 * @module visualize
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { DependencyGraph } from './graph.js';
import { parseTestFile, generateTestKey } from './parser.js';
import type { TestInfo, DependencyDefinition } from './types.js';

export interface GraphOptions {
  /** Graph direction for Mermaid: 'TB', 'BT', 'LR', 'RL' */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Output format: 'mermaid', 'ascii', 'json' */
  format?: 'mermaid' | 'ascii' | 'json';
  /** Include tests without dependencies */
  includeOrphans?: boolean;
}

export interface GraphResult {
  graph: DependencyGraph;
  output: string;
  testCount: number;
  dependencyCount: number;
}

/**
 * Build dependency graph from test files
 */
export function buildGraphFromFiles(testFiles: string[]): DependencyGraph {
  const graph = new DependencyGraph();
  const allTests = new Map<string, TestInfo>();
  
  // First pass: collect all tests
  for (const filePath of testFiles) {
    if (!fs.existsSync(filePath)) continue;
    ``
    try {
      const deps = parseTestFile(filePath);
      const fileName = path.basename(filePath);
      
      for (const [title, dependencies] of deps) {
        const id = generateTestKey(fileName, title);
        const testInfo: TestInfo = {
          id,
          title,
          file: fileName,
          dependencies,
        };
        allTests.set(id, testInfo);
        graph.addTest(testInfo);
      }
      
      // Also add tests without dependencies
      const content = fs.readFileSync(filePath, 'utf-8');
      const testMatches = content.matchAll(/test\s*\(\s*(['"`])([^'"`]+)\1/g);
      
      for (const match of testMatches) {
        const title = match[2];
        const id = generateTestKey(fileName, title);
        
        if (!allTests.has(id)) {
          const testInfo: TestInfo = {
            id,
            title,
            file: fileName,
            dependencies: [],
          };
          allTests.set(id, testInfo);
          graph.addTest(testInfo);
        }
      }
    } catch {
      // Skip files that can't be parsed
    }
  }
  
  // Second pass: add dependency edges
  for (const [id, testInfo] of allTests) {
    for (const dep of testInfo.dependencies) {
      const depId = resolveDepId(dep, testInfo.file, allTests);
      if (depId && graph.hasTest(depId)) {
        graph.addDependency(id, depId);
      }
    }
  }
  
  return graph;
}

function resolveDepId(
  dep: DependencyDefinition, 
  currentFile: string, 
  allTests: Map<string, TestInfo>
): string | null {
  // Try exact match first
  if (allTests.has(dep.fullKey)) {
    return dep.fullKey;
  }
  
  // Try with current file
  const withCurrentFile = generateTestKey(currentFile, dep.testTitle);
  if (allTests.has(withCurrentFile)) {
    return withCurrentFile;
  }
  
  // Try to find by title alone
  for (const [id, info] of allTests) {
    if (info.title === dep.testTitle) {
      return id;
    }
  }
  
  return null;
}

/**
 * Generate dependency graph visualization from test files
 */
export function generateGraph(
  testPattern: string | string[],
  options: GraphOptions = {}
): GraphResult {
  const {
    direction = 'TB',
    format = 'mermaid',
    includeOrphans = true,
  } = options;
  
  // Resolve test files
  const patterns = Array.isArray(testPattern) ? testPattern : [testPattern];
  const testFiles: string[] = [];
  
  for (const pattern of patterns) {
    if (glob.sync) {
      testFiles.push(...glob.sync(pattern));
    } else {
      // Fallback for environments without glob
      if (fs.existsSync(pattern)) {
        testFiles.push(pattern);
      }
    }
  }
  
  const graph = buildGraphFromFiles(testFiles);
  
  // Remove orphans if requested
  if (!includeOrphans) {
    for (const id of graph.getAllTestIds()) {
      const deps = graph.getDependencies(id);
      const dependents = graph.getDependents(id);
      if (deps.length === 0 && dependents.length === 0) {
        // Note: DependencyGraph doesn't have removeTest, so we rebuild
      }
    }
  }
  
  // Count dependencies
  let dependencyCount = 0;
  for (const id of graph.getAllTestIds()) {
    dependencyCount += graph.getDependencies(id).length;
  }
  
  // Generate output
  let output: string;
  switch (format) {
    case 'ascii':
      output = graph.toAscii();
      break;
    case 'json':
      output = JSON.stringify(graphToJson(graph), null, 2);
      break;
    case 'mermaid':
    default:
      output = graph.toMermaid(direction);
  }
  
  return {
    graph,
    output,
    testCount: graph.getAllTestIds().length,
    dependencyCount,
  };
}

function graphToJson(graph: DependencyGraph): object {
  const nodes: object[] = [];
  const edges: object[] = [];
  
  for (const id of graph.getAllTestIds()) {
    const test = graph.getTest(id);
    if (test) {
      nodes.push({
        id,
        title: test.title,
        file: test.file,
      });
    }
    
    for (const dep of graph.getDependencies(id)) {
      edges.push({
        from: dep,
        to: id,
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Generate HTML page with interactive Mermaid graph
 */
export function generateHtmlGraph(
  testPattern: string | string[],
  options: GraphOptions = {}
): string {
  const result = generateGraph(testPattern, { ...options, format: 'mermaid' });
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dependency Graph - playwright-relay</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #1a1a2e;
      color: #eee;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 24px;
    }
    .stats {
      color: #888;
      margin-bottom: 20px;
    }
    .mermaid {
      background: #16213e;
      padding: 20px;
      border-radius: 8px;
    }
    .mermaid svg {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <h1>🔗 Dependency Graph</h1>
  <p class="stats">${result.testCount} tests, ${result.dependencyCount} dependencies</p>
  <div class="mermaid">
${result.output}
  </div>
  <script>
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'dark',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  </script>
</body>
</html>`;
}
