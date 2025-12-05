#!/usr/bin/env node
/**
 * CLI for playwright-relay
 * @module cli
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateGraph, generateHtmlGraph } from './visualize.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
  console.log(`
playwright-relay CLI

Usage:
  npx playwright-relay <command> [options]

Commands:
  graph [pattern]     Generate dependency graph from test files
  help               Show this help message

Graph Options:
  --format <type>    Output format: mermaid, ascii, json, html (default: mermaid)
  --direction <dir>  Graph direction: TB, BT, LR, RL (default: TB)
  --output <file>    Write output to file instead of stdout
  --no-orphans       Exclude tests without dependencies

Examples:
  npx playwright-relay graph "tests/**/*.spec.ts"
  npx playwright-relay graph "tests/**/*.spec.ts" --format html --output graph.html
  npx playwright-relay graph "tests/**/*.spec.ts" --format ascii
  npx playwright-relay graph "tests/**/*.spec.ts" --direction LR
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      
      if (key === 'no-orphans') {
        result['includeOrphans'] = false;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[key] = args[++i];
      } else {
        result[key] = true;
      }
    } else if (!result['pattern']) {
      result['pattern'] = arg;
    }
  }
  
  return result;
}

async function runGraph(args: string[]): Promise<void> {
  const options = parseArgs(args);
  const pattern = (options['pattern'] as string) || 'tests/**/*.spec.ts';
  const format = (options['format'] as string) || 'mermaid';
  const direction = (options['direction'] as 'TB' | 'BT' | 'LR' | 'RL') || 'TB';
  const outputFile = options['output'] as string | undefined;
  const includeOrphans = options['includeOrphans'] !== false;
  
  try {
    let output: string;
    
    if (format === 'html') {
      output = generateHtmlGraph(pattern, { direction, includeOrphans });
    } else {
      const result = generateGraph(pattern, { 
        format: format as 'mermaid' | 'ascii' | 'json',
        direction,
        includeOrphans,
      });
      
      output = result.output;
      
      if (!outputFile) {
        console.log(`\n📊 Found ${result.testCount} tests with ${result.dependencyCount} dependencies\n`);
      }
    }
    
    if (outputFile) {
      const outputPath = path.resolve(outputFile);
      fs.writeFileSync(outputPath, output);
      console.log(`✓ Graph written to ${outputPath}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error('Error generating graph:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  switch (command) {
    case 'graph':
      await runGraph(args.slice(1));
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch(console.error);
