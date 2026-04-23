-- =============================================
-- City of God Foodbank - Database Schema
-- Supabase PostgreSQL Implementation
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE user_role AS ENUM ('super_admin', 'centre_admin', 'staff', 'read_only');
CREATE TYPE voucher_status AS ENUM ('issued', 'fulfilled', 'cancelled');
CREATE TYPE collection_method AS ENUM ('collection', 'delivery');
CREATE TYPE audit_action AS ENUM (
  'login', 'logout', 
  'client_created', 'client_updated', 'client_deleted',
  'voucher_created', 'voucher_updated', 'voucher_cancelled',
  'consent_captured', 'consent_revoked',
  'data_exported', 'user_role_changed', 'user_created', 'user_deleted',
  'centre_created', 'centre_updated', 'centre_deleted'
);

-- ... rest of tables ...

-- GDPR Compliance: Trigger to nullify data when consent is revoked
CREATE OR REPLACE FUNCTION handle_consent_revocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle contact consent revocation
  IF OLD.contact_consent = true AND NEW.contact_consent = false THEN
    NEW.phone := NULL;
    NEW.email := NULL;
  END IF;

  -- Handle dietary consent revocation
  IF OLD.dietary_consent = true AND NEW.dietary_consent = false THEN
    NEW.dietary_requirements := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_consent_revocation
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION handle_consent_revocation();


-- =============================================
-- CORE TABLES
-- =============================================

-- Centres Table
CREATE TABLE centres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  postcode VARCHAR(10) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  opening_times JSONB, -- Store as JSON: {"monday": "9am-5pm", ...}
  delivery_available BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users Table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Centre Assignments (Many-to-Many: Users <-> Centres)
CREATE TABLE centre_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, centre_id)
);

-- Clients Table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  address TEXT,
  postcode VARCHAR(10) NOT NULL,
  year_of_birth INTEGER,
  phone VARCHAR(20),
  email VARCHAR(255),
  contact_consent BOOLEAN DEFAULT false,
  dietary_consent BOOLEAN DEFAULT false,
  dietary_requirements TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for searching
  CONSTRAINT chk_year_of_birth CHECK (year_of_birth IS NULL OR (year_of_birth >= 1900 AND year_of_birth <= EXTRACT(YEAR FROM CURRENT_DATE)))
);

-- Create indexes for client search
CREATE INDEX idx_clients_name ON clients(last_name, first_name);
CREATE INDEX idx_clients_postcode ON clients(postcode);
CREATE INDEX idx_clients_created_at ON clients(created_at DESC);

-- Income Sources Reference Table
CREATE TABLE income_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral Reasons Reference Table
CREATE TABLE referral_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repeat Voucher Reasons Reference Table
CREATE TABLE repeat_voucher_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vouchers Table
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_code VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  centre_id UUID NOT NULL REFERENCES centres(id) ON DELETE RESTRICT,
  issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Voucher details
  status voucher_status DEFAULT 'issued',
  issue_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  household_size INTEGER DEFAULT 1,
  
  -- Referral information
  income_source_id UUID REFERENCES income_sources(id),
  
  -- Collection details
  collection_method collection_method NOT NULL DEFAULT 'collection',
  
  -- Repeat voucher handling
  is_repeat_voucher BOOLEAN DEFAULT false,
  repeat_voucher_reason_id UUID REFERENCES repeat_voucher_reasons(id),
  repeat_voucher_notes TEXT,
  repeat_voucher_consent BOOLEAN DEFAULT false,
  
  -- General notes
  notes TEXT,
  
  -- Fulfillment tracking
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES users(id),
  
  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_household_size CHECK (household_size > 0),
  CONSTRAINT chk_repeat_voucher CHECK (
    (is_repeat_voucher = false) OR 
    (is_repeat_voucher = true AND repeat_voucher_reason_id IS NOT NULL AND repeat_voucher_consent = true)
  )
);

-- Voucher Referral Reasons (Many-to-Many, max 4)
CREATE TABLE voucher_referral_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  referral_reason_id UUID NOT NULL REFERENCES referral_reasons(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voucher_id, referral_reason_id)
);

-- Indexes for vouchers
CREATE INDEX idx_vouchers_client ON vouchers(client_id);
CREATE INDEX idx_vouchers_centre ON vouchers(centre_id);
CREATE INDEX idx_vouchers_issue_date ON vouchers(issue_date DESC);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_code ON vouchers(voucher_code);

-- Audit Log Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action audit_action NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  centre_id UUID REFERENCES centres(id) ON DELETE SET NULL,
  
  -- Resource tracking
  resource_type VARCHAR(50), -- e.g., 'client', 'voucher', 'user'
  resource_id UUID,
  
  -- Details
  details JSONB, -- Store additional context as JSON
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_centres_updated_at BEFORE UPDATE ON centres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate voucher code
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := COALESCE(current_setting('app.voucher_prefix', true), 'COG');
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code: PREFIX-YYYYMMDD-XXXX (e.g., COG-20260203-A1B2)
    code := prefix || '-' || 
            TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM vouchers WHERE voucher_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate voucher code
CREATE OR REPLACE FUNCTION set_voucher_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.voucher_code IS NULL OR NEW.voucher_code = '' THEN
    NEW.voucher_code := generate_voucher_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_voucher_code BEFORE INSERT ON vouchers
  FOR EACH ROW EXECUTE FUNCTION set_voucher_code();

