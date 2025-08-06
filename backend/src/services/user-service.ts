import { PrismaClient, User, Role } from '@prisma/client';
import { createLogger } from '../utils/logger';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const logger = createLogger('user-service');

/**
 * Service for user management and authentication
 * 
 * This service provides methods for user registration, authentication, and other user-related operations.
 * It uses bcrypt for password hashing and JWT for token generation.
 */
export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new user
   * 
   * @param email - User's email address
   * @param password - User's password (will be hashed)
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @returns The created user object (without password)
   * @throws If the email is already in use
   */
  async register(email: string, password: string, firstName: string, lastName: string): Promise<Omit<User, 'passwordHash'>> {
    try {
      logger.debug('Registering new user', { email });

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        logger.warn('Registration failed: Email already in use', { email });
        throw new Error('Email already in use');
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          isActive: true
        }
      });

      logger.info('User registered successfully', { userId: user.id, email });

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Error registering user', { 
        error: error instanceof Error ? error.message : String(error),
        email 
      });
      throw error;
    }
  }

  /**
   * Authenticate a user and generate JWT tokens
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Object containing access token, refresh token, and user info
   * @throws If the credentials are invalid or the user is inactive
   */
  async login(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    try {
      logger.debug('Authenticating user', { email });

      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email }
      });

      // Check if user exists
      if (!user) {
        logger.warn('Authentication failed: User not found', { email });
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Authentication failed: User is inactive', { email, userId: user.id });
        throw new Error('User is inactive');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        logger.warn('Authentication failed: Invalid password', { email, userId: user.id });
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info('User authenticated successfully', { userId: user.id, email });

      // Return tokens and user info (without password hash)
      const { passwordHash: _, ...userWithoutPassword } = user;
      return {
        accessToken,
        refreshToken,
        user: userWithoutPassword
      };
    } catch (error) {
      logger.error('Error authenticating user', { 
        error: error instanceof Error ? error.message : String(error),
        email 
      });
      throw error;
    }
  }

  /**
   * Refresh an access token using a refresh token
   * 
   * @param refreshToken - The refresh token
   * @returns Object containing new access token, refresh token, and user info
   * @throws If the refresh token is invalid or expired
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    try {
      logger.debug('Refreshing token');

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || '') as {
        userId: string;
        type: string;
      };

      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        logger.warn('Token refresh failed: Not a refresh token');
        throw new Error('Invalid token');
      }

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      // Check if user exists and is active
      if (!user || !user.isActive) {
        logger.warn('Token refresh failed: User not found or inactive', { 
          userId: decoded.userId 
        });
        throw new Error('Invalid token');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      logger.info('Token refreshed successfully', { userId: user.id });

      // Return new tokens and user info
      const { passwordHash: _, ...userWithoutPassword } = user;
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: userWithoutPassword
      };
    } catch (error) {
      logger.error('Error refreshing token', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user by ID
   * 
   * @param userId - The user ID
   * @returns The user object (without password)
   * @throws If the user is not found
   */
  async getUserById(userId: string): Promise<Omit<User, 'passwordHash'>> {
    try {
      logger.debug('Getting user by ID', { userId });

      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        logger.warn('User not found', { userId });
        throw new Error('User not found');
      }

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Error getting user by ID', { 
        error: error instanceof Error ? error.message : String(error),
        userId 
      });
      throw error;
    }
  }

  /**
   * Check if a user has a specific role in a workspace
   * 
   * @param userId - The user ID
   * @param workspaceId - The workspace ID
   * @param requiredRole - The required role or array of roles
   * @returns True if the user has the required role, false otherwise
   */
  async hasWorkspaceRole(
    userId: string, 
    workspaceId: string, 
    requiredRole: Role | Role[]
  ): Promise<boolean> {
    try {
      logger.debug('Checking user workspace role', { userId, workspaceId });

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
        return false;
      }

      // Check if user has one of the required roles
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      const hasRole = requiredRoles.includes(userWorkspaceRole.role);

      logger.debug('User workspace role check result', { 
        userId, 
        workspaceId, 
        userRole: userWorkspaceRole.role,
        requiredRoles,
        hasRole 
      });

      return hasRole;
    } catch (error) {
      logger.error('Error checking user workspace role', { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        workspaceId 
      });
      return false;
    }
  }

  /**
   * Generate an access token for a user
   * 
   * @param user - The user object
   * @returns JWT access token
   * @private
   */
  private generateAccessToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      type: 'access'
    };

    const secret = process.env.JWT_SECRET || '';
    const options = { expiresIn: process.env.JWT_EXPIRES_IN || '24h' };
    
    return jwt.sign(payload, secret, options as any);
  }

  /**
   * Generate a refresh token for a user
   * 
   * @param user - The user object
   * @returns JWT refresh token
   * @private
   */
  private generateRefreshToken(user: User): string {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    const secret = process.env.JWT_SECRET || '';
    const options = { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' };
    
    return jwt.sign(payload, secret, options as any);
  }
}