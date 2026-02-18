import { supabase } from '../config/supabase.js';
import { AuditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export class AuthController {
  constructor() {
    this.auditService = new AuditService();
  }

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return res.status(401).json({ error: error.message || 'Invalid credentials' });
      }

      // Update last_login_at and fetch full user profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, centre_assignments(centre_id)')
        .eq('id', data.user.id)
        .eq('is_active', true)
        .single();

      if (!userProfile) {
        await supabase.auth.signOut();
        return res.status(403).json({ error: 'User profile not found or inactive' });
      }

      // Update last_login_at
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.user.id);

      // Log audit trail
      await this.auditService.log({
        action: 'login',
        user_id: data.user.id,
        details: { email },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          role: userProfile.role,
          centres: userProfile.centre_assignments?.map(ca => ca.centre_id) || []
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      // Log audit trail before signing out
      await this.auditService.log({
        action: 'logout',
        user_id: req.user.id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      await supabase.auth.signOut();

      res.status(204).send();
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  };

  refreshToken = async (req, res, next) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const { data, error } = await supabase.auth.refreshSession({ refresh_token });

      if (error) {
        return res.status(401).json({ error: error.message || 'Invalid or expired refresh token' });
      }

      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      next(error);
    }
  };

  getCurrentUser = async (req, res, next) => {
    try {
      const { data: userProfile, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          last_login_at,
          centre_assignments(centre_id, centre:centres(id, name))
        `)
        .eq('id', req.user.id)
        .single();

      if (error || !userProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      if (!userProfile.is_active) {
        return res.status(403).json({ error: 'User account is inactive' });
      }

      res.json({
        id: userProfile.id,
        email: userProfile.email,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        role: userProfile.role,
        last_login_at: userProfile.last_login_at,
        centres: userProfile.centre_assignments?.map(ca => ({
          id: ca.centre_id,
          name: ca.centre?.name
        })) || []
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      next(error);
    }
  };
}
