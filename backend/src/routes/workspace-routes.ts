import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { WorkspaceService } from '../services/workspace-service';
import { createLogger } from '../utils/logger';
import { authenticateJWT, requireWorkspaceRole } from '../middleware/auth-middleware';

const logger = createLogger('workspace-routes');

/**
 * Creates and configures routes for workspace management
 * 
 * @param prisma - Prisma client for database operations
 * @returns Express router with configured workspace routes
 */
export default function workspaceRoutes(prisma: PrismaClient) {
  const router = Router();
  const workspaceService = new WorkspaceService(prisma);

  // All workspace routes require authentication
  router.use(authenticateJWT);

  /**
   * GET /api/v1/workspaces
   * Get all workspaces accessible by the authenticated user
   * 
   * @route GET /api/v1/workspaces
   * @returns {Object[]} Array of workspaces with role information
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaces = await workspaceService.getWorkspacesByUser(req.user.userId);

      logger.debug('Retrieved workspaces for user', { 
        userId: req.user.userId, 
        count: workspaces.length 
      });

      return res.status(200).json(workspaces);
    } catch (error) {
      logger.error('Error getting workspaces', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/workspaces
   * Create a new workspace
   * 
   * @route POST /api/v1/workspaces
   * @param {string} name - Workspace name
   * @param {string} [description] - Optional workspace description
   * @returns {Object} Created workspace
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, description } = req.body;

      // Validate input
      if (!name) {
        return res.status(400).json({ error: 'Workspace name is required' });
      }

      const workspace = await workspaceService.createWorkspace(
        name,
        description,
        req.user.userId
      );

      logger.info('Workspace created', { 
        workspaceId: workspace.id, 
        name, 
        userId: req.user.userId 
      });

      return res.status(201).json(workspace);
    } catch (error) {
      logger.error('Error creating workspace', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/workspaces/:id
   * Get workspace by ID
   * 
   * @route GET /api/v1/workspaces/:id
   * @param {string} id - Workspace ID
   * @returns {Object} Workspace
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;

      // Check if user has access to workspace
      const userRole = await workspaceService.getUserRole(req.user.userId, workspaceId);
      if (!userRole) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const workspace = await workspaceService.getWorkspaceById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }

      logger.debug('Retrieved workspace', { 
        workspaceId, 
        name: workspace.name, 
        userId: req.user.userId 
      });

      return res.status(200).json({ ...workspace, userRole });
    } catch (error) {
      logger.error('Error getting workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        userId: req.user?.userId
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/v1/workspaces/:id
   * Update workspace
   * 
   * @route PUT /api/v1/workspaces/:id
   * @param {string} id - Workspace ID
   * @param {string} [name] - New workspace name
   * @param {string} [description] - New workspace description
   * @returns {Object} Updated workspace
   */
  router.put('/:id', requireWorkspaceRole(prisma, [Role.OWNER, Role.ADMIN]), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;
      const { name, description } = req.body;

      // Validate input
      if (!name && description === undefined) {
        return res.status(400).json({ error: 'At least one field to update is required' });
      }

      // Prepare update data
      const updateData: { name?: string; description?: string } = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const workspace = await workspaceService.updateWorkspace(workspaceId, updateData);

      logger.info('Workspace updated', { 
        workspaceId, 
        name: workspace.name, 
        userId: req.user.userId 
      });

      return res.status(200).json(workspace);
    } catch (error) {
      logger.error('Error updating workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        userId: req.user?.userId
      });

      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return res.status(404).json({ error: 'Workspace not found' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/v1/workspaces/:id
   * Delete workspace (soft delete)
   * 
   * @route DELETE /api/v1/workspaces/:id
   * @param {string} id - Workspace ID
   * @returns {Object} Success message
   */
  router.delete('/:id', requireWorkspaceRole(prisma, [Role.OWNER]), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;

      await workspaceService.deleteWorkspace(workspaceId);

      logger.info('Workspace deleted', { 
        workspaceId, 
        userId: req.user.userId 
      });

      return res.status(200).json({ message: 'Workspace deleted successfully' });
    } catch (error) {
      logger.error('Error deleting workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        userId: req.user?.userId
      });

      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return res.status(404).json({ error: 'Workspace not found' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/workspaces/:id/users
   * Get users in workspace
   * 
   * @route GET /api/v1/workspaces/:id/users
   * @param {string} id - Workspace ID
   * @returns {Object[]} Array of users with their roles
   */
  router.get('/:id/users', requireWorkspaceRole(prisma, [Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER]), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;

      const users = await workspaceService.getWorkspaceUsers(workspaceId);

      logger.debug('Retrieved workspace users', { 
        workspaceId, 
        count: users.length, 
        userId: req.user.userId 
      });

      return res.status(200).json(users);
    } catch (error) {
      logger.error('Error getting workspace users', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        userId: req.user?.userId
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/workspaces/:id/users
   * Add user to workspace
   * 
   * @route POST /api/v1/workspaces/:id/users
   * @param {string} id - Workspace ID
   * @param {string} userId - User ID to add
   * @param {string} role - Role to assign (ADMIN, EDITOR, VIEWER)
   * @returns {Object} Created user-workspace relationship
   */
  router.post('/:id/users', requireWorkspaceRole(prisma, [Role.OWNER, Role.ADMIN]), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;
      const { userId, role } = req.body;

      // Validate input
      if (!userId || !role) {
        return res.status(400).json({ error: 'User ID and role are required' });
      }

      // Validate role
      if (!Object.values(Role).includes(role as Role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Only OWNER can add ADMIN
      if (role === Role.ADMIN) {
        const currentUserRole = await workspaceService.getUserRole(req.user.userId, workspaceId);
        if (currentUserRole !== Role.OWNER) {
          return res.status(403).json({ error: 'Only workspace owners can add admins' });
        }
      }

      // Prevent adding OWNER role
      if (role === Role.OWNER) {
        return res.status(400).json({ error: 'Cannot add user with OWNER role' });
      }

      const result = await workspaceService.addUserToWorkspace(workspaceId, userId, role as Role);

      logger.info('User added to workspace', { 
        workspaceId, 
        targetUserId: userId, 
        role, 
        userId: req.user.userId 
      });

      return res.status(201).json(result);
    } catch (error) {
      logger.error('Error adding user to workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        userId: req.user?.userId
      });

      if (error instanceof Error && error.message === 'User already exists in workspace') {
        return res.status(409).json({ error: 'User already exists in workspace' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/v1/workspaces/:id/users/:uid
   * Update user role in workspace
   * 
   * @route PUT /api/v1/workspaces/:id/users/:uid
   * @param {string} id - Workspace ID
   * @param {string} uid - User ID
   * @param {string} role - New role to assign (ADMIN, EDITOR, VIEWER)
   * @returns {Object} Updated user-workspace relationship
   */
  router.put('/:id/users/:uid', requireWorkspaceRole(prisma, [Role.OWNER, Role.ADMIN]), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;
      const targetUserId = req.params.uid;
      const { role } = req.body;

      // Validate input
      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }

      // Validate role
      if (!Object.values(Role).includes(role as Role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Check if target user is the workspace owner
      const targetUserRole = await workspaceService.getUserRole(targetUserId, workspaceId);
      if (targetUserRole === Role.OWNER) {
        return res.status(400).json({ error: 'Cannot change role of workspace owner' });
      }

      // Only OWNER can manage ADMIN role
      if (role === Role.ADMIN || targetUserRole === Role.ADMIN) {
        const currentUserRole = await workspaceService.getUserRole(req.user.userId, workspaceId);
        if (currentUserRole !== Role.OWNER) {
          return res.status(403).json({ error: 'Only workspace owners can manage admin roles' });
        }
      }

      // Prevent setting OWNER role
      if (role === Role.OWNER) {
        return res.status(400).json({ error: 'Cannot set OWNER role' });
      }

      const result = await workspaceService.updateUserRole(workspaceId, targetUserId, role as Role);

      logger.info('User role updated in workspace', { 
        workspaceId, 
        targetUserId, 
        role, 
        userId: req.user.userId 
      });

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Error updating user role in workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        targetUserId: req.params.uid,
        userId: req.user?.userId
      });

      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return res.status(404).json({ error: 'User not found in workspace' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/v1/workspaces/:id/users/:uid
   * Remove user from workspace
   * 
   * @route DELETE /api/v1/workspaces/:id/users/:uid
   * @param {string} id - Workspace ID
   * @param {string} uid - User ID
   * @returns {Object} Success message
   */
  router.delete('/:id/users/:uid', requireWorkspaceRole(prisma, [Role.OWNER, Role.ADMIN]), async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.params.id;
      const targetUserId = req.params.uid;

      // Check if target user is the workspace owner
      const targetUserRole = await workspaceService.getUserRole(targetUserId, workspaceId);
      if (targetUserRole === Role.OWNER) {
        return res.status(400).json({ error: 'Cannot remove workspace owner' });
      }

      // Only OWNER can remove ADMIN
      if (targetUserRole === Role.ADMIN) {
        const currentUserRole = await workspaceService.getUserRole(req.user.userId, workspaceId);
        if (currentUserRole !== Role.OWNER) {
          return res.status(403).json({ error: 'Only workspace owners can remove admins' });
        }
      }

      await workspaceService.removeUserFromWorkspace(workspaceId, targetUserId);

      logger.info('User removed from workspace', { 
        workspaceId, 
        targetUserId, 
        userId: req.user.userId 
      });

      return res.status(200).json({ message: 'User removed from workspace successfully' });
    } catch (error) {
      logger.error('Error removing user from workspace', {
        error: error instanceof Error ? error.message : String(error),
        workspaceId: req.params.id,
        targetUserId: req.params.uid,
        userId: req.user?.userId
      });

      if (error instanceof Error) {
        if (error.message === 'User not found in workspace') {
          return res.status(404).json({ error: 'User not found in workspace' });
        }
        if (error.message === 'Cannot remove workspace owner') {
          return res.status(400).json({ error: 'Cannot remove workspace owner' });
        }
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}