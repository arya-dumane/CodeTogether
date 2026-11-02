import { api, ensureCsrfToken, setCsrfToken } from './client';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthResult {
  user: User;
  csrfToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function login(input: LoginInput): Promise<User> {
  await ensureCsrfToken();
  const data = await api.post<AuthResult>('/auth/login', input);
  setCsrfToken(data.csrfToken);
  return data.user;
}

export async function register(input: RegisterInput): Promise<User> {
  await ensureCsrfToken();
  const data = await api.post<AuthResult>('/auth/register', input);
  setCsrfToken(data.csrfToken);
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post<void>('/auth/logout');
  setCsrfToken(null);
}
