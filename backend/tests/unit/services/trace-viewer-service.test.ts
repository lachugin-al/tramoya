import { TraceViewerService, traceViewerService as singletonService } from '../../../src/services/trace-viewer-service';
import { ChildProcess } from 'child_process';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';

// Define custom interfaces for our mocks to avoid TypeScript errors
interface MockEventEmitter extends EventEmitter {
  pipe?: jest.Mock;
}

interface MockChildProcess extends Partial<ChildProcess> {
  stdout?: any;
  stderr?: any;
  on: jest.Mock;
  kill: jest.Mock;
  pid?: number;
  killed?: boolean;
  exitCode?: number | null;
  _eventCallbacks?: {
    [key: string]: (...args: any[]) => void;
  };
}

// Mock dependencies
jest.mock('child_process');
jest.mock('fs', () => {
  // Create a mock implementation that properly handles all the fs methods we use
  const mockFs = {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    constants: { R_OK: 4 },
    promises: {
      access: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ size: 1024 }),
      open: jest.fn().mockResolvedValue({
        read: jest.fn().mockResolvedValue({ bytesRead: 4 }),
        close: jest.fn().mockResolvedValue(undefined)
      })
    }
  };
  return mockFs;
});
jest.mock('http');
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-session-id')
}));
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('TraceViewerService', () => {
  let traceViewerService: TraceViewerService;
  let mockProcess: MockChildProcess;
  let mockStdout: MockEventEmitter;
  let mockStderr: MockEventEmitter;
  let mockHttpServer: EventEmitter & {
    listen: jest.Mock;
    close: jest.Mock;
  };
  let mockHttpRequest: EventEmitter & {
    end: jest.Mock;
    pipe?: jest.Mock;
  };
  let mockHttpResponse: EventEmitter & {
    setHeader: jest.Mock;
    statusCode: number;
    pipe: jest.Mock;
    on: jest.Mock;
  };
  
  // Original environment variables
  const originalEnv = process.env;
  // Original process.kill method
  const originalProcessKill = process.kill;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.kill to prevent ESRCH errors
    process.kill = jest.fn();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Set up fs mock return values
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Ensure fs.promises.stat returns an object with a size property
    (fs.promises.stat as jest.Mock).mockResolvedValue({ size: 1024 });
    
    // Ensure fs.promises.open returns an object with read and close methods
    (fs.promises.open as jest.Mock).mockResolvedValue({
      read: jest.fn().mockResolvedValue({ bytesRead: 4, buffer: Buffer.from([0x50, 0x4B, 0x03, 0x04]) }),
      close: jest.fn().mockResolvedValue(undefined)
    });
    
    // Create proper EventEmitter instances for stdout and stderr
    mockStdout = new EventEmitter() as MockEventEmitter;
    mockStdout.pipe = jest.fn().mockReturnValue(mockStdout);
    
    mockStderr = new EventEmitter() as MockEventEmitter;
    mockStderr.pipe = jest.fn().mockReturnValue(mockStderr);
    
    // Create a more complete mock for ChildProcess
    mockProcess = {
      stdout: mockStdout as any,
      stderr: mockStderr as any,
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'exit' || event === 'error') {
          // Store the callback to be called later if needed
          mockProcess._eventCallbacks = mockProcess._eventCallbacks || {};
          mockProcess._eventCallbacks[event] = callback;
        }
        return mockProcess;
      }),
      kill: jest.fn().mockImplementation(() => {
        // Simulate process exit when killed
        if (mockProcess._eventCallbacks && typeof mockProcess._eventCallbacks.exit === 'function') {
          process.nextTick(() => {
            if (mockProcess._eventCallbacks) {
              mockProcess._eventCallbacks.exit(0);
            }
          });
        }
        return true;
      }),
      pid: 12345,
      killed: false,
      exitCode: null,
      _eventCallbacks: {} // Store event callbacks for manual triggering
    };
    
    // Mock child_process.spawn to return our enhanced mock
    (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
    
    // Improve exec mock to handle both callback and promise styles
    jest.spyOn(child_process, 'exec').mockImplementation((cmd: any, callback?: any) => {
      const result = { stdout: 'mock output', stderr: '' };
      
      if (callback) {
        // Callback style
        process.nextTick(() => callback(null, result, null));
      }
      
      // Always return a mock object with stdout and stderr streams
      const mockExecProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter()
      };
      
      // Emit some data on stdout for tests that listen to it
      process.nextTick(() => {
        mockExecProcess.stdout.emit('data', Buffer.from('mock output'));
        mockExecProcess.stdout.emit('end');
      });
      
      return mockExecProcess as any;
    });
    
    // Create a more complete mock for HTTP server
    mockHttpServer = Object.assign(new EventEmitter(), {
      listen: jest.fn().mockImplementation((port, host, callback) => {
        if (callback) process.nextTick(callback);
        process.nextTick(() => mockHttpServer.emit('listening'));
        return mockHttpServer;
      }),
      close: jest.fn().mockImplementation((callback) => {
        if (callback) process.nextTick(callback);
        process.nextTick(() => mockHttpServer.emit('close'));
        return mockHttpServer;
      })
    });
    
    (http.createServer as jest.Mock).mockReturnValue(mockHttpServer);
    
    // Create a more complete mock for HTTP request
    mockHttpRequest = Object.assign(new EventEmitter(), {
      end: jest.fn().mockImplementation(() => {
        // Simulate request completion
        process.nextTick(() => mockHttpRequest.emit('response', mockHttpResponse));
        return mockHttpRequest;
      }),
      pipe: jest.fn().mockReturnValue(mockHttpRequest),
      setTimeout: jest.fn(),
      abort: jest.fn()
    });
    
    // Create a more complete mock for HTTP response
    mockHttpResponse = Object.assign(new EventEmitter(), {
      setHeader: jest.fn(),
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      pipe: jest.fn().mockImplementation((destination) => {
        // Simulate data piping only if destination has emit method
        if (destination && typeof destination.emit === 'function') {
          process.nextTick(() => {
            destination.emit('data', Buffer.from('test data'));
            destination.emit('end');
          });
        }
        return destination;
      }),
      on: jest.fn().mockImplementation(function(this: any, event, callback) {
        if (event === 'data') {
          process.nextTick(() => callback(Buffer.from('test data')));
        } else if (event === 'end') {
          process.nextTick(callback);
        }
        return this;
      })
    });
    
    // Default http.request implementation
    (http.request as jest.Mock).mockImplementation((_options, callback) => {
      if (callback) {
        process.nextTick(() => callback(mockHttpResponse));
      }
      return mockHttpRequest;
    });
    
    // Mock Buffer.alloc to return a buffer with ZIP file signature
    const mockBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    (Buffer.alloc as jest.Mock) = jest.fn().mockReturnValue(mockBuffer);
    
    // Use the singleton instance instead of creating a new one
    traceViewerService = singletonService;
    
    // Mock private methods using type assertion
    const service = traceViewerService as any;
    service.isPortAvailable = jest.fn().mockResolvedValue(true);
    service.findAvailablePort = jest.fn().mockResolvedValue(4000);
    service.checkPlaywrightVersion = jest.fn().mockResolvedValue('Playwright v1.30.0');
    service.isRunningInDocker = jest.fn().mockResolvedValue(false);
    service.testNetworkConnectivity = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
    // Restore original process.kill method
    process.kill = originalProcessKill;
    jest.resetAllMocks();
  });
  
  // Clean up the singleton instance after all tests
  afterAll(async () => {
    // Make sure to clean up the singleton instance to prevent hanging intervals
    await singletonService.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with default configuration if environment variables are not set', () => {
      // Clear environment variables
      process.env = {};
      
      // Create new service instance
      const service = new TraceViewerService();
      
      // Access private properties using type assertion
      const privateService = service as any;
      
      // Verify default configuration
      expect(privateService.portRangeStart).toBe(4000);
      expect(privateService.portRangeEnd).toBe(4100);
      expect(privateService.sessionTimeout).toBe(300000); // 5 minutes
      expect(privateService.tempDir).toBe('/tmp/tramoya-traces');
      
      // Verify temp directory creation
      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/tramoya-traces');
      expect(fs.mkdirSync).not.toHaveBeenCalled(); // Directory already exists
    });

    it('should initialize with configuration from environment variables', () => {
      // Set environment variables
      process.env = {
        ...process.env,
        TRACE_VIEWER_PORT_RANGE_START: '5000',
        TRACE_VIEWER_PORT_RANGE_END: '5100',
        TRACE_VIEWER_SESSION_TIMEOUT: '600000',
        TRACE_TEMP_DIR: '/custom/temp/dir'
      };
      
      // Mock directory doesn't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      // Create new service instance
      const service = new TraceViewerService();
      
      // Access private properties using type assertion
      const privateService = service as any;
      
      // Verify configuration from environment variables
      expect(privateService.portRangeStart).toBe(5000);
      expect(privateService.portRangeEnd).toBe(5100);
      expect(privateService.sessionTimeout).toBe(600000); // 10 minutes
      expect(privateService.tempDir).toBe('/custom/temp/dir');
      
      // Verify temp directory creation
      expect(fs.existsSync).toHaveBeenCalledWith('/custom/temp/dir');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/temp/dir', { recursive: true });
    });

    it('should set up cleanup interval', () => {
      // Mock setInterval
      jest.spyOn(global, 'setInterval').mockReturnValue({} as any);
      
      // Create new service instance
      new TraceViewerService();
      
      // Verify setInterval was called
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
    });
  });

  describe('startTraceViewer', () => {
    it('should start a trace viewer process and return session information', async () => {
      // Mock the http request to simulate a successful connection
      (http.request as jest.Mock).mockImplementation((_options, callback) => {
        if (callback) {
          // Create a mock response with status code 200
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn(),
            pipe: jest.fn()
          };
          callback(mockResponse);
        }
        return {
          on: jest.fn(),
          end: jest.fn(),
          emit: jest.fn()
        };
      });
      
      // Call the method
      const result = await traceViewerService.startTraceViewer('/path/to/trace.zip');
      
      // Verify trace file validation
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/trace.zip');
      expect(fs.promises.access).toHaveBeenCalledWith('/path/to/trace.zip', fs.constants.R_OK);
      expect(fs.promises.stat).toHaveBeenCalledWith('/path/to/trace.zip');
      expect(fs.promises.open).toHaveBeenCalledWith('/path/to/trace.zip', 'r');
      
      // Verify process spawning
      expect(child_process.spawn).toHaveBeenCalledWith(
        'npx',
        [
          'playwright', 'show-trace',
          '/path/to/trace.zip',
          '--port=4000',
          '--host=0.0.0.0'
        ],
        expect.any(Object)
      );
      
      // Verify result has the expected properties
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('port', 4000);
    });

    it('should throw an error if trace file does not exist', async () => {
      // Mock file doesn't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      // Call the method and expect error
      await expect(traceViewerService.startTraceViewer('/path/to/trace.zip'))
        .rejects.toThrow('Trace file not found: /path/to/trace.zip');
    });

    it('should throw an error if trace file is empty', async () => {
      // Mock file is empty
      (fs.promises.stat as jest.Mock).mockResolvedValue({ size: 0 });
      
      // Call the method and expect error
      await expect(traceViewerService.startTraceViewer('/path/to/trace.zip'))
        .rejects.toThrow('Trace file is empty: /path/to/trace.zip');
    });

    it('should throw an error if trace file is not a valid ZIP file', async () => {
      // Mock invalid ZIP file signature
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      (Buffer.alloc as jest.Mock).mockReturnValue(invalidBuffer);
      
      // Call the method and expect error
      await expect(traceViewerService.startTraceViewer('/path/to/trace.zip'))
        .rejects.toThrow('Invalid trace file format: Not a valid ZIP file');
    });

    it('should throw an error if maximum number of sessions is reached', async () => {
      // Mock sessions map to have 10 sessions
      const service = traceViewerService as any;
      for (let i = 0; i < 10; i++) {
        service.sessions.set(`session-${i}`, {});
      }
      
      // Call the method and expect error
      await expect(traceViewerService.startTraceViewer('/path/to/trace.zip'))
        .rejects.toThrow('Maximum number of trace viewer sessions reached');
    });

    it('should throw an error if no ports are available', async () => {
      // Clear the sessions map to ensure we don't hit the maximum sessions check
      const service = traceViewerService as any;
      service.sessions.clear();
      
      // Mock no available ports
      service.findAvailablePort = jest.fn().mockResolvedValue(null);
      
      // Call the method and expect error
      await expect(traceViewerService.startTraceViewer('/path/to/trace.zip'))
        .rejects.toThrow('No available ports for trace viewer. Please try again later.');
    });
  });

  describe('stopTraceViewer', () => {
    it('should stop a trace viewer session', async () => {
      // Set up mock session
      const mockSession = {
        sessionId: 'mock-session-id',
        process: mockProcess,
        port: 4000,
        traceFilePath: '/path/to/trace.zip',
        startTime: new Date(),
        lastAccessTime: new Date()
      };
      
      // Add session to the service
      const service = traceViewerService as any;
      service.sessions.set('mock-session-id', mockSession);
      
      // Call the method
      await traceViewerService.stopTraceViewer('mock-session-id');
      
      // Verify process was killed
      expect(process.kill).toHaveBeenCalledWith(mockProcess.pid);
      
      // Verify session was removed
      expect(service.sessions.has('mock-session-id')).toBe(false);
    });

    it('should throw an error if session is not found', async () => {
      // Call the method with non-existent session ID
      await expect(traceViewerService.stopTraceViewer('non-existent-session'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('getViewerStatus', () => {
    it('should return the status of a trace viewer session', async () => {
      // Set up mock session with known start time
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const lastAccessTime = new Date(Date.now() - 30000); // 30 seconds ago
      
      const mockSession = {
        sessionId: 'mock-session-id',
        process: mockProcess,
        port: 4000,
        traceFilePath: '/path/to/trace.zip',
        startTime,
        lastAccessTime
      };
      
      // Add session to the service
      const service = traceViewerService as any;
      service.sessions.set('mock-session-id', mockSession);
      
      // Call the method
      const result = await traceViewerService.getViewerStatus('mock-session-id');
      
      // Verify result
      expect(result.status).toBe('running');
      expect(result.uptime).toBeGreaterThanOrEqual(60000); // At least 1 minute
      expect(result.lastAccess).not.toBe(lastAccessTime); // Should be updated
      expect(result.lastAccess.getTime()).toBeGreaterThan(lastAccessTime.getTime());
    });

    it('should throw an error if session is not found', async () => {
      // Call the method with non-existent session ID
      await expect(traceViewerService.getViewerStatus('non-existent-session'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('proxyRequest', () => {
    it('should proxy a request to a trace viewer instance', async () => {
      // Set up mock session with startTime in the past
      const now = Date.now();
      const mockSession = {
        sessionId: 'mock-session-id',
        process: mockProcess,
        port: 4000,
        traceFilePath: '/path/to/trace.zip',
        startTime: new Date(now - 1000), // 1 second ago
        lastAccessTime: new Date(now - 500) // 0.5 seconds ago
      };
      
      // Add session to the service
      const service = traceViewerService as any;
      service.sessions.set('mock-session-id', mockSession);
      
      // Create mock request and response
      const mockReq = {
        method: 'GET',
        headers: { 'user-agent': 'test-agent' },
        pipe: jest.fn()
      } as unknown as IncomingMessage;
      
      const mockRes = {
        statusCode: 0,
        setHeader: jest.fn(),
        end: jest.fn()
      } as unknown as ServerResponse;
      
      // Call the method
      await traceViewerService.proxyRequest('mock-session-id', mockReq, mockRes, '/path');
      
      // Verify http request was created with correct options
      expect(http.request).toHaveBeenCalledWith(
        {
          hostname: 'localhost',
          port: 4000,
          path: '/path',
          method: 'GET',
          headers: { 'user-agent': 'test-agent', host: 'localhost:4000' }
        },
        expect.any(Function)
      );
      
      // Verify request was piped
      expect(mockReq.pipe).toHaveBeenCalled();
      
      // Verify session last access time was updated
      expect(mockSession.lastAccessTime.getTime()).toBeGreaterThan(mockSession.startTime.getTime());
    });

    it('should handle session not found', async () => {
      // Create mock request and response
      const mockReq = {} as IncomingMessage;
      const mockRes = {
        statusCode: 0,
        end: jest.fn()
      } as unknown as ServerResponse;
      
      // Call the method
      await traceViewerService.proxyRequest('non-existent-session', mockReq, mockRes, '/path');
      
      // Verify response
      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Session not found' }));
    });

    it('should handle proxy request errors', async () => {
      // Set up mock session
      const mockSession = {
        sessionId: 'mock-session-id',
        process: mockProcess,
        port: 4000,
        traceFilePath: '/path/to/trace.zip',
        startTime: new Date(),
        lastAccessTime: new Date()
      };
      
      // Add session to the service
      const service = traceViewerService as any;
      service.sessions.set('mock-session-id', mockSession);
      
      // Create mock request and response
      const mockReq = {
        method: 'GET',
        headers: {},
        pipe: jest.fn()
      } as unknown as IncomingMessage;
      
      const mockRes = {
        statusCode: 0,
        end: jest.fn()
      } as unknown as ServerResponse;
      
      // Create a promise to control when the error is emitted
      const errorPromise = new Promise<void>(resolve => {
        // Mock http request to emit error
        (http.request as jest.Mock).mockImplementation(() => {
          const req = new EventEmitter() as any;
          req.end = jest.fn();
          req.pipe = jest.fn();
          
          // Emit error immediately but after the current execution context
          process.nextTick(() => {
            req.emit('error', new Error('Connection refused'));
            resolve(); // Resolve the promise after emitting the error
          });
          
          return req;
        });
      });
      
      // Call the method
      const proxyPromise = traceViewerService.proxyRequest('mock-session-id', mockReq, mockRes, '/path');
      
      // Wait for the error to be emitted and handled
      await errorPromise;
      await proxyPromise;
      
      // Verify response
      expect(mockRes.statusCode).toBe(502);
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Bad Gateway' }));
    });
  });

  describe('cleanupInactiveSessions', () => {
    it('should remove inactive sessions', async () => {
      // Mock the sessions map directly
      const serviceInstance = traceViewerService as any;
      
      // Clear any existing sessions
      serviceInstance.sessions.clear();
      
      // Set up mock sessions with different last access times
      const now = Date.now();
      const activeMockSession = {
        sessionId: 'active-session',
        process: { ...mockProcess },
        port: 4000,
        traceFilePath: '/path/to/trace1.zip',
        startTime: new Date(now - 600000), // 10 minutes ago
        lastAccessTime: new Date(now - 60000) // 1 minute ago
      };
      
      const inactiveMockSession = {
        sessionId: 'inactive-session',
        process: { ...mockProcess },
        port: 4001,
        traceFilePath: '/path/to/trace2.zip',
        startTime: new Date(now - 600000), // 10 minutes ago
        lastAccessTime: new Date(now - 360000) // 6 minutes ago
      };
      
      // Add sessions to the service
      serviceInstance.sessions.set('active-session', activeMockSession);
      serviceInstance.sessions.set('inactive-session', inactiveMockSession);
      
      // Set session timeout to 5 minutes
      serviceInstance.sessionTimeout = 300000;
      
      // Call the method
      await traceViewerService.cleanupInactiveSessions();
      
      // Verify inactive session was removed
      expect(serviceInstance.sessions.has('active-session')).toBe(true);
      expect(serviceInstance.sessions.has('inactive-session')).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should stop all sessions and clear cleanup interval', async () => {
      // Mock the sessions map directly
      const shutdownService = traceViewerService as any;
      
      // Clear any existing sessions
      shutdownService.sessions.clear();
      
      // Set up mock sessions
      const mockSession1 = {
        sessionId: 'session-1',
        process: { ...mockProcess },
        port: 4000,
        traceFilePath: '/path/to/trace1.zip',
        startTime: new Date(),
        lastAccessTime: new Date()
      };
      
      const mockSession2 = {
        sessionId: 'session-2',
        process: { ...mockProcess },
        port: 4001,
        traceFilePath: '/path/to/trace2.zip',
        startTime: new Date(),
        lastAccessTime: new Date()
      };
      
      // Add sessions to the service
      shutdownService.sessions.set('session-1', mockSession1);
      shutdownService.sessions.set('session-2', mockSession2);
      
      // Mock stopTraceViewer to actually remove sessions
      jest.spyOn(traceViewerService, 'stopTraceViewer').mockImplementation(async (sessionId: string) => {
        shutdownService.sessions.delete(sessionId);
        return Promise.resolve();
      });
      
      // Mock clearInterval
      jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
      
      // Set cleanup interval
      shutdownService.cleanupInterval = {} as any;
      
      // Call the method
      await traceViewerService.shutdown();
      
      // Verify all sessions were stopped
      expect(shutdownService.sessions.size).toBe(0);
      
      // Verify clearInterval was called
      expect(clearInterval).toHaveBeenCalled();
      expect(shutdownService.cleanupInterval).toBeNull();
    });
  });
});