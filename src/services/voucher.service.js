import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const VOUCHER_PERIOD_MONTHS = parseInt(process.env.VOUCHER_PERIOD_MONTHS, 10) || 6;

export class VoucherService {
  async findVouchers({ centreId, clientId, status, startDate, endDate, page = 1, limit = 50, userCentres = [], userRole = 'staff' }) {
    try {
      let query = supabaseAdmin
        .from('vouchers')
        .select(`
          *,
          client:clients(id, first_name, last_name, postcode, household_size),
          centre:centres(id, name, address, opening_times),
          issued_by:users!issued_by(id, first_name, last_name),
          income_source:income_sources(name)
        `, { count: 'exact' });

      // Centre filtering for non-super-admins
      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        query = query.in('centre_id', userCentres);
      }
      if (centreId) query = query.eq('centre_id', centreId);
      if (clientId) query = query.eq('client_id', clientId);
      if (status) query = query.eq('status', status);
      if (startDate) query = query.gte('issue_date', startDate);
      if (endDate) query = query.lte('issue_date', endDate);

      const offset = (page - 1) * limit;
      const { data, error, count } = await query
        .order('issue_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding vouchers:', error);
      throw error;
    }
  }

  async findById(id, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabaseAdmin
        .from('vouchers')
        .select(`
          *,
          client:clients(*),
          centre:centres(*),
          issued_by:users!issued_by(id, first_name, last_name, email),
          income_source:income_sources(name),
          repeat_reason:repeat_voucher_reasons(id, name)
        `)
        .eq('id', id);

      const { data, error } = await query.single();

      if (error) throw error;
      if (!data) return null;

      if (userRole !== 'super_admin' && userCentres?.length > 0 && !userCentres.includes(data.centre_id)) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error finding voucher by ID:', error);
      throw error;
    }
  }

  async findByCode(code, userCentres = [], userRole = 'super_admin') {
    try {
      let query = supabaseAdmin
        .from('vouchers')
        .select(`
          *,
          client:clients(*),
          centre:centres(*),
          issued_by:users!issued_by(id, first_name, last_name),
          income_source:income_sources(name),
          repeat_reason:repeat_voucher_reasons(id, name)
        `)
        .eq('voucher_code', code.toUpperCase());

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      if (userRole !== 'super_admin' && userCentres?.length > 0 && !userCentres.includes(data.centre_id)) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error finding voucher by code:', error);
      throw error;
    }
  }

  async checkRepeatVoucher(clientId, months = VOUCHER_PERIOD_MONTHS) {
    try {
      const { data, error } = await supabaseAdmin.rpc('check_repeat_voucher', {
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

  async create(voucherData, issuedBy, userCentres = [], userRole = 'super_admin') {
    try {
      const { referral_reason_ids, ...voucherFields } = voucherData;

      await this._validateReferences({
        client_id: voucherFields.client_id,
        centre_id: voucherFields.centre_id,
        income_source_id: voucherFields.income_source_id,
        referral_reason_ids,
        repeat_voucher_reason_id: voucherFields.repeat_voucher_reason_id
      });

      // Validate centre access
      if (userRole !== 'super_admin' && userCentres?.length > 0 && !userCentres.includes(voucherFields.centre_id)) {
        throw new Error('Unauthorized to issue vouchers for this centre');
      }

      const insertData = {
        ...voucherFields,
        issued_by: issuedBy,
        voucher_code: null // Trigger will generate
      };

      const { data: voucher, error } = await supabaseAdmin
        .from('vouchers')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      if (referral_reason_ids && Array.isArray(referral_reason_ids) && referral_reason_ids.length > 0) {
        const limitedReasons = referral_reason_ids.slice(0, 4); // Max 4 per PDF
        await supabaseAdmin
          .from('voucher_referral_reasons')
          .insert(limitedReasons.map(rr => ({ voucher_id: voucher.id, referral_reason_id: rr })));
      }

      return voucher;
    } catch (error) {
      logger.error('Error creating voucher:', error);
      throw error;
    }
  }

  async update(id, updates, userCentres = [], userRole = 'super_admin') {
    try {
      const existing = await this.findById(id, userCentres, userRole);
      if (!existing) return null;

      const { referral_reason_ids, income_source_id, ...updateFields } = updates;

      if (income_source_id) {
        const { data } = await supabaseAdmin.from('income_sources').select('id').eq('id', income_source_id).single();
        if (!data) {
          const err = new Error('Invalid income_source_id: not found');
          err.statusCode = 400;
          throw err;
        }
      }
      if (referral_reason_ids && Array.isArray(referral_reason_ids) && referral_reason_ids.length > 0) {
        const limited = referral_reason_ids.slice(0, 4);
        const { data: reasons } = await supabaseAdmin.from('referral_reasons').select('id').in('id', limited);
        const foundIds = new Set((reasons || []).map(r => r.id));
        const invalid = limited.filter(rid => !foundIds.has(rid));
        if (invalid.length > 0) {
          const err = new Error(`Invalid referral_reason_ids: ${invalid.join(', ')} not found`);
          err.statusCode = 400;
          throw err;
        }
      }

      const allowedFields = ['household_size', 'expiry_date', 'income_source_id', 'collection_method', 'notes', 'status'];
      const sanitized = Object.fromEntries(
        Object.entries(updateFields).filter(([k]) => allowedFields.includes(k))
      );

      const { data, error } = await supabaseAdmin
        .from('vouchers')
        .update(sanitized)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (referral_reason_ids && Array.isArray(referral_reason_ids)) {
        await supabaseAdmin.from('voucher_referral_reasons').delete().eq('voucher_id', id);
        const limited = referral_reason_ids.slice(0, 4);
        if (limited.length > 0) {
          await supabaseAdmin
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

  async fulfill(id, fulfilledBy, userCentres = [], userRole = 'super_admin') {
    try {
      const existing = await this.findById(id, userCentres, userRole);
      if (!existing) return null;
      if (existing.status !== 'issued') {
        throw new Error('Only issued vouchers can be fulfilled');
      }

      const { data, error } = await supabaseAdmin
        .from('vouchers')
        .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString(), fulfilled_by: fulfilledBy })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fulfilling voucher:', error);
      throw error;
    }
  }

  async cancel(id, cancellationReason, cancelledBy, userCentres = [], userRole = 'super_admin') {
    try {
      const existing = await this.findById(id, userCentres, userRole);
      if (!existing) return null;
      if (existing.status === 'cancelled') {
        throw new Error('Voucher is already cancelled');
      }

      const { data, error } = await supabaseAdmin
        .from('vouchers')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: cancelledBy,
          cancellation_reason: cancellationReason
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error cancelling voucher:', error);
      throw error;
    }
  }

  async getPrintable(id, userCentres = [], userRole = 'super_admin') {
    const voucher = await this.findById(id, userCentres, userRole);
    if (!voucher) return null;

    return {
      voucher_code: voucher.voucher_code,
      client_name: `${voucher.client?.first_name} ${voucher.client?.last_name}`,
      household_size: voucher.household_size,
      centre: voucher.centre,
      collection_method: voucher.collection_method,
      issue_date: voucher.issue_date,
      expiry_date: voucher.expiry_date,
      notes: voucher.notes
    };
  }
}
