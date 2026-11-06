import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { documentVersionService } from '../services/documentVersion.service.js';
import { versionController } from '../controllers/version.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// GET /api/versions/:roomId/:documentId - List versions with pagination
router.get(
  '/:roomId/:documentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentVersionService.listVersions(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/versions/:roomId/:documentId/:versionId - Get specific version
router.get(
  '/:roomId/:documentId/:versionId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentVersionService.getVersion(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/versions/:roomId/:documentId - Create manual version
router.post(
  '/:roomId/:documentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentVersionService.createManualVersion(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/versions/compare - Compare two versions
router.get(
  '/compare',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentVersionService.compareVersions(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/versions/:roomId/:documentId/restore - Restore version
router.post(
  '/:roomId/:documentId/restore',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentVersionService.restoreVersion(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export { router as versionRoutes };