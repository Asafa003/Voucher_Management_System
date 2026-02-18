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
      const stats = await this.reportService.getDashboardStats(req.userCentres, req.userRole);
      res.json(stats);
    } catch (error) {
      logger.error('Error fetching dashboard:', error);
      next(error);
    }
  };

  getVoucherReport = async (req, res, next) => {
    try {
      const { centre_id, status, start_date, end_date, page = 1, limit = 100 } = req.query;

      const result = await this.reportService.getVoucherReport({
        centreId: centre_id,
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
      logger.error('Error fetching voucher report:', error);
      next(error);
    }
  };

  getClientReport = async (req, res, next) => {
    try {
      const { centre_id, start_date, end_date, page = 1, limit = 100 } = req.query;

      const result = await this.reportService.getClientReport({
        centreId: centre_id,
        startDate: start_date,
        endDate: end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching client report:', error);
      next(error);
    }
  };

  exportData = async (req, res, next) => {
    try {
      const { type = 'csv', centre_id, status, start_date, end_date } = req.query;

      const exportContent = await this.reportService.exportData({
        type,
        centreId: centre_id,
        status,
        startDate: start_date,
        endDate: end_date,
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      await this.auditService.log({
        action: 'data_exported',
        user_id: req.user.id,
        resource_type: 'report',
        details: {
          export_type: type,
          centre_id,
          status,
          start_date,
          end_date
        },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      if (type.toLowerCase() === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=vouchers-export.csv');
        res.send(exportContent);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=vouchers-export.json');
        res.send(exportContent);
      }
    } catch (error) {
      logger.error('Error exporting data:', error);
      next(error);
    }
  };
}
