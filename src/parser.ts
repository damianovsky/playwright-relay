/**
 * Parser for @depends annotations
 * @module parser
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DependencyDefinition } from './types.js';

const DEPENDS_REGEX = /@depends\s+(.+?)(?:\n|$)/g;
const CROSS_FILE_REGEX = /^(.+\.spec\.[tj]s)\s*>\s*(.+)$/;
const TEST_CALL_REGEX = /test\s*\(\s*(['"`])([^'"`]+)\1/g;

export function parseDependsValue(value: string): DependencyDefinition {
  const trimmed = value.trim();
  const match = trimmed.match(CROSS_FILE_REGEX);

  if (match) {
    return {
      file: match[1].trim(),
      testTitle: match[2].trim(),
      fullKey: trimmed,
    };
  }

  return { testTitle: trimmed, fullKey: trimmed };
}

export function parseDependsAnnotations(comment: string): DependencyDefinition[] {
  const deps: DependencyDefinition[] = [];
  DEPENDS_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DEPENDS_REGEX.exec(comment)) !== null) {
    const value = match[1].trim();
    if (value) deps.push(parseDependsValue(value));
  }

  return deps;
}

export function extractPrecedingComment(source: string, position: number): string | null {
  const before = source.substring(0, position);
  const jsDocMatch = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);
  const lineMatch = before.match(/(?:\/\/[^\n]*\n)+\s*$/);

  if (jsDocMatch && lineMatch) {
    return jsDocMatch.index! > lineMatch.index! ? jsDocMatch[0] : lineMatch[0];
  }
  return jsDocMatch?.[0] ?? lineMatch?.[0] ?? null;
}

export function parseTestSource(source: string): Map<string, DependencyDefinition[]> {
  const result = new Map<string, DependencyDefinition[]>();
  TEST_CALL_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TEST_CALL_REGEX.exec(source)) !== null) {
    const title = match[2];
    const comment = extractPrecedingComment(source, match.index);

    if (comment) {
      const deps = parseDependsAnnotations(comment);
      if (deps.length > 0) result.set(title, deps);
    }
  }

  return result;
}

export function parseTestFile(filePath: string): Map<string, DependencyDefinition[]> {
  return parseTestSource(fs.readFileSync(filePath, 'utf-8'));
}

export function generateTestKey(file: string | undefined, title: string): string {
  return file ? `${path.basename(file)} > ${title}` : title;
}

export function parseTestKey(key: string): { file?: string; testTitle: string } {
  const match = key.match(CROSS_FILE_REGEX);
  return match
    ? { file: match[1].trim(), testTitle: match[2].trim() }
    : { testTitle: key };
}

export function resolveFilePath(currentFile: string, relativePath: string): string {
  return path.resolve(path.dirname(currentFile), relativePath);
}
