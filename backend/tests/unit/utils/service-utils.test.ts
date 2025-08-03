import { initializeServices, shutdownServices } from '../../../src/utils/service-utils';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { QueueService } from '../../../src/services/queue-service';
import { createLogger } from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/services/minio-service');
jest.mock('../../../src/services/redis-service');
jest.mock('../../../src/services/queue-service');
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

describe('Service Utils', () => {
  let mockMinioService: jest.Mocked<MinioService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockMinioService = new MinioService() as jest.Mocked<MinioService>;
    mockRedisService = new RedisService() as jest.Mocked<RedisService>;
    mockQueueService = new QueueService(mockRedisService) as jest.Mocked<QueueService>;
    mockLogger = createLogger('service-utils');

    // Mock constructor behavior
    (MinioService as jest.Mock).mockImplementation(() => mockMinioService);
    (RedisService as jest.Mock).mockImplementation(() => mockRedisService);
    (QueueService as jest.Mock).mockImplementation(() => mockQueueService);

    // Mock methods
    mockMinioService.ensureBucket = jest.fn().mockResolvedValue(undefined);
    mockRedisService.close = jest.fn().mockResolvedValue(undefined);
    mockQueueService.close = jest.fn().mockResolvedValue(undefined);
  });

  describe('initializeServices', () => {
    it('should initialize all services successfully', async () => {
      const result = await initializeServices();

      // Verify services were created
      expect(MinioService).toHaveBeenCalled();
      expect(RedisService).toHaveBeenCalled();
      expect(QueueService).toHaveBeenCalledWith(mockRedisService);

      // Verify bucket was ensured
      expect(mockMinioService.ensureBucket).toHaveBeenCalled();

      // Verify logger was used
      expect(createLogger).toHaveBeenCalledWith('service-utils');
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing services');
      expect(mockLogger.info).toHaveBeenCalledWith('Services initialized successfully', expect.any(Object));

      // Verify result contains all services
      expect(result).toEqual({
        minioService: mockMinioService,
        redisService: mockRedisService,
        queueService: mockQueueService
      });
    });

    it('should handle errors during initialization', async () => {
      // Mock ensureBucket to throw an error
      const error = new Error('Failed to create bucket');
      mockMinioService.ensureBucket.mockRejectedValue(error);

      // Verify error is propagated
      await expect(initializeServices()).rejects.toThrow('Failed to create bucket');

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith('Error initializing services', expect.objectContaining({
        error: 'Failed to create bucket'
      }));
    });

    it('should use environment variables for service configuration', async () => {
      // Set environment variables
      const originalEnv = process.env;
      process.env.MINIO_ENDPOINT = 'custom-minio:9000';
      process.env.MINIO_BUCKET = 'custom-bucket';
      process.env.REDIS_HOST = 'custom-redis';
      process.env.REDIS_PORT = '6380';

      await initializeServices();

      // Restore original environment
      process.env = originalEnv;

      // Verify logger output contains the custom values
      expect(mockLogger.info).toHaveBeenCalledWith('Services initialized successfully', expect.objectContaining({
        services: expect.objectContaining({
          minio: expect.objectContaining({
            endpoint: 'custom-minio:9000',
            bucket: 'custom-bucket'
          }),
          redis: expect.objectContaining({
            host: 'custom-redis',
            port: '6380'
          })
        })
      }));
    });
  });

  describe('shutdownServices', () => {
    it('should shut down all services successfully', async () => {
      await shutdownServices(mockQueueService, mockRedisService);

      // Verify services were closed in the correct order
      expect(mockQueueService.close).toHaveBeenCalled();
      expect(mockRedisService.close).toHaveBeenCalled();

      // Verify logger was used
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down services');
      expect(mockLogger.info).toHaveBeenCalledWith('Services shut down successfully', expect.any(Object));
    });

    it('should handle errors during shutdown', async () => {
      // Mock close to throw an error
      const error = new Error('Failed to close queue');
      mockQueueService.close.mockRejectedValue(error);

      // Verify error is propagated
      await expect(shutdownServices(mockQueueService, mockRedisService)).rejects.toThrow('Failed to close queue');

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith('Error shutting down services', expect.objectContaining({
        error: 'Failed to close queue'
      }));
    });

    it('should log timing information for each shutdown step', async () => {
      await shutdownServices(mockQueueService, mockRedisService);

      // Verify debug logs for timing information
      expect(mockLogger.debug).toHaveBeenCalledWith('Closing queue connections');
      expect(mockLogger.debug).toHaveBeenCalledWith('Queue connections closed', expect.objectContaining({
        closeTime: expect.stringMatching(/\d+ms/)
      }));

      expect(mockLogger.debug).toHaveBeenCalledWith('Closing Redis connections');
      expect(mockLogger.debug).toHaveBeenCalledWith('Redis connections closed', expect.objectContaining({
        closeTime: expect.stringMatching(/\d+ms/)
      }));
    });
  });
});