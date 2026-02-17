import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ClientController } from '../controllers/client.controller.js';

const router = express.Router();
const clientController = new ClientController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/clients - Get all clients (with search/filters)
router.get('/', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  clientController.getClients
);

// GET /api/v1/clients/:id - Get single client
router.get('/:id', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  clientController.getClientById
);

// GET /api/v1/clients/:id/history - Get client voucher history
router.get('/:id/history', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  clientController.getClientHistory
);

// POST /api/v1/clients - Create new client
router.post('/', 
  authorize('super_admin', 'centre_admin', 'staff'),
  clientController.createClient
);

// PATCH /api/v1/clients/:id - Update client
router.patch('/:id', 
  authorize('super_admin', 'centre_admin', 'staff'),
  clientController.updateClient
);

// DELETE /api/v1/clients/:id - Soft delete client
router.delete('/:id', 
  authorize('super_admin', 'centre_admin'),
  clientController.deleteClient
);

export default router;
