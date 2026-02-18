import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // general API
const MAX_AUTH_ATTEMPTS = 5; // login attempts
const MAX_REFRESH = 10; // token refresh

export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_AUTH_ATTEMPTS,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: MAX_REFRESH,
  message: { error: 'Too many token refresh attempts' },
  standardHeaders: true,
  legacyHeaders: false
});
