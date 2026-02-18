import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { sanitizeSearchInput } from '../utils/sanitize.js';

export class UserService {
  async findUsers({ centreId, role, search, page = 1, limit = 50, userCentres = [], userRole = 'staff' }) {
    try {
      let allowedUserIds = null;
      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        const { data: assignments } = await supabaseAdmin
          .from('centre_assignments')
          .select('user_id')
          .in('centre_id', userCentres);
        allowedUserIds = [...new Set((assignments || []).map(a => a.user_id))];
        if (allowedUserIds.length === 0) {
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
      }
      if (centreId) {
        const { data: assignments } = await supabaseAdmin
          .from('centre_assignments')
          .select('user_id')
          .eq('centre_id', centreId);
        const centreUserIds = [...new Set((assignments || []).map(a => a.user_id))];
        if (centreUserIds.length === 0) {
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
        allowedUserIds = allowedUserIds ? allowedUserIds.filter(id => centreUserIds.includes(id)) : centreUserIds;
        if (allowedUserIds?.length === 0) {
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
      }

      let query = supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          last_login_at,
          created_at,
          centre_assignments(centre_id, centre:centres(name))
        `, { count: 'exact' })
        .eq('is_active', true);

      if (allowedUserIds?.length) query = query.in('id', allowedUserIds);
      if (role) query = query.eq('role', role);
      if (search) {
        const sanitized = sanitizeSearchInput(search);
        if (sanitized) {
          query = query.or(`first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
        }
      }

      const offset = (page - 1) * limit;
      const { data, error, count } = await query
        .order('last_name')
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding users:', error);
      throw error;
    }
  }

  async findById(id, userCentres = [], userRole = 'super_admin') {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          last_login_at,
          created_at,
          updated_at,
          centre_assignments(centre_id, centre:centres(id, name))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;

      if (userRole === 'centre_admin' && userCentres?.length > 0) {
        const userCentreIds = data.centre_assignments?.map(ca => ca.centre_id) || [];
        const hasOverlap = userCentreIds.some(cid => userCentres.includes(cid));
        if (!hasOverlap) return null;
      }

      return data;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async create(userData, centreIds = []) {
    try {
      const { email, password, first_name, last_name, role } = userData;

      if (!email || !first_name || !last_name) {
        throw new Error('Email, first_name, and last_name are required');
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || undefined,
        email_confirm: true
      });

      if (authError) throw authError;

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          first_name,
          last_name,
          role: role || 'staff'
        })
        .select()
        .single();

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      if (centreIds?.length > 0) {
        await supabaseAdmin
          .from('centre_assignments')
          .insert(centreIds.map(centre_id => ({ user_id: profile.id, centre_id })));
      }

      return profile;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async update(id, updates, userCentres = [], userRole = 'super_admin') {
    try {
      const existing = await this.findById(id, userCentres, userRole);
      if (!existing) return null;

      const allowedFields = ['first_name', 'last_name', 'role'];
      const sanitized = Object.fromEntries(
        Object.entries(updates).filter(([k]) => allowedFields.includes(k))
      );

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(sanitized)
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
      await supabaseAdmin.from('centre_assignments').delete().eq('user_id', userId);

      if (centreIds?.length > 0) {
        await supabaseAdmin
          .from('centre_assignments')
          .insert(centreIds.map(centre_id => ({ user_id: userId, centre_id })));
      }

      return this.findById(userId, [], 'super_admin');
    } catch (error) {
      logger.error('Error assigning centres:', error);
      throw error;
    }
  }
}
