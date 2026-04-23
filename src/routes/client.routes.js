import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ClientController } from '../controllers/client.controller.js';
import { handleValidation } from '../middleware/validate.js';
import { clientQueryValidation, clientCreateValidation, clientUpdateValidation } from '../validators/index.js';

const router = express.Router();
const clientController = new ClientController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/clients - Get all clients (with search/filters)
router.get('/', 
  clientQueryValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  clientController.getClients
);

// GET /api/v1/clients/:id - Get single client
router.get('/:id', 
  clientIdParam,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  clientController.getClientById
);

// GET /api/v1/clients/:id/history - Get client voucher history
router.get('/:id/history', 
  clientIdParam,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  clientController.getClientHistory
);

// POST /api/v1/clients - Create new client
router.post('/', 
  clientCreateValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff'),
  clientController.createClient
);

// PATCH /api/v1/clients/:id - Update client
router.patch('/:id', 
  clientUpdateValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff'),
  clientController.updateClient
);

// DELETE /api/v1/clients/:id - Soft delete client
router.delete('/:id', 
  authorize('super_admin', 'centre_admin'),
  clientController.deleteClient
);

export default router;
