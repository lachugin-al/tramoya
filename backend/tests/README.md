# Tramoya Backend Tests

This directory contains tests for the Tramoya backend service. The tests are organized into unit tests and integration tests.

## Test Structure

```
tests/
├── setup.ts                 # Global test setup file
├── unit/                    # Unit tests
│   └── services/            # Tests for service classes
│       ├── redis-service.test.ts
│       └── minio-service.test.ts
└── integration/             # Integration tests
    └── routes/              # Tests for API routes
        └── test-routes.test.ts
```

## Testing Approach

### Unit Tests

Unit tests focus on testing individual components in isolation. They use mocks to replace dependencies and test the component's behavior under various conditions.

- **Services**: Each service class has its own test file that verifies its methods work correctly.
- **Mocking**: External dependencies like Redis and Minio are mocked to avoid actual connections during testing.

### Integration Tests

Integration tests verify that different components work together correctly. They test the API endpoints by making HTTP requests and verifying the responses.

- **Routes**: Each route file has its own test file that tests all the endpoints it provides.
- **Express App**: A test Express app is created with the routes under test.
- **Mocking**: External services are still mocked, but the tests verify that the routes interact with these services correctly.

## Running Tests

The following npm scripts are available for running tests:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage reporting
npm run test:coverage
```

## Test Coverage

Test coverage reports are generated when running `npm run test:coverage`. The reports are saved in the `coverage` directory and show which parts of the code are covered by tests.

## Adding New Tests

### Adding a Unit Test

1. Create a new file in the appropriate directory under `tests/unit/`.
2. Import the component to test and its dependencies.
3. Mock the dependencies using Jest's mocking capabilities.
4. Write test cases that verify the component's behavior.

Example:
```typescript
import { YourService } from '../../../src/services/your-service';
import { Dependency } from 'dependency-package';

// Mock dependencies
jest.mock('dependency-package');

describe('YourService', () => {
  let service: YourService;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    // Setup mocks and create service instance
    mockDependency = new Dependency() as jest.Mocked<Dependency>;
    service = new YourService(mockDependency);
  });

  it('should do something', () => {
    // Arrange
    mockDependency.method.mockReturnValue('result');

    // Act
    const result = service.doSomething();

    // Assert
    expect(result).toBe('expected result');
    expect(mockDependency.method).toHaveBeenCalled();
  });
});
```

### Adding an Integration Test

1. Create a new file in the appropriate directory under `tests/integration/`.
2. Import the necessary modules, including Express and supertest.
3. Create a test Express app with the routes under test.
4. Write test cases that make HTTP requests and verify the responses.

Example:
```typescript
import express from 'express';
import request from 'supertest';
import bodyParser from 'body-parser';
import { YourService } from '../../../src/services/your-service';
import yourRoutes from '../../../src/routes/your-routes';

// Mock dependencies
jest.mock('../../../src/services/your-service');

describe('Your Routes', () => {
  let app: express.Application;
  let mockService: jest.Mocked<YourService>;

  beforeEach(() => {
    // Setup mocks
    mockService = new YourService() as jest.Mocked<YourService>;

    // Create Express app
    app = express();
    app.use(bodyParser.json());
    app.use('/your-path', yourRoutes(mockService));
  });

  it('should handle GET request', async () => {
    // Arrange
    mockService.getData.mockResolvedValue({ data: 'test' });

    // Act
    const response = await request(app).get('/your-path');

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: 'test' });
    expect(mockService.getData).toHaveBeenCalled();
  });
});
```