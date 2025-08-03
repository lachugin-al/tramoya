import Redis from 'ioredis';
import { createLogger } from '../utils/logger';
import { TestResult } from '../models/test-result';

const logger = createLogger('redis-service');

/**
 * Service for interacting with Redis database
 * 
 * @class RedisService
 * @description Provides methods for Redis operations including pub/sub messaging and data storage.
 * This service maintains three separate Redis connections:
 * - A main client for general operations
 * - A dedicated publisher client for sending messages
 * - A dedicated subscriber client for receiving messages
 * 
 * The service is configured using environment variables:
 * - REDIS_URL: The Redis connection URL (default: 'redis://localhost:6379')
 * 
 * This service is used for:
 * - Real-time communication between components via pub/sub
 * - Storing and retrieving test results
 * - General Redis operations
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
   * Returns the main Redis client instance
   * 
   * @method getClient
   * @description Provides access to the main Redis client instance for general operations.
   * This client should be used for standard Redis operations like get, set, etc.
   * 
   * @returns {Redis} The main Redis client instance
   */
  public getClient(): Redis {
    return this.client;
  }
  
  /**
   * Returns the Redis publisher client instance
   * 
   * @method getPublisher
   * @description Provides access to the dedicated Redis client instance used for publishing messages.
   * This client is optimized for publishing operations and should be used instead of the main client
   * when publishing messages to channels.
   * 
   * @returns {Redis} The Redis publisher client instance
   */
  public getPublisher(): Redis {
    return this.publisher;
  }
  
  /**
   * Returns the Redis subscriber client instance
   * 
   * @method getSubscriber
   * @description Provides access to the dedicated Redis client instance used for subscribing to channels.
   * This client is in subscriber mode and should only be used for subscription-related operations.
   * Note that a Redis client in subscriber mode cannot execute other Redis commands.
   * 
   * @returns {Redis} The Redis subscriber client instance
   */
  public getSubscriber(): Redis {
    return this.subscriber;
  }
  
  /**
   * Publishes a message to a Redis channel
   * 
   * @method publish
   * @description Publishes a message to the specified Redis channel using the dedicated publisher client.
   * If the message is not a string, it will be automatically converted to JSON.
   * The method logs information about the publishing process, including the number of subscribers
   * that received the message.
   * 
   * @param {string} channel - The name of the Redis channel to publish to
   * @param {any} message - The message to publish (will be stringified if not a string)
   * @returns {Promise<void>} A promise that resolves when the message has been published
   * @throws {Error} If there's an error during the publishing process
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
   * Subscribes to a Redis channel to receive messages
   * 
   * @method subscribe
   * @description Sets up a subscription to the specified Redis channel using the dedicated subscriber client.
   * When a message is received on the channel, the provided callback function is invoked with the message.
   * The method also sets up error handlers for the subscription.
   * 
   * Note: The Redis client used for subscriptions enters a special mode where it can only execute
   * subscription-related commands. Other Redis commands will fail on this client.
   * 
   * @param {string} channel - The name of the Redis channel to subscribe to
   * @param {Function} callback - Callback function that will be called with each message received
   * @param {string} callback.message - The message received from the channel
   * @throws {Error} If there's an error during the subscription process
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
   * Unsubscribes from a Redis channel
   * 
   * @method unsubscribe
   * @description Removes the subscription to the specified Redis channel using the dedicated subscriber client.
   * After unsubscribing, no more messages will be received from this channel.
   * 
   * This method handles errors internally and doesn't throw exceptions to prevent connection crashes.
   * Errors are logged but not propagated to the caller.
   * 
   * @param {string} channel - The name of the Redis channel to unsubscribe from
   * @returns {Promise<void>} A promise that resolves when the unsubscription is complete
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
   * Retrieves a test result from Redis by its ID
   * 
   * @method getTestResult
   * @description Fetches a previously saved test result from Redis using its unique ID.
   * The test result is stored as a JSON string in Redis and is parsed back into a TestResult object.
   * If no test result is found with the given ID, the method returns null.
   * 
   * @param {string} id - The unique identifier of the test result to retrieve
   * @returns {Promise<TestResult|null>} A promise that resolves to the test result object if found, or null if not found
   * @throws {Error} If there's an error retrieving or parsing the test result
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
   * Saves a test result to Redis
   * 
   * @method saveTestResult
   * @description Stores a test result object in Redis using its ID as part of the key.
   * The test result object is serialized to JSON before storage.
   * This method uses the main Redis client to store the data.
   * 
   * @param {TestResult} testResult - The test result object to save
   * @returns {Promise<void>} A promise that resolves when the test result has been saved
   * @throws {Error} If there's an error serializing or saving the test result
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
   * Closes all Redis connections gracefully
   * 
   * @method close
   * @description Properly closes all Redis client connections (main client, publisher, and subscriber).
   * This method should be called when the application is shutting down to ensure all connections
   * are closed properly and to prevent resource leaks.
   * 
   * This method handles errors internally and doesn't throw exceptions to ensure cleanup always proceeds.
   * Errors are logged but not propagated to the caller.
   * 
   * @returns {Promise<void>} A promise that resolves when all connections have been closed
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