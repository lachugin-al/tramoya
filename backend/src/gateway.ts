/**
 * Gateway service implementation.
 *
 * This file implements the API gateway service that:
 * 1. Handles HTTP requests and WebSocket connections
 * 2. Configures middleware for CORS, body parsing, request ID tracking, and logging
 * 3. Sets up API routes
 * 4. Manages connections to external services (MinIO, Redis, Queue)
 * 5. Provides graceful shutdown handling
 *
 * The gateway service is the main entry point for client applications to interact with the system.
 *
 * @module gateway
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import {createLogger, requestIdMiddleware} from './utils/logger';
import {setupRoutes} from './routes';
import {initializeServices, shutdownServices} from './utils/service-utils';
import morgan from 'morgan';
import os from 'os';

const logger = createLogger('gateway');

/**
 * Initializes and starts the gateway service.
 *
 * This function:
 * 1. Logs system information (node version, platform, architecture, etc.)
 * 2. Initializes required services (MinIO, Redis, Queue)
 * 3. Creates an Express application and configures middleware:
 *    - CORS
 *    - Body parser
 *    - Request ID tracking
 *    - Request logging with Morgan
 *    - Error handling
 * 4. Sets up API routes
 * 5. Starts the HTTP server
 * 6. Configures WebSocket server if stream routes are available
 * 7. Sets up event handlers for graceful shutdown
 * 8. Sets up error handling for uncaught exceptions and unhandled promise rejections
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the gateway service is started
 * @throws {Error} If there's an error during service initialization or startup
 */
async function startGateway() {
    logger.info('Starting gateway service', {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        cpus: os.cpus().length
    });

    const startTime = Date.now();

    try {
        // Initialize services
        logger.debug('Initializing services');
        const {minioService, redisService, queueService} = await initializeServices();
        logger.debug('Services initialized successfully', {
            serviceTypes: ['minio', 'redis', 'queue'],
            initTime: `${Date.now() - startTime}ms`
        });

        // Create Express app
        const app = express();
        const port = process.env.PORT || 3001;

        // Middleware
        logger.debug('Setting up middleware');

        // CORS configuration
        const corsOptions = {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
        };
        app.use(cors(corsOptions));
        logger.debug('CORS middleware configured', {corsOptions});

        // Body parser
        app.use(bodyParser.json({limit: '10mb'}));
        app.use(bodyParser.urlencoded({extended: true}));
        logger.debug('Body parser middleware configured');

        // Request ID middleware
        app.use(requestIdMiddleware);
        logger.debug('Request ID middleware configured');

        // Request logging with Morgan
        morgan.token('request-id', (req: any) => req.headers['x-request-id'] || 'no-request-id');
        app.use(morgan(':remote-addr :request-id :method :url :status :response-time ms - :res[content-length]', {
            stream: {
                write: (message: string) => {
                    logger.http(message.trim());
                }
            }
        }));
        logger.debug('Morgan request logging middleware configured');

        // Error handling middleware
        app.use((err: any, req: any, res: any, next: any) => {
            logger.error('Express error handler caught an error', {
                error: err.message,
                stack: err.stack,
                path: req.path,
                method: req.method
            });

            res.status(500).json({
                error: 'Internal Server Error',
                requestId: req.headers['x-request-id']
            });
        });
        logger.debug('Error handling middleware configured');

        // Set up routes with services
        logger.debug('Setting up routes');
        const routes = setupRoutes(app, minioService, redisService, queueService);
        logger.debug('Routes configured successfully');

        // Start server
        const server = app.listen(port, () => {
            const setupTime = Date.now() - startTime;
            logger.info(`Gateway service listening on port ${port}`, {
                port,
                setupTime: `${setupTime}ms`,
                env: process.env.NODE_ENV || 'development'
            });
        });

        // Set up WebSocket server
        if (routes.streamRoutes) {
            logger.debug('Setting up WebSocket server');
            // Use type assertion to handle the custom property
            const streamRouter = routes.streamRoutes as any;
            if (streamRouter.setupWebSocketServer) {
                streamRouter.setupWebSocketServer(server);
                logger.info('WebSocket server initialized');
            }
        }

        // Handle shutdown signals
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down');
            await shutdown(server, queueService, redisService);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down');
            await shutdown(server, queueService, redisService);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', {
                error: error.message,
                stack: error.stack
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined
            });
        });
    } catch (error) {
        logger.error('Error starting gateway service', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            startupTime: `${Date.now() - startTime}ms`
        });
        process.exit(1);
    }
}

/**
 * Gracefully shuts down the gateway service.
 *
 * This function:
 * 1. Closes the HTTP server
 * 2. Closes connections to external services (Queue, Redis)
 * 3. Logs the shutdown status
 * 4. Exits the process
 *
 * @async
 * @param {any} server - The HTTP server instance to close
 * @param {any} queueService - The queue service instance to shut down
 * @param {any} redisService - The Redis service instance to shut down
 * @returns {Promise<void>} A promise that resolves when the shutdown is complete
 * @throws {Error} If there's an error during the shutdown process
 */
async function shutdown(
    server: any,
    queueService: any,
    redisService: any
) {
    logger.info('Shutting down gateway service');

    try {
        // Close HTTP server
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // Close service connections
        await shutdownServices(queueService, redisService);

        logger.info('Gateway service shut down successfully');
        process.exit(0);
    } catch (error) {
        logger.error(`Error shutting down gateway service: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

export {startGateway};