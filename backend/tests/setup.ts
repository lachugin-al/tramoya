// Jest setup file

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'minioadmin';
process.env.MINIO_SECRET_KEY = 'minioadmin';
process.env.MINIO_BUCKET = 'test-bucket';
process.env.MINIO_USE_SSL = 'false';

// Set Playwright environment variables
process.env.PLAYWRIGHT_BROWSERS_PATH = '0'; // Use the default path in node_modules

// Global beforeAll and afterAll hooks can be added here
beforeAll(() => {
  // Setup code that runs before all tests
  console.log('Starting test suite');
});

afterAll(() => {
  // Cleanup code that runs after all tests
  console.log('Test suite completed');
});

// Mock modules that are difficult to test
jest.mock('../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

// Mock Playwright to avoid browser initialization issues
jest.mock('playwright', () => {
  return {
    chromium: {
      launch: jest.fn().mockResolvedValue({
        newContext: jest.fn().mockResolvedValue({
          tracing: {
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined)
          },
          newPage: jest.fn().mockResolvedValue({
            goto: jest.fn().mockResolvedValue(undefined),
            fill: jest.fn().mockResolvedValue(undefined),
            click: jest.fn().mockResolvedValue(undefined),
            $: jest.fn().mockResolvedValue({
              textContent: jest.fn().mockResolvedValue('Mock text content')
            }),
            isVisible: jest.fn().mockResolvedValue(true),
            waitForTimeout: jest.fn().mockResolvedValue(undefined),
            url: jest.fn().mockReturnValue('https://example.com'),
            screenshot: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
          }),
          close: jest.fn().mockResolvedValue(undefined)
        }),
        close: jest.fn().mockResolvedValue(undefined)
      })
    }
  };
});