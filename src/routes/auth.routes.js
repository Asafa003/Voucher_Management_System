import express from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const authController = new AuthController();

// POST /api/v1/auth/login - Login with email and password
router.post('/login', authController.login);

// POST /api/v1/auth/logout - Logout
router.post('/logout', authenticate, authController.logout);

// POST /api/v1/auth/refresh - Refresh token
router.post('/refresh', authController.refreshToken);

// GET /api/v1/auth/me - Get current user profile
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
