import { supabase, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase client
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Fetch user profile and role from the public.users table
      // We use supabaseAdmin here because RLS might prevent users from seeing their own role 
      // if not configured perfectly, and we need reliable role data for authorization.
      const { data: userData, error } = await supabaseAdmin
        .from('users')
        .select(`
          role,
          centre_assignments(centre_id)
        `)
        .eq('id', req.user.id)
        .single();

      if (error || !userData) {
        logger.error(`User profile lookup failed for ID ${req.user.id}:`, error?.message);
        return res.status(403).json({ error: 'User profile not found or access denied' });
      }

      if (!allowedRoles.includes(userData.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Attach role and centres to request for use in controllers/services
      req.userRole = userData.role;
      req.userCentres = userData.centre_assignments?.map(ca => ca.centre_id) || [];

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};