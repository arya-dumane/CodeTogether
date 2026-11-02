const configuredBase = import.meta.env.VITE_API_URL?.trim();
const API_BASE = (configuredBase || '/api/v1').replace(/\/$/, '');

export const AUTH_UNAUTHORIZED_EVENT = 'codetogether:unauthorized';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? 'GET').toUpperCase();
}

async function request<T>(path: string, init?: RequestInit, allowCsrfRetry = true): Promise<T> {
  const method = methodOf(init);
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  if (init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiError('The API could not be reached. Is the server running?', 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorBody | null;

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;

    if (
      response.status === 403 &&
      error?.code === 'CSRF_INVALID' &&
      allowCsrfRetry &&
      !SAFE_METHODS.has(method)
    ) {
      await refreshCsrfToken();
      return request<T>(path, init, false);
    }

    if (
      response.status === 401 &&
      !path.startsWith('/auth/') &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    throw new ApiError(
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.code,
      error?.details,
    );
  }

  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as ApiEnvelope<T>).data;
  }

  return body as T;
}

export async function refreshCsrfToken(): Promise<string> {
  const data = await request<{ csrfToken: string }>('/auth/csrf', undefined, false);
  setCsrfToken(data.csrfToken);
  return data.csrfToken;
}

export async function ensureCsrfToken(): Promise<string> {
  return csrfToken ?? refreshCsrfToken();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
