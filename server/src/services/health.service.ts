import mongoose from 'mongoose';

const connectionStates: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: string;
  };
}

export function getHealthStatus(): HealthStatus {
  const databaseStatus = connectionStates[mongoose.connection.readyState] ?? 'unknown';
  const connected = databaseStatus === 'connected';

  return {
    status: connected ? 'ok' : 'degraded',
    service: 'codetogether-api',
    version: '0.1.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: databaseStatus,
    },
  };
}
