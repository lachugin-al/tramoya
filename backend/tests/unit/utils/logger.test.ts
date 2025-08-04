import winston from 'winston';
import * as cls from 'cls-hooked';
import { createLogger, requestIdMiddleware, getRequestId } from '../../../src/utils/logger';

// We need to reset the mocks from the global setup
jest.unmock('../../../src/utils/logger');

// Mock dependencies
jest.mock('winston', () => {
  const originalModule = jest.requireActual('winston');
  const formatFn = jest.fn().mockImplementation((transform) => {
    return () => transform;
  });
  
  // Combine function and object properties
  Object.assign(formatFn, {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn().mockReturnValue({}),
    errors: jest.fn().mockReturnValue({}),
    splat: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    colorize: jest.fn().mockReturnValue({}),
    printf: jest.fn().mockReturnValue({}),
  });
  
  return {
    ...originalModule,
    format: formatFn,
    createLogger: jest.fn().mockReturnValue({
      log: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      http: jest.fn(),
      verbose: jest.fn()
    }),
    addColors: jest.fn(),
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

jest.mock('cls-hooked', () => {
  return {
    createNamespace: jest.fn().mockReturnValue({
      run: jest.fn((callback) => callback()),
      get: jest.fn(),
      set: jest.fn()
    })
  };
});

jest.mock('fs', () => {
  return {
    existsSync: jest.fn().mockReturnValue(false),
    mkdirSync: jest.fn()
  };
});

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid')
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with the correct configuration', () => {
      const moduleName = 'test-module';
      const logger = createLogger(moduleName);

      // Verify Winston createLogger was called with the correct configuration
      expect(winston.createLogger).toHaveBeenCalledWith(expect.objectContaining({
        defaultMeta: expect.objectContaining({
          module: moduleName
        })
      }));

      // Verify transports were created
      expect(winston.transports.Console).toHaveBeenCalled();
      expect(winston.transports.File).toHaveBeenCalledTimes(4); // combined, error, http, debug logs
    });

    it('should create log directory if it does not exist', () => {
      const fs = require('fs');
      
      createLogger('test-module');
      
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith('logs', { recursive: true });
    });

    it('should add trace method to the logger', () => {
      const logger = createLogger('test-module');
      const message = 'trace message';
      const meta = { key: 'value' };
      
      logger.trace(message, meta);
      
      // Verify the log method was called with trace level
      expect((logger as any).log).toHaveBeenCalledWith('trace', message, meta);
    });

    it('should use environment variables for configuration when available', () => {
      const originalEnv = process.env;
      process.env.LOG_DIR = 'custom-logs';
      process.env.LOG_LEVEL = 'warn';
      
      createLogger('test-module');
      
      // Restore original environment
      process.env = originalEnv;
      
      // Verify Winston createLogger was called with the correct log level
      expect(winston.createLogger).toHaveBeenCalledWith(expect.objectContaining({
        level: 'warn'
      }));
    });
  });

  describe('requestIdMiddleware', () => {
    it('should use existing request ID from headers if available', () => {
      const req = {
        headers: {
          'x-request-id': 'existing-id'
        }
      };
      const res = {
        setHeader: jest.fn()
      };
      const next = jest.fn();
      
      requestIdMiddleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'existing-id');
      expect(cls.createNamespace('tramoya-logger').set).toHaveBeenCalledWith('requestId', 'existing-id');
      expect(next).toHaveBeenCalled();
    });

    it('should generate a new request ID if not in headers', () => {
      const req = { headers: {} };
      const res = {
        setHeader: jest.fn()
      };
      const next = jest.fn();
      
      requestIdMiddleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'test-uuid');
      expect(cls.createNamespace('tramoya-logger').set).toHaveBeenCalledWith('requestId', 'test-uuid');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getRequestId', () => {
    it('should return the request ID from the namespace if available', () => {
      const mockNamespace = cls.createNamespace('tramoya-logger');
      (mockNamespace.get as jest.Mock).mockReturnValue('test-request-id');
      
      const result = getRequestId();
      
      expect(result).toBe('test-request-id');
      expect(mockNamespace.get).toHaveBeenCalledWith('requestId');
    });

    it('should return "no-request-id" if request ID is not in namespace', () => {
      const mockNamespace = cls.createNamespace('tramoya-logger');
      (mockNamespace.get as jest.Mock).mockReturnValue(null);
      
      const result = getRequestId();
      
      expect(result).toBe('no-request-id');
      expect(mockNamespace.get).toHaveBeenCalledWith('requestId');
    });
  });
});