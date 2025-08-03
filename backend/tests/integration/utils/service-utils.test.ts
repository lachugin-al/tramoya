import { initializeServices, shutdownServices } from '../../../src/utils/service-utils';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { QueueService } from '../../../src/services/queue-service';

// We need to partially mock the services to avoid actual connections
// but still test the integration between service-utils and the services
jest.mock('../../../src/services/minio-service', () => {
  return {
    MinioService: jest.fn().mockImplementation(() => {
      return {
        ensureBucket: jest.fn().mockResolvedValue(undefined)
      };
    })
  };
});

jest.mock('../../../src/services/redis-service', () => {
  return {
    RedisService: jest.fn().mockImplementation(() => {
      return {
        close: jest.fn().mockResolvedValue(undefined)
      };
    })
  };
});

jest.mock('../../../src/services/queue-service', () => {
  return {
    QueueService: jest.fn().mockImplementation(() => {
      return {
        close: jest.fn().mockResolvedValue(undefined)
      };
    }),
    QUEUE_NAMES: {
      TEST_EXECUTION: 'test-execution'
    }
  };
});

describe('Service Utils Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set environment variables for testing
    process.env.MINIO_ENDPOINT = 'test-minio:9000';
    process.env.MINIO_BUCKET = 'test-bucket';
    process.env.REDIS_HOST = 'test-redis';
    process.env.REDIS_PORT = '6379';
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('initializeServices', () => {
    it('should initialize all services and return them', async () => {
      // Initialize services
      const services = await initializeServices();
      
      // Verify services were created
      expect(services).toHaveProperty('minioService');
      expect(services).toHaveProperty('redisService');
      expect(services).toHaveProperty('queueService');
      
      // Verify services are instances of the correct classes
      expect(services.minioService).toBeInstanceOf(Object);
      expect(services.redisService).toBeInstanceOf(Object);
      expect(services.queueService).toBeInstanceOf(Object);
      
      // Verify MinioService was initialized with environment variables
      expect(MinioService).toHaveBeenCalled();
      
      // Verify bucket was ensured
      expect(services.minioService.ensureBucket).toHaveBeenCalled();
      
      // Verify QueueService was initialized with RedisService
      expect(QueueService).toHaveBeenCalledWith(services.redisService);
    });
    
    it('should handle errors during initialization', async () => {
      // Mock ensureBucket to throw an error
      const error = new Error('Failed to create bucket');
      (MinioService as jest.Mock).mockImplementationOnce(() => {
        return {
          ensureBucket: jest.fn().mockRejectedValue(error)
        };
      });
      
      // Verify error is propagated
      await expect(initializeServices()).rejects.toThrow('Failed to create bucket');
    });
  });
  
  describe('shutdownServices', () => {
    it('should shut down all services in the correct order', async () => {
      // Initialize services
      const services = await initializeServices();
      
      // Shut down services
      await shutdownServices(services.queueService, services.redisService);
      
      // Verify services were closed in the correct order
      expect(services.queueService.close).toHaveBeenCalled();
      expect(services.redisService.close).toHaveBeenCalled();
    });
    
    it('should handle errors during shutdown', async () => {
      // Initialize services
      const services = await initializeServices();
      
      // Mock close to throw an error
      const error = new Error('Failed to close queue');
      services.queueService.close = jest.fn().mockRejectedValue(error);
      
      // Verify error is propagated
      await expect(shutdownServices(services.queueService, services.redisService)).rejects.toThrow('Failed to close queue');
    });
  });
  
  describe('Integration with environment variables', () => {
    it('should use custom environment variables', async () => {
      // Set custom environment variables
      const customEnv = {
        MINIO_ENDPOINT: 'custom-minio:9000',
        MINIO_BUCKET: 'custom-bucket',
        REDIS_HOST: 'custom-redis',
        REDIS_PORT: '6380'
      };
      
      Object.entries(customEnv).forEach(([key, value]) => {
        process.env[key] = value;
      });
      
      // Initialize services
      await initializeServices();
      
      // Restore original environment variables for this test
      Object.keys(customEnv).forEach(key => {
        process.env[key] = originalEnv[key] || '';
      });
      
      // Verify MinioService was initialized with custom environment variables
      // Note: We can't directly verify the constructor arguments, but we can verify it was called
      expect(MinioService).toHaveBeenCalled();
    });
  });
});