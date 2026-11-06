import { Router, type Request, type Response } from 'express';
import { messageController } from '../controllers/message.controller.js';

const router = Router();

// GET /api/rooms/:roomId/messages - Get message history
router.get(
  '/:roomId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageController.getMessages(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/rooms/:roomId/messages - Create a new message
router.post(
  '/:roomId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageController.createMessage(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/rooms/:roomId/messages/:messageId - Edit a message
router.patch(
  '/:roomId/messages/:messageId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageController.editMessage(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/rooms/:roomId/messages/:messageId - Delete a message
router.delete(
  '/:roomId/messages/:messageId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await messageController.deleteMessage(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export { router as messageRoutes };