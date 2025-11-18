import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import jobRoutes from './routes/job.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static files (for web UI)
  const publicPath = path.join(__dirname, '../../public');
  app.use(express.static(publicPath));

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/jobs', jobRoutes);

  // Serve web UI on root
  app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
