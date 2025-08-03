import express, { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { RedisService } from '../services/redis-service';
import { EVENT_CHANNELS } from '../services/queue-service';
import * as WebSocket from 'ws';
import { addClient } from '../services/stream-manager';

const logger = createLogger('stream-routes');

/**
 * Creates and configures Express router for real-time streaming functionality
 * 
 * This router provides endpoints for Server-Sent Events (SSE) and WebSocket connections
 * that allow clients to receive real-time updates about test executions. It subscribes
 * to Redis events and forwards relevant events to connected clients.
 * 
 * @param {RedisService} redisService - Service for Redis operations and pub/sub
 * @returns {Router} Express router configured with streaming endpoints and WebSocket setup
 */
export default function streamRoutes(redisService: RedisService): Router {
  const router = express.Router();
  
  /**
   * GET /stream/:id
   * Server-Sent Events (SSE) endpoint for streaming test run events in real-time
   * 
   * This endpoint establishes a long-lived connection with the client and streams
   * test execution events as they occur. It subscribes to Redis events and forwards
   * only events related to the requested run ID.
   * 
   * @route GET /stream/:id
   * @param {string} req.params.id - The ID of the test run to stream events for
   * @returns {EventStream} A stream of SSE events related to the test run
   * @throws {500} If there's an error establishing or maintaining the connection
   */
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    
    logger.info(`New SSE connection for run: ${id}`);
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    
    // Send initial connection established event
    res.write(`event: connected\ndata: ${JSON.stringify({ type: 'connected', runId: id })}\n\n`);
    logger.debug(`Sent SSE connected event for run: ${id}`);
    
    // Set up heartbeat to prevent connection timeout (every 15 seconds)
    const keepAlive = setInterval(() => res.write(':\n\n'), 15_000);
    
    /**
     * Processes Redis messages and forwards relevant events to the SSE client
     * 
     * This callback function handles incoming Redis messages, parses them as JSON events,
     * and determines if they should be forwarded to the connected client. Events are
     * forwarded if they are directly related to the requested run ID or if they have a
     * related run ID (e.g., a result ID that corresponds to the requested run ID).
     * 
     * @private
     * @param {string} message - JSON string containing the event data from Redis
     */
    const messageCallback = (message: string) => {
      try {
        logger.info(`Received Redis event on channel test-events: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
        const event = JSON.parse(message);
        
        // Check if the event's runId matches our expected id or is related to it
        const isRelatedRunId = 
          event.runId === id || 
          (id.startsWith('run_') && event.runId?.startsWith('result_')) ||
          (id.startsWith('result_') && event.runId?.startsWith('run_'));
        
        // Only forward events for this run or related runs
        if (isRelatedRunId) {
          logger.info(`Forwarding event to SSE client: type=${event.type}, runId=${event.runId} (related to ${id})`);
          
          // Send the event with proper SSE format including event type
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          
          // Flush the response to ensure immediate delivery
          if (res.flush) {
            res.flush();
          }
          
          // Log the event being sent
          logger.debug(`Sent SSE event: ${event.type} for run: ${event.runId} (related to ${id})`);
        } else {
          logger.debug(`Ignoring event for unrelated run: ${event.runId} (we want ${id})`);
        }
      } catch (error) {
        logger.error(`Error parsing event: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    // Add this client to the stream manager
    addClient(id, res);
    
    // Subscribe to Redis events for this run
    redisService.subscribe('test-events', messageCallback);
    
    // Handle client disconnect
    req.on('close', async () => {
      logger.info(`SSE connection closed for run: ${id}`);
      
      // Clear the keepalive interval
      clearInterval(keepAlive);
      
      try {
        // Unsubscribe from Redis events
        await redisService.unsubscribe('test-events');
      } catch (error) {
        logger.error(`Error during unsubscribe on connection close: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with cleanup even if unsubscribe fails
      }
    });
    
    // Send current state of the run if available
    try {
      const run = await redisService.getTestResult(id);
      if (run) {
        // Send the current state with a specific event type
        res.write(`event: test-result\ndata: ${JSON.stringify(run)}\n\n`);
        logger.debug(`Sent current test result state for run: ${id}`);
      }
    } catch (error) {
      logger.error(`Error fetching test result: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  /**
   * Sets up WebSocket server for live streaming of test execution events
   * 
   * This function initializes a WebSocket server that allows clients to establish
   * bidirectional connections for receiving real-time test execution events. It
   * subscribes to Redis events and forwards only events related to the requested run ID.
   * The WebSocket connection requires a runId query parameter to identify which test
   * run events to stream.
   * 
   * @param {http.Server|https.Server} server - HTTP or HTTPS server instance to attach the WebSocket server to
   * @returns {WebSocket.Server} The configured WebSocket server instance
   * @throws {Error} If there's an error setting up the WebSocket server
   */
  const setupWebSocketServer = (server: any) => {
    const wss = new WebSocket.Server({ server, path: '/api/v1/stream/ws' });
    
    /**
     * Handles new WebSocket connections
     * 
     * This event handler processes new WebSocket connections, extracts the run ID from
     * the URL query parameters, and sets up event subscriptions and message handlers.
     * It validates that a runId is provided and closes the connection if it's missing.
     * 
     * @private
     * @param {WebSocket} ws - The WebSocket connection object
     * @param {http.IncomingMessage} req - The HTTP request that initiated the connection
     */
    wss.on('connection', (ws, req) => {
      // Extract run ID from URL
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const runId = url.searchParams.get('runId');
      
      if (!runId) {
        logger.warn('WebSocket connection without runId');
        ws.close(1008, 'Missing runId parameter');
        return;
      }
      
      logger.info(`New WebSocket connection for run: ${runId}`);
      
      /**
       * Processes Redis messages and forwards relevant events to the WebSocket client
       * 
       * This callback function handles incoming Redis messages, parses them as JSON events,
       * and determines if they should be forwarded to the connected WebSocket client. Events
       * are forwarded if they are directly related to the requested run ID or if they have a
       * related run ID (e.g., a result ID that corresponds to the requested run ID).
       * 
       * @private
       * @param {string} message - JSON string containing the event data from Redis
       */
      const handleMessage = (message: string) => {
        try {
          logger.info(`Received Redis event on channel test-events for WebSocket: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
          const event = JSON.parse(message);
          
          // Check if the event's runId matches our expected runId or is related to it
          const isRelatedRunId = 
            event.runId === runId || 
            (runId.startsWith('run_') && event.runId?.startsWith('result_')) ||
            (runId.startsWith('result_') && event.runId?.startsWith('run_'));
          
          // Only forward events for this run or related runs
          if (isRelatedRunId) {
            logger.info(`Forwarding event to WebSocket client: type=${event.type}, runId=${event.runId} (related to ${runId})`);
            ws.send(JSON.stringify(event));
          } else {
            logger.debug(`Ignoring WebSocket event for unrelated run: ${event.runId} (we want ${runId})`);
          }
        } catch (error) {
          logger.error(`Error parsing event for WebSocket: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      redisService.subscribe('test-events', handleMessage);
      
      /**
       * Handles WebSocket connection closure
       * 
       * This event handler cleans up resources when a WebSocket connection is closed,
       * including unsubscribing from Redis events to prevent memory leaks.
       * 
       * @private
       */
      ws.on('close', async () => {
        logger.info(`WebSocket connection closed for run: ${runId}`);
        try {
          await redisService.unsubscribe('test-events');
        } catch (error) {
          logger.error(`Error during unsubscribe on WebSocket close: ${error instanceof Error ? error.message : String(error)}`);
          // Continue with cleanup even if unsubscribe fails
        }
      });
      
      /**
       * Handles incoming messages from the WebSocket client
       * 
       * This event handler processes messages sent from the client to the server.
       * Currently, it only logs the messages, but it could be extended to support
       * bidirectional communication for features like pausing or resuming test execution.
       * 
       * @private
       * @param {WebSocket.Data} message - The message received from the client
       */
      ws.on('message', (message) => {
        logger.debug(`Received message from client: ${message}`);
        // Handle client commands here (e.g., pause, resume)
      });
    });
    
    logger.info('WebSocket server initialized');
    return wss;
  };
  
  // Expose the WebSocket setup function
  (router as any).setupWebSocketServer = setupWebSocketServer;
  
  return router;
}