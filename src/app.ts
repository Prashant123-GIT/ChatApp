import express, { Express } from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';

export function createApp(): Express {
  const app = express();

  // Global middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/', routes);

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
