import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class ClientService {
  async findClients({ search, postcode, page = 1, limit = 50, userCentres = [] }) {
    try {
      let query = supabase
        .from('clients')
        .select('*, created_by:users!created_by(first_name, last_name)', { count: 'exact' });

      // Apply search filter
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }

      // Apply postcode filter
      if (postcode) {
        query = query.ilike('postcode', `${postcode}%`);
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

  async findById(id) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          created_by:users!created_by(first_name, last_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding client by ID:', error);
      throw error;
    }
  }

  async getVoucherHistory(clientId) {
    try {
      const { data, error } = await supabase
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
      return data;
    } catch (error) {
      logger.error('Error getting client voucher history:', error);
      throw error;
    }
  }

  async checkDuplicates(firstName, lastName, postcode) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, postcode, created_at')
        .ilike('first_name', firstName)
        .ilike('last_name', lastName)
        .ilike('postcode', `${postcode}%`)
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

      const { data, error } = await supabase
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

  async update(id, updates) {
    try {
      // Handle consent changes
      if (updates.contact_consent === false) {
        updates.phone = null;
        updates.email = null;
      }

      if (updates.dietary_consent === false) {
        updates.dietary_requirements = null;
      }

      const { data, error } = await supabase
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

  async delete(id) {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      logger.error('Error deleting client:', error);
      throw error;
    }
  }
}
