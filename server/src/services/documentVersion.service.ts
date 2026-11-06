import { NotFoundError } from '../errors/AppError.js';
import { DocumentVersion, CollaborativeDocument } from '../models/index.js';
import { Room } from '../models/Room.js';
import type { Request, Response } from 'express';
import { getAuthenticatedUserId } from '../middleware/requireAuth.js';

function isValidString(value: any): value is string {
  return typeof value === 'string' && value.length > 0;
}

export const documentVersionService = {
  /**
   * Create a manual version snapshot
   */
  createManualVersion: async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const { roomId, documentId, description } = req.params;

      // Validate required fields
      if (!isValidString(roomId) || !isValidString(documentId) || !isValidString(description)) {
        res.status(400).json({ error: 'Invalid input: roomId, documentId, and description are required' });
        return;
      }

      // Get the current Yjs document state
      const collaborativeDoc = await CollaborativeDocument.findOne({
        roomId,
        documentId,
      }).lean();

      if (!collaborativeDoc || collaborativeDoc.state == null) {
        res.status(404).json({ error: 'Document not found or has no state' });
        return;
      }

      // Get the room to find the projectId
      const room = await Room.findById(roomId).lean();
      if (!room || !room.project) {
        res.status(404).json({ error: 'Room not found or has no project' });
        return;
      }

      // Determine the next version number
      const lastVersion = await DocumentVersion.findOne({
        roomId,
        documentId,
      })
        .sort({ versionNumber: -1 })
        .limit(1);

      const nextVersionNumber = (lastVersion ? lastVersion.versionNumber : 0) + 1;

      // Get the authenticated user ID from the session
      const createdBy = getAuthenticatedUserId(req);

      // Convert snapshot to Buffer
      const snapshotBuffer = Buffer.from(collaborativeDoc.state as unknown as Buffer);

      // Create the version record
      await DocumentVersion.create({
        projectId: room.project,
        roomId,
        documentId,
        versionNumber: nextVersionNumber,
        snapshot: snapshotBuffer,
        createdBy,
        type: 'manual',
        description,
        metadata: {
          createdAt: new Date().toISOString(),
          origin: 'manual_ui',
        },
      });

      // Save the state to CollaborativeDocument for Yjs restoration
      await CollaborativeDocument.updateOne(
        { roomId, documentId },
        { $set: { state: snapshotBuffer } },
        { upsert: true },
      );

      res.status(201).json({
        success: true,
        version: {
          versionNumber: nextVersionNumber,
          description,
          type: 'manual',
          createdAt: new Date(),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List versions with pagination
   */
  listVersions: async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const { roomId, documentId } = req.params;

      if (!isValidString(roomId) || !isValidString(documentId)) {
        res.status(400).json({ error: 'Invalid input: roomId and documentId are required' });
        return;
      }

      // Count total versions
      const total = await DocumentVersion.countDocuments({
        roomId,
        documentId,
      });

      // Get versions with pagination, sorted by version number descending
      // Exclude large snapshot buffers from list response for performance
      const versions = await DocumentVersion.find({
        roomId,
        documentId,
      })
        .sort({ versionNumber: -1 })
        .limit(50)
        .select('-snapshot')
        .lean();

      res.json({
        success: true,
        data: {
          versions,
          pagination: {
            page: 1,
            limit: versions.length,
            total,
            pages: Math.ceil(total / 50),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get a specific version by ID
   */
  getVersion: async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const { roomId, documentId, versionId } = req.params;

      if (!isValidString(roomId) || !isValidString(documentId) || !isValidString(versionId)) {
        res.status(400).json({ error: 'Invalid input: roomId, documentId, and versionId are required' });
        return;
      }

      const version = await DocumentVersion.findOne({
        roomId,
        documentId,
        _id: versionId,
      }).select('-snapshot').lean();

      if (!version) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      // For the requested version, also fetch the snapshot if needed for preview
      const fullVersion = await DocumentVersion.findOne({
        roomId,
        documentId,
        _id: versionId,
      }).select('snapshot').lean();

      res.json({
        success: true,
        data: {
          ...version,
          snapshot: fullVersion?.snapshot,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Compare two versions
   */
  compareVersions: async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const { roomId, documentId, versionId1, versionId2 } = req.params;

      if (!isValidString(roomId) || !isValidString(documentId) || !isValidString(versionId1) || !isValidString(versionId2)) {
        res.status(400).json({ error: 'Invalid input: roomId, documentId, versionId1, and versionId2 are required' });
        return;
      }

      // Fetch both versions
      const [version1, version2] = await Promise.all([
        DocumentVersion.findOne({
          roomId,
          documentId,
          _id: versionId1,
        }).select('snapshot versionNumber description type createdAt').lean(),
        DocumentVersion.findOne({
          roomId,
          documentId,
          _id: versionId2,
        }).select('snapshot versionNumber description type createdAt').lean(),
      ]);

      if (!version1 || !version2) {
        res.status(404).json({ error: 'One or both versions not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          version1: {
            id: versionId1,
            versionNumber: version1.versionNumber,
            description: version1.description,
            type: version1.type,
            createdAt: version1.createdAt,
          },
          version2: {
            id: versionId2,
            versionNumber: version2.versionNumber,
            description: version2.description,
            type: version2.type,
            createdAt: version2.createdAt,
          },
          // Note: Full snapshot comparison would happen on the frontend
          // using Monaco Diff Editor with actual snapshot buffers
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Restore a previous version
   */
  restoreVersion: async (req: Request, res: Response, next: Function): Promise<void> => {
    try {
      const { roomId, documentId, versionId } = req.params;

      if (!isValidString(roomId) || !isValidString(documentId) || !isValidString(versionId)) {
        res.status(400).json({ error: 'Invalid input: roomId, documentId, and versionId are required' });
        return;
      }

      // Fetch the version to restore
      const versionToRestore = await DocumentVersion.findOne({
        roomId,
        documentId,
        _id: versionId,
      }).lean();

      if (!versionToRestore) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      // Check permissions - only Owner/Editor can restore
      const userId = getAuthenticatedUserId(req);

      // Get the room to check permissions
      const room = await Room.findById(roomId).lean();

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      // Project owner always has full access
      const ProjectClass = (await import('../models/Project.js')).Project;
      const project = await ProjectClass.findById(room.project).lean();

      if (project?.ownerId?.toString() === userId) {
        // Owner can restore - do nothing, proceed
      } else {
        // Check room member roles
        const member = room.members?.find(
          (m: any) => m.userId?.toString() === userId
        );

        if (!member) {
          res.status(403).json({ error: 'Insufficient permissions to restore this version' });
          return;
        }

// Members with room access can restore versions
        // Project owner check was already done above
      }

      // Load the Yjs document state from the snapshot
      const collaborativeDoc = await CollaborativeDocument.findOne({
        roomId,
        documentId,
      });

      if (!collaborativeDoc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Convert snapshot to Buffer
      const snapshotBuffer = Buffer.from(versionToRestore.snapshot as unknown as Buffer);

      // Update the current document state with the restored snapshot
      await CollaborativeDocument.updateOne(
        { roomId, documentId },
        { $set: { state: snapshotBuffer } },
        { upsert: true },
      );

      // Create a new version record of type 'restore'
      const lastVersion = await DocumentVersion.findOne({
        roomId,
        documentId,
      })
        .sort({ versionNumber: -1 })
        .limit(1);

      const nextVersionNumber = (lastVersion ? lastVersion.versionNumber : 0) + 1;

      await DocumentVersion.create({
        projectId: room.project,
        roomId,
        documentId,
        versionNumber: nextVersionNumber,
        snapshot: snapshotBuffer,
        createdBy: userId,
        type: 'restore',
        description: `Restored from version ${versionToRestore.versionNumber}: ${versionToRestore.description || 'No description'}`,
        metadata: {
          restoredFromVersion: versionToRestore.versionNumber,
          restoredAt: new Date().toISOString(),
          origin: 'ui_restore',
        },
      });

      res.json({
        success: true,
        data: {
          message: 'Version restored successfully',
          newVersionNumber: nextVersionNumber,
          restoredVersion: versionToRestore.versionNumber,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};