# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-05

### Added

- Initial beta release
- `@depends` annotation support for declaring test dependencies
- `relay` fixture with methods:
  - `from<T>()` - get data from executed dependency
  - `require<T>()` - get data, executing dependency if needed
  - `hasRun()` - check if dependency completed
  - `status()` - get dependency status
  - `all()` - get all cached results
  - `rerun<T>()` - force re-execution
- `storeTestResult()` helper for storing test data
- `withRelay()` config wrapper
- `relayTest()` alternative test wrapper
- Cross-file dependency support (`file.spec.ts > test name`)
- Dependency graph with cycle detection
- Topological sorting for execution order
- Configurable options:
  - `dependencyTimeout` - timeout for dependencies
  - `onDependencyFailure` - skip or fail on dependency failure
  - `persistCache` - cache persistence between runs
- Full TypeScript support with generics
- MkDocs documentation

[1.0.0-beta]: https://github.com/damianovsky/playwright-relay/releases/tag/v1.0.0-beta
