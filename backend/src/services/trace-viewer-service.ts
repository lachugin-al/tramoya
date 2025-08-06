import { spawn, ChildProcess, exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { promisify } from 'util';

const execPromise = promisify(exec);
const logger = createLogger('trace-viewer-service');

/**
 * Interface for trace viewer session information
 */
interface TraceViewerSession {
  sessionId: string;
  process: ChildProcess;
  port: number;
  traceFilePath: string;
  startTime: Date;
  lastAccessTime: Date;
}

/**
 * Service for managing Playwright Trace Viewer instances
 * 
 * @class TraceViewerService
 * @description Provides methods for starting, stopping, and managing Playwright Trace Viewer instances.
 * The service handles the lifecycle of trace viewer processes, including automatic cleanup of inactive sessions.
 * 
 * The service is configured using environment variables:
 * - TRACE_VIEWER_PORT_RANGE_START: Starting port for trace viewer instances (default: 4000)
 * - TRACE_VIEWER_PORT_RANGE_END: Ending port for trace viewer instances (default: 4100)
 * - TRACE_VIEWER_SESSION_TIMEOUT: Timeout in milliseconds for inactive sessions (default: 300000 - 5 minutes)
 * - TRACE_TEMP_DIR: Directory for temporary trace files (default: /tmp/tramoya-traces)
 */
export class TraceViewerService {
  private sessions: Map<string, TraceViewerSession> = new Map();
  private portRangeStart: number;
  private portRangeEnd: number;
  private sessionTimeout: number;
  private tempDir: string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Get configuration from environment variables
    this.portRangeStart = parseInt(process.env.TRACE_VIEWER_PORT_RANGE_START || '4000', 10);
    this.portRangeEnd = parseInt(process.env.TRACE_VIEWER_PORT_RANGE_END || '4100', 10);
    this.sessionTimeout = parseInt(process.env.TRACE_VIEWER_SESSION_TIMEOUT || '300000', 10); // 5 minutes default
    this.tempDir = process.env.TRACE_TEMP_DIR || '/tmp/tramoya-traces';

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      logger.info(`Created temporary directory: ${this.tempDir}`);
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupInactiveSessions(), 60000); // Check every minute

    logger.info(`TraceViewerService initialized with port range: ${this.portRangeStart}-${this.portRangeEnd}, session timeout: ${this.sessionTimeout}ms`);
  }

  /**
   * Starts a new Playwright Trace Viewer instance for the specified trace file
   * 
   * @method startTraceViewer
   * @param {string} traceFilePath - Path to the trace file to view
   * @returns {Promise<{port: number, sessionId: string}>} Object containing the port and session ID
   * @throws {Error} If there are no available ports or if the trace viewer fails to start
   */
  public async startTraceViewer(traceFilePath: string): Promise<{port: number, sessionId: string}> {
    // Check if we've reached the maximum number of sessions (10)
    if (this.sessions.size >= 10) {
      logger.error('Maximum number of trace viewer sessions reached');
      throw new Error('Maximum number of trace viewer sessions reached. Please try again later.');
    }

    // Verify the trace file exists and is accessible
    if (!fs.existsSync(traceFilePath)) {
      logger.error(`Trace file not found: ${traceFilePath}`);
      throw new Error(`Trace file not found: ${traceFilePath}`);
    }

    try {
      // Check file permissions
      await fs.promises.access(traceFilePath, fs.constants.R_OK);
    } catch (error) {
      logger.error(`Cannot read trace file: ${traceFilePath}`);
      throw new Error(`Cannot read trace file: ${traceFilePath}`);
    }

    // Verify file size is not zero
    const stats = await fs.promises.stat(traceFilePath);
    if (stats.size === 0) {
      logger.error(`Trace file is empty: ${traceFilePath}`);
      throw new Error(`Trace file is empty: ${traceFilePath}`);
    }
    
    // Verify the file is a valid ZIP file
    try {
      // Read the first 4 bytes of the file to check for ZIP signature (PK\x03\x04)
      const fd = await fs.promises.open(traceFilePath, 'r');
      const buffer = Buffer.alloc(4);
      await fd.read(buffer, 0, 4, 0);
      await fd.close();
      
      // Check for ZIP file signature
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        logger.error(`Invalid trace file format: ${traceFilePath} - Not a valid ZIP file`);
        throw new Error(`Invalid trace file format: Not a valid ZIP file`);
      }
      
      logger.debug(`Verified trace file is a valid ZIP file: ${traceFilePath}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not a valid ZIP file')) {
        throw error; // Re-throw our custom error
      }
      logger.error(`Error validating trace file format: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Error validating trace file: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Find an available port
    const port = await this.findAvailablePort();
    if (!port) {
      logger.error('No available ports for trace viewer');
      throw new Error('No available ports for trace viewer. Please try again later.');
    }

    // Generate a unique session ID
    const sessionId = uuidv4();

    // Check Playwright version before starting
    let playwrightVersion = 'unknown';
    try {
      playwrightVersion = await this.checkPlaywrightVersion();
      
      // Start the trace viewer process
      logger.info(`Starting trace viewer for file: ${traceFilePath} on port ${port}`);
      
      // Collect stdout and stderr for better error reporting
      let stdoutChunks: string[] = [];
      let stderrChunks: string[] = [];
      
      // Use --host=0.0.0.0 to bind to all interfaces instead of just localhost
      // This is important in Docker environments where localhost might not be accessible
      const args = [
        'playwright', 'show-trace', 
        traceFilePath,
        `--port=${port}`,
        `--host=0.0.0.0`
      ];
      
      // Log the exact command being executed for better diagnostics
      logger.info(`Executing command: npx ${args.join(' ')}`);
      
      const process = spawn('npx', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Handle process output for debugging
      process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        stdoutChunks.push(output);
        logger.debug(`Trace viewer stdout [${sessionId}]: ${output}`);
      });

      process.stderr.on('data', (data) => {
        const output = data.toString().trim();
        stderrChunks.push(output);
        logger.debug(`Trace viewer stderr [${sessionId}]: ${output}`);
      });

      // Handle process exit
      process.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`Trace viewer process exited with code ${code} [${sessionId}]`);
          logger.error(`Trace viewer stderr: ${stderrChunks.join('\n')}`);
        } else {
          logger.info(`Trace viewer process exited with code ${code} [${sessionId}]`);
        }
        this.sessions.delete(sessionId);
      });

      // Handle process error
      process.on('error', (err) => {
        logger.error(`Trace viewer process error [${sessionId}]: ${err.message}`);
        this.sessions.delete(sessionId);
      });

      // Store session information
      const session: TraceViewerSession = {
        sessionId,
        process,
        port,
        traceFilePath,
        startTime: new Date(),
        lastAccessTime: new Date()
      };

      this.sessions.set(sessionId, session);

      // Check if running in Docker for better error messages
      const isInDocker = await this.isRunningInDocker();
      
      // Wait for the trace viewer to start with improved error handling
      await new Promise<void>((resolve, reject) => {
        // Make isInDocker available in the closure for all nested functions
        const dockerEnvironment = isInDocker;
        const maxRetries = 15; // Increase retries for slower systems
        let retries = 0;
        let startupTimeout: NodeJS.Timeout;

        // Set an overall timeout for startup
        const startupTimeoutMs = 15000; // 15 seconds
        startupTimeout = setTimeout(() => {
          const stdout = stdoutChunks.join('\n');
          const stderr = stderrChunks.join('\n');
          
          // Log detailed error information
          logger.error(`Trace viewer startup timed out after ${startupTimeoutMs}ms [${sessionId}]`);
          if (stdout) logger.error(`Trace viewer stdout: ${stdout}`);
          if (stderr) logger.error(`Trace viewer stderr: ${stderr}`);
          
          // Check if process is still running
          if (process.pid && !process.killed) {
            try {
              process.kill();
              logger.info(`Killed hanging trace viewer process [${sessionId}]`);
            } catch (err) {
              logger.error(`Failed to kill trace viewer process [${sessionId}]: ${err}`);
            }
          }
          
          // Include Playwright version and Docker-specific recommendations in error message
          let errorMsg = `Trace viewer startup timed out. Playwright version: ${playwrightVersion}.`;
          if (dockerEnvironment) {
            errorMsg += ` Running in Docker environment. This may be due to Docker networking issues. Ensure the container has proper network access.`;
          }
          if (stderr) {
            errorMsg += ` Error: ${stderr}`;
          }
          
          logger.error(errorMsg);
          reject(new Error(errorMsg));
        }, startupTimeoutMs);

        const checkServer = () => {
          // Try multiple connection methods to handle different Docker networking configurations
          logger.debug(`Checking if trace viewer is running on port ${port} (attempt ${retries + 1}/${maxRetries})`);
          
          // List of hosts to try in order
          const hostsToTry = ['localhost', '127.0.0.1', '0.0.0.0'];
          let currentHostIndex = 0;
          
          const tryNextHost = () => {
            if (currentHostIndex >= hostsToTry.length) {
              // If we've tried all hosts, try a direct TCP socket connection as a last resort
              tryTcpConnection();
              return;
            }
            
            const currentHost = hostsToTry[currentHostIndex];
            logger.debug(`Trying to connect to ${currentHost}:${port}`);
            
            const req = http.request({
              host: currentHost,
              port: port,
              path: '/',
              method: 'HEAD',
              timeout: 1000
            }, (res) => {
              if (res.statusCode === 200 || res.statusCode === 404) {
                logger.debug(`Trace viewer is running on ${currentHost}:${port} (status code: ${res.statusCode})`);
                clearTimeout(startupTimeout);
                resolve();
              } else {
                logger.debug(`Unexpected status code from trace viewer at ${currentHost}:${port}: ${res.statusCode}`);
                currentHostIndex++;
                tryNextHost();
              }
            });

            req.on('error', (err) => {
              // Log the specific error for better diagnostics
              logger.debug(`Error connecting to trace viewer at ${currentHost}:${port}: ${err.message}`);
              
              // Check if process has exited prematurely
              if (process.exitCode !== null) {
                clearTimeout(startupTimeout);
                const stdout = stdoutChunks.join('\n');
                const stderr = stderrChunks.join('\n');
                
                logger.error(`Trace viewer process exited prematurely with code ${process.exitCode} [${sessionId}]`);
                if (stdout) logger.error(`Trace viewer stdout: ${stdout}`);
                if (stderr) logger.error(`Trace viewer stderr: ${stderr}`);
                
                // Include Playwright version in error message
                const errorMsg = `Trace viewer process exited with code ${process.exitCode}. Playwright version: ${playwrightVersion}. ${stderr ? `Error: ${stderr}` : ''}`;
                logger.error(errorMsg);
                reject(new Error(errorMsg));
              } else {
                // Try the next host
                currentHostIndex++;
                tryNextHost();
              }
            });

            req.end();
          };
          
          // Try a direct TCP socket connection as a last resort
          const tryTcpConnection = () => {
            logger.debug(`Trying direct TCP socket connection to port ${port}`);
            
            const net = require('net');
            const socket = new net.Socket();
            let socketConnected = false;
            
            socket.setTimeout(1000);
            
            socket.on('connect', () => {
              logger.debug(`TCP socket connected successfully to port ${port}`);
              socketConnected = true;
              socket.destroy();
              clearTimeout(startupTimeout);
              resolve();
            });
            
            socket.on('timeout', () => {
              logger.debug(`TCP socket connection timed out to port ${port}`);
              socket.destroy();
              if (!socketConnected) {
                retry();
              }
            });
            
            socket.on('error', (err: Error) => {
              logger.debug(`TCP socket connection error to port ${port}: ${err.message}`);
              socket.destroy();
              retry();
            });
            
            // Try to connect to localhost first, then 127.0.0.1
            try {
              socket.connect(port, 'localhost');
            } catch (err: unknown) {
              logger.debug(`Error initiating TCP socket connection: ${err instanceof Error ? err.message : String(err)}`);
              retry();
            }
          };
          
          // Start the connection attempts
          tryNextHost();
        };

        const retry = async () => {
          retries++;
          if (retries >= maxRetries) {
            clearTimeout(startupTimeout);
            const stdout = stdoutChunks.join('\n');
            const stderr = stderrChunks.join('\n');
            
            logger.error(`Trace viewer failed to start after ${maxRetries} retries [${sessionId}]`);
            if (stdout) logger.error(`Trace viewer stdout: ${stdout}`);
            if (stderr) logger.error(`Trace viewer stderr: ${stderr}`);
            
            // Check if the process is still running
            const isProcessRunning = process.pid && !process.killed;
            logger.error(`Trace viewer process is ${isProcessRunning ? 'still running' : 'not running'}`);
            
            // Check if the stdout contains the "Listening" message
            const isListening = stdout.includes('Listening on');
            let listeningUrl = '';
            
            if (isListening) {
              logger.error(`Trace viewer reported it is listening, but we couldn't connect to it. This may indicate a network configuration issue.`);
              
              // Try to extract the URL it's listening on
              const match = stdout.match(/Listening on (http:\/\/[^⁠\s]+)/);
              if (match) {
                listeningUrl = match[1];
                logger.error(`Trace viewer is listening on: ${listeningUrl}`);
                
                // Extract host and port from the URL
                try {
                  const url = new URL(listeningUrl);
                  const host = url.hostname;
                  const urlPort = parseInt(url.port);
                  
                  // Test direct connectivity to the reported host:port
                  logger.info(`Testing direct connectivity to ${host}:${urlPort}`);
                  const canConnect = await this.testNetworkConnectivity(host, urlPort);
                  logger.info(`Direct connectivity test to ${host}:${urlPort}: ${canConnect ? 'SUCCESS' : 'FAILED'}`);
                  
                  // If we can't connect to the reported host:port, test localhost and 127.0.0.1
                  if (!canConnect) {
                    const localhostConnectivity = await this.testNetworkConnectivity('localhost', urlPort);
                    logger.info(`Connectivity test to localhost:${urlPort}: ${localhostConnectivity ? 'SUCCESS' : 'FAILED'}`);
                    
                    const loopbackConnectivity = await this.testNetworkConnectivity('127.0.0.1', urlPort);
                    logger.info(`Connectivity test to 127.0.0.1:${urlPort}: ${loopbackConnectivity ? 'SUCCESS' : 'FAILED'}`);
                  }
                } catch (urlError) {
                  logger.error(`Error parsing listening URL: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
                }
              }
            }
            
            // Include detailed diagnostics in error message
            let errorMsg = `Trace viewer failed to start. Playwright version: ${playwrightVersion}.`;
            
            if (isListening) {
              errorMsg += ` Server reported it is listening on ${listeningUrl || 'unknown URL'}, but connection failed.`;
              errorMsg += ` This indicates a network configuration issue where the process can bind to a port but is not accessible.`;
            }
            
            if (dockerEnvironment) {
              errorMsg += ` Running in Docker environment. This is likely due to Docker networking issues. Try the following:
              
              1. Check Docker network configuration:
                 - Ensure the container has proper network access
                 - Verify that the port is properly exposed in your docker-compose.yml or Dockerfile
                 - Check if port forwarding is correctly configured
              
              2. Verify host resolution:
                 - Make sure 'localhost' and '127.0.0.1' resolve correctly inside the container
                 - Try using the container's IP address instead of localhost
              
              3. Check for port conflicts:
                 - Verify that the port is not already in use by another service
                 - Try using a different port range in your configuration
              
              4. Inspect firewall rules:
                 - Check if there are any firewall rules blocking the connection
                 - Temporarily disable firewall to test if that's the issue
              
              5. Review Docker networking mode:
                 - Consider using 'host' network mode for testing
                 - Check if your Docker network driver is compatible`;
            }
            
            if (stderr) {
              errorMsg += ` Error output: ${stderr}`;
            }
            
            logger.error(errorMsg);
            reject(new Error(errorMsg));
          } else {
            // Exponential backoff with a maximum of 2 seconds
            const delay = Math.min(500 * Math.pow(1.5, retries - 1), 2000);
            logger.debug(`Retrying connection in ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
            setTimeout(checkServer, delay);
          }
        };

        checkServer();
      });

      logger.info(`Trace viewer started successfully [${sessionId}] on port ${port}`);
      return { port, sessionId };
    } catch (error) {
      // Clean up any session that might have been created
      if (this.sessions.has(sessionId)) {
        try {
          const session = this.sessions.get(sessionId);
          if (session && session.process.pid && !session.process.killed) {
            session.process.kill();
          }
          this.sessions.delete(sessionId);
        } catch (cleanupError) {
          logger.error(`Error cleaning up failed session [${sessionId}]: ${cleanupError}`);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error starting trace viewer: ${errorMessage}`);
      
      // Include Playwright version in the error message
      throw new Error(`Failed to start trace viewer: ${errorMessage}. Playwright version: ${playwrightVersion}`);
    }
  }

  /**
   * Stops a trace viewer session
   * 
   * @method stopTraceViewer
   * @param {string} sessionId - ID of the session to stop
   * @returns {Promise<void>}
   * @throws {Error} If the session is not found
   */
  public async stopTraceViewer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    try {
      logger.info(`Stopping trace viewer session: ${sessionId}`);
      
      // Kill the process
      if (session.process.pid) {
        process.kill(session.process.pid);
      }

      // Remove the session
      this.sessions.delete(sessionId);

      logger.info(`Trace viewer session stopped: ${sessionId}`);
    } catch (error) {
      logger.error(`Error stopping trace viewer: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Gets the status of a trace viewer session
   * 
   * @method getViewerStatus
   * @param {string} sessionId - ID of the session to check
   * @returns {Promise<{status: string, uptime: number, lastAccess: Date}>} Session status information
   * @throws {Error} If the session is not found
   */
  public async getViewerStatus(sessionId: string): Promise<{status: string, uptime: number, lastAccess: Date}> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      throw new Error('Session not found');
    }

    // Update last access time
    session.lastAccessTime = new Date();

    // Calculate uptime
    const uptime = Date.now() - session.startTime.getTime();

    return {
      status: 'running',
      uptime,
      lastAccess: session.lastAccessTime
    };
  }

  /**
   * Proxies a request to a trace viewer instance
   * 
   * @method proxyRequest
   * @param {string} sessionId - ID of the session to proxy to
   * @param {IncomingMessage} req - The incoming request
   * @param {ServerResponse} res - The server response
   * @returns {Promise<void>}
   * @throws {Error} If the session is not found
   */
  public async proxyRequest(sessionId: string, req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found for proxy request: ${sessionId}`);
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    // Update last access time
    session.lastAccessTime = new Date();

    try {
      // Create proxy request options
      const options = {
        hostname: 'localhost',
        port: session.port,
        path: path || '/',
        method: req.method,
        headers: { ...req.headers, host: `localhost:${session.port}` }
      };

      // Create proxy request
      const proxyReq = http.request(options, (proxyRes) => {
        // Copy status code and headers
        res.statusCode = proxyRes.statusCode || 500;
        Object.keys(proxyRes.headers).forEach(key => {
          const value = proxyRes.headers[key];
          if (value) {
            res.setHeader(key, value);
          }
        });

        // Pipe response data
        proxyRes.pipe(res);
      });

      // Handle errors
      proxyReq.on('error', (error) => {
        logger.error(`Proxy request error: ${error.message}`);
        res.statusCode = 502;
        res.end(JSON.stringify({ error: 'Bad Gateway' }));
      });

      // Pipe request data
      req.pipe(proxyReq);
    } catch (error) {
      logger.error(`Error proxying request: ${error instanceof Error ? error.message : String(error)}`);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  /**
   * Cleans up inactive sessions
   * 
   * @method cleanupInactiveSessions
   * @returns {Promise<void>}
   */
  public async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    // Find inactive sessions
    this.sessions.forEach((session, sessionId) => {
      const inactiveTime = now - session.lastAccessTime.getTime();
      if (inactiveTime > this.sessionTimeout) {
        sessionsToRemove.push(sessionId);
      }
    });

    // Remove inactive sessions
    for (const sessionId of sessionsToRemove) {
      logger.info(`Cleaning up inactive session: ${sessionId}`);
      try {
        await this.stopTraceViewer(sessionId);
      } catch (error) {
        logger.error(`Error cleaning up session: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (sessionsToRemove.length > 0) {
      logger.info(`Cleaned up ${sessionsToRemove.length} inactive sessions`);
    }
  }

  /**
   * Finds an available port in the configured range
   * 
   * @method findAvailablePort
   * @returns {Promise<number|null>} An available port or null if none are available
   * @private
   */
  private async findAvailablePort(): Promise<number | null> {
    // Get currently used ports
    const usedPorts = new Set<number>();
    this.sessions.forEach(session => {
      usedPorts.add(session.port);
    });

    // Find an available port in the range
    for (let port = this.portRangeStart; port <= this.portRangeEnd; port++) {
      if (!usedPorts.has(port) && await this.isPortAvailable(port)) {
        return port;
      }
    }

    return null;
  }

  /**
   * Checks if a port is available
   * 
   * @method isPortAvailable
   * @param {number} port - The port to check
   * @returns {Promise<boolean>} True if the port is available, false otherwise
   * @private
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const server = http.createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });
      server.listen(port, '127.0.0.1');
    });
  }
  
  /**
   * Checks the installed Playwright version and logs system diagnostics
   * 
   * @method checkPlaywrightVersion
   * @returns {Promise<string>} The installed Playwright version
   * @private
   */
  private async checkPlaywrightVersion(): Promise<string> {
    try {
      // Check if Playwright is installed
      const { stdout: versionOutput } = await execPromise('npx playwright --version');
      const versionInfo = versionOutput.trim();
      logger.info(`Installed Playwright version: ${versionInfo}`);
      
      // Check Node.js version
      const { stdout: nodeOutput } = await execPromise('node --version');
      const nodeVersion = nodeOutput.trim();
      logger.info(`Node.js version: ${nodeVersion}`);
      
      // Check OS information
      const { stdout: osOutput } = await execPromise('uname -a || ver');
      const osInfo = osOutput.trim();
      logger.info(`Operating system: ${osInfo}`);
      
      // Check if running in Docker
      const isInDocker = await this.isRunningInDocker();
      if (isInDocker) {
        logger.info('Running in Docker environment');
        
        // Get additional Docker network diagnostics
        try {
          // List network interfaces
          const { stdout: ifconfigOutput } = await execPromise('ifconfig || ip addr');
          logger.debug(`Network interfaces:\n${ifconfigOutput}`);
          
          // Check Docker network configuration
          const { stdout: dockerNetworkOutput } = await execPromise('cat /etc/hosts');
          logger.debug(`Docker hosts file:\n${dockerNetworkOutput}`);
          
          // Test DNS resolution for localhost
          const { stdout: dnsOutput } = await execPromise('getent hosts localhost || cat /etc/hosts | grep localhost');
          logger.info(`Localhost DNS resolution: ${dnsOutput.trim()}`);
        } catch (diagError) {
          logger.debug(`Error getting Docker network diagnostics: ${diagError instanceof Error ? diagError.message : String(diagError)}`);
        }
      } else {
        logger.info('Not running in Docker environment');
      }
      
      // Check open ports
      try {
        const { stdout: netstatOutput } = await execPromise('netstat -tuln || ss -tuln');
        logger.debug(`Open ports:\n${netstatOutput}`);
      } catch (netstatError) {
        logger.debug(`Error checking open ports: ${netstatError instanceof Error ? netstatError.message : String(netstatError)}`);
      }
      
      return versionInfo;
    } catch (error) {
      logger.error(`Error checking Playwright version: ${error instanceof Error ? error.message : String(error)}`);
      return 'unknown';
    }
  }
  
  /**
   * Tests network connectivity to a specific host and port
   * 
   * @method testNetworkConnectivity
   * @param {string} host - The host to test
   * @param {number} port - The port to test
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   * @private
   */
  private async testNetworkConnectivity(host: string, port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      let connected = false;
      
      socket.setTimeout(1000);
      
      socket.on('connect', () => {
        logger.debug(`Successfully connected to ${host}:${port}`);
        connected = true;
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        logger.debug(`Connection to ${host}:${port} timed out`);
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', (err: Error) => {
        logger.debug(`Error connecting to ${host}:${port}: ${err.message}`);
        socket.destroy();
        resolve(false);
      });
      
      try {
        socket.connect(port, host);
      } catch (err) {
        logger.debug(`Exception connecting to ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`);
        resolve(false);
      }
    });
  }
  
  /**
   * Checks if the application is running inside a Docker container
   * 
   * @method isRunningInDocker
   * @returns {Promise<boolean>} True if running in Docker, false otherwise
   * @private
   */
  private async isRunningInDocker(): Promise<boolean> {
    try {
      // Check for .dockerenv file
      if (fs.existsSync('/.dockerenv')) {
        return true;
      }
      
      // Check for docker in cgroup
      const { stdout } = await execPromise('cat /proc/1/cgroup 2>/dev/null | grep -q docker && echo "true" || echo "false"');
      return stdout.trim() === 'true';
    } catch (error) {
      // If any error occurs, assume not in Docker
      return false;
    }
  }

  /**
   * Cleans up resources when the service is shutting down
   * 
   * @method shutdown
   * @returns {Promise<void>}
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down TraceViewerService');

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      try {
        await this.stopTraceViewer(sessionId);
      } catch (error) {
        logger.error(`Error stopping session during shutdown: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    logger.info('TraceViewerService shutdown complete');
  }
}

// Export a singleton instance
export const traceViewerService = new TraceViewerService();