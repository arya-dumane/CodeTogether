import { NotFoundError } from '../errors/AppError.js';
import { Project, type ProjectDocument } from '../models/Project.js';
import type { CreateProjectInput, UpdateProjectInput } from '../schemas/project.js';

function projectNotFound(): NotFoundError {
  return new NotFoundError('Project not found');
}

export async function listProjects(ownerId: string): Promise<ProjectDocument[]> {
  return Project.find({ owner: ownerId }).sort({ updatedAt: -1, _id: -1 });
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
): Promise<ProjectDocument> {
  return Project.create({
    owner: ownerId,
    name: input.name,
    description: input.description ?? '',
  });
}

export async function getProject(
  ownerId: string,
  projectId: string,
): Promise<ProjectDocument> {
  const project = await Project.findOne({ _id: projectId, owner: ownerId });

  if (!project) {
    throw projectNotFound();
  }

  return project;
}

export async function updateProject(
  ownerId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDocument> {
  const updates: Record<string, string> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.description !== undefined) {
    updates.description = input.description;
  }

  const project = await Project.findOneAndUpdate(
    { _id: projectId, owner: ownerId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!project) {
    throw projectNotFound();
  }

  return project;
}

export async function deleteProject(ownerId: string, projectId: string): Promise<void> {
  const project = await Project.findOneAndDelete({ _id: projectId, owner: ownerId });

  if (!project) {
    throw projectNotFound();
  }
}
