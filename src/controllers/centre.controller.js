import { CentreService } from '../services/centre.service.js';
import { logger } from '../utils/logger.js';

export class CentreController {
  constructor() {
    this.centreService = new CentreService();
  }

  getCentres = async (req, res, next) => {
    try {
      const { include_inactive } = req.query;

      const centres = await this.centreService.findCentres({
        includeInactive: include_inactive === 'true',
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(centres);
    } catch (error) {
      logger.error('Error fetching centres:', error);
      next(error);
    }
  };

  getCentreById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const centre = await this.centreService.findById(id, req.userCentres, req.userRole);

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
      res.status(201).json(centre);
    } catch (error) {
      logger.error('Error creating centre:', error);
      next(error);
    }
  };

  updateCentre = async (req, res, next) => {
    try {
      const { id } = req.params;

      const centre = await this.centreService.update(id, req.body);

      if (!centre) {
        return res.status(404).json({ error: 'Centre not found' });
      }

      res.json(centre);
    } catch (error) {
      logger.error('Error updating centre:', error);
      next(error);
    }
  };

  deleteCentre = async (req, res, next) => {
    try {
      const { id } = req.params;

      const centre = await this.centreService.findById(id, req.userCentres, req.userRole);
      if (!centre) {
        return res.status(404).json({ error: 'Centre not found' });
      }

      await this.centreService.delete(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting centre:', error);
      next(error);
    }
  };
}
