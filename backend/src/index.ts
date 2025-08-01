import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { setupRoutes } from './routes';

// Load environment variables
dotenv.config();

// Create logger
const logger = createLogger('server');

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Setup routes
setupRoutes(app);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack || '');
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});