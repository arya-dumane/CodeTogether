import type { RequestHandler } from 'express';
import { getAuthenticatedUserId } from '../middleware/requireAuth.js';
import {
  closeRoomPresence,
  revokeUserRoomAccess,
} from '../realtime/index.js';
import type { CreateRoomInput, JoinRoomInput, UpdateRoomInput } from '../schemas/room.js';
import * as roomService from '../services/room.service.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const rooms = await roomService.listRooms(userId);

    res.status(200).json({ data: { rooms } });
  } catch (error) {
    next(error);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { body } = res.locals.validated as { body: CreateRoomInput };
    const room = await roomService.createRoom(userId, body);

    res.status(201).json({ data: { room } });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { roomId: string } };
    const room = await roomService.getRoomDetail(userId, params.roomId);

    res.status(200).json({ data: { room } });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params, body } = res.locals.validated as {
      params: { roomId: string };
      body: UpdateRoomInput;
    };
    const room = await roomService.updateRoom(userId, params.roomId, body);

    if (body.status === 'archived') {
      closeRoomPresence(params.roomId, 'ROOM_ARCHIVED');
    }

    res.status(200).json({ data: { room } });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { roomId: string } };
    await roomService.deleteRoom(userId, params.roomId);
    closeRoomPresence(params.roomId, 'ROOM_DELETED');

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const join: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { body } = res.locals.validated as { body: JoinRoomInput };
    const result = await roomService.joinRoom(userId, body.inviteCode);

    res.status(200).json({
      data: { room: result.room, alreadyMember: result.alreadyMember },
    });
  } catch (error) {
    next(error);
  }
};

export const leave: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { roomId: string } };
    await roomService.leaveRoom(userId, params.roomId);
    revokeUserRoomAccess(userId, params.roomId, 'MEMBERSHIP_REVOKED');

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const rotateInviteCode: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { params } = res.locals.validated as { params: { roomId: string } };
    const room = await roomService.rotateInviteCode(userId, params.roomId);

    res.status(200).json({ data: { room } });
  } catch (error) {
    next(error);
  }
};
