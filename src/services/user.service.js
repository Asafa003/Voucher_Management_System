import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class UserService {
  async findAll({ role, centreId, isActive, page = 1, limit = 50, userCentres = [], userRole = 'staff' }) {
    try {
      let query = supabaseAdmin
        .from('users')
        .select(`
          *,
          centre_assignments(centre:centres(id, name))
        `, { count: 'exact' });

      if (role) query = query.eq('role', role);
      if (typeof isActive === 'boolean') query = query.eq('is_active', isActive);
      
      // Filter by centre_id if provided or restrict to userCentres for non-super-admins
      if (centreId) {
        query = query.filter('centre_assignments.centre_id', 'eq', centreId);
      } else if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.filter('centre_assignments.centre_id', 'in', `(${userCentres.join(',')})`);
      }

      const offset = (page - 1) * limit;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data,
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      };
    } catch (error) {
      logger.error('Error finding users:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          centre_assignments(centre:centres(id, name, address))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async create(userData) {
    try {
      // Create auth user via Supabase Admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      });

      if (authError) throw authError;

      // Insert user profile
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role || 'staff'
        })
        .select()
        .single();

      if (error) {
        // Rollback: delete auth user if profile insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async update(id, updates) {
    try {
      // Only allow updating safe fields
      const allowedFields = ['first_name', 'last_name', 'role', 'is_active'];
      const safeUpdates = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          safeUpdates[key] = updates[key];
        }
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deactivate(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  async assignCentres(userId, centreIds) {
    try {
      // Remove existing assignments
      const { error: deleteError } = await supabaseAdmin
        .from('centre_assignments')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (centreIds.length > 0) {
        const assignments = centreIds.map(centreId => ({
          user_id: userId,
          centre_id: centreId
        }));

        const { error: insertError } = await supabaseAdmin
          .from('centre_assignments')
          .insert(assignments);

        if (insertError) throw insertError;
      }

      // Return updated user with assignments
      return this.findById(userId);
    } catch (error) {
      logger.error('Error assigning centres:', error);
      throw error;
    }
  }
}
