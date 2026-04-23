import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class ReferenceController {
  getIncomeSources = async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('income_sources')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      logger.error('Error fetching income sources:', error);
      next(error);
    }
  };

  getReferralReasons = async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('referral_reasons')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      logger.error('Error fetching referral reasons:', error);
      next(error);
    }
  };

  getRepeatVoucherReasons = async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('repeat_voucher_reasons')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      logger.error('Error fetching repeat voucher reasons:', error);
      next(error);
    }
  };

  getAll = async (req, res, next) => {
    try {
      const [incomeRes, referralRes, repeatRes] = await Promise.all([
        supabaseAdmin.from('income_sources').select('id, name').eq('is_active', true).order('name'),
        supabaseAdmin.from('referral_reasons').select('id, name').eq('is_active', true).order('name'),
        supabaseAdmin.from('repeat_voucher_reasons').select('id, name').eq('is_active', true).order('name')
      ]);
      if (incomeRes.error) throw incomeRes.error;
      if (referralRes.error) throw referralRes.error;
      if (repeatRes.error) throw repeatRes.error;
      res.json({
        income_sources: incomeRes.data || [],
        referral_reasons: referralRes.data || [],
        repeat_voucher_reasons: repeatRes.data || []
      });
    } catch (error) {
      logger.error('Error fetching reference data:', error);
      next(error);
    }
  };
}
