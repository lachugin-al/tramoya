/**
 * @fileoverview Vite configuration file for the frontend application.
 * This file defines the build and development settings for the Vite bundler.
 * @see {@link https://vitejs.dev/config/} for more information on Vite configuration options.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite configuration object.
 * @type {import('vite').UserConfig}
 * 
 * @description
 * This configuration defines how the application is built and served during development.
 * It includes settings for plugins, path resolution, and development server options.
 */
export default defineConfig({
  /**
   * Plugins section.
   * @property {Array} plugins - List of Vite plugins used in the project.
   * 
   * @description
   * Plugins extend Vite's functionality. The React plugin enables JSX support
   * and provides React-specific optimizations.
   */
  plugins: [react()],

  /**
   * Path resolution configuration.
   * @property {Object} resolve - Configuration for module resolution.
   * 
   * @description
   * Defines how import paths are resolved in the application.
   */
  resolve: {
    /**
     * Path aliases for simplified imports.
     * @property {Object} alias - Map of alias names to their actual paths.
     * 
     * @description
     * Allows using '@/' as a shorthand for the src directory, making imports cleaner.
     * Example: import Component from '@/components/Component' instead of relative paths.
     */
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  /**
   * Development server configuration.
   * @property {Object} server - Settings for the development server.
   * 
   * @description
   * Configures how the development server runs, including port settings and API proxying.
   */
  server: {
    /**
     * Port number for the development server.
     * @type {number}
     */
    port: 3000,

    /**
     * Proxy configuration for API requests.
     * @property {Object} proxy - Proxy rules for development server.
     * 
     * @description
     * Routes API requests to the backend server during development to avoid CORS issues.
     * All requests to /api will be forwarded to the backend service.
     */
    proxy: {
      '/api': {
        /**
         * Target URL where requests will be proxied to.
         * @type {string}
         */
        target: 'http://backend:3001',

        /**
         * Changes the origin of the host header to the target URL.
         * @type {boolean}
         */
        changeOrigin: true,
      },
    },
  },
});