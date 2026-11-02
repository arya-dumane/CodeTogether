import type { RequestHandler } from 'express';
import { getAuthenticatedUserId } from '../middleware/requireAuth.js';
import { serializeProject } from '../models/Project.js';
import type { CreateProjectInput, UpdateProjectInput } from '../schemas/project.js';
import * as projectService from '../services/project.service.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const projects = await projectService.listProjects(ownerId);

    res.status(200).json({
      data: { projects: projects.map(serializeProject) },
    });
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const { body } = res.locals.validated as { body: CreateProjectInput };
    const project = await projectService.createProject(ownerId, body);

    res.status(201).json({ data: { project: serializeProject(project) } });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { projectId: string } };
    const project = await projectService.getProject(ownerId, params.projectId);

    res.status(200).json({ data: { project: serializeProject(project) } });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const { params, body } = res.locals.validated as {
      params: { projectId: string };
      body: UpdateProjectInput;
    };
    const project = await projectService.updateProject(ownerId, params.projectId, body);

    res.status(200).json({ data: { project: serializeProject(project) } });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { projectId: string } };
    await projectService.deleteProject(ownerId, params.projectId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
