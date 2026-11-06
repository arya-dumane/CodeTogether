import { Request, Response, NextFunction } from 'express';
import { documentVersionService } from '../services/documentVersion.service.js';
import { z } from 'zod';

export class VersionController {

  /**
   * Create a manual version snapshot
   */
  async createManualVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await documentVersionService.createManualVersion(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List versions with pagination
   */
  async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await documentVersionService.listVersions(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await documentVersionService.getVersion(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await documentVersionService.compareVersions(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await documentVersionService.restoreVersion(req, res, next);
    } catch (error) {
      next(error);
    }
  }
}

export const versionController = new VersionController();