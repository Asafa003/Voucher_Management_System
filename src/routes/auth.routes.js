import express from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { handleValidation } from '../middleware/validate.js';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit.js';
import { loginValidation, refreshTokenValidation } from '../validators/index.js';

const router = express.Router();
const authController = new AuthController();

// POST /api/v1/auth/login - Login with email and password (strict rate limit)
router.post('/login', authLimiter, loginValidation, handleValidation, authController.login);

// POST /api/v1/auth/logout - Logout
router.post('/logout', authenticate, authController.logout);

// POST /api/v1/auth/refresh - Refresh token (rate limited)
router.post('/refresh', refreshLimiter, refreshTokenValidation, handleValidation, authController.refreshToken);

// GET /api/v1/auth/me - Get current user profile
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
