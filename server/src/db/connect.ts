import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { LearningPath } from '../models/LearningPath.js';
import { LearningProgress } from '../models/LearningProgress.js';
import { Project } from '../models/Project.js';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';

let listenersRegistered = false;

function registerConnectionEvents(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  mongoose.connection.on('error', (error: Error) => {
    console.error(`[db] MongoDB connection error: ${error.message}`);
  });
}

export async function connectDatabase(): Promise<void> {
  registerConnectionEvents();

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    await User.init();
    await Project.init();
    await LearningPath.init();
    await LearningProgress.init();
    await Room.init();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error';
    console.error(`[db] Initial MongoDB connection failed: ${message}`);

    if (env.nodeEnv === 'production') {
      throw error;
    }

    console.warn('[db] Continuing without MongoDB; the health endpoint will report a degraded status.');
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
