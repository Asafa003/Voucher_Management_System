import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { sanitizeSearchInput, sanitizePostcode } from '../utils/sanitize.js';

export class ClientService {
  async findClients({ search, postcode, page = 1, limit = 50, userCentres = [], userRole = 'super_admin', createdByUserId = null }) {
    try {
      let query = supabaseAdmin
        .from('clients')
        .select('*, created_by:users!created_by(first_name, last_name)', { count: 'exact' });

      // Apply search filter (sanitized to prevent ilike injection)
      if (search) {
        const sanitized = sanitizeSearchInput(search);
        if (sanitized) {
          query = query.or(`first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%`);
        }
      }

      // Apply postcode filter (sanitized)
      if (postcode) {
        const sanitized = sanitizePostcode(postcode);
        if (sanitized) {
          query = query.ilike('postcode', `${sanitized}%`);
        }
      }

      // Centre-based filtering for non-super-admins (clients with vouchers at user's centres OR created by user)
      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        const { data: centreClientIds } = await supabaseAdmin
          .from('vouchers')
          .select('client_id')
          .in('centre_id', userCentres)
          .neq('status', 'cancelled');
        const clientIdsFromVouchers = [...new Set((centreClientIds || []).map(v => v.client_id))];
        const createdByIds = createdByUserId
          ? (await supabaseAdmin.from('clients').select('id').eq('created_by', createdByUserId).then(({ data }) => (data || []).map(c => c.id)))
          : [];
        const allowedIds = [...new Set([...clientIdsFromVouchers, ...createdByIds])];
        if (allowedIds.length === 0) {
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
        query = query.in('id', allowedIds);
      }

      // Pagination
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
      logger.error('Error finding clients:', error);
      throw error;
    }
  }

  async _clientAccessible(clientId, userCentres, userRole, userId) {
    if (userRole === 'super_admin') return true;
    if (!userCentres?.length) return false;
    const { data } = await supabaseAdmin.from('clients').select('id, created_by').eq('id', clientId).single();
    if (!data) return false;
    if (data.created_by === userId) return true;
    const { data: v } = await supabaseAdmin.from('vouchers').select('id').eq('client_id', clientId).in('centre_id', userCentres).limit(1);
    return (v || []).length > 0;
  }

  async findById(id, userCentres = [], userRole = 'super_admin', userId = null) {
    try {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select(`
          *,
          created_by:users!created_by(first_name, last_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;
      if (!(await this._clientAccessible(id, userCentres, userRole, userId))) return null;
      return data;
    } catch (error) {
      logger.error('Error finding client by ID:', error);
      throw error;
    }
  }

  async getVoucherHistory(clientId, userCentres = [], userRole = 'super_admin', userId = null) {
    try {
      if (!(await this._clientAccessible(clientId, userCentres, userRole, userId))) return null;
      const { data, error } = await supabaseAdmin
        .from('vouchers')
        .select(`
          *,
          centre:centres(name, address),
          issued_by:users!issued_by(first_name, last_name),
          income_source:income_sources(name)
        `)
        .eq('client_id', clientId)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting client voucher history:', error);
      throw error;
    }
  }

  async checkDuplicates(firstName, lastName, postcode) {
    try {
      const safeFirst = sanitizeSearchInput(String(firstName || ''));
      const safeLast = sanitizeSearchInput(String(lastName || ''));
      const safePostcode = sanitizePostcode(String(postcode || ''));
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, first_name, last_name, postcode, created_at')
        .ilike('first_name', safeFirst)
        .ilike('last_name', safeLast)
        .ilike('postcode', `${safePostcode}%`)
        .limit(5);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error checking duplicates:', error);
      throw error;
    }
  }

  async create(clientData) {
    try {
      // Only store sensitive data if consent is given
      if (!clientData.contact_consent) {
        clientData.phone = null;
        clientData.email = null;
      }

      if (!clientData.dietary_consent) {
        clientData.dietary_requirements = null;
      }

      const { data, error } = await supabaseAdmin
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating client:', error);
      throw error;
    }
  }

  async update(id, updates, userCentres = [], userRole = 'super_admin', userId = null) {
    try {
      if (!(await this._clientAccessible(id, userCentres, userRole, userId))) return null;
      // Handle consent changes
      if (updates.contact_consent === false) {
        updates.phone = null;
        updates.email = null;
      }

      if (updates.dietary_consent === false) {
        updates.dietary_requirements = null;
      }

      const { data, error } = await supabaseAdmin
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating client:', error);
      throw error;
    }
  }

  async delete(id, userCentres = [], userRole = 'super_admin', userId = null) {
    try {
      if (!(await this._clientAccessible(id, userCentres, userRole, userId))) return false;

      const { data: vouchers } = await supabaseAdmin
        .from('vouchers')
        .select('id')
        .eq('client_id', id)
        .limit(1);

      if (vouchers && vouchers.length > 0) {
        const err = new Error('Cannot delete client with existing vouchers. Remove or reassign vouchers first.');
        err.statusCode = 409;
        throw err;
      }

      const { error } = await supabaseAdmin
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      if (error.statusCode === 409) throw error;
      logger.error('Error deleting client:', error);
      throw error;
    }
  }
}
