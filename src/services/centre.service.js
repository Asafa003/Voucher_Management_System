import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class CentreService {
  async findAll(userCentres = [], userRole = 'staff') {
    try {
      let query = supabaseAdmin
        .from('centres')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // Non-super-admins only see assigned centres
      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('id', userCentres);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding centres:', error);
      throw error;
    }
  }

  async findById(id, userCentres = [], userRole = 'super_admin') {
    try {
      // Access check
      if (userRole !== 'super_admin' && !userCentres.includes(id)) {
        return null;
      }

      const { data, error } = await supabaseAdmin
        .from('centres')
        .select(`
          *,
          centre_assignments(
            user:users(id, first_name, last_name, email, role, is_active)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
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
      const { data, error } = await supabaseAdmin
        .from('centres')
        .update(updates)
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
      // Soft delete by setting is_active to false
      const { data, error } = await supabaseAdmin
        .from('centres')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error deleting centre:', error);
      throw error;
    }
  }
}
