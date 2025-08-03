/**
 * Main entry point for the application.
 * 
 * This file:
 * 1. Loads environment variables from .env file
 * 2. Creates a logger instance
 * 3. Determines which service to start based on the SERVICE_TYPE environment variable
 * 4. Starts either the gateway or runner service
 * 
 * The application can run in two modes:
 * - Gateway: API server that handles HTTP requests and WebSocket connections
 * - Runner: Background worker that processes jobs from the queue
 * 
 * @module index
 */

import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { startGateway } from './gateway';
import { startRunner } from './runner';

// Load environment variables
dotenv.config();

// Create logger
const logger = createLogger('server');

// Determine service type from environment variable
const serviceType = process.env.SERVICE_TYPE || 'gateway';

logger.info(`Starting service as: ${serviceType}`);

// Start the appropriate service based on type
if (serviceType === 'gateway') {
  startGateway();
} else if (serviceType === 'runner') {
  startRunner();
} else {
  logger.error(`Unknown service type: ${serviceType}`);
  process.exit(1);
}