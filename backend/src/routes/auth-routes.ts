import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserService } from '../services/user-service';
import { createLogger } from '../utils/logger';
import { authenticateJWT } from '../middleware/auth-middleware';

const logger = createLogger('auth-routes');

/**
 * Creates and configures routes for authentication
 * 
 * @param prisma - Prisma client for database operations
 * @returns Express router with configured auth routes
 */
export default function authRoutes(prisma: PrismaClient) {
  const router = Router();
  const userService = new UserService(prisma);

  /**
   * POST /api/v1/auth/register
   * Register a new user
   * 
   * @route POST /api/v1/auth/register
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @param {string} firstName - User's first name
   * @param {string} lastName - User's last name
   * @returns {Object} User object and tokens
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Validate input
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Register user
      const user = await userService.register(email, password, firstName, lastName);

      // Log in the user after registration
      const { accessToken, refreshToken } = await userService.login(email, password);

      logger.info('User registered and logged in', { userId: user.id, email });

      return res.status(201).json({
        user,
        accessToken,
        refreshToken
      });
    } catch (error) {
      logger.error('Error registering user', {
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Error && error.message === 'Email already in use') {
        return res.status(409).json({ error: 'Email already in use' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/auth/login
   * Authenticate a user and generate tokens
   * 
   * @route POST /api/v1/auth/login
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Object} User object and tokens
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Authenticate user
      const { user, accessToken, refreshToken } = await userService.login(email, password);

      logger.info('User logged in', { userId: user.id, email });

      return res.status(200).json({
        user,
        accessToken,
        refreshToken
      });
    } catch (error) {
      logger.error('Error logging in user', {
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Error && 
         (error.message === 'Invalid credentials' || error.message === 'User is inactive')) {
        return res.status(401).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   * 
   * @route POST /api/v1/auth/refresh
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New access token and refresh token
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Validate input
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      // Refresh token
      const result = await userService.refreshToken(refreshToken);

      logger.info('Token refreshed', { userId: result.user.id });

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Error refreshing token', {
        error: error instanceof Error ? error.message : String(error)
      });

      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  /**
   * GET /api/v1/auth/me
   * Get current user information
   * 
   * @route GET /api/v1/auth/me
   * @returns {Object} User object
   */
  router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await userService.getUserById(req.user.userId);

      logger.debug('User info retrieved', { userId: user.id });

      return res.status(200).json({ user });
    } catch (error) {
      logger.error('Error getting user info', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId
      });

      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/auth/logout
   * Logout user (client-side only)
   * 
   * @route POST /api/v1/auth/logout
   * @returns {Object} Success message
   */
  router.post('/logout', (req: Request, res: Response) => {
    // JWT tokens are stateless, so we don't need to do anything server-side
    // The client should remove the tokens from storage
    
    logger.debug('User logged out (client-side)');
    
    return res.status(200).json({ message: 'Logged out successfully' });
  });

  return router;
}