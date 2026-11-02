import rateLimit from 'express-rate-limit';

export const roomJoinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'ROOM_JOIN_RATE_LIMITED',
      message: 'Too many room join attempts. Try again later.',
    },
  },
});
