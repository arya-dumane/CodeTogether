import { Router } from 'express';
import * as roomController from '../controllers/room.controller.js';
import { roomJoinRateLimiter } from '../middleware/roomRateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  createRoomSchema,
  joinRoomSchema,
  leaveRoomSchema,
  listRoomsSchema,
  roomIdSchema,
  rotateInviteCodeSchema,
  updateRoomSchema,
} from '../schemas/room.js';

export const roomRouter = Router();

roomRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

roomRouter.get('/', validate(listRoomsSchema), roomController.list);
roomRouter.post('/', validate(createRoomSchema), roomController.create);
roomRouter.post(
  '/join',
  roomJoinRateLimiter,
  validate(joinRoomSchema),
  roomController.join,
);
roomRouter.get('/:roomId', validate(roomIdSchema), roomController.get);
roomRouter.patch('/:roomId', validate(updateRoomSchema), roomController.update);
roomRouter.delete('/:roomId', validate(roomIdSchema), roomController.remove);
roomRouter.post('/:roomId/leave', validate(leaveRoomSchema), roomController.leave);
roomRouter.post(
  '/:roomId/invite-code/rotate',
  validate(rotateInviteCodeSchema),
  roomController.rotateInviteCode,
);
