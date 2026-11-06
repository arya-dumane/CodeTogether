import { Request, Response, NextFunction } from 'express';
import { RoomMessage, Room } from '../models/index.js';
import { z } from 'zod';
import { Types } from 'mongoose';

export const messageController = {
  /**
   * GET /api/rooms/:roomId/messages - Get message history
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;

      // Find non-deleted messages for this room, sorted newest first
      const messages = await RoomMessage.find({ roomId: roomId, deletedAt: null })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await RoomMessage.countDocuments({ roomId: roomId, deletedAt: null });

      // Populate sender info (basic info)
      const populatedMessages = await RoomMessage.find({ roomId: roomId, deletedAt: null })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('senderId', 'displayName')
        .lean();

      res.json({
        success: true,
        data: {
          messages: populatedMessages.reverse(), // Return oldest first for UI
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/rooms/:roomId/messages - Create a new message
   */
  async createMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId } = req.params;

      // Validate the message content
      const validated = z.object({
        content: z.string().min(1).max(10000),
        replyTo: z.string().optional(),
      }).parse({
        content: req.body.content,
        replyTo: req.body.replyTo,
      });

      const { content, replyTo } = validated;

      // Find the room to verify project membership
      const room = await Room.findById(roomId).populate('project');
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      // Get the authenticated user ID from the session
      const senderId = (req as any).session?.userId;
      if (!senderId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Check that the user is a member of the room
      const member = room.members?.find(
        (m: any) => m.userId?.toString() === senderId
      );
      if (!member) {
        res.status(403).json({ error: 'You are not a member of this room' });
        return;
      }

      // Create the message
      const message = await RoomMessage.create({
        roomId,
        projectId: room.project,
        senderId,
        content,
        replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
      });

      // Populate sender info for the response
      await message.populate('senderId', 'displayName');

      res.status(201).json({
        success: true,
        data: {
          message: {
            id: message.id,
            content: message.content,
            sender: message.senderId,
            createdAt: message.createdAt,
            replyTo: message.replyTo,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/rooms/:roomId/messages/:messageId - Edit a message
   */
  async editMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId, messageId } = req.params;
      const { content } = req.body;

      // Find the message
      const message = await RoomMessage.findById(messageId);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      // Check that the user is the sender
      const senderId = (req as any).session?.userId;
      if (!senderId || message.senderId.toString() !== senderId) {
        res.status(403).json({ error: 'You can only edit your own messages' });
        return;
      }

      // Update the message
      message.content = content;
      message.editedAt = new Date();
      await message.save();

      // Populate sender info
      await message.populate('senderId', 'displayName');

      res.json({
        success: true,
        data: {
          message: {
            id: message.id,
            content: message.content,
            sender: message.senderId,
            createdAt: message.createdAt,
            editedAt: message.editedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/rooms/:roomId/messages/:messageId - Delete a message
   */
  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId, messageId } = req.params;
      const senderId = (req as any).session?.userId;

      // Find the message
      const message = await RoomMessage.findById(messageId);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      // Check that the user is the sender or an owner
      if (message.senderId.toString() !== senderId) {
        res.status(403).json({ error: 'You can only delete your own messages' });
        return;
      }

      // Soft-delete the message
      message.deletedAt = new Date();
      await message.save();

      res.json({
        success: true,
        data: {
          message: {
            id: message.id,
            deletedAt: message.deletedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
};