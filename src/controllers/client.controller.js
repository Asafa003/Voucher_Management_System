import { ClientService } from '../services/client.service.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class ClientController {
  constructor() {
    this.clientService = new ClientService();
    this.auditService = new AuditService();
  }

  getClients = async (req, res, next) => {
    try {
      const { search, postcode, page = 1, limit = 50 } = req.query;
      
      const result = await this.clientService.findClients({
        search,
        postcode,
        page: parseInt(page),
        limit: parseInt(limit),
        userCentres: req.userCentres
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching clients:', error);
      next(error);
    }
  };

  getClientById = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const client = await this.clientService.findById(id);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      res.json(client);
    } catch (error) {
      logger.error('Error fetching client:', error);
      next(error);
    }
  };

  getClientHistory = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const history = await this.clientService.getVoucherHistory(id);

      res.json(history);
    } catch (error) {
      logger.error('Error fetching client history:', error);
      next(error);
    }
  };

  createClient = async (req, res, next) => {
    try {
      const clientData = {
        ...req.body,
        created_by: req.user.id
      };

      // Check for potential duplicates
      const duplicates = await this.clientService.checkDuplicates(
        clientData.first_name,
        clientData.last_name,
        clientData.postcode
      );

      if (duplicates.length > 0) {
        return res.status(409).json({
          error: 'Potential duplicate clients found',
          duplicates
        });
      }

      const client = await this.clientService.create(clientData);

      // Log audit trail
      await this.auditService.log({
        action: 'client_created',
        user_id: req.user.id,
        resource_type: 'client',
        resource_id: client.id,
        details: { client_name: `${client.first_name} ${client.last_name}` },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.status(201).json(client);
    } catch (error) {
      logger.error('Error creating client:', error);
      next(error);
    }
  };

  updateClient = async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const client = await this.clientService.update(id, updates);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Log audit trail
      await this.auditService.log({
        action: 'client_updated',
        user_id: req.user.id,
        resource_type: 'client',
        resource_id: client.id,
        details: { updates },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json(client);
    } catch (error) {
      logger.error('Error updating client:', error);
      next(error);
    }
  };

  deleteClient = async (req, res, next) => {
    try {
      const { id } = req.params;

      await this.clientService.delete(id);

      // Log audit trail
      await this.auditService.log({
        action: 'client_deleted',
        user_id: req.user.id,
        resource_type: 'client',
        resource_id: id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting client:', error);
      next(error);
    }
  };
}
