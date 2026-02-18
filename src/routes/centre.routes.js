import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { CentreController } from '../controllers/centre.controller.js';
import { handleValidation } from '../middleware/validate.js';
import { centreCreateValidation, centreUpdateValidation } from '../validators/index.js';
import { param } from 'express-validator';

const router = express.Router();
const centreController = new CentreController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/centres - Get all centres
router.get('/', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  centreController.getCentres
);

// GET /api/v1/centres/:id - Get single centre
router.get('/:id', 
  param('id').isUUID(),
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  centreController.getCentreById
);

// POST /api/v1/centres - Create new centre
router.post('/', 
  centreCreateValidation,
  handleValidation,
  authorize('super_admin'),
  centreController.createCentre
);

// PATCH /api/v1/centres/:id - Update centre
router.patch('/:id', 
  centreUpdateValidation,
  handleValidation,
  authorize('super_admin'),
  centreController.updateCentre
);

// DELETE /api/v1/centres/:id - Delete centre
router.delete('/:id', 
  param('id').isUUID(),
  handleValidation,
  authorize('super_admin'),
  centreController.deleteCentre
);

export default router;
