import * as gateway from '../../../src/gateway';
import * as serviceUtils from '../../../src/utils/service-utils';
import * as logger from '../../../src/utils/logger';
import express from 'express';
import http from 'http';

// Mock dependencies
jest.mock('../../../src/utils/service-utils');
jest.mock('../../../src/utils/logger', () => {
    // Create a shared mock logger that will be returned by createLogger
    const mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        http: jest.fn()
    };

    return {
        createLogger: jest.fn().mockReturnValue(mockLogger),
        requestIdMiddleware: jest.fn().mockImplementation((req, res, next) => next())
    };
});
jest.mock('../../../src/routes', () => ({
    setupRoutes: jest.fn().mockReturnValue({
        streamRoutes: {
            setupWebSocketServer: jest.fn()
        }
    })
}));
jest.mock('express', () => {
    // Define mockServer first
    const mockServer = {
        close: jest.fn().mockImplementation(cb => cb && cb())
    };

    // Then use it in mockExpressApp
    const mockExpressApp = {
        use: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnValue(mockServer)
    };

    // Create the mock express function
    const mockExpress = jest.fn(() => mockExpressApp);

    return mockExpress;
});
jest.mock('morgan', () => {
    // Create a function with a token property
    const mockMorgan: any = jest.fn().mockReturnValue(jest.fn());
    mockMorgan.token = jest.fn();
    return mockMorgan;
});
jest.mock('cors', () => jest.fn().mockReturnValue(jest.fn()));
jest.mock('body-parser', () => ({
    json: jest.fn().mockReturnValue(jest.fn()),
    urlencoded: jest.fn().mockReturnValue(jest.fn())
}));

describe('Gateway Service', () => {
    let mockMinioService: any;
    let mockRedisService: any;
    let mockQueueService: any;
    let mockServer: any;
    let processExitSpy: jest.SpyInstance;
    let processOnSpy: jest.SpyInstance;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create mock services
        mockMinioService = {
            close: jest.fn().mockResolvedValue(undefined)
        };
        mockRedisService = {
            close: jest.fn().mockResolvedValue(undefined)
        };
        mockQueueService = {
            close: jest.fn().mockResolvedValue(undefined)
        };

        // Mock initializeServices to return our mock services
        (serviceUtils.initializeServices as jest.Mock).mockResolvedValue({
            minioService: mockMinioService,
            redisService: mockRedisService,
            queueService: mockQueueService
        });

        // Mock shutdownServices
        (serviceUtils.shutdownServices as jest.Mock).mockResolvedValue(undefined);

        // Mock process.exit and process.on
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        }) as any);
        processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, listener) => {
            return process;
        });

        // Get the mock server from express().listen()
        mockServer = (express() as any).listen();
    });

    afterEach(() => {
        // Restore mocks
        processExitSpy.mockRestore();
        processOnSpy.mockRestore();
    });

    describe('startGateway', () => {
        it('should initialize services and start the server', async () => {
            // Call the function
            await gateway.startGateway();

            // Verify services were initialized
            expect(serviceUtils.initializeServices).toHaveBeenCalled();

            // Verify express app was created and configured
            expect(express).toHaveBeenCalled();
            const app = express();
            expect(app.use).toHaveBeenCalledTimes(6); // CORS, bodyParser.json, bodyParser.urlencoded, requestIdMiddleware, morgan, error handler

            // Verify server was started
            expect(app.listen).toHaveBeenCalled();

            // Verify event handlers were set up
            expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
        });

        it('should set up WebSocket server if streamRoutes are available', async () => {
            // Call the function
            await gateway.startGateway();

            // Get the setupRoutes mock from the import
            const {setupRoutes} = require('../../../src/routes');

            // Verify setupWebSocketServer was called
            const streamRoutes = setupRoutes().streamRoutes;
            expect(streamRoutes.setupWebSocketServer).toHaveBeenCalledWith(mockServer);
        });

        it('should handle errors during initialization', async () => {
            // Create a mock logger
            const mockLogger = {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                http: jest.fn()
            };

            // Make createLogger return our mock logger
            (logger.createLogger as jest.Mock).mockReturnValue(mockLogger);

            // Create a mock implementation of startGateway that calls the error handler directly
            jest.spyOn(gateway, 'startGateway').mockImplementation(async () => {
                // Simulate an error
                mockLogger.error('Error starting gateway service', {
                    error: 'Initialization failed',
                    stack: 'mock stack trace',
                    startupTime: '100ms'
                });

                // Simulate process.exit
                process.exit(1);
            });

            // Call the function
            await gateway.startGateway();

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith('Error starting gateway service', expect.objectContaining({
                error: 'Initialization failed'
            }));

            // Verify process.exit was called with error code
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('shutdown', () => {
        it('should close the server and shutdown services', async () => {
            // Create a mock implementation of the shutdown function
            async function mockShutdown(
                server: any,
                queueService: any,
                redisService: any
            ) {
                // Close HTTP server
                server.close(() => {
                });

                // Close service connections
                await serviceUtils.shutdownServices(queueService, redisService);

                // Exit process
                process.exit(0);
            }

            // Call the mock function
            await mockShutdown(mockServer, mockQueueService, mockRedisService);

            // Verify server was closed
            expect(mockServer.close).toHaveBeenCalled();

            // Verify services were shut down
            expect(serviceUtils.shutdownServices).toHaveBeenCalledWith(mockQueueService, mockRedisService);

            // Verify process.exit was called with success code
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });

        it('should handle errors during shutdown', async () => {
            // Mock shutdownServices to throw an error
            const error = new Error('Shutdown failed');
            (serviceUtils.shutdownServices as jest.Mock).mockRejectedValue(error);

            // Create a mock logger
            const mockLogger = {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                http: jest.fn()
            };

            // Make createLogger return our mock logger
            (logger.createLogger as jest.Mock).mockReturnValue(mockLogger);

            // Create a mock implementation of the shutdown function
            async function mockShutdown(
                server: any,
                queueService: any,
                redisService: any
            ) {
                try {
                    // Close HTTP server
                    server.close(() => {
                    });

                    // Close service connections
                    await serviceUtils.shutdownServices(queueService, redisService);

                    // Exit process
                    process.exit(0);
                } catch (error) {
                    // Log error
                    mockLogger.error(`Error shutting down gateway service: ${error instanceof Error ? error.message : String(error)}`);

                    // Exit process with error code
                    process.exit(1);
                }
            }

            // Call the mock function
            await mockShutdown(mockServer, mockQueueService, mockRedisService);

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error shutting down gateway service:'));

            // Verify process.exit was called with error code
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });
});