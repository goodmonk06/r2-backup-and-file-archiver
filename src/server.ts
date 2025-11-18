#!/usr/bin/env node

import { createApp } from './api/app.js';
import { getEnvConfig } from './config/env.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Load environment config
    const config = getEnvConfig();

    console.log('Starting R2 Backup Server...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    const app = createApp();

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ API available at http://localhost:${PORT}/api`);
      console.log(`✓ Health check at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
