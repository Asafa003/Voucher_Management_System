import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class AuditService {
  async log(auditData) {
    try {
      const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert(auditData);

      if (error) {
        logger.error('Error creating audit log:', error);
        throw error;
      }
    } catch (error) {
      // Don't throw - audit logging should not break main operations
      logger.error('Failed to log audit trail:', error);
    }
  }

  async getAuditLogs({ userId, action, resourceType, resourceId, startDate, endDate, page = 1, limit = 100 }) {
    try {
      let query = supabaseAdmin
        .from('audit_logs')
        .select(`
          *,
          user:users(first_name, last_name, email),
          centre:centres(name)
        `, { count: 'exact' });

      if (userId) query = query.eq('user_id', userId);
      if (action) query = query.eq('action', action);
      if (resourceType) query = query.eq('resource_type', resourceType);
      if (resourceId) query = query.eq('resource_id', resourceId);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const offset = (page - 1) * limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  async getAuditLogById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('audit_logs')
        .select(`
          *,
          user:users(first_name, last_name, email),
          centre:centres(name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching audit log by ID:', error);
      throw error;
    }
  }
}
