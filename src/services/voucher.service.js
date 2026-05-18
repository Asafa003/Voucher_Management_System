import { supabase, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const VOUCHER_PERIOD_MONTHS = parseInt(process.env.VOUCHER_PERIOD_MONTHS, 10) || 2;

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
          client:clients(id, first_name, last_name, postcode, household_size),
          centre:centres(id, name, address, opening_times),
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

  async findById(id, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabase
        .from('vouchers')
        .select(`
          *,
          client:clients(id, first_name, last_name, address, postcode, phone, email, year_of_birth, household_size),
          centre:centres(id, name, address, postcode, phone, email, opening_times, delivery_available),
          issued_by_user:users!issued_by(first_name, last_name, email),
          fulfilled_by_user:users!fulfilled_by(first_name, last_name),
          cancelled_by_user:users!cancelled_by(first_name, last_name),
          income_source:income_sources(name),
          repeat_reason:repeat_voucher_reasons(name),
          voucher_referral_reasons(referral_reason:referral_reasons(name))
        `)
        .eq('id', id);

      // Explicit centre filtering for non-super-admins
      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('centre_id', userCentres);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error finding voucher by ID:', error);
      throw error;
    }
  }

  async findByCode(code, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabase
        .from('vouchers')
        .select(`
          *,
          client:clients(id, first_name, last_name, postcode),
          centre:centres(id, name, address),
          issued_by_user:users!issued_by(first_name, last_name)
        `)
        .eq('voucher_code', code.toUpperCase());

      // Explicit centre filtering for non-super-admins
      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('centre_id', userCentres);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error;
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
  async checkRepeatVoucher(clientId, months = VOUCHER_PERIOD_MONTHS) {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('check_repeat_voucher', {
          p_client_id: clientId,
          p_months: months
        });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return {
        voucher_count: result?.voucher_count ?? 0,
        is_repeat: result?.is_repeat ?? false,
        last_vouchers: result?.last_vouchers ?? []
      };
    } catch (error) {
      logger.error('Error checking repeat voucher:', error);
      throw error;
    }
  }

  async _validateReferences({ client_id, centre_id, income_source_id, referral_reason_ids, repeat_voucher_reason_id }) {
    const err = (msg) => {
      const e = new Error(msg);
      e.statusCode = 400;
      return e;
    };

    // Use admin for reference validation to ensure existence check works regardless of RLS
    const { data: client } = await supabaseAdmin.from('clients').select('id').eq('id', client_id).single();
    if (!client) throw err('Invalid client_id: client not found');

    const { data: centre } = await supabaseAdmin.from('centres').select('id').eq('id', centre_id).single();
    if (!centre) throw err('Invalid centre_id: centre not found');

    if (income_source_id) {
      const { data: income } = await supabaseAdmin.from('income_sources').select('id').eq('id', income_source_id).single();
      if (!income) throw err('Invalid income_source_id: not found');
    }

    if (referral_reason_ids && Array.isArray(referral_reason_ids) && referral_reason_ids.length > 0) {
      const limited = referral_reason_ids.slice(0, 4);
      const { data: reasons } = await supabaseAdmin.from('referral_reasons').select('id').in('id', limited);
      const foundIds = new Set((reasons || []).map(r => r.id));
      const invalid = limited.filter(id => !foundIds.has(id));
      if (invalid.length > 0) {
        throw err(`Invalid referral_reason_ids: ${invalid.join(', ')} not found`);
      }
    }

    if (repeat_voucher_reason_id) {
      const { data: reason } = await supabaseAdmin.from('repeat_voucher_reasons').select('id').eq('id', repeat_voucher_reason_id).single();
      if (!reason) throw err('Invalid repeat_voucher_reason_id: not found');
    }
  }

  async create(voucherData, referralReasonIds = []) {
    try {
      // 1. Validate references
      await this._validateReferences({
        client_id: voucherData.client_id,
        centre_id: voucherData.centre_id,
        income_source_id: voucherData.income_source_id,
        referral_reason_ids: referralReasonIds,
        repeat_voucher_reason_id: voucherData.repeat_voucher_reason_id
      });

      // 2. Check repeat voucher status using Admin (to see across centres)
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

      // 3. Insert voucher using user client to respect RLS (staff must be assigned to the centre)
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

      // 4. Insert referral reasons
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
        }
      }

      return voucher;
    } catch (error) {
      logger.error('Error in createVoucher service:', error);
      throw error;
    }
  }

  async update(id, updates, userCentres = [], userRole = 'super_admin') {
    try {
      const { referral_reason_ids, ...updateFields } = updates;
      
      const allowedFields = ['household_size', 'expiry_date', 'income_source_id', 'collection_method', 'notes', 'status'];
      const sanitized = Object.fromEntries(
        Object.entries(updateFields).filter(([k]) => allowedFields.includes(k))
      );

      let query = supabase
        .from('vouchers')
        .update(sanitized)
        .eq('id', id);

      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('centre_id', userCentres);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;

      if (referral_reason_ids && Array.isArray(referral_reason_ids)) {
        await supabase.from('voucher_referral_reasons').delete().eq('voucher_id', id);
        const limited = referral_reason_ids.slice(0, 4);
        if (limited.length > 0) {
          await supabase
            .from('voucher_referral_reasons')
            .insert(limited.map(rr => ({ voucher_id: id, referral_reason_id: rr })));
        }
      }

      return data;
    } catch (error) {
      logger.error('Error updating voucher:', error);
      throw error;
    }
  }

  async fulfill(id, userId, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabase
        .from('vouchers')
        .update({
          status: 'fulfilled',
          fulfilled_at: new Date().toISOString(),
          fulfilled_by: userId
        })
        .eq('id', id)
        .eq('status', 'issued');

      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('centre_id', userCentres);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fulfilling voucher:', error);
      throw error;
    }
  }

  async cancel(id, userId, reason, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabase
        .from('vouchers')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason
        })
        .eq('id', id)
        .eq('status', 'issued');

      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('centre_id', userCentres);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error cancelling voucher:', error);
      throw error;
    }
  }

  async getPrintableVoucher(id, userCentres = [], userRole = 'super_admin') {
    try {
      const voucher = await this.findById(id, userCentres, userRole);
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
