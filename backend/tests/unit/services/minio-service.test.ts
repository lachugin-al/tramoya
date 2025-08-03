import { MinioService } from '../../../src/services/minio-service';
import * as Minio from 'minio';
import * as fs from 'fs';

// Mock dependencies
jest.mock('minio');
jest.mock('fs');

describe('MinioService', () => {
  let minioService: MinioService;
  let mockClient: jest.Mocked<Minio.Client>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock fs.statSync
    (fs.statSync as jest.Mock).mockReturnValue({
      size: 1024
    });

    // Create mock Minio client
    mockClient = {
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      setBucketPolicy: jest.fn(),
      fPutObject: jest.fn(),
      presignedGetObject: jest.fn(),
    } as unknown as jest.Mocked<Minio.Client>;

    // Mock Minio.Client constructor
    (Minio.Client as jest.MockedClass<typeof Minio.Client>).mockImplementation(() => mockClient);

    // Initialize service
    minioService = new MinioService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize Minio client with default configuration if environment variables are not set', () => {
      // Clear environment variables
      const originalEnv = process.env;
      process.env = {};

      // Create new service instance
      new MinioService();

      // Check if Minio.Client was called with default config
      expect(Minio.Client).toHaveBeenCalledWith({
        endPoint: 'minio',
        port: 9000,
        useSSL: false,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin'
      });

      // Restore environment variables
      process.env = originalEnv;
    });

    it('should initialize Minio client with configuration from environment variables', () => {
      // Set environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        MINIO_ENDPOINT: 'custom-minio',
        MINIO_PORT: '8000',
        MINIO_ACCESS_KEY: 'custom-access',
        MINIO_SECRET_KEY: 'custom-secret',
        MINIO_USE_SSL: 'true',
        MINIO_BUCKET: 'custom-bucket'
      };

      // Create new service instance
      new MinioService();

      // Check if Minio.Client was called with config from environment variables
      expect(Minio.Client).toHaveBeenCalledWith({
        endPoint: 'custom-minio',
        port: 8000,
        useSSL: true,
        accessKey: 'custom-access',
        secretKey: 'custom-secret'
      });

      // Restore environment variables
      process.env = originalEnv;
    });
  });

  describe('ensureBucket', () => {
    it('should not create bucket if it already exists', async () => {
      mockClient.bucketExists.mockResolvedValue(true);

      await minioService.ensureBucket();

      expect(mockClient.bucketExists).toHaveBeenCalled();
      expect(mockClient.makeBucket).not.toHaveBeenCalled();
      expect(mockClient.setBucketPolicy).not.toHaveBeenCalled();
    });

    it('should create bucket and set policy if bucket does not exist', async () => {
      mockClient.bucketExists.mockResolvedValue(false);
      mockClient.makeBucket.mockResolvedValue(undefined);
      mockClient.setBucketPolicy.mockResolvedValue(undefined);

      await minioService.ensureBucket();

      expect(mockClient.bucketExists).toHaveBeenCalled();
      expect(mockClient.makeBucket).toHaveBeenCalledWith('test-bucket', 'us-east-1');
      expect(mockClient.setBucketPolicy).toHaveBeenCalled();
      
      // Verify policy content
      const policyArg = mockClient.setBucketPolicy.mock.calls[0][1];
      const policy = JSON.parse(policyArg);
      expect(policy.Statement[0].Action).toEqual(['s3:GetObject']);
      expect(policy.Statement[0].Resource).toEqual(['arn:aws:s3:::test-bucket/*']);
    });

    it('should throw error if bucket check fails', async () => {
      const error = new Error('Bucket check failed');
      mockClient.bucketExists.mockRejectedValue(error);

      await expect(minioService.ensureBucket()).rejects.toThrow('Bucket check failed');
    });
  });

  describe('uploadFile', () => {
    it('should upload file with correct content type', async () => {
      mockClient.bucketExists.mockResolvedValue(true);
      mockClient.fPutObject.mockResolvedValue({
        etag: 'etag123',
        versionId: 'v1'
      });

      const filePath = '/path/to/image.png';
      const objectName = 'images/image.png';

      await minioService.uploadFile(filePath, objectName);

      expect(mockClient.fPutObject).toHaveBeenCalledWith(
        'test-bucket',
        objectName,
        filePath,
        {
          'Content-Type': 'image/png'
        }
      );
    });

    it('should ensure bucket exists before uploading', async () => {
      mockClient.bucketExists.mockResolvedValue(false);
      mockClient.makeBucket.mockResolvedValue(undefined);
      mockClient.setBucketPolicy.mockResolvedValue(undefined);
      mockClient.fPutObject.mockResolvedValue({
        etag: 'etag123',
        versionId: 'v1'
      });

      const filePath = '/path/to/file.txt';
      const objectName = 'files/file.txt';

      await minioService.uploadFile(filePath, objectName);

      expect(mockClient.bucketExists).toHaveBeenCalled();
      expect(mockClient.makeBucket).toHaveBeenCalled();
      expect(mockClient.fPutObject).toHaveBeenCalled();
    });

    it('should throw error if file upload fails', async () => {
      mockClient.bucketExists.mockResolvedValue(true);
      const error = new Error('Upload failed');
      mockClient.fPutObject.mockRejectedValue(error);

      const filePath = '/path/to/file.txt';
      const objectName = 'files/file.txt';

      await expect(minioService.uploadFile(filePath, objectName)).rejects.toThrow('Upload failed');
    });
  });

  describe('getPresignedUrl', () => {
    it('should generate presigned URL with default expiry', async () => {
      const objectName = 'files/file.txt';
      const presignedUrl = 'https://minio.example.com/tramoya/files/file.txt?signature=abc123';
      
      mockClient.presignedGetObject.mockResolvedValue(presignedUrl);

      const result = await minioService.getPresignedUrl(objectName);

      expect(mockClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        objectName,
        86400 // Default expiry (24 hours)
      );
      expect(result).toBe(presignedUrl);
    });

    it('should generate presigned URL with custom expiry', async () => {
      const objectName = 'files/file.txt';
      const expirySeconds = 3600; // 1 hour
      const presignedUrl = 'https://minio.example.com/tramoya/files/file.txt?signature=abc123';
      
      mockClient.presignedGetObject.mockResolvedValue(presignedUrl);

      const result = await minioService.getPresignedUrl(objectName, expirySeconds);

      expect(mockClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        objectName,
        expirySeconds
      );
      expect(result).toBe(presignedUrl);
    });

    it('should throw error if presigned URL generation fails', async () => {
      const objectName = 'files/file.txt';
      const error = new Error('Presigned URL generation failed');
      
      mockClient.presignedGetObject.mockRejectedValue(error);

      await expect(minioService.getPresignedUrl(objectName)).rejects.toThrow('Presigned URL generation failed');
    });
  });

  describe('getPublicUrl', () => {
    it('should generate public URL with correct format', () => {
      const objectName = 'files/file.txt';
      const result = minioService.getPublicUrl(objectName);

      expect(result).toBe('/storage/files/file.txt');
    });
  });

  describe('getContentType', () => {
    it('should return correct content type for various file extensions', () => {
      // Access the private method using type assertion
      const service = minioService as any;

      expect(service.getContentType('image.png')).toBe('image/png');
      expect(service.getContentType('image.jpg')).toBe('image/jpeg');
      expect(service.getContentType('image.jpeg')).toBe('image/jpeg');
      expect(service.getContentType('image.gif')).toBe('image/gif');
      expect(service.getContentType('image.svg')).toBe('image/svg+xml');
      expect(service.getContentType('data.json')).toBe('application/json');
      expect(service.getContentType('file.txt')).toBe('text/plain');
      expect(service.getContentType('page.html')).toBe('text/html');
      expect(service.getContentType('style.css')).toBe('text/css');
      expect(service.getContentType('script.js')).toBe('application/javascript');
      expect(service.getContentType('unknown.xyz')).toBe('application/octet-stream');
    });
  });
});