import http from 'http';
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { initRealtime } from './services/realtime';

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);
  server.listen(env.PORT, env.HOST, () => {
    logger.info(`tuneslam-ai backend listening on http://${env.HOST}:${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
