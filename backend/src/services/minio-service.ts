import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('minio-service');

/**
 * Service for interacting with Minio/S3 storage
 */
export class MinioService {
  private client: Minio.Client;
  private bucket: string;
  
  constructor() {
    // Get configuration from environment variables
    const endPoint = process.env.MINIO_ENDPOINT || 'minio';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    this.bucket = process.env.MINIO_BUCKET || 'tramoya';
    
    // Initialize Minio client
    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey
    });
    
    logger.info(`MinioService initialized with endpoint: ${endPoint}:${port}, bucket: ${this.bucket}`);
  }
  
  /**
   * Ensure the bucket exists
   */
  public async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      
      if (!exists) {
        logger.info(`Creating bucket: ${this.bucket}`);
        await this.client.makeBucket(this.bucket, 'us-east-1');
        
        // Set bucket policy to allow public read access
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`]
            }
          ]
        };
        
        await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
        logger.info(`Bucket created and policy set: ${this.bucket}`);
      } else {
        logger.info(`Bucket already exists: ${this.bucket}`);
      }
    } catch (error) {
      logger.error(`Error ensuring bucket: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Upload a file to Minio
   * @param filePath Local file path
   * @param objectName Object name in Minio
   * @returns The object name
   */
  public async uploadFile(filePath: string, objectName: string): Promise<string> {
    try {
      logger.info(`Uploading file: ${filePath} to ${objectName}`);
      
      // Ensure the bucket exists
      await this.ensureBucket();
      
      // Get file metadata
      const fileStats = fs.statSync(filePath);
      
      // Upload the file
      await this.client.fPutObject(
        this.bucket,
        objectName,
        filePath,
        {
          'Content-Type': this.getContentType(filePath)
        }
      );
      
      logger.info(`File uploaded: ${objectName} (${fileStats.size} bytes)`);
      return objectName;
    } catch (error) {
      logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get a presigned URL for an object
   * @param objectName Object name in Minio
   * @param expirySeconds Expiry time in seconds (default: 24 hours)
   * @returns Presigned URL
   */
  public async getPresignedUrl(objectName: string, expirySeconds: number = 86400): Promise<string> {
    try {
      logger.info(`Generating presigned URL for: ${objectName}`);
      
      // Generate presigned URL
      const url = await this.client.presignedGetObject(
        this.bucket,
        objectName,
        expirySeconds
      );
      
      return url;
    } catch (error) {
      logger.error(`Error generating presigned URL: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a public URL for an object accessible through the frontend proxy
   * @param objectName Object name in Minio
   * @returns Public URL
   */
  public getPublicUrl(objectName: string): string {
    // Return URL that goes through the frontend nginx proxy
    // The nginx proxy is configured to forward /storage/ to http://minio:9000/tramoya/
    // So we should not include the bucket name in the URL
    return `/storage/${objectName}`;
  }

  /**
   * Get the content type based on file extension
   * @param filePath File path
   * @returns Content type
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.svg':
        return 'image/svg+xml';
      case '.json':
        return 'application/json';
      case '.txt':
        return 'text/plain';
      case '.html':
        return 'text/html';
      case '.css':
        return 'text/css';
      case '.js':
        return 'application/javascript';
      default:
        return 'application/octet-stream';
    }
  }
}