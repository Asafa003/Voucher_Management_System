import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { VoucherController } from '../controllers/voucher.controller.js';
import { handleValidation } from '../middleware/validate.js';
import {
  voucherCreateValidation,
  voucherUpdateValidation,
  voucherCancelValidation,
  voucherCheckRepeatValidation
} from '../validators/index.js';

const router = express.Router();
const voucherController = new VoucherController();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/vouchers - Get all vouchers (with filters)
router.get('/', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  voucherController.getVouchers
);

// POST /api/v1/vouchers - Create new voucher
router.post('/', 
  voucherCreateValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff'),
  voucherController.createVoucher
);

// POST /api/v1/vouchers/check-repeat - Check if client needs repeat voucher handling (must be before /:id)
router.post('/check-repeat', 
  voucherCheckRepeatValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff'),
  voucherController.checkRepeatVoucher
);

// GET /api/v1/vouchers/code/:code - Get voucher by code (must be before /:id)
router.get('/code/:code', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  voucherController.getVoucherByCode
);

// PATCH /api/v1/vouchers/:id/fulfill - Mark voucher as fulfilled
router.patch('/:id/fulfill', 
  authorize('super_admin', 'centre_admin', 'staff'),
  voucherController.fulfillVoucher
);

// PATCH /api/v1/vouchers/:id/cancel - Cancel voucher
router.patch('/:id/cancel', 
  voucherCancelValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff'),
  voucherController.cancelVoucher
);

// GET /api/v1/vouchers/:id/print - Get printable voucher
router.get('/:id/print', 
  authorize('super_admin', 'centre_admin', 'staff'),
  voucherController.getPrintableVoucher
);

// GET /api/v1/vouchers/:id - Get single voucher
router.get('/:id', 
  authorize('super_admin', 'centre_admin', 'staff', 'read_only'),
  voucherController.getVoucherById
);

// PATCH /api/v1/vouchers/:id - Update voucher
router.patch('/:id', 
  voucherUpdateValidation,
  handleValidation,
  authorize('super_admin', 'centre_admin', 'staff'),
  voucherController.updateVoucher
);

export default router;
