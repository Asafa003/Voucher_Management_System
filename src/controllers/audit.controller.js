import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class AuditController {
  constructor() {
    this.auditService = new AuditService();
  }

  getAuditLogs = async (req, res, next) => {
    try {
      const {
        user_id, action, resource_type, resource_id,
        start_date, end_date, page = 1, limit = 100
      } = req.query;

      const result = await this.auditService.getAuditLogs({
        userId: user_id,
        action,
        resourceType: resource_type,
        resourceId: resource_id,
        startDate: start_date,
        endDate: end_date,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      next(error);
    }
  };

  getAuditLogById = async (req, res, next) => {
    try {
      const auditLog = await this.auditService.getAuditLogById(req.params.id);

      if (!auditLog) {
        return res.status(404).json({ error: 'Audit log not found' });
      }

      res.json(auditLog);
    } catch (error) {
      logger.error('Error fetching audit log:', error);
      next(error);
    }
  };
}
