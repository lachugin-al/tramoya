# Changelog

All notable changes to the Tramoya project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Refactor imports to align with project style
- Apply consistent spacing across files for improved readability

## [MVP 2.0.0] - 2025-08-02
### Added
- Comprehensive JSDoc comments across backend services for improved maintainability
- Expanded JSDoc coverage for logger.ts and types/index.ts
- Complete JSDoc documentation for frontend and backend components
- Logging system utilities with support for frontend and backend tracing

### Changed
- Refactored logging utility: moved logger to `utils/` directory and updated imports
- Enhanced `useRunStream` hook to handle `testId` and auto-populate missing fields
- Improved state update logging in `useRunStream`
- Ensured `useRunStream` initializes `videoUrl` and `traceUrl` with empty strings
- Enhanced fallback logic in logging
- Refined `useRunStream` logging with fallbacks for various fields

### Fixed
- Removed redundant logging and error handling across components
- Cleaned up API methods
- Disabled debugging flags

## [MVP 1.0.0] - 2025-08-01
### Added
- Initial release of Tramoya - Visual Test Builder
- Visual drag-and-drop interface for creating test scenarios
- Ready-to-use test blocks (navigate, click, input, assert, etc.)
- One-click test execution
- Detailed test reports with logs and screenshots
- Support for CSS and XPath selectors
- Automatic screenshot capture
- Test history tracking
- React frontend with TypeScript
- Node.js backend with TypeScript and Playwright
- Minio storage for test artifacts
- Docker containerization for all components

### Changed
- Refactored backend services for improved error handling and reliability
- Centralized service initialization and shutdown logic