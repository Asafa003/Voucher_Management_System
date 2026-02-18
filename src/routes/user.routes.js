import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { UserController } from '../controllers/user.controller.js';
import { handleValidation } from '../middleware/validate.js';
import {
  userCreateValidation,
  userUpdateValidation,
  userAssignCentresValidation
} from '../validators/index.js';
import { param } from 'express-validator';

const router = express.Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/users - Get all users
router.get('/', 
  authorize('super_admin', 'centre_admin'),
  userController.getUsers
);

// GET /api/v1/users/:id - Get single user
router.get('/:id', 
  param('id').isUUID(),
  handleValidation,
  authorize('super_admin', 'centre_admin'),
  userController.getUserById
);

// POST /api/v1/users - Create new user
router.post('/', 
  userCreateValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin'),
  userController.createUser
);

// PATCH /api/v1/users/:id - Update user
router.patch('/:id', 
  userUpdateValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin'),
  userController.updateUser
);

// DELETE /api/v1/users/:id - Deactivate user
router.delete('/:id', 
  param('id').isUUID(),
  handleValidation,
  authorize('super_admin'),
  userController.deactivateUser
);

// POST /api/v1/users/:id/assign-centres - Assign centres to user
router.post('/:id/assign-centres', 
  userAssignCentresValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin'),
  userController.assignCentres
);

export default router;
