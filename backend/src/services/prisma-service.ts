import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('prisma-service');

/**
 * Prisma client instance with logging middleware
 * 
 * This instance is configured with query logging middleware that logs all database queries
 * for debugging and performance monitoring purposes.
 */
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Set up logging middleware
prisma.$on('query', (e) => {
  logger.debug('Query: ' + e.query);
  logger.debug('Duration: ' + e.duration + 'ms');
});

prisma.$on('error', (e) => {
  logger.error('Prisma error', { error: e.message, target: e.target });
});

prisma.$on('info', (e) => {
  logger.info('Prisma info', { message: e.message, target: e.target });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma warning', { message: e.message, target: e.target });
});

/**
 * Initialize the Prisma client
 * 
 * This function connects to the database and performs any necessary initialization.
 * It should be called when the application starts.
 */
export const initPrisma = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to database');
    return prisma;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
};

/**
 * Disconnect the Prisma client
 * 
 * This function disconnects from the database and should be called when the application shuts down.
 */
export const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from database');
  } catch (error) {
    logger.error('Failed to disconnect from database', { error });
    throw error;
  }
};

export default prisma;