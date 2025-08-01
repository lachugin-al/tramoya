import Redis from 'ioredis';
import { createLogger } from '../utils/logger';
import { TestResult } from '../models/test-result';

const logger = createLogger('redis-service');

/**
 * Service for interacting with Redis
 */
export class RedisService {
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;
  
  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Create Redis clients
    this.client = new Redis(redisUrl);
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    
    // Handle connection events for main client
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    this.client.on('error', (err) => {
      logger.error(`Redis client error: ${err.message}`);
    });
    
    // Handle connection events for publisher client
    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });
    
    this.publisher.on('error', (err) => {
      logger.error(`Redis publisher error: ${err.message}`);
    });
    
    // Handle connection events for subscriber client
    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });
    
    this.subscriber.on('error', (err) => {
      logger.error(`Redis subscriber error: ${err.message}`);
    });
    
    logger.info('RedisService initialized');
  }
  
  /**
   * Get the Redis client
   */
  public getClient(): Redis {
    return this.client;
  }
  
  /**
   * Get the Redis publisher client
   */
  public getPublisher(): Redis {
    return this.publisher;
  }
  
  /**
   * Get the Redis subscriber client
   */
  public getSubscriber(): Redis {
    return this.subscriber;
  }
  
  /**
   * Publish a message to a channel
   * @param channel Channel name
   * @param message Message to publish
   */
  public async publish(channel: string, message: any): Promise<void> {
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      logger.info(`Publishing message to Redis channel: ${channel}`);
      logger.debug(`Message content (first 100 chars): ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);
      
      const result = await this.publisher.publish(channel, messageStr);
      logger.info(`Successfully published message to ${channel}, delivered to ${result} subscribers`);
      
      if (result === 0) {
        logger.warn(`No subscribers received the message on channel: ${channel}`);
      }
    } catch (error) {
      logger.error(`Error publishing message: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Subscribe to a channel
   * @param channel Channel name
   * @param callback Callback function to handle messages
   */
  public subscribe(channel: string, callback: (message: string) => void): void {
    try {
      logger.info(`Attempting to subscribe to Redis channel: ${channel}`);
      
      this.subscriber.subscribe(channel, (err, count) => {
        if (err) {
          logger.error(`Error in subscribe callback: ${err.message}`);
          throw err;
        }
        logger.info(`Successfully subscribed to channel: ${channel}, now subscribed to ${count} channels`);
      });
      
      // Set up message handler
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          logger.debug(`Received message on channel ${ch} (first 100 chars): ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
          callback(message);
        }
      });
      
      // Add subscription error handler
      this.subscriber.on('error', (err) => {
        logger.error(`Redis subscription error on channel ${channel}: ${err.message}`);
      });
      
      logger.info(`Subscription handler set up for channel: ${channel}`);
    } catch (error) {
      logger.error(`Error subscribing to channel: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from a channel
   * @param channel Channel name
   */
  public async unsubscribe(channel: string): Promise<void> {
    try {
      logger.info(`Attempting to unsubscribe from channel: ${channel}`);
      
      // In subscriber mode, we can only use subscriber commands
      // So we directly call unsubscribe without checking if we're subscribed
      await this.subscriber.unsubscribe(channel);
      logger.info(`Successfully unsubscribed from channel: ${channel}`);
    } catch (error) {
      // Just log the error but don't throw it to prevent connection crashes
      logger.error(`Error unsubscribing from channel: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get a test result by ID
   * @param id The test result ID
   * @returns The test result or null if not found
   */
  public async getTestResult(id: string): Promise<TestResult | null> {
    try {
      const key = `test:result:${id}`;
      const data = await this.client.get(key);
      
      if (!data) {
        logger.debug(`Test result not found: ${id}`);
        return null;
      }
      
      return JSON.parse(data) as TestResult;
    } catch (error) {
      logger.error(`Error getting test result: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Save a test result
   * @param testResult The test result to save
   */
  public async saveTestResult(testResult: TestResult): Promise<void> {
    try {
      const key = `test:result:${testResult.id}`;
      await this.client.set(key, JSON.stringify(testResult));
      logger.debug(`Test result saved: ${testResult.id}`);
    } catch (error) {
      logger.error(`Error saving test result: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Close all Redis connections
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
      await this.publisher.quit();
      await this.subscriber.quit();
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error(`Error closing Redis connections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}