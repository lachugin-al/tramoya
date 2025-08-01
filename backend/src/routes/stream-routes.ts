import express, { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { RedisService } from '../services/redis-service';
import { EVENT_CHANNELS } from '../services/queue-service';
import * as WebSocket from 'ws';
import { addClient } from '../services/stream-manager';

const logger = createLogger('stream-routes');

/**
 * Create stream routes
 */
export default function streamRoutes(redisService: RedisService): Router {
  const router = express.Router();
  
  /**
   * GET /stream/:id
   * SSE endpoint for streaming test run events
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
    
    // Create message callback function
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
   * Set up WebSocket server for live streaming
   * @param server HTTP server instance
   */
  const setupWebSocketServer = (server: any) => {
    const wss = new WebSocket.Server({ server, path: '/api/v1/stream/ws' });
    
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
      
      // Subscribe to Redis events for this run
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
      
      // Handle client disconnect
      ws.on('close', async () => {
        logger.info(`WebSocket connection closed for run: ${runId}`);
        try {
          await redisService.unsubscribe('test-events');
        } catch (error) {
          logger.error(`Error during unsubscribe on WebSocket close: ${error instanceof Error ? error.message : String(error)}`);
          // Continue with cleanup even if unsubscribe fails
        }
      });
      
      // Handle client messages (for future bidirectional communication)
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