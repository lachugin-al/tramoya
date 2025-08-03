import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('minio-service');

/**
 * Service for interacting with Minio/S3 compatible object storage
 * 
 * @class MinioService
 * @description Provides methods for file storage operations including bucket management,
 * file uploads, and URL generation for stored objects. This service uses the Minio client
 * to interact with S3-compatible storage systems.
 * 
 * The service is configured using environment variables:
 * - MINIO_ENDPOINT: Hostname of the Minio server (default: 'minio')
 * - MINIO_PORT: Port of the Minio server (default: 9000)
 * - MINIO_ACCESS_KEY: Access key for authentication (default: 'minioadmin')
 * - MINIO_SECRET_KEY: Secret key for authentication (default: 'minioadmin')
 * - MINIO_USE_SSL: Whether to use SSL for connections (default: false)
 * - MINIO_BUCKET: Name of the bucket to use (default: 'tramoya')
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
   * Ensures that the configured bucket exists in the Minio storage
   * 
   * @method ensureBucket
   * @description Checks if the configured bucket exists and creates it if it doesn't.
   * When creating a new bucket, it also sets a bucket policy to allow public read access
   * to all objects in the bucket.
   * 
   * @returns {Promise<void>} A promise that resolves when the bucket exists or has been created
   * @throws {Error} If there's an error checking bucket existence or creating the bucket
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
   * Uploads a file from the local filesystem to Minio storage
   * 
   * @method uploadFile
   * @description Uploads a file from the local filesystem to the configured Minio bucket.
   * The method automatically determines the content type based on the file extension and
   * ensures the bucket exists before uploading.
   * 
   * @param {string} filePath - Full path to the local file to be uploaded
   * @param {string} objectName - Name to assign to the object in Minio storage (can include path segments)
   * @returns {Promise<string>} A promise that resolves to the object name in Minio storage
   * @throws {Error} If the file doesn't exist or there's an error during upload
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
   * Generates a presigned URL for temporary access to an object in Minio storage
   * 
   * @method getPresignedUrl
   * @description Creates a time-limited URL that provides direct access to a specific object
   * in the Minio storage. This URL can be used to access the object without requiring
   * authentication credentials, but only for the specified duration.
   * 
   * @param {string} objectName - Name of the object in Minio storage to generate URL for
   * @param {number} [expirySeconds=86400] - Number of seconds the URL will be valid (default: 24 hours)
   * @returns {Promise<string>} A promise that resolves to the presigned URL
   * @throws {Error} If there's an error generating the presigned URL
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
   * Generates a public URL for an object that can be accessed through the frontend proxy
   * 
   * @method getPublicUrl
   * @description Creates a URL path that can be used to access an object in Minio storage
   * through the frontend's nginx proxy. This URL is relative and doesn't include the host,
   * so it can be used in both frontend and backend contexts.
   * 
   * The nginx proxy is configured to forward requests to /storage/ path to the Minio server.
   * 
   * @param {string} objectName - Name of the object in Minio storage to generate URL for
   * @returns {string} A relative URL path that can be used to access the object
   */
  public getPublicUrl(objectName: string): string {
    // Return URL that goes through the frontend nginx proxy
    // The nginx proxy is configured to forward /storage/ to http://minio:9000/tramoya/
    // So we should not include the bucket name in the URL
    return `/storage/${objectName}`;
  }

  /**
   * Determines the appropriate MIME content type based on a file's extension
   * 
   * @method getContentType
   * @description Analyzes the file extension of the provided file path and returns
   * the corresponding MIME content type. This is used when uploading files to ensure
   * they have the correct content type metadata.
   * 
   * Supported file extensions include:
   * - Images: .png, .jpg, .jpeg, .gif, .svg
   * - Web: .html, .css, .js
   * - Data: .json, .txt
   * - For unrecognized extensions, 'application/octet-stream' is returned
   * 
   * @param {string} filePath - Path to the file (only the extension is used)
   * @returns {string} The MIME content type corresponding to the file extension
   * @private
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