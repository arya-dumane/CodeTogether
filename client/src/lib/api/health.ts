import { api } from './client';

export interface HealthPayload {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: string;
  };
}

export function fetchHealth(): Promise<HealthPayload> {
  return api.get<HealthPayload>('/health');
}
