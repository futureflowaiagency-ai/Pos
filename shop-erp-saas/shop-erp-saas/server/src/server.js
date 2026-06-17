import app from './app.js';
import { connectDB } from './config/db.js';
import { config } from './config/env.js';

const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`🚀 Server running in ${config.nodeEnv} mode on port ${config.port}`);
    console.log(`   API base: http://localhost:${config.port}/api`);
  });
};

start();
