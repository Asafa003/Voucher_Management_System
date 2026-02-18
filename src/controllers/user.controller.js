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
      const { centre_id, role, search, page = 1, limit = 50 } = req.query;

      const result = await this.userService.findUsers({
        centreId: centre_id,
        role,
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userCentres,
        userRole: req.userRole
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching users:', error);
      next(error);
    }
  };

  getUserById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const user = await this.userService.findById(id, req.userCentres, req.userRole);

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
      const { centre_ids, ...userData } = req.body;

      const user = await this.userService.create(userData, centre_ids);

      await this.auditService.log({
        action: 'user_created',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: user.id,
        details: { email: user.email },
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
      const { id } = req.params;
      const { role, ...updates } = req.body;

      const updateData = { ...updates };
      if (role !== undefined) updateData.role = role;

      const user = await this.userService.update(id, updateData, req.userCentres, req.userRole);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (role !== undefined) {
        await this.auditService.log({
          action: 'user_role_changed',
          user_id: req.user.id,
          resource_type: 'user',
          resource_id: user.id,
          details: { new_role: role },
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });
      }

      res.json(user);
    } catch (error) {
      logger.error('Error updating user:', error);
      next(error);
    }
  };

  deactivateUser = async (req, res, next) => {
    try {
      const { id } = req.params;

      if (id === req.user.id) {
        return res.status(400).json({ error: 'Cannot deactivate your own account' });
      }

      const user = await this.userService.deactivate(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await this.auditService.log({
        action: 'user_deleted',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: id,
        details: { email: user.email },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error deactivating user:', error);
      next(error);
    }
  };

  assignCentres = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { centre_ids } = req.body;

      if (!Array.isArray(centre_ids)) {
        return res.status(400).json({ error: 'centre_ids must be an array' });
      }

      // Centre admins can only assign users to their own centres
      const validCentreIds = req.userRole === 'super_admin'
        ? centre_ids
        : centre_ids.filter(cid => req.userCentres.includes(cid));

      const user = await this.userService.assignCentres(id, validCentreIds);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      logger.error('Error assigning centres:', error);
      next(error);
    }
  };
}
