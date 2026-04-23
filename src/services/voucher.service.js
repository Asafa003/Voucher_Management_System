import { supabase, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class VoucherService {
  /**
   * Finds vouchers based on filters.
   * Respects RLS - non-super-admins only see vouchers from their centres.
   */
  async findVouchers({ status, centreId, clientId, startDate, endDate, page = 1, limit = 50 }) {
    try {
      let query = supabase
        .from('vouchers')
        .select(`
          *,
          client:clients(id, first_name, last_name, postcode),
          centre:centres(id, name),
          issued_by_user:users!issued_by(first_name, last_name),
          income_source:income_sources(name),
          repeat_reason:repeat_voucher_reasons(name),
          voucher_referral_reasons(referral_reason:referral_reasons(name))
        `, { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (centreId) query = query.eq('centre_id', centreId);
      if (clientId) query = query.eq('client_id', clientId);
      if (startDate) query = query.gte('issue_date', startDate);
      if (endDate) query = query.lte('issue_date', endDate);

      const offset = (page - 1) * limit;
      query = query
        .order('issue_date', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data,
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      };
    } catch (error) {
      logger.error('Error finding vouchers:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select(`
          *,
          client:clients(id, first_name, last_name, address, postcode, phone, email, year_of_birth),
          centre:centres(id, name, address, postcode, phone, email, opening_times, delivery_available),
          issued_by_user:users!issued_by(first_name, last_name, email),
          fulfilled_by_user:users!fulfilled_by(first_name, last_name),
          cancelled_by_user:users!cancelled_by(first_name, last_name),
          income_source:income_sources(name),
          repeat_reason:repeat_voucher_reasons(name),
          voucher_referral_reasons(referral_reason:referral_reasons(name))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding voucher by ID:', error);
      throw error;
    }
  }

  async findByCode(code) {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select(`
          *,
          client:clients(id, first_name, last_name, postcode),
          centre:centres(id, name, address),
          issued_by_user:users!issued_by(first_name, last_name)
        `)
        .eq('voucher_code', code)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding voucher by code:', error);
      throw error;
    }
  }

  /**
   * RPC call to check repeat status. Uses admin to ensure bypass of RLS for this specific check 
   * (staff might need to know repeat status even if voucher belongs to another centre)
   */
  async checkRepeatVoucher(clientId, months = 6) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('check_repeat_voucher', {
          p_client_id: clientId,
          p_months: months
        });

      if (error) throw error;
      return data?.[0] || { voucher_count: 0, is_repeat: false, last_vouchers: [] };
    } catch (error) {
      logger.error('Error checking repeat voucher:', error);
      throw error;
    }
  }

  async create(voucherData, referralReasonIds = []) {
    try {
      // 1. Check repeat voucher status using Admin (to see across centres)
      const repeatCheck = await this.checkRepeatVoucher(voucherData.client_id);

      if (repeatCheck.is_repeat) {
        voucherData.is_repeat_voucher = true;

        // Strict enforcement of repeat voucher requirements
        if (!voucherData.repeat_voucher_reason_id || !voucherData.repeat_voucher_consent) {
          const err = new Error('Repeat voucher requires a reason and explicit consent');
          err.statusCode = 400;
          throw err;
        }
      }

      // 2. Insert voucher using user client to respect RLS (staff must be assigned to the centre)
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .insert({
          client_id: voucherData.client_id,
          centre_id: voucherData.centre_id,
          issued_by: voucherData.issued_by,
          household_size: voucherData.household_size || 1,
          income_source_id: voucherData.income_source_id,
          collection_method: voucherData.collection_method || 'collection',
          is_repeat_voucher: voucherData.is_repeat_voucher || false,
          repeat_voucher_reason_id: voucherData.repeat_voucher_reason_id,
          repeat_voucher_notes: voucherData.repeat_voucher_notes,
          repeat_voucher_consent: voucherData.repeat_voucher_consent || false,
          notes: voucherData.notes,
          expiry_date: voucherData.expiry_date
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Insert referral reasons
      if (referralReasonIds && referralReasonIds.length > 0) {
        const reasons = referralReasonIds.slice(0, 4).map(reasonId => ({
          voucher_id: voucher.id,
          referral_reason_id: reasonId
        }));

        const { error: reasonError } = await supabase
          .from('voucher_referral_reasons')
          .insert(reasons);

        if (reasonError) {
          logger.error('Error inserting referral reasons:', reasonError);
          // We don't fail the whole request if reasons fail, but log it
        }
      }

      return voucher;
    } catch (error) {
      logger.error('Error in createVoucher service:', error);
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating voucher:', error);
      throw error;
    }
  }

  async fulfill(id, userId) {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .update({
          status: 'fulfilled',
          fulfilled_at: new Date().toISOString(),
          fulfilled_by: userId
        })
        .eq('id', id)
        .eq('status', 'issued') // Can only fulfill issued vouchers
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fulfilling voucher:', error);
      throw error;
    }
  }

  async cancel(id, userId, reason) {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason
        })
        .eq('id', id)
        .eq('status', 'issued') // Can only cancel issued vouchers
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error cancelling voucher:', error);
      throw error;
    }
  }

  async getPrintableVoucher(id) {
    try {
      const voucher = await this.findById(id);
      if (!voucher) return null;

      return {
        voucher_code: voucher.voucher_code,
        issue_date: voucher.issue_date,
        expiry_date: voucher.expiry_date,
        status: voucher.status,
        client_name: `${voucher.client?.first_name} ${voucher.client?.last_name}`,
        household_size: voucher.household_size,
        collection_method: voucher.collection_method,
        centre: {
          name: voucher.centre?.name,
          address: voucher.centre?.address,
          postcode: voucher.centre?.postcode,
          phone: voucher.centre?.phone,
          opening_times: voucher.centre?.opening_times
        },
        issued_by: voucher.issued_by_user 
          ? `${voucher.issued_by_user.first_name} ${voucher.issued_by_user.last_name}` 
          : 'Unknown Staff Member',
        notes: voucher.notes
      };
    } catch (error) {
      logger.error('Error getting printable voucher:', error);
      throw error;
    }
  }
}
