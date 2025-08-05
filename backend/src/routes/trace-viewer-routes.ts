import express, { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { MinioService } from '../services/minio-service';
import { traceViewerService } from '../services/trace-viewer-service';

const logger = createLogger('trace-viewer-routes');

/**
 * Creates and configures Express router for trace viewer management
 *
 * This router provides endpoints for starting, stopping, and interacting with
 * Playwright Trace Viewer instances. It allows clients to view trace files
 * directly in the browser without downloading them.
 *
 * @param {MinioService} minioService - Service for object storage operations
 * @returns {Router} Express router configured with trace viewer management endpoints
 */
export default function traceViewerRoutes(
    minioService: MinioService
): Router {
    const router = express.Router();

    /**
     * POST /trace-viewer/:traceId/start
     * Starts a new trace viewer instance for the specified trace file
     *
     * @route POST /trace-viewer/:traceId/start
     * @param {string} req.params.traceId - The ID of the trace file to view
     * @returns {Object} Object containing session information
     * @returns {string} returns.sessionId - The ID of the created trace viewer session
     * @returns {number} returns.port - The port the trace viewer is running on
     * @returns {string} returns.url - The URL to access the trace viewer
     * @returns {string} returns.status - The status of the trace viewer
     * @throws {404} If the trace file is not found
     * @throws {500} If there's an error starting the trace viewer
     */
    router.post('/:traceId/start', async (req, res) => {
        const { traceId } = req.params;
    
        try {
            logger.info(`Starting trace viewer for trace: ${traceId}`);
        
            // Construct the object name for the trace file
            const objectName = `runs/${traceId}/trace.zip`;
        
            // Download the trace file to a temporary location
            const traceFilePath = await minioService.downloadTraceFile(objectName);
        
            // Start the trace viewer
            const { sessionId, port } = await traceViewerService.startTraceViewer(traceFilePath);
        
            // Return the session information
            res.status(201).json({
                sessionId,
                port,
                url: `/api/v1/trace-viewer/${sessionId}/proxy/`,
                status: 'starting'
            });
        } catch (error) {
            logger.error(`Error starting trace viewer: ${error instanceof Error ? error.message : String(error)}`);
        
            if (error instanceof Error && error.message && error.message.includes('Not Found')) {
                res.status(404).json({ error: 'Trace file not found' });
            } else {
                res.status(500).json({ error: 'Error starting trace viewer' });
            }
        }
    });

    /**
     * POST /trace-viewer/start
     * Starts a new trace viewer instance for the specified trace file using either traceId or traceUrl
     *
     * @route POST /trace-viewer/start
     * @param {Object} req.body - Request body
     * @param {string} [req.body.traceId] - The ID of the trace file to view
     * @param {string} [req.body.traceUrl] - The URL of the trace file to view
     * @returns {Object} Object containing session information
     * @returns {string} returns.sessionId - The ID of the created trace viewer session
     * @returns {number} returns.port - The port the trace viewer is running on
     * @returns {string} returns.url - The URL to access the trace viewer
     * @returns {string} returns.status - The status of the trace viewer
     * @throws {400} If neither traceId nor traceUrl is provided or if traceUrl format is invalid
     * @throws {404} If the trace file is not found
     * @throws {500} If there's an error starting the trace viewer
     */
    router.post('/start', async (req, res) => {
        const { traceUrl, traceId } = req.body;
    
        try {
            let objectName: string;
        
            if (traceUrl) {
                // Extract objectName from traceUrl
                // URL format: /storage/runs/{runId}/trace.zip
                const match = traceUrl.match(/\/runs\/(.+\/trace\.zip)/);
                if (!match) {
                    return res.status(400).json({ error: 'Invalid traceUrl format' });
                }
                objectName = `runs/${match[1]}`;
                logger.info(`Starting trace viewer for trace URL: ${traceUrl}, extracted object name: ${objectName}`);
            } else if (traceId) {
                // Use the traceId to construct the object name
                objectName = `runs/${traceId}/trace.zip`;
                logger.info(`Starting trace viewer for trace ID: ${traceId}`);
            } else {
                return res.status(400).json({ error: 'Either traceUrl or traceId must be provided' });
            }
        
            // Download the trace file to a temporary location
            const traceFilePath = await minioService.downloadTraceFile(objectName);
        
            // Start the trace viewer
            const { sessionId, port } = await traceViewerService.startTraceViewer(traceFilePath);
        
            // Return the session information
            res.status(201).json({
                sessionId,
                port,
                url: `/api/v1/trace-viewer/${sessionId}/proxy/`,
                status: 'starting'
            });
        } catch (error) {
            logger.error(`Error starting trace viewer: ${error instanceof Error ? error.message : String(error)}`);
        
            if (error instanceof Error && error.message && error.message.includes('Not Found')) {
                res.status(404).json({ error: 'Trace file not found' });
            } else {
                res.status(500).json({ error: 'Error starting trace viewer' });
            }
        }
    });

    /**
     * GET /trace-viewer/:sessionId/status
     * Gets the status of a trace viewer session
     *
     * @route GET /trace-viewer/:sessionId/status
     * @param {string} req.params.sessionId - The ID of the trace viewer session
     * @returns {Object} Object containing session status information
     * @returns {string} returns.status - The status of the trace viewer
     * @returns {number} returns.uptime - The uptime of the trace viewer in milliseconds
     * @returns {string} returns.lastAccess - The timestamp of the last access to the trace viewer
     * @throws {404} If the session is not found
     * @throws {500} If there's an error getting the session status
     */
    router.get('/:sessionId/status', async (req, res) => {
        const { sessionId } = req.params;
        
        try {
            logger.info(`Getting status for trace viewer session: ${sessionId}`);
            
            // Get the session status
            const status = await traceViewerService.getViewerStatus(sessionId);
            
            // Return the status information
            res.json({
                status: status.status,
                uptime: status.uptime,
                lastAccess: status.lastAccess
            });
        } catch (error) {
            logger.error(`Error getting trace viewer status: ${error instanceof Error ? error.message : String(error)}`);
            
            if (error instanceof Error && error.message && error.message.includes('not found')) {
                res.status(404).json({ error: 'Session not found' });
            } else {
                res.status(500).json({ error: 'Error getting trace viewer status' });
            }
        }
    });

    /**
     * DELETE /trace-viewer/:sessionId
     * Stops a trace viewer session
     *
     * @route DELETE /trace-viewer/:sessionId
     * @param {string} req.params.sessionId - The ID of the trace viewer session to stop
     * @returns {204} No content on successful deletion
     * @throws {404} If the session is not found
     * @throws {500} If there's an error stopping the session
     */
    router.delete('/:sessionId', async (req, res) => {
        const { sessionId } = req.params;
        
        try {
            logger.info(`Stopping trace viewer session: ${sessionId}`);
            
            // Stop the trace viewer session
            await traceViewerService.stopTraceViewer(sessionId);
            
            // Return success
            res.status(204).send();
        } catch (error) {
            logger.error(`Error stopping trace viewer: ${error instanceof Error ? error.message : String(error)}`);
            
            if (error instanceof Error && error.message && error.message.includes('not found')) {
                res.status(404).json({ error: 'Session not found' });
            } else {
                res.status(500).json({ error: 'Error stopping trace viewer' });
            }
        }
    });

    /**
     * GET /trace-viewer/:sessionId/proxy/*
     * Proxies requests to a trace viewer instance
     *
     * This endpoint forwards all requests to the trace viewer instance running on the local machine.
     * It handles all HTTP methods and paths, allowing the client to interact with the trace viewer
     * as if it were directly accessible.
     *
     * @route GET /trace-viewer/:sessionId/proxy/*
     * @param {string} req.params.sessionId - The ID of the trace viewer session
     * @param {string} req.params[0] - The path to proxy to the trace viewer
     * @throws {404} If the session is not found
     * @throws {500} If there's an error proxying the request
     */
    router.all('/:sessionId/proxy/*', async (req, res) => {
        const { sessionId } = req.params;
        
        // Extract the path after /proxy/ from the original URL
        const proxyBasePath = `/api/v1/trace-viewer/${sessionId}/proxy`;
        const path = req.originalUrl.startsWith(proxyBasePath) 
            ? req.originalUrl.substring(proxyBasePath.length) || '/'
            : '/';
        
        try {
            // Proxy the request to the trace viewer
            await traceViewerService.proxyRequest(sessionId, req, res, path);
        } catch (error) {
            logger.error(`Error proxying request: ${error instanceof Error ? error.message : String(error)}`);
            
            // If we get here, the proxyRequest method didn't handle the response
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error proxying request to trace viewer' });
            }
        }
    });

    /**
     * POST /trace-viewer/cleanup
     * Cleans up temporary trace files and inactive sessions
     *
     * @route POST /trace-viewer/cleanup
     * @returns {Object} Object containing cleanup information
     * @returns {number} returns.filesRemoved - The number of temporary files removed
     * @returns {number} returns.sessionsRemoved - The number of inactive sessions removed
     * @throws {500} If there's an error during cleanup
     */
    router.post('/cleanup', async (req, res) => {
        try {
            logger.info('Cleaning up temporary trace files and inactive sessions');
            
            // Clean up temporary files
            const filesRemoved = await minioService.cleanupTempFiles();
            
            // Clean up inactive sessions
            await traceViewerService.cleanupInactiveSessions();
            
            // Return cleanup information
            res.json({
                filesRemoved,
                message: 'Cleanup completed successfully'
            });
        } catch (error) {
            logger.error(`Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
            
            // Still try to clean up inactive sessions even if cleaning up temp files fails
            try {
                await traceViewerService.cleanupInactiveSessions();
            } catch (sessionError) {
                logger.error(`Error cleaning up inactive sessions: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`);
            }
            
            res.status(500).json({ error: 'Error during cleanup' });
        }
    });

    return router;
}