import winston from 'winston';
import path from 'path';

/**
 * Creates a logger instance with the given module name
 * @param moduleName The name of the module to create a logger for
 * @returns A winston logger instance
 */
export const createLogger = (moduleName: string) => {
  const logDir = process.env.LOG_DIR || 'logs';
  
  // Create the logger
  const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'tramoya', module: moduleName },
    transports: [
      // Write all logs to console
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            info => `${info.timestamp} ${info.level}: [${info.module}] ${info.message}`
          )
        )
      }),
      
      // Write all logs with level 'info' and below to combined.log
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      }),
      
      // Write all logs with level 'error' and below to error.log
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'),
        level: 'error'
      })
    ]
  });

  return logger;
};

// Create a default logger
export const logger = createLogger('app');