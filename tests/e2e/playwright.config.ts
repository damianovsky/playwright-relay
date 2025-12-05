import { defineConfig } from '@playwright/test';
import { withRelay } from '../../src';

export default defineConfig(withRelay({
  testDir: './e2e',
  fullyParallel: false, // Required for dependency ordering
  workers: 1, // Single worker to maintain state
  
  relay: {
    dependencyTimeout: 30000,
    onDependencyFailure: 'skip',
    persistCache: false,
  },
}));