-- Function to check repeat voucher count
CREATE OR REPLACE FUNCTION check_repeat_voucher(p_client_id UUID, p_months INTEGER DEFAULT 6)
RETURNS TABLE(
  voucher_count INTEGER,
  is_repeat BOOLEAN,
  last_vouchers JSONB
) AS $$
DECLARE
  v_count INTEGER;
  v_vouchers JSONB;
BEGIN
  -- Count vouchers in the specified period
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

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE centre_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user has access to centre
CREATE OR REPLACE FUNCTION user_has_centre_access(user_uuid UUID, centre_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM centre_assignments 
    WHERE user_id = user_uuid AND centre_id = centre_uuid
  ) OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_uuid AND role IN ('super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies for centres
CREATE POLICY "Users can view centres they're assigned to"
  ON centres FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM centre_assignments ca
      WHERE ca.centre_id = centres.id AND ca.user_id = auth.uid()
    ) OR
    get_user_role(auth.uid()) = 'super_admin'
  );

CREATE POLICY "Only super admins can modify centres"
  ON centres FOR ALL
  USING (get_user_role(auth.uid()) = 'super_admin');

-- RLS Policies for users
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid() OR get_user_role(auth.uid()) IN ('super_admin', 'centre_admin'));

CREATE POLICY "Only admins can modify users"
  ON users FOR ALL
  USING (get_user_role(auth.uid()) IN ('super_admin', 'centre_admin'));

-- RLS Policies for clients
CREATE POLICY "Users can view clients from their centres"
  ON clients FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM vouchers v
      JOIN centre_assignments ca ON ca.centre_id = v.centre_id
      WHERE v.client_id = clients.id AND ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create clients"
  ON clients FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'centre_admin', 'staff'));

CREATE POLICY "Staff can update clients"
  ON clients FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('super_admin', 'centre_admin', 'staff'));

-- RLS Policies for vouchers
CREATE POLICY "Users can view vouchers from their centres"
  ON vouchers FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'super_admin' OR
    user_has_centre_access(auth.uid(), centre_id)
  );

CREATE POLICY "Staff can create vouchers for their centres"
  ON vouchers FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('super_admin', 'centre_admin', 'staff') AND
    (get_user_role(auth.uid()) = 'super_admin' OR user_has_centre_access(auth.uid(), centre_id))
  );

CREATE POLICY "Staff can update vouchers from their centres"
  ON vouchers FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('super_admin', 'centre_admin', 'staff') AND
    (get_user_role(auth.uid()) = 'super_admin' OR user_has_centre_access(auth.uid(), centre_id))
  );

-- RLS Policies for audit logs
CREATE POLICY "Users can view audit logs from their centres"
  ON audit_logs FOR SELECT
  USING (
    get_user_role(auth.uid()) IN ('super_admin', 'centre_admin') OR
    user_id = auth.uid()
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- SEED DATA (Reference Tables)
-- =============================================

-- Income Sources
INSERT INTO income_sources (name) VALUES
  ('Universal Credit'),
  ('Job Seekers Allowance'),
  ('Employment and Support Allowance'),
  ('Income Support'),
  ('Pension Credit'),
  ('Child Tax Credit'),
  ('Working Tax Credit'),
  ('No Income'),
  ('Low Income'),
  ('Other');

-- Referral Reasons
INSERT INTO referral_reasons (name) VALUES
  ('Low Income'),
  ('Benefit Delays'),
  ('Debt'),
  ('Homeless'),
  ('Domestic Abuse'),
  ('Sickness/Disability'),
  ('Refugee/Asylum Seeker'),
  ('Unemployment'),
  ('Family Crisis'),
  ('Other');

-- Repeat Voucher Reasons
INSERT INTO repeat_voucher_reasons (name) VALUES
  ('Ongoing Financial Hardship'),
  ('Benefit Delays Continue'),
  ('Medical Emergency'),
  ('Family Emergency'),
  ('Homelessness'),
  ('Domestic Abuse Situation'),
  ('Awaiting Support Services'),
  ('Other Exceptional Circumstances');

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- View: Voucher Statistics by Centre
CREATE OR REPLACE VIEW voucher_stats_by_centre AS
SELECT 
  c.id AS centre_id,
  c.name AS centre_name,
  COUNT(v.id) AS total_vouchers,
  COUNT(DISTINCT v.client_id) AS unique_clients,
  COUNT(CASE WHEN v.status = 'issued' THEN 1 END) AS issued_count,
  COUNT(CASE WHEN v.status = 'fulfilled' THEN 1 END) AS fulfilled_count,
  COUNT(CASE WHEN v.is_repeat_voucher THEN 1 END) AS repeat_voucher_count,
  COUNT(CASE WHEN v.collection_method = 'delivery' THEN 1 END) AS delivery_count,
  COUNT(CASE WHEN v.collection_method = 'collection' THEN 1 END) AS collection_count
FROM centres c
LEFT JOIN vouchers v ON v.centre_id = c.id
GROUP BY c.id, c.name;

-- View: Client Voucher History
CREATE OR REPLACE VIEW client_voucher_history AS
SELECT 
  c.id AS client_id,
  c.first_name,
  c.last_name,
  c.postcode,
  COUNT(v.id) AS total_vouchers,
  MAX(v.issue_date) AS last_voucher_date,
  COUNT(CASE WHEN v.issue_date >= NOW() - INTERVAL '6 months' THEN 1 END) AS vouchers_last_6_months,
  COUNT(CASE WHEN v.is_repeat_voucher THEN 1 END) AS repeat_vouchers
FROM clients c
LEFT JOIN vouchers v ON v.client_id = c.id AND v.status != 'cancelled'
GROUP BY c.id, c.first_name, c.last_name, c.postcode;
