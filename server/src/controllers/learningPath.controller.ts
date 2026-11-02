import type { RequestHandler } from 'express';
import { getAuthenticatedUserId } from '../middleware/requireAuth.js';
import * as learningPathService from '../services/learningPath.service.js';

export const list: RequestHandler = async (_req, res, next) => {
  try {
    const paths = await learningPathService.listPublishedLearningPaths();
    res.status(200).json({ data: { paths } });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    const { params } = res.locals.validated as { params: { pathId: string } };
    const path = await learningPathService.getPublishedLearningPath(params.pathId);
    res.status(200).json({ data: { path } });
  } catch (error) {
    next(error);
  }
};

export const enroll: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { pathId: string } };
    const { progress, created } = await learningPathService.enrollInLearningPath(
      userId,
      params.pathId,
    );

    res.set('Cache-Control', 'no-store');
    res.status(created ? 201 : 200).json({ data: { progress } });
  } catch (error) {
    next(error);
  }
};

export const getProgress: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { pathId: string } };
    const progress = await learningPathService.getUserProgress(userId, params.pathId);

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ data: { progress } });
  } catch (error) {
    next(error);
  }
};

export const listMyProgress: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const enrollments = await learningPathService.listUserProgress(userId);

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ data: { enrollments } });
  } catch (error) {
    next(error);
  }
};

export const completeLesson: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as {
      params: { pathId: string; lessonId: string };
    };
    const progress = await learningPathService.completeLesson(
      userId,
      params.pathId,
      params.lessonId,
    );

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ data: { progress } });
  } catch (error) {
    next(error);
  }
};

export const uncompleteLesson: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as {
      params: { pathId: string; lessonId: string };
    };
    const progress = await learningPathService.uncompleteLesson(
      userId,
      params.pathId,
      params.lessonId,
    );

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ data: { progress } });
  } catch (error) {
    next(error);
  }
};
