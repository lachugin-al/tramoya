/**
 * Script to create an admin user
 * 
 * This script creates a default admin user with the specified credentials.
 * The admin user can then be used as the owner of the default workspace.
 * 
 * Usage:
 * ```
 * npx ts-node src/scripts/create-admin-user.ts
 * ```
 * 
 * Environment variables:
 * - ADMIN_EMAIL: Email address for the admin user (required)
 * - ADMIN_PASSWORD: Password for the admin user (required)
 * - ADMIN_FIRST_NAME: First name for the admin user (default: "Admin")
 * - ADMIN_LAST_NAME: Last name for the admin user (default: "User")
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createLogger } from '../utils/logger';

const logger = createLogger('create-admin-user');

// Get admin user details from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'User';

/**
 * Main function to create an admin user
 */
async function createAdminUser() {
  // Validate environment variables
  if (!ADMIN_EMAIL) {
    logger.error('ADMIN_EMAIL environment variable is not set');
    console.error('Please set ADMIN_EMAIL environment variable');
    process.exit(1);
  }

  if (!ADMIN_PASSWORD) {
    logger.error('ADMIN_PASSWORD environment variable is not set');
    console.error('Please set ADMIN_PASSWORD environment variable');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  
  try {
    logger.info('Starting admin user creation');
    
    // Check if user with the same email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    });
    
    if (existingUser) {
      logger.info(`User with email ${ADMIN_EMAIL} already exists`);
      console.log(`User with email ${ADMIN_EMAIL} already exists with ID: ${existingUser.id}`);
      console.log('You can use this ID as the DEFAULT_ADMIN_ID for the create-default-workspace script');
      
      // Update the .env file with the admin user ID
      console.log('\nAdd the following line to your .env file:');
      console.log(`DEFAULT_ADMIN_ID=${existingUser.id}`);
      
      return existingUser.id;
    }
    
    // Hash the password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    
    // Create the admin user
    const adminUser = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        isActive: true
      }
    });
    
    logger.info(`Admin user created with ID: ${adminUser.id}`);
    console.log(`Admin user created with ID: ${adminUser.id}`);
    console.log('You can use this ID as the DEFAULT_ADMIN_ID for the create-default-workspace script');
    
    // Update the .env file with the admin user ID
    console.log('\nAdd the following line to your .env file:');
    console.log(`DEFAULT_ADMIN_ID=${adminUser.id}`);
    
    return adminUser.id;
  } catch (error) {
    logger.error('Error creating admin user', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdminUser()
  .then((adminId) => {
    console.log('\nAdmin user creation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });