import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';
import { PrismaClient, Role } from '@prisma/client';

const logger = createLogger('auth-middleware');

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT
 * 
 * This middleware verifies the JWT token in the Authorization header and adds the user ID
 * and email to the request object. If the token is invalid or missing, it returns a 401 Unauthorized response.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Authentication failed: No authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract token from header (Bearer <token>)
    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('Authentication failed: No token provided');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as {
      userId: string;
      email: string;
      type: string;
    };

    // Check if it's an access token
    if (decoded.type !== 'access') {
      logger.warn('Authentication failed: Not an access token');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };

    logger.debug('User authenticated', { userId: decoded.userId, email: decoded.email });
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Factory function to create middleware for checking workspace permissions
 * 
 * This function returns middleware that checks if the authenticated user has the required role
 * in the specified workspace. The workspace ID is expected to be in the request parameters as 'id'.
 * 
 * @param prisma - Prisma client instance
 * @param requiredRoles - Required role(s) for the operation
 * @returns Express middleware function
 */
export const requireWorkspaceRole = (prisma: PrismaClient, requiredRoles: Role | Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        logger.warn('Workspace permission check failed: User not authenticated');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user.userId;
      const workspaceId = req.params.id;

      if (!workspaceId) {
        logger.warn('Workspace permission check failed: No workspace ID in request', { userId });
        return res.status(400).json({ error: 'Workspace ID is required' });
      }

      logger.debug('Checking workspace permissions', { userId, workspaceId });

      // Find user's role in the workspace
      const userWorkspaceRole = await prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      if (!userWorkspaceRole) {
        logger.warn('Workspace permission check failed: User has no role in workspace', { userId, workspaceId });
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Check if user has one of the required roles
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (!roles.includes(userWorkspaceRole.role)) {
        logger.warn('Workspace permission check failed: Insufficient permissions', {
          userId,
          workspaceId,
          userRole: userWorkspaceRole.role,
          requiredRoles: roles
        });
        return res.status(403).json({ error: 'Forbidden' });
      }

      logger.debug('Workspace permission check passed', {
        userId,
        workspaceId,
        userRole: userWorkspaceRole.role
      });
      next();
    } catch (error) {
      logger.error('Error checking workspace permissions', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
        workspaceId: req.params.id
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};