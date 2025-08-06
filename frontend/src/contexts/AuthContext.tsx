import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authApiService from '../services/authApi';
import { toast } from 'react-toastify';

// Define the User type
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Define the Authentication state
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

// Define the Authentication context
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

// Create the Authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage keys
const AUTH_TOKEN_KEY = 'tramoya_auth_token';
const AUTH_REFRESH_TOKEN_KEY = 'tramoya_refresh_token';
const AUTH_USER_KEY = 'tramoya_auth_user';

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Initialize state from local storage if available
  const [authState, setAuthState] = useState<AuthState>(() => {
    const accessToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
    const userJson = localStorage.getItem(AUTH_USER_KEY);
    
    let user = null;
    try {
      if (userJson) {
        user = JSON.parse(userJson);
      }
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
    }
    
    return {
      isAuthenticated: !!accessToken,
      user,
      accessToken,
      refreshToken
    };
  });

  // Update local storage when auth state changes
  useEffect(() => {
    if (authState.accessToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, authState.accessToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    
    if (authState.refreshToken) {
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, authState.refreshToken);
    } else {
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    }
    
    if (authState.user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authState.user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, [authState]);

  // Login function using authApiService
  const login = async (email: string, password: string) => {
    try {
      const response = await authApiService.login(email, password);
      
      setAuthState({
        isAuthenticated: true,
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      
      toast.success('Logged in successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
      throw error;
    }
  };

  // Register function using authApiService
  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await authApiService.register(email, password, firstName, lastName);
      
      setAuthState({
        isAuthenticated: true,
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      
      toast.success('Registered successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
      throw error;
    }
  };

  // Logout function using authApiService
  const logout = async () => {
    try {
      // Call the API to logout (server-side)
      if (authState.accessToken) {
        await authApiService.logout();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Always clear the local state, even if the API call fails
      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null
      });
      
      toast.info('Logged out successfully');
    }
  };

  // Update user function
  const updateUser = (user: User) => {
    setAuthState(prev => ({
      ...prev,
      user
    }));
  };

  // Create the context value
  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};