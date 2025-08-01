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