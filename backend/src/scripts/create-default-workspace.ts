/**
 * Script to create a default workspace and associate existing tests with it
 * 
 * This script:
 * 1. Creates a default workspace if it doesn't exist
 * 2. Finds all tests that are not associated with a workspace
 * 3. Associates those tests with the default workspace
 * 
 * Usage:
 * ```
 * npx ts-node src/scripts/create-default-workspace.ts
 * ```
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('create-default-workspace');

// Default admin user ID - this should be the ID of an existing admin user
// If no admin user exists, you'll need to create one first using the create-admin-user script
const DEFAULT_ADMIN_ID = process.env.DEFAULT_ADMIN_ID;

// Default workspace name and description
const DEFAULT_WORKSPACE_NAME = 'Default Workspace';
const DEFAULT_WORKSPACE_DESCRIPTION = 'Default workspace for all tests';

/**
 * Main function to create default workspace and migrate tests
 */
async function createDefaultWorkspace() {
  if (!DEFAULT_ADMIN_ID) {
    logger.error('DEFAULT_ADMIN_ID environment variable is not set');
    console.error('Please set DEFAULT_ADMIN_ID environment variable to the ID of an admin user');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  
  try {
    logger.info('Starting default workspace creation and test migration');
    
    // Check if admin user exists
    const adminUser = await prisma.user.findUnique({
      where: { id: DEFAULT_ADMIN_ID }
    });
    
    if (!adminUser) {
      logger.error(`Admin user with ID ${DEFAULT_ADMIN_ID} not found`);
      console.error(`Admin user with ID ${DEFAULT_ADMIN_ID} not found. Please create an admin user first.`);
      process.exit(1);
    }
    
    logger.info(`Found admin user: ${adminUser.email}`);
    
    // Check if default workspace already exists
    let defaultWorkspace = await prisma.workspace.findFirst({
      where: {
        name: DEFAULT_WORKSPACE_NAME,
        isActive: true
      }
    });
    
    // Create default workspace if it doesn't exist
    if (!defaultWorkspace) {
      logger.info('Creating default workspace');
      
      defaultWorkspace = await prisma.workspace.create({
        data: {
          name: DEFAULT_WORKSPACE_NAME,
          description: DEFAULT_WORKSPACE_DESCRIPTION,
          createdById: DEFAULT_ADMIN_ID,
          isActive: true
        }
      });
      
      logger.info(`Default workspace created with ID: ${defaultWorkspace.id}`);
      
      // Add admin user as owner of the workspace
      await prisma.userWorkspaceRole.create({
        data: {
          userId: DEFAULT_ADMIN_ID,
          workspaceId: defaultWorkspace.id,
          role: 'OWNER'
        }
      });
      
      logger.info(`Added admin user as owner of default workspace`);
    } else {
      logger.info(`Default workspace already exists with ID: ${defaultWorkspace.id}`);
    }
    
    // Find tests without a workspace
    // Note: This depends on how your database is structured
    // If you're using a new database schema where all tests must have a workspace,
    // you may need to modify this query or handle the migration differently
    
    // For PostgreSQL, you can use a raw query to find tests without a workspace
    const testsWithoutWorkspace = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM tests WHERE workspace_id IS NULL
    `;
    
    logger.info(`Found ${testsWithoutWorkspace.length} tests without a workspace`);
    
    // Associate tests with default workspace
    if (testsWithoutWorkspace.length > 0) {
      for (const test of testsWithoutWorkspace) {
        await prisma.test.update({
          where: { id: test.id },
          data: { 
            workspaceId: defaultWorkspace.id,
            createdById: DEFAULT_ADMIN_ID // Set the creator to the admin user
          }
        });
      }
      
      logger.info(`Associated ${testsWithoutWorkspace.length} tests with default workspace`);
    }
    
    logger.info('Default workspace creation and test migration completed successfully');
  } catch (error) {
    logger.error('Error creating default workspace or migrating tests', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createDefaultWorkspace()
  .then(() => {
    console.log('Default workspace creation and test migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });