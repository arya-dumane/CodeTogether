import { ApiError } from './client';

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) {
    return undefined;
  }

  const match = error.details.find((detail) => {
    if (typeof detail !== 'object' || detail === null || !('path' in detail)) {
      return false;
    }

    const path = String((detail as { path: unknown }).path);
    return path === field || path === `body.${field}`;
  });

  if (match && typeof match === 'object' && 'message' in match) {
    return String((match as { message: unknown }).message);
  }

  return undefined;
}
