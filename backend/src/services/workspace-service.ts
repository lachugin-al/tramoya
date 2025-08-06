import { PrismaClient, Workspace, Role, User } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('workspace-service');

/**
 * Service for workspace management
 * 
 * This service provides methods for creating, retrieving, updating, and deleting workspaces,
 * as well as managing user-workspace relationships.
 */
export class WorkspaceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new workspace
   * 
   * @param name - Workspace name
   * @param description - Optional workspace description
   * @param createdById - ID of the user creating the workspace
   * @returns The created workspace
   */
  async createWorkspace(
    name: string,
    description: string | undefined,
    createdById: string
  ): Promise<Workspace> {
    try {
      logger.debug('Creating new workspace', { name, createdById });

      // Create workspace
      const workspace = await this.prisma.workspace.create({
        data: {
          name,
          description,
          createdById,
          isActive: true
        }
      });

      // Assign owner role to creator
      await this.prisma.userWorkspaceRole.create({
        data: {
          userId: createdById,
          workspaceId: workspace.id,
          role: Role.OWNER
        }
      });

      logger.info('Workspace created successfully', { 
        workspaceId: workspace.id, 
        name, 
        createdById 
      });

      return workspace;
    } catch (error) {
      logger.error('Error creating workspace', { 
        error: error instanceof Error ? error.message : String(error),
        name,
        createdById
      });
      throw error;
    }
  }

  /**
   * Get all workspaces accessible by a user
   * 
   * @param userId - ID of the user
   * @returns Array of workspaces with role information
   */
  async getWorkspacesByUser(userId: string): Promise<Array<Workspace & { userRole: Role }>> {
    try {
      logger.debug('Getting workspaces for user', { userId });

      const userWorkspaces = await this.prisma.userWorkspaceRole.findMany({
        where: {
          userId,
          workspace: {
            isActive: true
          }
        },
        include: {
          workspace: true
        }
      });

      const workspacesWithRole = userWorkspaces.map(uw => ({
        ...uw.workspace,
        userRole: uw.role
      }));

      logger.debug('Retrieved workspaces for user', { 
        userId, 
        count: workspacesWithRole.length 
      });

      return workspacesWithRole;
    } catch (error) {
      logger.error('Error getting workspaces for user', { 
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Get workspace by ID
   * 
   * @param workspaceId - ID of the workspace
   * @returns The workspace or null if not found
   */
  async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    try {
      logger.debug('Getting workspace by ID', { workspaceId });

      const workspace = await this.prisma.workspace.findUnique({
        where: {
          id: workspaceId,
          isActive: true
        }
      });

      if (!workspace) {
        logger.debug('Workspace not found', { workspaceId });
        return null;
      }

      logger.debug('Retrieved workspace', { workspaceId, name: workspace.name });
      return workspace;
    } catch (error) {
      logger.error('Error getting workspace by ID', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Update workspace
   * 
   * @param workspaceId - ID of the workspace to update
   * @param data - Data to update (name and/or description)
   * @returns The updated workspace
   * @throws If the workspace is not found
   */
  async updateWorkspace(
    workspaceId: string,
    data: { name?: string; description?: string }
  ): Promise<Workspace> {
    try {
      logger.debug('Updating workspace', { workspaceId, data });

      const workspace = await this.prisma.workspace.update({
        where: {
          id: workspaceId,
          isActive: true
        },
        data
      });

      logger.info('Workspace updated successfully', { 
        workspaceId, 
        name: workspace.name 
      });

      return workspace;
    } catch (error) {
      logger.error('Error updating workspace', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Delete workspace (soft delete)
   * 
   * @param workspaceId - ID of the workspace to delete
   * @returns The deleted workspace
   * @throws If the workspace is not found
   */
  async deleteWorkspace(workspaceId: string): Promise<Workspace> {
    try {
      logger.debug('Deleting workspace', { workspaceId });

      const workspace = await this.prisma.workspace.update({
        where: {
          id: workspaceId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      logger.info('Workspace deleted successfully', { 
        workspaceId, 
        name: workspace.name 
      });

      return workspace;
    } catch (error) {
      logger.error('Error deleting workspace', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Get users in a workspace with their roles
   * 
   * @param workspaceId - ID of the workspace
   * @returns Array of users with their roles in the workspace
   */
  async getWorkspaceUsers(workspaceId: string): Promise<Array<{
    user: Omit<User, 'passwordHash'>;
    role: Role;
  }>> {
    try {
      logger.debug('Getting users in workspace', { workspaceId });

      const userRoles = await this.prisma.userWorkspaceRole.findMany({
        where: {
          workspaceId,
          user: {
            isActive: true
          }
        },
        include: {
          user: true
        }
      });

      const usersWithRoles = userRoles.map(ur => {
        // Remove password hash from user object
        const { passwordHash, ...userWithoutPassword } = ur.user;
        return {
          user: userWithoutPassword,
          role: ur.role
        };
      });

      logger.debug('Retrieved users in workspace', { 
        workspaceId, 
        count: usersWithRoles.length 
      });

      return usersWithRoles;
    } catch (error) {
      logger.error('Error getting users in workspace', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Add user to workspace
   * 
   * @param workspaceId - ID of the workspace
   * @param userId - ID of the user to add
   * @param role - Role to assign to the user
   * @returns The created user-workspace role
   * @throws If the user or workspace is not found, or if the user is already in the workspace
   */
  async addUserToWorkspace(
    workspaceId: string,
    userId: string,
    role: Role
  ): Promise<{ userId: string; workspaceId: string; role: Role }> {
    try {
      logger.debug('Adding user to workspace', { workspaceId, userId, role });

      // Check if user already exists in workspace
      const existingRole = await this.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      if (existingRole) {
        logger.warn('User already exists in workspace', { 
          workspaceId, 
          userId, 
          existingRole: existingRole.role 
        });
        throw new Error('User already exists in workspace');
      }

      // Add user to workspace
      const userWorkspaceRole = await this.prisma.userWorkspaceRole.create({
        data: {
          userId,
          workspaceId,
          role
        }
      });

      logger.info('User added to workspace successfully', { 
        workspaceId, 
        userId, 
        role 
      });

      return {
        userId: userWorkspaceRole.userId,
        workspaceId: userWorkspaceRole.workspaceId,
        role: userWorkspaceRole.role
      };
    } catch (error) {
      logger.error('Error adding user to workspace', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update user role in workspace
   * 
   * @param workspaceId - ID of the workspace
   * @param userId - ID of the user
   * @param role - New role to assign
   * @returns The updated user-workspace role
   * @throws If the user-workspace relationship is not found
   */
  async updateUserRole(
    workspaceId: string,
    userId: string,
    role: Role
  ): Promise<{ userId: string; workspaceId: string; role: Role }> {
    try {
      logger.debug('Updating user role in workspace', { workspaceId, userId, role });

      // Update user role
      const userWorkspaceRole = await this.prisma.userWorkspaceRole.update({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        },
        data: {
          role
        }
      });

      logger.info('User role updated successfully', { 
        workspaceId, 
        userId, 
        role 
      });

      return {
        userId: userWorkspaceRole.userId,
        workspaceId: userWorkspaceRole.workspaceId,
        role: userWorkspaceRole.role
      };
    } catch (error) {
      logger.error('Error updating user role', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Remove user from workspace
   * 
   * @param workspaceId - ID of the workspace
   * @param userId - ID of the user to remove
   * @throws If the user-workspace relationship is not found or if trying to remove the owner
   */
  async removeUserFromWorkspace(workspaceId: string, userId: string): Promise<void> {
    try {
      logger.debug('Removing user from workspace', { workspaceId, userId });

      // Check if user is the owner
      const userRole = await this.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      if (!userRole) {
        logger.warn('User not found in workspace', { workspaceId, userId });
        throw new Error('User not found in workspace');
      }

      if (userRole.role === Role.OWNER) {
        logger.warn('Cannot remove workspace owner', { workspaceId, userId });
        throw new Error('Cannot remove workspace owner');
      }

      // Remove user from workspace
      await this.prisma.userWorkspaceRole.delete({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      logger.info('User removed from workspace successfully', { 
        workspaceId, 
        userId 
      });
    } catch (error) {
      logger.error('Error removing user from workspace', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get user role in workspace
   * 
   * @param userId - ID of the user
   * @param workspaceId - ID of the workspace
   * @returns The user's role or null if not found
   */
  async getUserRole(userId: string, workspaceId: string): Promise<Role | null> {
    try {
      logger.debug('Getting user role in workspace', { userId, workspaceId });

      const userWorkspaceRole = await this.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      });

      if (!userWorkspaceRole) {
        logger.debug('User has no role in workspace', { userId, workspaceId });
        return null;
      }

      logger.debug('Retrieved user role', { 
        userId, 
        workspaceId, 
        role: userWorkspaceRole.role 
      });

      return userWorkspaceRole.role;
    } catch (error) {
      logger.error('Error getting user role', { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        workspaceId
      });
      throw error;
    }
  }
}