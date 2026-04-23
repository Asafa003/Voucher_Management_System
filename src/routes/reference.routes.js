import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ReferenceController } from '../controllers/reference.controller.js';

const router = express.Router();
const referenceController = new ReferenceController();

router.use(authenticate);
router.use(authorize('super_admin', 'centre_admin', 'staff', 'read_only'));

// Specific routes first (before /)
router.get('/income-sources', referenceController.getIncomeSources);
router.get('/referral-reasons', referenceController.getReferralReasons);
router.get('/repeat-voucher-reasons', referenceController.getRepeatVoucherReasons);

// GET /api/v1/reference - Get all reference data (for voucher form)
router.get('/', referenceController.getAll);

export default router;
