import { VoucherService } from '../services/voucher.service.js';
import { ClientService } from '../services/client.service.js';
import { CentreService } from '../services/centre.service.js';
import { AuditService } from '../services/audit.service.js';
import { NotificationService } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

export class VoucherController {
  constructor() {
    this.voucherService = new VoucherService();
    this.clientService = new ClientService();
    this.centreService = new CentreService();
    this.auditService = new AuditService();
    this.notificationService = new NotificationService();
  }

  getVouchers = async (req, res, next) => {
    try {
      const { status, centre_id, client_id, start_date, end_date, page = 1, limit = 50 } = req.query;

      const result = await this.voucherService.findVouchers({
        status,
        centreId: centre_id,
        clientId: client_id,
        startDate: start_date,
        endDate: end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userRole === 'super_admin' ? [] : req.userCentres
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching vouchers:', error);
      next(error);
    }
  };

  getVoucherById = async (req, res, next) => {
    try {
      const voucher = await this.voucherService.findById(req.params.id, req.userCentres, req.userRole);

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
      const voucher = await this.voucherService.findByCode(req.params.code, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      res.json(voucher);
    } catch (error) {
      logger.error('Error fetching voucher by code:', error);
      next(error);
    }
  };

  createVoucher = async (req, res, next) => {
    try {
      const { referral_reason_ids, ...voucherData } = req.validatedBody;

      voucherData.issued_by = req.user.id;

      // Default centre to user's first assigned centre if not provided in body
      if (!voucherData.centre_id && req.userCentres?.length > 0) {
        voucherData.centre_id = req.userCentres[0];
      }

      if (!voucherData.centre_id) {
        return res.status(400).json({ error: 'centre_id is required or user has no assigned centres' });
      }

      const voucher = await this.voucherService.create(voucherData, referral_reason_ids || []);

      // Log audit trail
      await this.auditService.log({
        action: 'voucher_created',
        user_id: req.user.id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        centre_id: voucher.centre_id,
        details: {
          voucher_code: voucher.voucher_code,
          client_id: voucher.client_id,
          is_repeat: voucher.is_repeat_voucher
        },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      // Log consent if repeat voucher
      if (voucher.is_repeat_voucher && voucher.repeat_voucher_consent) {
        await this.auditService.log({
          action: 'consent_captured',
          user_id: req.user.id,
          resource_type: 'voucher',
          resource_id: voucher.id,
          centre_id: voucher.centre_id,
          details: { consent_type: 'repeat_voucher' },
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });
      }

      // Send notifications (non-blocking)
      try {
        const client = await this.clientService.findById(voucher.client_id);
        const centre = await this.centreService.findById(voucher.centre_id);
        if (client && centre) {
          this.notificationService.notifyVoucherIssued({ client, voucher, centre });
        }
      } catch (notifError) {
        logger.error('Notification error (non-blocking):', notifError);
      }

      res.status(201).json(voucher);
    } catch (error) {
      logger.error('Error creating voucher:', error);
      next(error);
    }
  };

  checkRepeatVoucher = async (req, res, next) => {
    try {
      const { client_id, months = 6 } = req.body;

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

  updateVoucher = async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const voucher = await this.voucherService.update(id, updates, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      await this.auditService.log({
        action: 'voucher_updated',
        user_id: req.user.id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        centre_id: voucher.centre_id,
        details: { updates },
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
      const voucher = await this.voucherService.fulfill(req.params.id, req.user.id, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found or already fulfilled/cancelled' });
      }

      await this.auditService.log({
        action: 'voucher_updated',
        user_id: req.user.id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        centre_id: voucher.centre_id,
        details: { action: 'fulfilled' },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(voucher);
    } catch (error) {
      logger.error('Error fulfilling voucher:', error);
      next(error);
    }
  };

  cancelVoucher = async (req, res, next) => {
    try {
      const { reason } = req.body;
      const voucher = await this.voucherService.cancel(req.params.id, req.user.id, reason, req.userCentres, req.userRole);

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found or already fulfilled/cancelled' });
      }

      await this.auditService.log({
        action: 'voucher_cancelled',
        user_id: req.user.id,
        resource_type: 'voucher',
        resource_id: voucher.id,
        centre_id: voucher.centre_id,
        details: { reason },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(voucher);
    } catch (error) {
      logger.error('Error cancelling voucher:', error);
      next(error);
    }
  };

  getPrintableVoucher = async (req, res, next) => {
    try {
      const printable = await this.voucherService.getPrintableVoucher(req.params.id, req.userCentres, req.userRole);

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
