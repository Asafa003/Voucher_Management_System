import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class CentreService {
  async findCentres({ includeInactive = false, userCentres = [], userRole = 'staff' }) {
    try {
      let query = supabaseAdmin
        .from('centres')
        .select('*')
        .order('name');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        query = query.in('id', userCentres);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error finding centres:', error);
      throw error;
    }
  }

  async findById(id, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabaseAdmin
        .from('centres')
        .select('*')
        .eq('id', id);

      const { data, error } = await query.single();

      if (error) throw error;
      if (!data) return null;

      if (userRole !== 'super_admin' && userCentres?.length > 0 && !userCentres.includes(data.id)) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error finding centre by ID:', error);
      throw error;
    }
  }

  async create(centreData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('centres')
        .insert(centreData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating centre:', error);
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const existing = await this.findById(id, [], 'super_admin');
      if (!existing) return null;

      const allowedFields = ['name', 'address', 'postcode', 'phone', 'email', 'opening_times', 'delivery_available', 'is_active'];
      const sanitized = Object.fromEntries(
        Object.entries(updates).filter(([k]) => allowedFields.includes(k))
      );

      const { data, error } = await supabaseAdmin
        .from('centres')
        .update(sanitized)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating centre:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      const { error } = await supabaseAdmin
        .from('centres')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      logger.error('Error deleting centre:', error);
      throw error;
    }
  }
}
