import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

export class ReportService {
  async getDashboard({ centreId, startDate, endDate, userCentres = [], userRole }) {
    try {
      const start = startDate || dayjs().startOf('month').toISOString();
      const end = endDate || dayjs().endOf('day').toISOString();

      // Build centre filter
      let centreFilter = null;
      if (centreId) {
        centreFilter = [centreId];
      } else if (userRole !== 'super_admin' && userCentres.length > 0) {
        centreFilter = userCentres;
      }

      // Total vouchers issued in period
      let voucherQuery = supabaseAdmin
        .from('vouchers')
        .select('id, status, is_repeat_voucher, collection_method, client_id', { count: 'exact' })
        .gte('issue_date', start)
        .lte('issue_date', end);

      if (centreFilter) voucherQuery = voucherQuery.in('centre_id', centreFilter);

      const { data: vouchers, count: totalVouchers } = await voucherQuery;

      // Calculate stats from the returned data
      const uniqueClients = new Set(vouchers?.map(v => v.client_id) || []).size;
      const repeatVouchers = vouchers?.filter(v => v.is_repeat_voucher).length || 0;
      const deliveryCount = vouchers?.filter(v => v.collection_method === 'delivery').length || 0;
      const collectionCount = vouchers?.filter(v => v.collection_method === 'collection').length || 0;
      const fulfilledCount = vouchers?.filter(v => v.status === 'fulfilled').length || 0;
      const cancelledCount = vouchers?.filter(v => v.status === 'cancelled').length || 0;

      // Referral reason breakdown
      let reasonQuery = supabaseAdmin
        .from('voucher_referral_reasons')
        .select(`
          referral_reason:referral_reasons(name),
          voucher:vouchers!inner(issue_date, centre_id)
        `)
        .gte('voucher.issue_date', start)
        .lte('voucher.issue_date', end);

      const { data: reasonData } = await reasonQuery;

      const referralBreakdown = {};
      (reasonData || []).forEach(r => {
        const name = r.referral_reason?.name;
        if (name) {
          referralBreakdown[name] = (referralBreakdown[name] || 0) + 1;
        }
      });

      return {
        period: { start, end },
        total_vouchers: totalVouchers || 0,
        unique_clients: uniqueClients,
        repeat_vouchers: repeatVouchers,
        fulfilled: fulfilledCount,
        cancelled: cancelledCount,
        collection: collectionCount,
        delivery: deliveryCount,
        referral_breakdown: referralBreakdown
      };
    } catch (error) {
      logger.error('Error generating dashboard:', error);
      throw error;
    }
  }

  async getVoucherReport({ centreId, status, startDate, endDate, page = 1, limit = 100, userCentres = [], userRole }) {
    try {
      let query = supabaseAdmin
        .from('vouchers')
        .select(`
          id, voucher_code, status, issue_date, expiry_date, household_size,
          collection_method, is_repeat_voucher, notes,
          client:clients(first_name, last_name, postcode),
          centre:centres(name),
          issued_by_user:users!issued_by(first_name, last_name),
          income_source:income_sources(name)
        `, { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (centreId) query = query.eq('centre_id', centreId);
      if (startDate) query = query.gte('issue_date', startDate);
      if (endDate) query = query.lte('issue_date', endDate);

      if (userRole !== 'super_admin' && userCentres.length > 0) {
        query = query.in('centre_id', userCentres);
      }

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
      logger.error('Error generating voucher report:', error);
      throw error;
    }
  }

  async getClientReport({ centreId, startDate, endDate, page = 1, limit = 100, userCentres = [], userRole }) {
    try {
      let query = supabaseAdmin
        .from('client_voucher_history')
        .select('*', { count: 'exact' });

      const offset = (page - 1) * limit;
      query = query
        .order('last_voucher_date', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data,
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      };
    } catch (error) {
      logger.error('Error generating client report:', error);
      throw error;
    }
  }

  async exportData({ type, centreId, status, startDate, endDate, userCentres = [], userRole }) {
    try {
      let data;

      if (type === 'vouchers') {
        let query = supabaseAdmin
          .from('vouchers')
          .select(`
            voucher_code, status, issue_date, expiry_date, household_size,
            collection_method, is_repeat_voucher, notes,
            client:clients(first_name, last_name, postcode),
            centre:centres(name),
            issued_by_user:users!issued_by(first_name, last_name),
            income_source:income_sources(name)
          `);

        if (status) query = query.eq('status', status);
        if (centreId) query = query.eq('centre_id', centreId);
        if (startDate) query = query.gte('issue_date', startDate);
        if (endDate) query = query.lte('issue_date', endDate);
        if (userRole !== 'super_admin' && userCentres.length > 0) {
          query = query.in('centre_id', userCentres);
        }

        query = query.order('issue_date', { ascending: false });
        const result = await query;
        if (result.error) throw result.error;
        data = result.data;
      } else if (type === 'clients') {
        const { data: clientData, error } = await supabaseAdmin
          .from('client_voucher_history')
          .select('*')
          .order('last_voucher_date', { ascending: false, nullsFirst: false });

        if (error) throw error;
        data = clientData;
      } else {
        throw Object.assign(new Error('Invalid export type. Use "vouchers" or "clients"'), { statusCode: 400 });
      }

      // Convert to CSV
      if (!data || data.length === 0) {
        return { csv: '', count: 0 };
      }

      const flatData = data.map(row => this._flattenObject(row));
      const headers = Object.keys(flatData[0]);
      const csvRows = [
        headers.join(','),
        ...flatData.map(row =>
          headers.map(h => {
            const val = row[h] ?? '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          }).join(',')
        )
      ];

      return { csv: csvRows.join('\n'), count: data.length };
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw error;
    }
  }

  _flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this._flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
    return result;
  }
}
