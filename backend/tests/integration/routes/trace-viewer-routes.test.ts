import express, { Express } from 'express';
import request from 'supertest';
import { MinioService } from '../../../src/services/minio-service';
import { traceViewerService } from '../../../src/services/trace-viewer-service';
import traceViewerRoutes from '../../../src/routes/trace-viewer-routes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock external dependencies but keep the integration between routes and service
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../../src/services/minio-service');
jest.mock('child_process');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    open: jest.fn().mockResolvedValue({
      read: jest.fn().mockResolvedValue({ bytesRead: 4 }),
      close: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

// Don't mock the trace-viewer-service to test the integration
// But we'll spy on its methods to verify they're called correctly

describe('Trace Viewer Routes Integration', () => {
  let app: Express;
  let mockMinioService: jest.Mocked<MinioService>;
  let tempTraceFile: string;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a temporary trace file path
    tempTraceFile = path.join(os.tmpdir(), 'test-trace.zip');

    // Mock MinioService
    mockMinioService = {
      downloadTraceFile: jest.fn().mockResolvedValue(tempTraceFile),
      cleanupTempFiles: jest.fn().mockResolvedValue(5)
    } as unknown as jest.Mocked<MinioService>;

    // Mock fs functions
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.stat as jest.Mock).mockResolvedValue({ size: 1024 });

    // Create a mock buffer with ZIP file signature
    const mockBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    jest.spyOn(Buffer, 'alloc').mockReturnValue(mockBuffer);

    // Spy on traceViewerService methods
    jest.spyOn(traceViewerService, 'startTraceViewer').mockResolvedValue({
      sessionId: 'test-session-id',
      port: 4000
    });
    jest.spyOn(traceViewerService, 'stopTraceViewer').mockResolvedValue(undefined);
    
    // Use a fixed date string for consistent testing
    const mockLastAccess = new Date('2025-08-05T16:23:00Z');
    jest.spyOn(traceViewerService, 'getViewerStatus').mockResolvedValue({
      status: 'running',
      uptime: 60000,
      lastAccess: mockLastAccess
    });
    // Create a more realistic proxyRequest mock that simulates the actual behavior
    jest.spyOn(traceViewerService, 'proxyRequest').mockImplementation(
      (sessionId, req, res, path) => {
        // Check if session exists (in our tests, only 'test-session-id' is valid)
        if (sessionId !== 'test-session-id') {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Session not found' }));
          return Promise.resolve();
        }
        
        // Create a mock session to update last access time (simulating real behavior)
        const mockSession = {
          sessionId: 'test-session-id',
          process: {} as any,
          port: 4000,
          traceFilePath: '/path/to/trace.zip',
          startTime: new Date(Date.now() - 60000), // 1 minute ago
          lastAccessTime: new Date(Date.now() - 30000) // 30 seconds ago
        };
        
        // Update last access time as the real implementation would
        mockSession.lastAccessTime = new Date();
        
        // Create a proxy response similar to what the real method would do
        res.statusCode = 200;
        
        // Set some headers like the real method would
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('X-Proxied-By', 'Trace Viewer Service');
        
        // End the response with data
        res.end('Proxied response');
        
        return Promise.resolve();
      }
    );
    jest.spyOn(traceViewerService, 'cleanupInactiveSessions').mockResolvedValue(undefined);

    // Create Express app
    app = express();
    
    // Add body-parser middleware for parsing JSON request bodies
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Set up routes
    app.use('/api/v1/trace-viewer', traceViewerRoutes(mockMinioService));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  // Clean up the singleton instance after all tests
  afterAll(async () => {
    // Make sure to clean up the singleton instance to prevent hanging intervals
    await traceViewerService.shutdown();
  });

  describe('Start Trace Viewer', () => {
    it('should integrate with service to start a trace viewer by traceId', async () => {
      // Make request
      const response = await request(app)
        .post('/api/v1/trace-viewer/trace-123/start');

      // Verify response
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        sessionId: 'test-session-id',
        port: 4000,
        url: '/api/v1/trace-viewer/test-session-id/proxy/',
        status: 'starting'
      });

      // Verify service integration
      expect(mockMinioService.downloadTraceFile).toHaveBeenCalledWith('runs/trace-123/trace.zip');
      expect(traceViewerService.startTraceViewer).toHaveBeenCalledWith(tempTraceFile);
    });

    it('should integrate with service to start a trace viewer by traceUrl', async () => {
      // Make request with proper content-type header to ensure body parsing works
      const response = await request(app)
        .post('/api/v1/trace-viewer/start')
        .set('Content-Type', 'application/json')
        .send({ traceUrl: '/storage/runs/trace-123/trace.zip' });

      // Verify response
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        sessionId: 'test-session-id',
        port: 4000,
        url: '/api/v1/trace-viewer/test-session-id/proxy/',
        status: 'starting'
      });

      // Verify service integration
      expect(mockMinioService.downloadTraceFile).toHaveBeenCalledWith('runs/trace-123/trace.zip');
      expect(traceViewerService.startTraceViewer).toHaveBeenCalledWith(tempTraceFile);
    });

    it('should handle service errors when starting a trace viewer', async () => {
      // Mock service to throw an error
      (traceViewerService.startTraceViewer as jest.Mock).mockRejectedValue(
        new Error('Failed to start trace viewer')
      );

      // Make request
      const response = await request(app)
        .post('/api/v1/trace-viewer/trace-123/start');

      // Verify response
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Error starting trace viewer' });

      // Verify service integration
      expect(mockMinioService.downloadTraceFile).toHaveBeenCalledWith('runs/trace-123/trace.zip');
      expect(traceViewerService.startTraceViewer).toHaveBeenCalledWith(tempTraceFile);
    });
  });

  describe('Get Viewer Status', () => {
    it('should integrate with service to get viewer status', async () => {
      // Make request
      const response = await request(app)
        .get('/api/v1/trace-viewer/test-session-id/status');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'running',
        uptime: 60000,
        lastAccess: new Date('2025-08-05T16:23:00Z').toISOString()
      });

      // Verify service integration
      expect(traceViewerService.getViewerStatus).toHaveBeenCalledWith('test-session-id');
    });

    it('should handle service errors when getting viewer status', async () => {
      // Mock service to throw an error
      (traceViewerService.getViewerStatus as jest.Mock).mockRejectedValue(
        new Error('Session not found')
      );

      // Make request
      const response = await request(app)
        .get('/api/v1/trace-viewer/test-session-id/status');

      // Verify response
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Session not found' });

      // Verify service integration
      expect(traceViewerService.getViewerStatus).toHaveBeenCalledWith('test-session-id');
    });
  });

  describe('Stop Trace Viewer', () => {
    it('should integrate with service to stop a trace viewer', async () => {
      // Make request
      const response = await request(app)
        .delete('/api/v1/trace-viewer/test-session-id');

      // Verify response
      expect(response.status).toBe(204);

      // Verify service integration
      expect(traceViewerService.stopTraceViewer).toHaveBeenCalledWith('test-session-id');
    });

    it('should handle service errors when stopping a trace viewer', async () => {
      // Mock service to throw an error
      (traceViewerService.stopTraceViewer as jest.Mock).mockRejectedValue(
        new Error('Session not found')
      );

      // Make request
      const response = await request(app)
        .delete('/api/v1/trace-viewer/test-session-id');

      // Verify response
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Session not found' });

      // Verify service integration
      expect(traceViewerService.stopTraceViewer).toHaveBeenCalledWith('test-session-id');
    });
  });

  describe('Proxy Requests', () => {
    it('should integrate with service to proxy requests', async () => {
      // Make request
      const response = await request(app)
        .get('/api/v1/trace-viewer/test-session-id/proxy/some/path');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.text).toBe('Proxied response');

      // Verify service integration
      expect(traceViewerService.proxyRequest).toHaveBeenCalledWith(
        'test-session-id',
        expect.any(Object),
        expect.any(Object),
        '/some/path'
      );
    });

    it('should handle service errors when proxying requests', async () => {
      // Mock service to throw an error
      (traceViewerService.proxyRequest as jest.Mock).mockImplementation(() => {
        throw new Error('Proxy error');
      });

      // Make request
      const response = await request(app)
        .get('/api/v1/trace-viewer/test-session-id/proxy/some/path');

      // Verify response
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Error proxying request to trace viewer' });

      // Verify service integration
      expect(traceViewerService.proxyRequest).toHaveBeenCalledWith(
        'test-session-id',
        expect.any(Object),
        expect.any(Object),
        '/some/path'
      );
    });
  });

  describe('Cleanup', () => {
    it('should integrate with service to clean up resources', async () => {
      // Make request
      const response = await request(app)
        .post('/api/v1/trace-viewer/cleanup');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        filesRemoved: 5,
        message: 'Cleanup completed successfully'
      });

      // Verify service integration
      expect(mockMinioService.cleanupTempFiles).toHaveBeenCalled();
      expect(traceViewerService.cleanupInactiveSessions).toHaveBeenCalled();
    });

    it('should handle MinioService errors during cleanup', async () => {
      // Mock MinioService to throw an error
      mockMinioService.cleanupTempFiles.mockRejectedValue(new Error('Cleanup error'));
      
      // Reset the cleanupInactiveSessions mock to ensure it's called
      (traceViewerService.cleanupInactiveSessions as jest.Mock).mockClear();
      
      // Mock implementation to ensure it's called even when cleanupTempFiles fails
      (traceViewerService.cleanupInactiveSessions as jest.Mock).mockImplementation(() => {
        return Promise.resolve();
      });

      // Make request
      const response = await request(app)
        .post('/api/v1/trace-viewer/cleanup');

      // Verify response
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Error during cleanup' });

      // Verify service integration
      expect(mockMinioService.cleanupTempFiles).toHaveBeenCalled();
      
      // In the actual implementation, cleanupInactiveSessions is called regardless of whether
      // cleanupTempFiles succeeds or fails, so we expect it to be called here too
      expect(traceViewerService.cleanupInactiveSessions).toHaveBeenCalled();
    });

    it('should handle TraceViewerService errors during cleanup', async () => {
      // Mock TraceViewerService to throw an error
      (traceViewerService.cleanupInactiveSessions as jest.Mock).mockRejectedValue(
        new Error('Session cleanup error')
      );

      // Make request
      const response = await request(app)
        .post('/api/v1/trace-viewer/cleanup');

      // Verify response
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Error during cleanup' });

      // Verify service integration
      expect(mockMinioService.cleanupTempFiles).toHaveBeenCalled();
      expect(traceViewerService.cleanupInactiveSessions).toHaveBeenCalled();
    });
  });
});