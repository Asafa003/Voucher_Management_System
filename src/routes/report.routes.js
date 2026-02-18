import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ReportController } from '../controllers/report.controller.js';

const router = express.Router();
const reportController = new ReportController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/reports/dashboard - Get dashboard statistics
router.get('/dashboard', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  reportController.getDashboard
);

// GET /api/v1/reports/vouchers - Get voucher report
router.get('/vouchers', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  reportController.getVoucherReport
);

// GET /api/v1/reports/clients - Get client report
router.get('/clients', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  reportController.getClientReport
);

// GET /api/v1/reports/export - Export data to CSV/XLSX
router.get('/export', 
  authorize('super_admin', 'centre_admin', 'staff'),
  reportController.exportData
);

export default router;
