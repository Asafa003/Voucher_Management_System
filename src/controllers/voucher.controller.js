import { VoucherService } from '../services/voucher.service.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class VoucherController {
  constructor() {
    this.voucherService = new VoucherService();
    this.auditService = new AuditService();
  }

  getVouchers = async (req, res, next) => {
    try {
      const { centre_id, client_id, status, start_date, end_date, page = 1, limit = 50 } = req.query;

      const result = await this.voucherService.findVouchers({
        centreId: centre_id,
        clientId: client_id,
        status,
        startDate: start_date,
        endDate: end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching vouchers:', error);
      next(error);
    }
  };

  getVoucherById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const voucher = await this.voucherService.findById(id, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      res.json(voucher);
    } catch (error) {
      logger.error('Error fetching voucher:', error);
      next(error);
    }
  };

  getVoucherByCode = async (req, res, next) => {
    try {
      const { code } = req.params;

      const voucher = await this.voucherService.findByCode(code, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      res.json(voucher);
    } catch (error) {
      logger.error('Error fetching voucher by code:', error);
      next(error);
    }
  };

  checkRepeatVoucher = async (req, res, next) => {
    try {
      const { client_id } = req.body;
      const months = parseInt(req.query.months, 10) || 6;

      if (!client_id) {
        return res.status(400).json({ error: 'client_id is required' });
      }

      const result = await this.voucherService.checkRepeatVoucher(client_id, months);
      res.json(result);
    } catch (error) {
      logger.error('Error checking repeat voucher:', error);
      next(error);
    }
  };

  createVoucher = async (req, res, next) => {
    try {
      const voucherData = {
        ...req.body,
        issued_by: req.user.id
      };

      // If repeat voucher, validate required fields
      if (voucherData.is_repeat_voucher) {
        if (!voucherData.repeat_voucher_reason_id || !voucherData.repeat_voucher_consent) {
          return res.status(400).json({
            error: 'Repeat vouchers require repeat_voucher_reason_id and repeat_voucher_consent'
          });
        }
      }

      const voucher = await this.voucherService.create(
        voucherData,
        req.user.id,
        req.userCentres,
        req.userRole
      );

      await this.auditService.log({
        action: 'voucher_created',
        user_id: req.user.id,
        centre_id: voucher.centre_id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        details: { voucher_code: voucher.voucher_code, client_id: voucher.client_id },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.status(201).json(voucher);
    } catch (error) {
      logger.error('Error creating voucher:', error);
      next(error);
    }
  };

  updateVoucher = async (req, res, next) => {
    try {
      const { id } = req.params;

      const voucher = await this.voucherService.update(id, req.body, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      await this.auditService.log({
        action: 'voucher_updated',
        user_id: req.user.id,
        centre_id: voucher.centre_id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        details: { updates: req.body },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(voucher);
    } catch (error) {
      logger.error('Error updating voucher:', error);
      next(error);
    }
  };

  fulfillVoucher = async (req, res, next) => {
    try {
      const { id } = req.params;

      const voucher = await this.voucherService.fulfill(
        id,
        req.user.id,
        req.userCentres,
        req.userRole
      );

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      await this.auditService.log({
        action: 'voucher_updated',
        user_id: req.user.id,
        centre_id: voucher.centre_id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        details: { action: 'fulfilled' },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(voucher);
    } catch (error) {
      logger.error('Error fulfilling voucher:', error);
      if (error.message?.includes('Only issued')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  };

  cancelVoucher = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { cancellation_reason } = req.body;

      const voucher = await this.voucherService.cancel(
        id,
        cancellation_reason,
        req.user.id,
        req.userCentres,
        req.userRole
      );

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      await this.auditService.log({
        action: 'voucher_cancelled',
        user_id: req.user.id,
        centre_id: voucher.centre_id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        details: { cancellation_reason },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(voucher);
    } catch (error) {
      logger.error('Error cancelling voucher:', error);
      if (error.message?.includes('already cancelled')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  };

  getPrintableVoucher = async (req, res, next) => {
    try {
      const { id } = req.params;

      const printable = await this.voucherService.getPrintable(id, req.userCentres, req.userRole);

      if (!printable) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      res.json(printable);
    } catch (error) {
      logger.error('Error getting printable voucher:', error);
      next(error);
    }
  };
}
