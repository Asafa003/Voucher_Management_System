import { supabase, supabaseAdmin } from '../config/supabase.js';
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Get user profile with role
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*, centre_assignments(centre_id)')
        .eq('id', data.user.id)
        .single();

      if (profileError || !userProfile) {
        return res.status(403).json({ error: 'User profile not found. Contact your administrator.' });
      }

      if (!userProfile.is_active) {
        return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });
      }

      // Update last login
      await supabaseAdmin
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.user.id);

      // Log audit trail
      await this.auditService.log({
        action: 'login',
        user_id: data.user.id,
        resource_type: 'user',
        resource_id: data.user.id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({
        user: {
          id: userProfile.id,
          email: userProfile.email,
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          role: userProfile.role,
          centres: userProfile.centre_assignments?.map(ca => ca.centre_id) || []
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      await this.auditService.log({
        action: 'logout',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.user.id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      res.json({ message: 'Logged out successfully' });
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

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token
      });

      if (error) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      res.json({
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      next(error);
    }
  };

  getCurrentUser = async (req, res, next) => {
    try {
      const { data: userProfile, error } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          centre_assignments(centre:centres(id, name))
        `)
        .eq('id', req.user.id)
        .single();

      if (error || !userProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      res.json({
        id: userProfile.id,
        email: userProfile.email,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        role: userProfile.role,
        is_active: userProfile.is_active,
        last_login_at: userProfile.last_login_at,
        centres: userProfile.centre_assignments?.map(ca => ca.centre) || []
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      next(error);
    }
  };
}
