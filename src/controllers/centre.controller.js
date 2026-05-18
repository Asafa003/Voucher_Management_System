import { CentreService } from '../services/centre.service.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class CentreController {
  constructor() {
    this.centreService = new CentreService();
    this.auditService = new AuditService();
  }

  getCentres = async (req, res, next) => {
    try {
      const centres = await this.centreService.findAll(req.userCentres, req.userRole);
      res.json(centres);
    } catch (error) {
      logger.error('Error fetching centres:', error);
      next(error);
    }
  };

  getCentreById = async (req, res, next) => {
    try {
      const centre = await this.centreService.findById(req.params.id, req.userCentres, req.userRole);

      if (!centre) {
        return res.status(404).json({ error: 'Centre not found' });
      }

      res.json(centre);
    } catch (error) {
      logger.error('Error fetching centre:', error);
      next(error);
    }
  };

  createCentre = async (req, res, next) => {
    try {
      const centre = await this.centreService.create(req.body);

      await this.auditService.log({
        action: 'centre_created',
        user_id: req.user.id,
        resource_type: 'centre',
        resource_id: centre.id,
        details: { centre_name: centre.name },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.status(201).json(centre);
    } catch (error) {
      logger.error('Error creating centre:', error);
      next(error);
    }
  };

  updateCentre = async (req, res, next) => {
    try {
      const centre = await this.centreService.update(req.params.id, req.body);

      if (!centre) {
        return res.status(404).json({ error: 'Centre not found' });
      }

      await this.auditService.log({
        action: 'centre_updated',
        user_id: req.user.id,
        resource_type: 'centre',
        resource_id: centre.id,
        details: { updates: req.body },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(centre);
    } catch (error) {
      logger.error('Error updating centre:', error);
      next(error);
    }
  };

  deleteCentre = async (req, res, next) => {
    try {
      const centre = await this.centreService.delete(req.params.id);

      if (!centre) {
        return res.status(404).json({ error: 'Centre not found' });
      }

      await this.auditService.log({
        action: 'centre_deleted',
        user_id: req.user.id,
        resource_type: 'centre',
        resource_id: req.params.id,
        details: { centre_name: centre.name },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({ message: 'Centre deactivated successfully' });
    } catch (error) {
      logger.error('Error deleting centre:', error);
      next(error);
    }
  };
}
