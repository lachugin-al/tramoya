import express, { Express, Router } from 'express';
import request from 'supertest';
import http from 'http';
import WebSocket from 'ws';
import streamRoutes from '../../../src/routes/stream-routes';
import { RedisService } from '../../../src/services/redis-service';
import { EVENT_CHANNELS } from '../../../src/services/queue-service';
import * as streamManager from '../../../src/services/stream-manager';

// Import the function to get the subscription callback
const { getSubscriptionCallback } = jest.requireMock('../../../src/services/redis-service');

// Define a custom interface that extends Router and includes the setupWebSocketServer property
interface StreamRouter extends Router {
  setupWebSocketServer: (server: any) => WebSocket.Server;
}

// Mock dependencies
jest.mock('../../../src/services/stream-manager', () => ({
  addClient: jest.fn()
}));

// Partially mock the Redis service
jest.mock('../../../src/services/redis-service', () => {
  // Create a variable to store the callback
  let subscriptionCallback: Function;
  
  return {
    RedisService: jest.fn().mockImplementation(() => ({
      subscribe: jest.fn().mockImplementation((channel, callback) => {
        // Store callback for later use in tests
        subscriptionCallback = callback;
      }),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      getTestResult: jest.fn().mockResolvedValue(null)
    })),
    // Export a function to access the callback
    getSubscriptionCallback: () => subscriptionCallback
  };
});

// Mock queue service constants
jest.mock('../../../src/services/queue-service', () => ({
  EVENT_CHANNELS: {
    TEST_EVENTS: 'test-events'
  }
}));

describe('Stream Routes Integration Tests', () => {
  let app: Express;
  let server: http.Server;
  let redisService: RedisService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create Redis service
    redisService = new RedisService();
    
    // Create Express app
    app = express();
    app.use('/stream', streamRoutes(redisService));
    
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
      
      // Mock the request object
      const mockRequest = {
        params: { id: runId },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            // Store the close callback for later use
            mockRequest.closeCallback = callback;
          }
          return mockRequest;
        }),
        closeCallback: null
      };
      
      // Get the route handler
      const router = streamRoutes(redisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Verify client was added
      expect(streamManager.addClient).toHaveBeenCalledWith(runId, mockResponse);
      
      // Verify Redis subscription was set up
      expect(redisService.subscribe).toHaveBeenCalledWith(
        EVENT_CHANNELS.TEST_EVENTS,
        expect.any(Function)
      );
    });
    
    it('should handle events for the specified run ID', async () => {
      const runId = 'test-run-123';
      
      // Create a mock response object to capture writes
      const mockResponse = {
        write: jest.fn(),
        setHeader: jest.fn(),
        flush: jest.fn(),
        end: jest.fn()
      };
      
      // Mock the request object
      const mockRequest = {
        params: { id: runId },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            // Store the close callback for later use
            mockRequest.closeCallback = callback;
          }
          return mockRequest;
        }),
        closeCallback: null
      };
      
      // Get the route handler
      const router = streamRoutes(redisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Reset the mock to clear previous calls
      mockResponse.write.mockClear();
      
      // Get the subscription callback
      const subscriptionCallback = getSubscriptionCallback();
      
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
      
      // Mock the request object
      const mockRequest = {
        params: { id: runId },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            // Store the close callback for later use
            mockRequest.closeCallback = callback;
          }
          return mockRequest;
        }),
        closeCallback: null
      };
      
      // Get the route handler
      const router = streamRoutes(redisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Reset the mock to clear previous calls
      mockResponse.write.mockClear();
      
      // Get the subscription callback
      const subscriptionCallback = getSubscriptionCallback();
      
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
    
    it('should handle completion events', async () => {
      const runId = 'test-run-123';
      
      // Create a mock response object to capture writes
      const mockResponse = {
        write: jest.fn(),
        setHeader: jest.fn(),
        flush: jest.fn(),
        end: jest.fn()
      };
      
      // Mock the request object
      const mockRequest = {
        params: { id: runId },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            // Store the close callback for later use
            mockRequest.closeCallback = callback;
          }
          return mockRequest;
        }),
        closeCallback: null
      };
      
      // Get the route handler
      const router = streamRoutes(redisService);
      const routeHandler = router.stack.find(layer => layer.route?.path === '/:id')?.route?.stack[0]?.handle;
      
      // Call the route handler directly
      if (routeHandler) {
        await routeHandler(mockRequest as any, mockResponse as any, () => {});
      }
      
      // Reset the mock to clear previous calls
      mockResponse.write.mockClear();
      
      // Get the subscription callback
      const subscriptionCallback = getSubscriptionCallback();
      
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
    });
  });
  
  describe('WebSocket server', () => {
    it('should set up WebSocket server with the correct path', () => {
      // Get the stream routes handler
      const routesHandler = streamRoutes(redisService) as StreamRouter;
      
      // Verify setupWebSocketServer is available
      expect(routesHandler).toHaveProperty('setupWebSocketServer');
      expect(typeof routesHandler.setupWebSocketServer).toBe('function');
      
      // Create a mock server
      const mockServer = {
        on: jest.fn()
      };
      
      // Call setupWebSocketServer
      routesHandler.setupWebSocketServer(mockServer as any);
      
      // Verify WebSocket server was set up
      expect(mockServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
    });
    
    it('should handle WebSocket connections', async () => {
      // Start the server
      const port = 3001;
      server.listen(port);
      
      // Get the stream routes handler
      const routesHandler = streamRoutes(redisService) as StreamRouter;
      
      // Set up WebSocket server
      routesHandler.setupWebSocketServer(server);
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create a WebSocket client
      const ws = new WebSocket(`ws://localhost:${port}/api/v1/stream/ws?runId=test-run-123`);
      
      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          resolve();
        });
        
        ws.on('error', (error) => {
          reject(error);
        });
      });
      
      // Close the WebSocket connection
      ws.close();
      
      // Wait for connection to be closed
      await new Promise<void>(resolve => {
        ws.on('close', () => {
          resolve();
        });
      });
      
      // No explicit assertion here, but the test passes if the WebSocket connection is established and closed without errors
    });
  });
  
  describe('Integration with Express middleware', () => {
    it('should work with custom middleware', async () => {
      // Create a new app with custom middleware
      const appWithMiddleware = express();
      
      // Add a middleware that adds a custom property to the request
      appWithMiddleware.use((req, res, next) => {
        (req as any).customData = 'test-data';
        next();
      });
      
      // Add stream routes
      appWithMiddleware.use('/stream', streamRoutes(redisService));
      
      // Add a middleware that checks the custom property
      appWithMiddleware.use((req, res, next) => {
        if ((req as any).customData === 'test-data') {
          (req as any).middlewareWorked = true;
        }
        next();
      });
      
      // Add a test endpoint to verify middleware
      appWithMiddleware.get('/middleware-test', (req, res) => {
        res.status(200).json({ 
          middlewareWorked: (req as any).middlewareWorked,
          customData: (req as any).customData
        });
      });
      
      // Test middleware endpoint
      const middlewareResponse = await request(appWithMiddleware).get('/middleware-test');
      expect(middlewareResponse.status).toBe(200);
      expect(middlewareResponse.body).toEqual({
        middlewareWorked: true,
        customData: 'test-data'
      });
    });
  });
});