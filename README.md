# Tramoya - Visual Test Builder

Tramoya is a web-based service that allows users without programming skills to create, run, and analyze automated browser tests using a visual drag-and-drop interface. The application enables users to build test scenarios from pre-defined blocks, execute them with a single click, and view detailed results including logs and screenshots.

## Features

- **Visual Test Builder**: Drag-and-drop interface for creating test scenarios without writing code
- **Ready-to-use Test Blocks**: Navigate to URLs, click elements, input text, assert content, and more
- **One-click Test Execution**: Run tests with a single click and get real-time status updates
- **Detailed Test Reports**: View comprehensive test results with logs, screenshots, videos, and traces
- **CSS and XPath Selectors**: Support for both selector types for element targeting
- **Screenshot Capture**: Automatic screenshots on errors or as configured in test steps
- **Video Recording**: Full video capture of test execution for debugging
- **Playwright Tracing**: Detailed trace files for advanced debugging
- **Real-time Updates**: Live updates during test execution via Server-Sent Events and WebSockets
- **Browser Selection**: Choose which browser to use for test execution
- **Test History**: Track and manage previous test executions

## Architecture

Tramoya consists of five main components:

1. **Frontend**: React application with TypeScript and drag-and-drop functionality (using React DnD)
2. **Gateway**: Node.js API server with TypeScript for handling HTTP requests
3. **Runner**: Node.js worker service with Playwright for browser automation
4. **Redis**: For job queue management (using BullMQ) and real-time event publishing
5. **Storage**: Minio (S3-compatible) for storing test artifacts (screenshots, videos, logs, traces)

All components are containerized using Docker and can be launched with a single `docker-compose up -d` command.

### Docker Configuration

The project uses Docker Compose to orchestrate the following services:

- **Frontend**: Runs on port 80, built with Vite and served by Nginx
- **Gateway**: Backend API service running on port 3001
- **Runner**: Backend worker service for test execution
- **Redis**: Runs on port 6379, used for job queues and pub/sub
- **Minio**: Runs on port 9000 for the API and 9001 for the web console
- **CreateBuckets**: A service that initializes the required Minio bucket

The frontend communicates with the backend through the `/api` proxy configured in Nginx. The gateway and runner services communicate through Redis job queues and pub/sub channels.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 16+ (for local development only)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tramoya.git
   cd tramoya
   ```

2. Start the application:
   ```bash
   docker-compose up -d
   ```
   The `-d` flag runs containers in the background (detached mode).

3. Access the application:
   - Frontend: http://localhost:80
   - Backend API: http://localhost:3001/api/v1
   - Minio Console: http://localhost:9001 (login: minioadmin / minioadmin)

### Local Development

1. Install dependencies:
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd frontend
   npm install
   ```

2. Start the services:
   ```bash
   # Backend
   cd backend
   npm run dev
   # Backend will run on http://localhost:3001

   # Frontend
   cd frontend
   npm run dev
   # Frontend will run on http://localhost:3000
   ```

   Note: When running in development mode, the frontend will access the backend on port 3001 (which is used in Docker).

## Usage Guide

### Creating a Test

1. Navigate to the "Create Test" page
2. Enter a name and optional description for your test
3. Drag test blocks from the left panel to the test area
4. Configure each block with the required parameters (URLs, selectors, text, etc.)
5. Arrange blocks in the desired order using drag-and-drop
6. Click "Save Test" to save your test scenario

### Running a Test

1. Navigate to the "Tests" page
2. Find the test you want to run
3. Select the browser you want to use (Chrome, Firefox, or WebKit)
4. Click the "Run Test" button
5. You'll be redirected to the results page where you can see real-time updates

### Viewing Test Results

1. On the test results page, you'll see:
   - Overall test status (Pending, Running, Passed, Failed, Error)
   - Summary statistics (total steps, passed, failed, etc.)
   - Detailed results for each step
   - Video recording of the entire test execution
   - Playwright trace for detailed debugging
2. Click on a step to expand and see:
   - Step details
   - Error messages (if any)
   - Screenshots
   - Logs

## API Documentation

### Test Scenarios

#### JSON Format

Test scenarios are represented as JSON objects with the following structure:

```json
{
  "id": "test_1627293847",
  "name": "Example Test",
  "description": "This is an example test",
  "createdAt": "2023-07-28T12:34:56.789Z",
  "updatedAt": "2023-07-28T12:34:56.789Z",
  "steps": [
    {
      "id": "step_1",
      "type": "navigate",
      "description": "Go to example.com",
      "url": "https://example.com",
      "takeScreenshot": true
    },
    {
      "id": "step_2",
      "type": "click",
      "description": "Click the login button",
      "selector": "#login-button"
    },
    {
      "id": "step_3",
      "type": "input",
      "description": "Enter username",
      "selector": "#username",
      "text": "testuser"
    }
  ]
}
```

#### Step Types

| Type | Description | Required Parameters |
|------|-------------|---------------------|
| `navigate` | Navigate to a URL | `url` |
| `input` | Enter text into an element | `selector`, `text` |
| `click` | Click on an element | `selector` |
| `assertText` | Assert that an element contains text | `selector`, `text`, optional `exactMatch` |
| `assertVisible` | Assert that an element is visible | `selector`, optional `shouldBeVisible` |
| `wait` | Wait for a specified time | `milliseconds` |
| `assertUrl` | Assert that the current URL matches | `url`, optional `exactMatch` |
| `screenshot` | Take a screenshot | optional `name` |

### API Endpoints

All API endpoints are accessible at `http://localhost:3001/api/v1` when running with Docker Compose.

#### Test Management

- `GET /api/v1/tests` - Get all test scenarios
- `GET /api/v1/tests/:id` - Get a specific test scenario
- `POST /api/v1/tests` - Create a new test scenario
- `PUT /api/v1/tests/:id` - Update an existing test scenario
- `DELETE /api/v1/tests/:id` - Delete a test scenario

#### Test Execution

- `POST /api/v1/tests/:id/execute` - Execute a test scenario

#### Test Results

- `GET /api/v1/tests/results` - Get all test results
- `GET /api/v1/tests/results/:id` - Get a specific test result
- `GET /api/v1/tests/:id/results` - Get all results for a specific test
- `DELETE /api/v1/tests/results/:id` - Delete a test result

#### Real-time Updates

The backend provides real-time updates during test execution through:

- Server-Sent Events (SSE) at `/api/v1/stream/tests/:runId`
- WebSocket events on the `test-events` channel

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Playwright](https://playwright.dev/) for browser automation
- [React DnD](https://react-dnd.github.io/react-dnd/) for drag-and-drop functionality
- [Minio](https://min.io/) for S3-compatible storage
- [BullMQ](https://docs.bullmq.io/) for job queue management
- [Redis](https://redis.io/) for pub/sub and job queue backend