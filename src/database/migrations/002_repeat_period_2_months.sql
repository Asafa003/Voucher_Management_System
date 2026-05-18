-- Migration: Set repeat voucher period baseline to 2 months
-- Run in Supabase SQL Editor
-- Note: App passes period from .env; DB default used for direct SQL. 

-- 1. Update check_repeat_voucher function default
CREATE OR REPLACE FUNCTION check_repeat_voucher(p_client_id UUID, p_months INTEGER DEFAULT 2)
RETURNS TABLE(
  voucher_count INTEGER,
  is_repeat BOOLEAN,
  last_vouchers JSONB
) AS $$
DECLARE
  v_count INTEGER;
  v_vouchers JSONB;
BEGIN
  SELECT COUNT(*), JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', v.id,
      'voucher_code', v.voucher_code,
      'issue_date', v.issue_date,
      'centre_id', v.centre_id
    )
  )
  INTO v_count, v_vouchers
  FROM vouchers v
  WHERE v.client_id = p_client_id
    AND v.issue_date >= NOW() - (p_months || ' months')::INTERVAL
    AND v.status != 'cancelled';
  
  RETURN QUERY SELECT 
    v_count,
    v_count >= 3,
    COALESCE(v_vouchers, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- 2. Update client_voucher_history view
CREATE OR REPLACE VIEW client_voucher_history AS
SELECT 
  c.id AS client_id,
  c.first_name,
  c.last_name,
  c.postcode,
  COUNT(v.id) AS total_vouchers,
  MAX(v.issue_date) AS last_voucher_date,
  COUNT(CASE WHEN v.issue_date >= NOW() - INTERVAL '2 months' THEN 1 END) AS vouchers_last_2_months,
  COUNT(CASE WHEN v.is_repeat_voucher THEN 1 END) AS repeat_vouchers
FROM clients c
LEFT JOIN vouchers v ON v.client_id = c.id AND v.status != 'cancelled'
GROUP BY c.id, c.first_name, c.last_name, c.postcode;
