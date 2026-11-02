import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:5173',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/codetogether_test',
      SESSION_SECRET: 'test-only-session-secret-with-at-least-32-characters',
    },
  },
});
