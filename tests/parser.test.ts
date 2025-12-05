import { describe, it, expect } from 'vitest';
import {
  parseDependsValue,
  parseDependsAnnotations,
  parseTestSource,
  parseTestKey,
  generateTestKey,
} from '../src/parser';

describe('Parser', () => {
  describe('parseDependsValue', () => {
    it('should parse simple test title', () => {
      const result = parseDependsValue('should create FTP account');
      
      expect(result.testTitle).toBe('should create FTP account');
      expect(result.file).toBeUndefined();
      expect(result.fullKey).toBe('should create FTP account');
    });

    it('should parse cross-file dependency', () => {
      const result = parseDependsValue('ftp.spec.ts > should create FTP account');
      
      expect(result.file).toBe('ftp.spec.ts');
      expect(result.testTitle).toBe('should create FTP account');
      expect(result.fullKey).toBe('ftp.spec.ts > should create FTP account');
    });

    it('should handle extra whitespace', () => {
      const result = parseDependsValue('  mysql.spec.ts   >   should create database  ');
      
      expect(result.file).toBe('mysql.spec.ts');
      expect(result.testTitle).toBe('should create database');
    });

    it('should handle .ts extension', () => {
      const result = parseDependsValue('auth.spec.ts > should login');
      
      expect(result.file).toBe('auth.spec.ts');
      expect(result.testTitle).toBe('should login');
    });

    it('should handle .js extension', () => {
      const result = parseDependsValue('auth.spec.js > should login');
      
      expect(result.file).toBe('auth.spec.js');
      expect(result.testTitle).toBe('should login');
    });
  });

  describe('parseDependsAnnotations', () => {
    it('should parse single @depends annotation', () => {
      const comment = `/**
       * @depends should create FTP account
       */`;
      
      const deps = parseDependsAnnotations(comment);
      
      expect(deps).toHaveLength(1);
      expect(deps[0].testTitle).toBe('should create FTP account');
    });

    it('should parse multiple @depends annotations', () => {
      const comment = `/**
       * @depends should create FTP account
       * @depends should create MySQL database
       */`;
      
      const deps = parseDependsAnnotations(comment);
      
      expect(deps).toHaveLength(2);
      expect(deps[0].testTitle).toBe('should create FTP account');
      expect(deps[1].testTitle).toBe('should create MySQL database');
    });

    it('should parse cross-file dependencies', () => {
      const comment = `/**
       * @depends ftp.spec.ts > should create FTP account
       * @depends mysql.spec.ts > should create MySQL database
       */`;
      
      const deps = parseDependsAnnotations(comment);
      
      expect(deps).toHaveLength(2);
      expect(deps[0].file).toBe('ftp.spec.ts');
      expect(deps[1].file).toBe('mysql.spec.ts');
    });

    it('should handle empty comments', () => {
      const comment = `/** */`;
      
      const deps = parseDependsAnnotations(comment);
      
      expect(deps).toHaveLength(0);
    });

    it('should handle line comments', () => {
      const comment = `// @depends should create account
// @depends should verify account`;
      
      const deps = parseDependsAnnotations(comment);
      
      expect(deps).toHaveLength(2);
    });
  });

  describe('parseTestSource', () => {
    it('should extract dependencies from test with JSDoc', () => {
      const source = `
import { test } from 'playwright-relay';

/**
 * @depends should create FTP account
 */
test('should connect to FTP', async ({ relay }) => {
  // test code
});
`;
      
      const deps = parseTestSource(source);
      
      expect(deps.has('should connect to FTP')).toBe(true);
      expect(deps.get('should connect to FTP')).toHaveLength(1);
      expect(deps.get('should connect to FTP')![0].testTitle).toBe('should create FTP account');
    });

    it('should extract multiple tests with dependencies', () => {
      const source = `
/**
 * @depends should create account
 */
test('should update account', async ({ relay }) => {});

/**
 * @depends should update account
 */
test('should delete account', async ({ relay }) => {});
`;
      
      const deps = parseTestSource(source);
      
      expect(deps.size).toBe(2);
      expect(deps.has('should update account')).toBe(true);
      expect(deps.has('should delete account')).toBe(true);
    });

    it('should handle tests without dependencies', () => {
      const source = `
test('should create account', async ({ api }) => {
  // no dependencies
});

/**
 * @depends should create account
 */
test('should use account', async ({ relay }) => {});
`;
      
      const deps = parseTestSource(source);
      
      expect(deps.size).toBe(1);
      expect(deps.has('should create account')).toBe(false);
      expect(deps.has('should use account')).toBe(true);
    });

    it('should handle different quote styles', () => {
      const source = `
/**
 * @depends test one
 */
test("should work with double quotes", async () => {});

/**
 * @depends test two
 */
test(\`should work with backticks\`, async () => {});
`;
      
      const deps = parseTestSource(source);
      
      expect(deps.has('should work with double quotes')).toBe(true);
      expect(deps.has('should work with backticks')).toBe(true);
    });
  });

  describe('parseTestKey', () => {
    it('should parse simple test key', () => {
      const result = parseTestKey('should create account');
      
      expect(result.testTitle).toBe('should create account');
      expect(result.file).toBeUndefined();
    });

    it('should parse cross-file test key', () => {
      const result = parseTestKey('auth.spec.ts > should login');
      
      expect(result.file).toBe('auth.spec.ts');
      expect(result.testTitle).toBe('should login');
    });
  });

  describe('generateTestKey', () => {
    it('should generate key without file', () => {
      const key = generateTestKey(undefined, 'should create account');
      
      expect(key).toBe('should create account');
    });

    it('should generate key with file', () => {
      const key = generateTestKey('/path/to/auth.spec.ts', 'should login');
      
      expect(key).toBe('auth.spec.ts > should login');
    });
  });
});
