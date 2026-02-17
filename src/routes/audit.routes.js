import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuditController } from '../controllers/audit.controller.js';

const router = express.Router();
const auditController = new AuditController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/audit - Get audit logs
router.get('/', 
  authorize('super_admin', 'centre_admin'),
  auditController.getAuditLogs
);

// GET /api/v1/audit/:id - Get single audit log
router.get('/:id', 
  authorize('super_admin', 'centre_admin'),
  auditController.getAuditLogById
);

export default router;
