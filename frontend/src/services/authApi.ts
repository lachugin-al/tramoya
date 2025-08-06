import axios, { AxiosError } from 'axios';
import { User } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';

/**
 * Logger instance for the Auth API service
 */
const logger = createLogger('auth-api-service');

/**
 * Configured Axios instance for making authentication API requests
 */
const authApi = axios.create({
  baseURL: '/api/v1/auth',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interface for authentication response
 */
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication API service
 * 
 * This service provides methods for user authentication, including login, registration,
 * token refresh, and logout.
 */
export const authApiService = {
  /**
   * Login a user with email and password
   * 
   * @param email - User's email
   * @param password - User's password
   * @returns Promise resolving to authentication response with user and tokens
   * @throws Error if login fails
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      logger.info('Logging in user', { email });
      
      const response = await authApi.post<AuthResponse>('/login', { email, password });
      
      logger.info('User logged in successfully', { email });
      return response.data;
    } catch (error) {
      logger.error('Login failed', { 
        error: error instanceof Error ? error.message : String(error),
        email 
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Login failed');
      }
      
      throw new Error('Login failed. Please try again.');
    }
  },
  
  /**
   * Register a new user
   * 
   * @param email - User's email
   * @param password - User's password
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @returns Promise resolving to authentication response with user and tokens
   * @throws Error if registration fails
   */
  async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    try {
      logger.info('Registering new user', { email });
      
      const response = await authApi.post<AuthResponse>('/register', { 
        email, 
        password, 
        firstName, 
        lastName 
      });
      
      logger.info('User registered successfully', { email });
      return response.data;
    } catch (error) {
      logger.error('Registration failed', { 
        error: error instanceof Error ? error.message : String(error),
        email 
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Registration failed');
      }
      
      throw new Error('Registration failed. Please try again.');
    }
  },
  
  /**
   * Refresh the access token using a refresh token
   * 
   * @param refreshToken - The refresh token
   * @returns Promise resolving to authentication response with new tokens
   * @throws Error if token refresh fails
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      logger.info('Refreshing token');
      
      const response = await authApi.post<AuthResponse>('/refresh', { refreshToken });
      
      logger.info('Token refreshed successfully');
      return response.data;
    } catch (error) {
      logger.error('Token refresh failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Token refresh failed');
      }
      
      throw new Error('Token refresh failed. Please log in again.');
    }
  },
  
  /**
   * Logout the current user
   * 
   * @returns Promise that resolves when logout is complete
   */
  async logout(): Promise<void> {
    try {
      logger.info('Logging out user');
      
      await authApi.post('/logout');
      
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Even if the server-side logout fails, we still want to clear the client-side state
      // So we don't throw an error here
    }
  },
  
  /**
   * Get the current user's information
   * 
   * @param token - The access token
   * @returns Promise resolving to the user object
   * @throws Error if getting user info fails
   */
  async getCurrentUser(token: string): Promise<User> {
    try {
      logger.info('Getting current user info');
      
      const response = await authApi.get<{ user: User }>('/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      logger.info('Got current user info successfully');
      return response.data.user;
    } catch (error) {
      logger.error('Failed to get current user info', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to get user info');
      }
      
      throw new Error('Failed to get user info. Please try again.');
    }
  }
};

export default authApiService;