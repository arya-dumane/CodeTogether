import { api } from './client';

export const PROJECT_NAME_MAX_LENGTH = 120;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
}

export async function fetchProjects(): Promise<Project[]> {
  const data = await api.get<{ projects: Project[] }>('/projects');
  return data.projects;
}

export async function fetchProject(projectId: string): Promise<Project> {
  const data = await api.get<{ project: Project }>(`/projects/${projectId}`);
  return data.project;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const data = await api.post<{ project: Project }>('/projects', input);
  return data.project;
}

export async function updateProject(
  projectId: string,
  input: Partial<ProjectInput>,
): Promise<Project> {
  const data = await api.patch<{ project: Project }>(`/projects/${projectId}`, input);
  return data.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await api.delete<void>(`/projects/${projectId}`);
}
