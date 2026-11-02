import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeSessionStore } from './config/session.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { closeRealtime, initializeRealtime } from './realtime/index.js';

const app = createApp();
const server = createServer(app);

initializeRealtime(server);

server.listen(env.port, () => {
  console.log(`[api] CodeTogether API listening on http://localhost:${env.port}`);
  console.log(`[api] Health endpoint: http://localhost:${env.port}/api/v1/health`);
});

void connectDatabase().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown database error';
  console.error(`[api] Fatal database connection failure: ${message}`);
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[api] Received ${signal}. Shutting down.`);

  setTimeout(() => {
    console.error('[api] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();

  try {
    await closeRealtime();
  } catch (error) {
    console.error('[api] Error while closing the realtime server', error);
  }

  if (server.listening) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  try {
    await closeSessionStore();
    await disconnectDatabase();
  } catch (error) {
    console.error('[api] Error while closing connections', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
