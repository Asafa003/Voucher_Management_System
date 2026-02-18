import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class ReportService {
  async getDashboardStats(userCentres = [], userRole = 'super_admin') {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: voucherStats } = await supabaseAdmin
        .from('voucher_stats_by_centre')
        .select('*');

      let stats = voucherStats || [];
      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        stats = stats.filter(s => userCentres.includes(s.centre_id));
      }

      const totals = stats.reduce((acc, s) => ({
        total_vouchers: acc.total_vouchers + (Number(s.total_vouchers) || 0),
        unique_clients: acc.unique_clients + (Number(s.unique_clients) || 0),
        issued_count: acc.issued_count + (Number(s.issued_count) || 0),
        fulfilled_count: acc.fulfilled_count + (Number(s.fulfilled_count) || 0),
        repeat_voucher_count: acc.repeat_voucher_count + (Number(s.repeat_voucher_count) || 0),
        delivery_count: acc.delivery_count + (Number(s.delivery_count) || 0),
        collection_count: acc.collection_count + (Number(s.collection_count) || 0)
      }), { total_vouchers: 0, unique_clients: 0, issued_count: 0, fulfilled_count: 0, repeat_voucher_count: 0, delivery_count: 0, collection_count: 0 });

      let voucherQuery = supabaseAdmin.from('vouchers').select('id', { count: 'exact', head: true }).neq('status', 'cancelled');
      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        voucherQuery = voucherQuery.in('centre_id', userCentres);
      }

      const { count: dailyCount } = await voucherQuery.gte('issue_date', todayStart);
      const { count: weeklyCount } = await voucherQuery.gte('issue_date', weekStart.toISOString());
      const { count: monthlyCount } = await voucherQuery.gte('issue_date', monthStart);

      return {
        totals: {
          ...totals,
          vouchers_today: dailyCount ?? 0,
          vouchers_this_week: weeklyCount ?? 0,
          vouchers_this_month: monthlyCount ?? 0
        },
        by_centre: stats
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  async getVoucherReport({ centreId, status, startDate, endDate, page = 1, limit = 100, userCentres = [], userRole = 'super_admin' }) {
    try {
      let query = supabaseAdmin
        .from('vouchers')
        .select(`
          id,
          voucher_code,
          status,
          issue_date,
          household_size,
          collection_method,
          is_repeat_voucher,
          client:clients(first_name, last_name, postcode),
          centre:centres(name),
          issued_by:users!issued_by(first_name, last_name),
          income_source:income_sources(name)
        `, { count: 'exact' })
        .order('issue_date', { ascending: false });

      if (userRole !== 'super_admin' && userCentres?.length > 0) {
        query = query.in('centre_id', userCentres);
      }
      if (centreId) query = query.eq('centre_id', centreId);
      if (status) query = query.eq('status', status);
      if (startDate) query = query.gte('issue_date', startDate);
      if (endDate) query = query.lte('issue_date', endDate);

      const offset = (page - 1) * limit;
      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting voucher report:', error);
      throw error;
    }
  }

  async getClientReport({ centreId, startDate, endDate, page = 1, limit = 100, userCentres = [], userRole = 'super_admin' }) {
    try {
      let allowedClientIds = null;
      if (centreId || (userRole !== 'super_admin' && userCentres?.length > 0)) {
        const centreIds = centreId ? [centreId] : userCentres;
        const { data: centreClients } = await supabaseAdmin
          .from('vouchers')
          .select('client_id')
          .in('centre_id', centreIds)
          .neq('status', 'cancelled');
        allowedClientIds = [...new Set((centreClients || []).map(v => v.client_id))];
        if (allowedClientIds.length === 0) {
          return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
      }

      let query = supabaseAdmin
        .from('client_voucher_history')
        .select('*', { count: 'exact' })
        .order('total_vouchers', { ascending: false });

      if (allowedClientIds?.length) query = query.in('client_id', allowedClientIds);
      if (startDate) query = query.gte('last_voucher_date', startDate);
      if (endDate) query = query.lte('last_voucher_date', endDate);

      const offset = (page - 1) * limit;
      const { data, error, count } = await query.range(offset, offset + limit - 1);

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
      logger.error('Error getting client report:', error);
      throw error;
    }
  }

  async exportData({ type = 'csv', centreId, status, startDate, endDate, userCentres = [], userRole = 'super_admin' }) {
    try {
      const report = await this.getVoucherReport({
        centreId,
        status,
        startDate,
        endDate,
        page: 1,
        limit: 10000,
        userCentres,
        userRole
      });

      const rows = report.data;
      if (type.toLowerCase() === 'csv') {
        if (rows.length === 0) {
          return 'No data to export';
        }
        const headers = ['voucher_code', 'status', 'issue_date', 'household_size', 'collection_method', 'is_repeat_voucher', 'client_name', 'centre', 'issued_by', 'income_source'];
        const escapeCsv = val => {
          const str = String(val ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const lines = [
          headers.join(','),
          ...rows.map(r => headers.map(h => {
            if (h === 'client_name') return escapeCsv(r.client ? `${r.client.first_name} ${r.client.last_name}` : '');
            if (h === 'centre') return escapeCsv(r.centre?.name);
            if (h === 'issued_by') return escapeCsv(r.issued_by ? `${r.issued_by.first_name} ${r.issued_by.last_name}` : '');
            if (h === 'income_source') return escapeCsv(r.income_source?.name);
            return escapeCsv(r[h]);
          }).join(','))
        ];
        return lines.join('\n');
      }

      return JSON.stringify(rows);
    } catch (error) {
      logger.error('Error exporting data:', error);
      throw error;
    }
  }
}
