import * as runner from '../../../src/runner';
import * as serviceUtils from '../../../src/utils/service-utils';
import {RunnerWorker} from '../../../src/services/runner-worker';
import {createLogger} from '../../../src/utils/logger';

// Create a real logger for integration tests
const logger = createLogger('runner-integration-test');

// Partially mock service-utils to avoid actual connections to external services
jest.mock('../../../src/utils/service-utils', () => {
    const originalModule = jest.requireActual('../../../src/utils/service-utils');
    return {
        ...originalModule,
        initializeServices: jest.fn(),
        shutdownServices: jest.fn().mockResolvedValue(undefined)
    };
});

// Mock RunnerWorker
jest.mock('../../../src/services/runner-worker');

// Create a mock RunnerWorker instance that we can control
const mockRunnerWorkerInstance = {
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined)
};

// Set up the RunnerWorker constructor mock to return our instance
(RunnerWorker as jest.Mock).mockImplementation(() => mockRunnerWorkerInstance);

describe('Runner Service Integration', () => {
    let mockMinioService: any;
    let mockRedisService: any;
    let mockQueueService: any;
    let runnerWorkerInstance: any;
    let processExitSpy: jest.SpyInstance;
    let processOnSpy: jest.SpyInstance;
    let setIntervalSpy: jest.SpyInstance;
    let clearIntervalSpy: jest.SpyInstance;
    let intervalId: any;

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

        // Mock setInterval and clearInterval
        setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((fn, ms) => {
            intervalId = 123; // Mock interval ID
            return intervalId;
        });
        clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {
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

        // Start the runner service
        await runner.startRunner();

        // We already have the RunnerWorker instance defined at the top
        runnerWorkerInstance = mockRunnerWorkerInstance;

        logger.info('Integration test runner started');
    });

    afterAll(async () => {
        // Call the shutdown handler if it was registered
        if (shutdownHandler) {
            await shutdownHandler();
        }

        // Restore mocks
        processExitSpy.mockRestore();
        processOnSpy.mockRestore();
        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();

        logger.info('Integration test runner shut down');
    });

    // Store the shutdown handler
    let shutdownHandler: Function | null = null;

    it('should initialize services correctly', () => {
        // Verify that initializeServices was called
        expect(serviceUtils.initializeServices).toHaveBeenCalled();
    });

    it('should create and start a RunnerWorker', () => {
        // Verify that RunnerWorker was created with the correct services
        expect(RunnerWorker).toHaveBeenCalledWith(mockQueueService, mockMinioService, mockRedisService);

        // Verify that the RunnerWorker instance was started
        expect(runnerWorkerInstance.start).toHaveBeenCalled();
    });

    it('should set up a periodic stats logging interval', () => {
        // Verify that setInterval was called
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('should handle shutdown correctly', async () => {
        // Verify that the shutdown handler was registered
        expect(shutdownHandler).toBeDefined();

        // Call the shutdown handler
        if (shutdownHandler) {
            await shutdownHandler();
        }

        // Verify that the RunnerWorker was stopped
        expect(runnerWorkerInstance.stop).toHaveBeenCalled();

        // Verify that shutdownServices was called
        expect(serviceUtils.shutdownServices).toHaveBeenCalled();

        // Verify that process.exit was called with success code
        expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle errors during shutdown', async () => {
        // Mock runnerWorker.stop to throw an error
        runnerWorkerInstance.stop.mockRejectedValueOnce(new Error('Stop failed'));

        // Call the shutdown handler
        if (shutdownHandler) {
            await shutdownHandler();
        }

        // Verify that process.exit was called with error code
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should clear the stats interval on exit', () => {
        // Get the exit handler
        const exitHandler = processOnSpy.mock.calls.find(call => call[0] === 'exit')?.[1];

        // Call the exit handler if it exists
        if (exitHandler) {
            exitHandler();
        }

        // Verify that clearInterval was called with the correct interval ID
        expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });
});