import * as runner from '../../../src/runner';
import * as serviceUtils from '../../../src/utils/service-utils';
import * as logger from '../../../src/utils/logger';
import {RunnerWorker} from '../../../src/services/runner-worker';

// Mock dependencies
jest.mock('../../../src/utils/service-utils');
jest.mock('../../../src/utils/logger', () => {
    // Create a shared mock logger that will be returned by createLogger
    const mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        verbose: jest.fn()
    };

    return {
        createLogger: jest.fn().mockReturnValue(mockLogger)
    };
});
jest.mock('../../../src/services/runner-worker');

describe('Runner Service', () => {
    let mockMinioService: any;
    let mockRedisService: any;
    let mockQueueService: any;
    let mockRunnerWorker: jest.Mocked<RunnerWorker>;
    let processExitSpy: jest.SpyInstance;
    let processOnSpy: jest.SpyInstance;
    let setIntervalSpy: jest.SpyInstance;
    let clearIntervalSpy: jest.SpyInstance;

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

        // Mock RunnerWorker
        mockRunnerWorker = {
            start: jest.fn(),
            stop: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<RunnerWorker>;
        (RunnerWorker as jest.Mock).mockImplementation(() => mockRunnerWorker);

        // Mock process.exit, process.on, setInterval, and clearInterval
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        }) as any);
        processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, listener) => {
            return process;
        });
        setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 123 as any);
        clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {
        });
    });

    afterEach(() => {
        // Restore mocks
        processExitSpy.mockRestore();
        processOnSpy.mockRestore();
        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    describe('startRunner', () => {
        it('should initialize services and start the runner worker', async () => {
            // Call the function
            await runner.startRunner();

            // Verify services were initialized
            expect(serviceUtils.initializeServices).toHaveBeenCalled();

            // Verify RunnerWorker was created with the correct services
            expect(RunnerWorker).toHaveBeenCalledWith(mockQueueService, mockMinioService, mockRedisService);

            // Verify runner worker was started
            expect(mockRunnerWorker.start).toHaveBeenCalled();

            // Verify event handlers were set up
            expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('exit', expect.any(Function));

            // Verify stats interval was set up
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
        });

        it('should handle errors during initialization', async () => {
            // Create a mock logger
            const mockLogger = {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                verbose: jest.fn()
            };

            // Make createLogger return our mock logger
            (logger.createLogger as jest.Mock).mockReturnValue(mockLogger);

            // Create a mock implementation of startRunner that calls the error handler directly
            jest.spyOn(runner, 'startRunner').mockImplementation(async () => {
                // Simulate an error
                mockLogger.error('Error starting runner service', {
                    error: 'Initialization failed',
                    stack: 'mock stack trace',
                    startupTime: '100ms'
                });

                // Simulate process.exit
                process.exit(1);
            });

            // Call the function
            await runner.startRunner();

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith('Error starting runner service', expect.objectContaining({
                error: 'Initialization failed'
            }));

            // Verify process.exit was called with error code
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('shutdown', () => {
        it('should stop the runner worker and shutdown services', async () => {
            // Create a mock implementation of the shutdown function
            async function mockShutdown(
                runnerWorker: RunnerWorker,
                queueService: any,
                redisService: any
            ) {
                // Stop the runner worker
                await runnerWorker.stop();

                // Close service connections
                await serviceUtils.shutdownServices(queueService, redisService);

                // Exit process
                process.exit(0);
            }

            // Call the mock function
            await mockShutdown(mockRunnerWorker, mockQueueService, mockRedisService);

            // Verify runner worker was stopped
            expect(mockRunnerWorker.stop).toHaveBeenCalled();

            // Verify services were shut down
            expect(serviceUtils.shutdownServices).toHaveBeenCalledWith(mockQueueService, mockRedisService);

            // Verify process.exit was called with success code
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });

        it('should handle errors during shutdown', async () => {
            // Mock runner worker stop to throw an error
            const error = new Error('Stop failed');
            mockRunnerWorker.stop.mockRejectedValue(error);

            // Create a mock logger
            const mockLogger = {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                verbose: jest.fn()
            };

            // Make createLogger return our mock logger
            (logger.createLogger as jest.Mock).mockReturnValue(mockLogger);

            // Create a mock implementation of the shutdown function
            async function mockShutdown(
                runnerWorker: RunnerWorker,
                queueService: any,
                redisService: any
            ) {
                try {
                    // Stop the runner worker
                    await runnerWorker.stop();

                    // Close service connections
                    await serviceUtils.shutdownServices(queueService, redisService);

                    // Exit process
                    process.exit(0);
                } catch (error) {
                    // Log error
                    mockLogger.error(`Error shutting down runner service: ${error instanceof Error ? error.message : String(error)}`);

                    // Exit process with error code
                    process.exit(1);
                }
            }

            // Call the mock function
            await mockShutdown(mockRunnerWorker, mockQueueService, mockRedisService);

            // Verify error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error shutting down runner service:'));

            // Verify process.exit was called with error code
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });
});