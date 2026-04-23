import { UserService } from '../services/user.service.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class UserController {
  constructor() {
    this.userService = new UserService();
    this.auditService = new AuditService();
  }

  getUsers = async (req, res, next) => {
    try {
      const { role, centre_id, is_active, page = 1, limit = 50 } = req.query;
      
      const result = await this.userService.findAll({
        role,
        centreId: centre_id,
        isActive: is_active === undefined ? undefined : is_active === 'true',
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching users:', error);
      next(error);
    }
  };

  getUserById = async (req, res, next) => {
    try {
      const user = await this.userService.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      logger.error('Error fetching user:', error);
      next(error);
    }
  };

  createUser = async (req, res, next) => {
    try {
      const user = await this.userService.create(req.body);

      await this.auditService.log({
        action: 'user_created',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: user.id,
        details: { email: user.email, role: user.role },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.status(201).json(user);
    } catch (error) {
      logger.error('Error creating user:', error);
      next(error);
    }
  };

  updateUser = async (req, res, next) => {
    try {
      const user = await this.userService.update(req.params.id, req.body);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await this.auditService.log({
        action: 'user_role_changed',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: user.id,
        details: { updates: req.body },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(user);
    } catch (error) {
      logger.error('Error updating user:', error);
      next(error);
    }
  };

  deactivateUser = async (req, res, next) => {
    try {
      const user = await this.userService.deactivate(req.params.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await this.auditService.log({
        action: 'user_deleted',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.params.id,
        details: { email: user.email },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      logger.error('Error deactivating user:', error);
      next(error);
    }
  };

  assignCentres = async (req, res, next) => {
    try {
      const { centre_ids } = req.body;
      
      if (!Array.isArray(centre_ids)) {
        return res.status(400).json({ error: 'centre_ids must be an array' });
      }

      const user = await this.userService.assignCentres(req.params.id, centre_ids);

      await this.auditService.log({
        action: 'user_role_changed',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.params.id,
        details: { assigned_centres: centre_ids },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(user);
    } catch (error) {
      logger.error('Error assigning centres:', error);
      next(error);
    }
  };
}
