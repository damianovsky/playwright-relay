/**
 * Parser for @depends annotations
 * @module parser
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DependencyDefinition } from './types.js';

// Match @depends only at start of line or after JSDoc asterisk/line comment (not in middle of text)
// Supports: * @depends, // @depends, @depends at line start
const DEPENDS_REGEX = /^\s*(?:\*|\/\/)?\s*@depends\s+(.+?)$/gm;
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
  
  // Find the LAST JSDoc comment before this position
  // We need to find all JSDoc comments and get the last one that ends right before the test
  const jsDocPattern = /\/\*\*[\s\S]*?\*\//g;
  const lineCommentPattern = /(?:\/\/[^\n]*\n)+/g;
  
  let lastJsDoc: { match: string; endIndex: number } | null = null;
  let lastLineComment: { match: string; endIndex: number } | null = null;
  
  // Find all JSDoc comments
  let jsDocMatch: RegExpExecArray | null;
  while ((jsDocMatch = jsDocPattern.exec(before)) !== null) {
    lastJsDoc = { match: jsDocMatch[0], endIndex: jsDocMatch.index + jsDocMatch[0].length };
  }
  
  // Find all line comment blocks
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = lineCommentPattern.exec(before)) !== null) {
    lastLineComment = { match: lineMatch[0], endIndex: lineMatch.index + lineMatch[0].length };
  }
  
  // Check if the last comment is immediately before the test (only whitespace between)
  const checkImmediatelyBefore = (comment: { match: string; endIndex: number } | null): string | null => {
    if (!comment) return null;
    const between = before.substring(comment.endIndex);
    // Only whitespace should be between comment and test
    if (/^\s*$/.test(between)) {
      return comment.match;
    }
    return null;
  };
  
  const jsDocResult = checkImmediatelyBefore(lastJsDoc);
  const lineResult = checkImmediatelyBefore(lastLineComment);
  
  // Return the one that's closer to the test (higher endIndex)
  if (jsDocResult && lineResult) {
    return lastJsDoc!.endIndex > lastLineComment!.endIndex ? jsDocResult : lineResult;
  }
  
  return jsDocResult ?? lineResult ?? null;
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
