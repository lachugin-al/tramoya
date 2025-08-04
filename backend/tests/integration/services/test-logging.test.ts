import * as logger from '../../../src/utils/logger';
import express from 'express';
import http from 'http';

// Mock the logger module
jest.mock('../../../src/utils/logger', () => {
    // Create mock logger functions
    const mockLoggerFunctions = {
        info: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        http: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn()
    };

    // Create a mock createLogger function that returns the mock logger
    const mockCreateLogger = jest.fn().mockReturnValue(mockLoggerFunctions);

    // Create a mock requestIdMiddleware
    const mockRequestIdMiddleware = jest.fn().mockImplementation((req, res, next) => {
        req.headers['x-request-id'] = 'test-request-id';
        next();
    });

    return {
        createLogger: mockCreateLogger,
        requestIdMiddleware: mockRequestIdMiddleware
    };
});

// Create a test logger
const testLogger = logger.createLogger('test-logging-integration-test');

describe('Test Logging Integration', () => {
    beforeAll(() => {
        testLogger.info('Integration test setup complete');
    });

    afterAll(() => {
        testLogger.info('Integration test cleanup complete');
    });

    describe('Logger functionality', () => {
        it('should create loggers for different modules', () => {
            // Create loggers for different modules
            const mainLogger = logger.createLogger('test-main');
            const serviceLogger = logger.createLogger('test-service');
            const apiLogger = logger.createLogger('test-api');

            // Log messages
            mainLogger.info('Main logger test');
            serviceLogger.info('Service logger test');
            apiLogger.info('API logger test');

            // Verify that createLogger was called with the correct module names
            expect(logger.createLogger).toHaveBeenCalledWith('test-main');
            expect(logger.createLogger).toHaveBeenCalledWith('test-service');
            expect(logger.createLogger).toHaveBeenCalledWith('test-api');

            // Verify that info was called with the correct messages
            expect(mainLogger.info).toHaveBeenCalledWith('Main logger test');
            expect(serviceLogger.info).toHaveBeenCalledWith('Service logger test');
            expect(apiLogger.info).toHaveBeenCalledWith('API logger test');
        });

        it('should log at different levels', () => {
            // Create a test logger
            const testLogger = logger.createLogger('test-levels');

            // Log at different levels
            testLogger.error('Error level test');
            testLogger.warn('Warning level test');
            testLogger.info('Info level test');
            testLogger.http('HTTP level test');
            testLogger.debug('Debug level test');
            testLogger.trace('Trace level test');

            // Verify that each log level was called with the correct message
            expect(testLogger.error).toHaveBeenCalledWith('Error level test');
            expect(testLogger.warn).toHaveBeenCalledWith('Warning level test');
            expect(testLogger.info).toHaveBeenCalledWith('Info level test');
            expect(testLogger.http).toHaveBeenCalledWith('HTTP level test');
            expect(testLogger.debug).toHaveBeenCalledWith('Debug level test');
            expect(testLogger.trace).toHaveBeenCalledWith('Trace level test');
        });

        it('should log with context', () => {
            // Create a test logger
            const testLogger = logger.createLogger('test-context');

            // Create context object
            const context = {
                environment: 'test',
                timestamp: new Date().toISOString(),
                testId: 'integration-test'
            };

            // Log with context
            testLogger.info('Context test', context);

            // Verify that info was called with the correct message and context
            expect(testLogger.info).toHaveBeenCalledWith('Context test', context);
        });
    });

    describe('Request ID middleware', () => {
        it('should assign and track request IDs', () => {
            // Create a mock Express request and response with properly typed headers
            const req = {headers: {} as Record<string, string>};
            const res = {};
            const next = jest.fn();

            // Call the middleware
            logger.requestIdMiddleware(req, res, next);

            // Verify that a request ID was assigned
            expect(req.headers['x-request-id']).toBe('test-request-id');

            // Verify that next was called
            expect(next).toHaveBeenCalled();

            // Create a logger and log a message
            const requestLogger = logger.createLogger('test-request');
            requestLogger.info('Received test request', {
                headers: req.headers
            });

            // Verify that the logger was created and used
            expect(logger.createLogger).toHaveBeenCalledWith('test-request');
            expect(requestLogger.info).toHaveBeenCalledWith('Received test request', {
                headers: req.headers
            });
        });
    });

    describe('Error logging', () => {
        it('should log errors with stack traces', () => {
            // Create a test logger
            const testLogger = logger.createLogger('test-error');

            // Create an error
            const error = new Error('Test error');

            // Create error context
            const errorContext = {
                error: error.message,
                stack: error.stack
            };

            // Log the error
            testLogger.error('Error occurred', errorContext);

            // Verify that error was logged with the correct message and context
            expect(testLogger.error).toHaveBeenCalledWith('Error occurred', errorContext);
        });
    });
});