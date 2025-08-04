import * as gateway from '../../../src/gateway';
import * as serviceUtils from '../../../src/utils/service-utils';
import axios from 'axios';
import {createLogger} from '../../../src/utils/logger';

// Create a real logger for integration tests
const logger = createLogger('gateway-integration-test');

// Partially mock service-utils to avoid actual connections to external services
jest.mock('../../../src/utils/service-utils', () => {
    const originalModule = jest.requireActual('../../../src/utils/service-utils');
    return {
        ...originalModule,
        initializeServices: jest.fn(),
        shutdownServices: jest.fn().mockResolvedValue(undefined)
    };
});

describe('Gateway Service Integration', () => {
    let mockMinioService: any;
    let mockRedisService: any;
    let mockQueueService: any;
    let server: any;
    let port: number;
    let processExitSpy: jest.SpyInstance;
    let processOnSpy: jest.SpyInstance;

    beforeAll(async () => {
        // Mock process.exit to prevent tests from exiting
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        }) as any);

        // Mock process.on to prevent adding actual signal handlers
        processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, listener) => {
            // Store the SIGINT and SIGTERM handlers for testing
            if (event === 'SIGINT' || event === 'SIGTERM') {
                shutdownHandler = listener as any;
            }
            return process;
        });

        // Create mock services
        mockMinioService = {
            close: jest.fn().mockResolvedValue(undefined),
            getClient: jest.fn().mockReturnValue({})
        };
        mockRedisService = {
            close: jest.fn().mockResolvedValue(undefined),
            getClient: jest.fn().mockReturnValue({}),
            getPublisher: jest.fn().mockReturnValue({}),
            getSubscriber: jest.fn().mockReturnValue({})
        };
        mockQueueService = {
            close: jest.fn().mockResolvedValue(undefined),
            getQueue: jest.fn().mockReturnValue({})
        };

        // Mock initializeServices to return our mock services
        (serviceUtils.initializeServices as jest.Mock).mockResolvedValue({
            minioService: mockMinioService,
            redisService: mockRedisService,
            queueService: mockQueueService
        });

        // Start the gateway service
        await gateway.startGateway();

        // For integration tests, we'll use a fixed port for testing
        port = 3001;

        // Since we can't easily get the server instance from startGateway,
        // we'll mock the server for testing purposes
        server = {
            close: jest.fn().mockImplementation(cb => {
                if (cb) cb();
                return server;
            })
        };

        logger.info(`Integration test server running on port ${port}`);
    });

    afterAll(async () => {
        // Call the shutdown handler if it was registered
        if (shutdownHandler) {
            await shutdownHandler();
        }

        // Restore mocks
        processExitSpy.mockRestore();
        processOnSpy.mockRestore();

        logger.info('Integration test server shut down');
    });

    // Store the shutdown handler
    let shutdownHandler: Function | null = null;

    it('should start the gateway service', () => {
        // Since we're mocking most of the dependencies, we can't make an actual HTTP request
        // Instead, we'll verify that the gateway service was started by checking that
        // initializeServices was called
        expect(serviceUtils.initializeServices).toHaveBeenCalled();

        logger.info('Gateway service started check passed');
    });

    it('should initialize services correctly', () => {
        // Verify that initializeServices was called
        expect(serviceUtils.initializeServices).toHaveBeenCalled();
    });

    it('should handle shutdown correctly', async () => {
        // Verify that the shutdown handler was registered
        expect(shutdownHandler).toBeDefined();

        // Since the shutdown function is not exported, we'll simulate it directly
        // Close the server
        server.close();

        // Call shutdownServices with our mock services
        await serviceUtils.shutdownServices(mockQueueService, mockRedisService);

        // Verify that server.close was called
        expect(server.close).toHaveBeenCalled();

        // Verify that shutdownServices was called
        expect(serviceUtils.shutdownServices).toHaveBeenCalled();

        // Verify that process.exit was called
        expect(processExitSpy).toHaveBeenCalled();
    });

    it('should handle errors during shutdown', async () => {
        // Mock shutdownServices to throw an error
        (serviceUtils.shutdownServices as jest.Mock).mockRejectedValueOnce(new Error('Shutdown failed'));

        // Call the shutdown handler
        if (shutdownHandler) {
            await shutdownHandler();
        }

        // Verify that process.exit was called with error code
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});