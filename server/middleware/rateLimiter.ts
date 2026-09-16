import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest } from './auth';

export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user / IP to 30 AI requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.id || req.ip || 'anonymous';
  },
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Batas pemanggilan AI tercapai. Silakan tunggu beberapa menit sebelum mencoba kembali.',
    });
  },
});
