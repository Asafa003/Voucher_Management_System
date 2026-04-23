import { ReportService } from '../services/report.service.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class ReportController {
  constructor() {
    this.reportService = new ReportService();
    this.auditService = new AuditService();
  }

  getDashboard = async (req, res, next) => {
    try {
      const { centre_id, start_date, end_date } = req.query;

      const dashboard = await this.reportService.getDashboard({
        centreId: centre_id,
        startDate: start_date,
        endDate: end_date,
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(dashboard);
    } catch (error) {
      logger.error('Error generating dashboard:', error);
      next(error);
    }
  };

  getVoucherReport = async (req, res, next) => {
    try {
      const { centre_id, status, start_date, end_date, page = 1, limit = 100 } = req.query;

      const report = await this.reportService.getVoucherReport({
        centreId: centre_id,
        status,
        startDate: start_date,
        endDate: end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(report);
    } catch (error) {
      logger.error('Error generating voucher report:', error);
      next(error);
    }
  };

  getClientReport = async (req, res, next) => {
    try {
      const { centre_id, start_date, end_date, page = 1, limit = 100 } = req.query;

      const report = await this.reportService.getClientReport({
        centreId: centre_id,
        startDate: start_date,
        endDate: end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(report);
    } catch (error) {
      logger.error('Error generating client report:', error);
      next(error);
    }
  };

  exportData = async (req, res, next) => {
    try {
      const { type, centre_id, status, start_date, end_date } = req.query;

      if (!type) {
        return res.status(400).json({ error: 'Export type is required (vouchers or clients)' });
      }

      const result = await this.reportService.exportData({
        type,
        centreId: centre_id,
        status,
        startDate: start_date,
        endDate: end_date,
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      // Log export in audit trail
      await this.auditService.log({
        action: 'data_exported',
        user_id: req.user.id,
        resource_type: type,
        details: {
          export_type: type,
          record_count: result.count,
          filters: { centre_id, status, start_date, end_date }
        },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(result.csv);
    } catch (error) {
      logger.error('Error exporting data:', error);
      next(error);
    }
  };
}
