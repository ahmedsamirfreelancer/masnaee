import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { testConnection } from './config/database.js';

const PORT = process.env.PORT || 5000;

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🏭 مصنعي API running on port ${PORT}`);
  });
}

start();

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
