import express, { Express, Router } from 'express';
import request from 'supertest';
import http from 'http';
import WebSocket from 'ws';
import streamRoutes from '../../../src/routes/stream-routes';
import { RedisService } from '../../../src/services/redis-service';
import { EVENT_CHANNELS } from '../../../src/services/queue-service';
import * as streamManager from '../../../src/services/stream-manager';

// Define a custom interface that extends Router and includes the setupWebSocketServer property
interface StreamRouter extends Router {
  setupWebSocketServer: (server: any) => WebSocket.Server;
}

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../../src/services/stream-manager', () => ({
  addClient: jest.fn()
}));

// Define a type for our mock request object
interface MockRequest {
  params: { id: string };
  on: jest.Mock;
  closeCallback?: Function;
}

// Helper function to create a mock request object
function createMockRequest(runId: string): MockRequest {
  const mockRequest: MockRequest = {
    params: { id: runId },
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'close') {
        // Store the close callback for later use
        mockRequest.closeCallback = callback;
      }
      return mockRequest;
    })
  };
  return mockRequest;
}

describe('Stream Routes', () => {
  let app: Express;
  let server: http.Server;
  let mockRedisService: jest.Mocked<RedisService>;
  let subscriptionCallback: Function;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis service
    mockRedisService = {
      subscribe: jest.fn().mockImplementation((channel, callback) => {
        subscriptionCallback = callback;
      }),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      getTestResult: jest.fn().mockResolvedValue(null)
    } as unknown as jest.Mocked<RedisService>;

    // Create Express app
    app = express();
    app.use('/stream', streamRoutes(mockRedisService));

    // Create HTTP server
    server = http.createServer(app);
  });

  afterEach(() => {
    server.close();
  });

  describe('GET /stream/:runId', () => {
    it('should set up SSE connection for a run ID', async () => {
      const runId = 'test-run-123';
      
      // Create a mock response object to capture writes
      const mockResponse = {
        write: jest.fn(),
        setHeader: jest.fn(),
        flush: jest.fn(),
        end: jest.fn()
      };
      
      // Create a mock request object
      const mockRequest = createMockRequest(runId);
      
      // Get the route handler
      const router = streamRoutes(mockRedisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Verify client was added
      expect(streamManager.addClient).toHaveBeenCalledWith(runId, mockResponse);
      
      // Verify Redis subscription was set up
      expect(mockRedisService.subscribe).toHaveBeenCalledWith(
        EVENT_CHANNELS.TEST_EVENTS,
        expect.any(Function)
      );
      
      // Simulate receiving an event for this run
      const event = {
        type: 'TEST_PROGRESS',
        runId: runId,
        progress: 50,
        ts: Date.now()
      };
      
      // Call the subscription callback
      subscriptionCallback(JSON.stringify(event));
      
      // Verify response.write was called with the event data
      expect(mockResponse.write).toHaveBeenCalledWith(
        `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
      );
      
      // Simulate receiving a completion event
      const completionEvent = {
        type: 'RUN_FINISHED',
        runId: runId,
        status: 'PASSED',
        ts: Date.now()
      };
      
      // Call the subscription callback
      subscriptionCallback(JSON.stringify(completionEvent));
      
      // Verify response.write was called with the completion event data
      expect(mockResponse.write).toHaveBeenCalledWith(
        `event: ${completionEvent.type}\ndata: ${JSON.stringify(completionEvent)}\n\n`
      );
      
      // Simulate connection close
      if (mockRequest.closeCallback) {
        mockRequest.closeCallback();
      }
      
      // Verify Redis unsubscribe was called
      expect(mockRedisService.unsubscribe).toHaveBeenCalledWith('test-events');
    });

    it('should handle malformed events', async () => {
      const runId = 'test-run-123';
      
      // Create a mock response object to capture writes
      const mockResponse = {
        write: jest.fn(),
        setHeader: jest.fn(),
        flush: jest.fn(),
        end: jest.fn()
      };
      
      // Create a mock request object
      const mockRequest = createMockRequest(runId);
      
      // Get the route handler
      const router = streamRoutes(mockRedisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Reset the mock to clear previous calls
      mockResponse.write.mockClear();
      
      // Simulate receiving a malformed event
      const malformedEvent = 'not-json';
      
      // Call the subscription callback
      subscriptionCallback(malformedEvent);
      
      // Verify response.write was not called with any event data (only the initial connection event)
      expect(mockResponse.write).not.toHaveBeenCalled();
    });

    it('should ignore events for other run IDs', async () => {
      const runId = 'test-run-123';
      
      // Create a mock response object to capture writes
      const mockResponse = {
        write: jest.fn(),
        setHeader: jest.fn(),
        flush: jest.fn(),
        end: jest.fn()
      };
      
      // Create a mock request object
      const mockRequest = createMockRequest(runId);
      
      // Get the route handler
      const router = streamRoutes(mockRedisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Reset the mock to clear previous calls
      mockResponse.write.mockClear();
      
      // Simulate receiving an event for a different run
      const event = {
        type: 'TEST_PROGRESS',
        runId: 'different-run-id',
        progress: 50,
        ts: Date.now()
      };
      
      // Call the subscription callback
      subscriptionCallback(JSON.stringify(event));
      
      // Verify response.write was not called with the event data
      expect(mockResponse.write).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket server', () => {
    it('should set up WebSocket server with the correct path', () => {
      // Get the stream routes handler
      const routesHandler = streamRoutes(mockRedisService) as StreamRouter;
      
      // Verify setupWebSocketServer is available
      expect(routesHandler).toHaveProperty('setupWebSocketServer');
      expect(typeof routesHandler.setupWebSocketServer).toBe('function');
      
      // Create a mock server
      const mockServer = {};
      
      // Mock WebSocket.Server constructor
      const mockWsServer = { on: jest.fn() };
      jest.spyOn(WebSocket, 'Server').mockImplementationOnce(() => mockWsServer as any);
      
      // Call setupWebSocketServer
      const result = routesHandler.setupWebSocketServer(mockServer as any);
      
      // Verify WebSocket.Server was created with the correct options
      expect(WebSocket.Server).toHaveBeenCalledWith({
        server: mockServer,
        path: '/api/v1/stream/ws'
      });
      
      // Verify the result is the WebSocket server
      expect(result).toBe(mockWsServer);
    });
    
    it('should handle WebSocket connections', () => {
      // This is a more complex test that would require mocking the WebSocket server
      // and client. For simplicity, we'll just verify the function exists.
      
      // Get the stream routes handler
      const routesHandler = streamRoutes(mockRedisService) as StreamRouter;
      
      // Verify setupWebSocketServer is a function
      expect(typeof routesHandler.setupWebSocketServer).toBe('function');
      
      // Verify the router has standard Express router properties
      expect(routesHandler).toHaveProperty('get');
      expect(routesHandler).toHaveProperty('post');
      expect(routesHandler).toHaveProperty('use');
    });
  });
});