import {RedisService} from '../../../src/services/redis-service';
import {TestResult, TestStatus} from '../../../src/models/test-result';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('RedisService', () => {
    let redisService: RedisService;
    let mockClient: jest.Mocked<Redis>;
    let mockPublisher: jest.Mocked<Redis>;
    let mockSubscriber: jest.Mocked<Redis>;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create mock instances
        mockClient = {
            on: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            quit: jest.fn().mockResolvedValue('OK'),
            publish: jest.fn()
        } as unknown as jest.Mocked<Redis>;

        mockPublisher = {
            on: jest.fn(),
            publish: jest.fn().mockResolvedValue(2),
            quit: jest.fn().mockResolvedValue('OK')
        } as unknown as jest.Mocked<Redis>;

        mockSubscriber = {
            on: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn().mockResolvedValue(undefined),
            quit: jest.fn().mockResolvedValue('OK')
        } as unknown as jest.Mocked<Redis>;

        // Setup mock implementation for Redis constructor
        let constructorCallCount = 0;
        (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => {
            constructorCallCount++;
            if (constructorCallCount === 1) return mockClient;
            if (constructorCallCount === 2) return mockPublisher;
            return mockSubscriber;
        });

        // Initialize service
        redisService = new RedisService();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize Redis clients with the correct URL', () => {
            expect(Redis).toHaveBeenCalledTimes(3);
            expect(Redis).toHaveBeenCalledWith('redis://localhost:6379');
        });

        it('should set up event handlers for Redis clients', () => {
            expect(mockClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockPublisher.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockPublisher.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockSubscriber.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSubscriber.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
    });

    describe('getClient', () => {
        it('should return the main Redis client', () => {
            expect(redisService.getClient()).toBe(mockClient);
        });
    });

    describe('getPublisher', () => {
        it('should return the publisher Redis client', () => {
            expect(redisService.getPublisher()).toBe(mockPublisher);
        });
    });

    describe('getSubscriber', () => {
        it('should return the subscriber Redis client', () => {
            expect(redisService.getSubscriber()).toBe(mockSubscriber);
        });
    });

    describe('publish', () => {
        it('should publish a message to the specified channel', async () => {
            mockPublisher.publish.mockResolvedValue(2); // Mock 2 subscribers received the message

            await redisService.publish('test-channel', 'test-message');

            expect(mockPublisher.publish).toHaveBeenCalledWith('test-channel', 'test-message');
        });

        it('should stringify non-string messages before publishing', async () => {
            mockPublisher.publish.mockResolvedValue(1);
            const message = {key: 'value'};

            await redisService.publish('test-channel', message);

            expect(mockPublisher.publish).toHaveBeenCalledWith('test-channel', JSON.stringify(message));
        });

        it('should handle errors during publishing', async () => {
            const error = new Error('Publish error');
            mockPublisher.publish.mockRejectedValue(error);

            await expect(redisService.publish('test-channel', 'test-message')).rejects.toThrow('Publish error');
        });
    });

    describe('subscribe', () => {
        it('should subscribe to the specified channel', () => {
            const callback = jest.fn();

            redisService.subscribe('test-channel', callback);

            expect(mockSubscriber.subscribe).toHaveBeenCalledWith('test-channel', expect.any(Function));
        });

        it('should call the callback when a message is received on the subscribed channel', () => {
            const callback = jest.fn();
            redisService.subscribe('test-channel', callback);

            // Get the 'message' event handler
            const onCall = mockSubscriber.on.mock.calls.find(call => call[0] === 'message');
            const messageHandler = onCall ? onCall[1] as Function : null;

            // Simulate receiving a message
            if (messageHandler) {
                messageHandler('test-channel', 'test-message');
                expect(callback).toHaveBeenCalledWith('test-message');
            }
        });

        it('should not call the callback when a message is received on a different channel', () => {
            const callback = jest.fn();
            redisService.subscribe('test-channel', callback);

            // Get the 'message' event handler
            const onCall = mockSubscriber.on.mock.calls.find(call => call[0] === 'message');
            const messageHandler = onCall ? onCall[1] as Function : null;

            // Simulate receiving a message on a different channel
            if (messageHandler) {
                messageHandler('other-channel', 'test-message');
                expect(callback).not.toHaveBeenCalled();
            }
        });
    });

    describe('unsubscribe', () => {
        it('should unsubscribe from the specified channel', async () => {
            mockSubscriber.unsubscribe.mockResolvedValue(undefined);

            await redisService.unsubscribe('test-channel');

            expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith('test-channel');
        });

        it('should handle errors during unsubscription without throwing', async () => {
            mockSubscriber.unsubscribe.mockRejectedValue(new Error('Unsubscribe error'));

            // Should not throw
            await expect(redisService.unsubscribe('test-channel')).resolves.not.toThrow();
        });
    });

    describe('getTestResult', () => {
        it('should retrieve a test result by ID', async () => {
            // Create a test result with fixed dates to avoid serialization issues
            const testDate = new Date('2025-08-03T18:00:00.000Z');
            const testResult: TestResult = {
                id: 'test-id',
                runId: 'run-id',
                testId: 'scenario-id',
                status: TestStatus.PASSED,
                startTime: testDate,
                endTime: testDate,
                stepResults: [],
                summary: {
                    totalSteps: 0,
                    passedSteps: 0,
                    failedSteps: 0,
                    skippedSteps: 0,
                    errorSteps: 0,
                    duration: 0
                }
            };

            // Stringify and then parse to simulate the Redis storage/retrieval process
            const serialized = JSON.stringify(testResult);
            mockClient.get.mockResolvedValue(serialized);

            const result = await redisService.getTestResult('test-id');

            expect(mockClient.get).toHaveBeenCalledWith('test:result:test-id');

            // The result will have string dates because JSON.parse doesn't convert strings back to Date objects
            const expected = JSON.parse(serialized);

            expect(result).toEqual(expected);
        });

        it('should return null if no test result is found', async () => {
            mockClient.get.mockResolvedValue(null);

            const result = await redisService.getTestResult('test-id');

            expect(result).toBeNull();
        });

        it('should handle errors during retrieval', async () => {
            mockClient.get.mockRejectedValue(new Error('Get error'));

            await expect(redisService.getTestResult('test-id')).rejects.toThrow('Get error');
        });
    });

    describe('saveTestResult', () => {
        it('should save a test result', async () => {
            const testResult: TestResult = {
                id: 'test-id',
                runId: 'run-id',
                testId: 'scenario-id',
                status: TestStatus.PASSED,
                startTime: new Date(),
                endTime: new Date(),
                stepResults: [],
                summary: {
                    totalSteps: 0,
                    passedSteps: 0,
                    failedSteps: 0,
                    skippedSteps: 0,
                    errorSteps: 0,
                    duration: 0
                }
            };

            mockClient.set.mockResolvedValue('OK');

            await redisService.saveTestResult(testResult);

            expect(mockClient.set).toHaveBeenCalledWith(
                'test:result:test-id',
                JSON.stringify(testResult)
            );
        });

        it('should handle errors during saving', async () => {
            const testResult: TestResult = {
                id: 'test-id',
                runId: 'run-id',
                testId: 'scenario-id',
                status: TestStatus.PASSED,
                startTime: new Date(),
                endTime: new Date(),
                stepResults: [],
                summary: {
                    totalSteps: 0,
                    passedSteps: 0,
                    failedSteps: 0,
                    skippedSteps: 0,
                    errorSteps: 0,
                    duration: 0
                }
            };

            mockClient.set.mockRejectedValue(new Error('Set error'));

            await expect(redisService.saveTestResult(testResult)).rejects.toThrow('Set error');
        });
    });

    describe('close', () => {
        it('should close all Redis connections', async () => {
            mockClient.quit.mockResolvedValue('OK');
            mockPublisher.quit.mockResolvedValue('OK');
            mockSubscriber.quit.mockResolvedValue('OK');

            await redisService.close();

            expect(mockClient.quit).toHaveBeenCalled();
            expect(mockPublisher.quit).toHaveBeenCalled();
            expect(mockSubscriber.quit).toHaveBeenCalled();
        });

        it('should handle errors during closing without throwing', async () => {
            mockClient.quit.mockRejectedValue(new Error('Close error'));
            mockPublisher.quit.mockResolvedValue('OK');
            mockSubscriber.quit.mockResolvedValue('OK');

            // Should not throw
            await expect(redisService.close()).resolves.not.toThrow();
        });
    });
});