# Database Setup Guide

## Overview

This system uses Supabase (PostgreSQL) with comprehensive Row Level Security (RLS) policies to ensure data isolation and security.

## Schema Structure

### Core Tables

1. **centres** - Foodbank centre locations
2. **users** - System users (extends Supabase auth.users)
3. **centre_assignments** - Links users to centres
4. **clients** - Foodbank clients
5. **vouchers** - Issued vouchers
6. **audit_logs** - Complete audit trail

### Reference Tables

- **income_sources** - Income types
- **referral_reasons** - Reasons for referral
- **repeat_voucher_reasons** - Reasons for repeat vouchers

### Junction Tables

- **voucher_referral_reasons** - Many-to-many between vouchers and referral reasons

## Initial Setup

### Step 1: Run the Schema

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the entire contents of `schema.sql`
4. Execute the SQL

This creates:
- All tables with proper relationships
- Indexes for performance
- RLS policies for security
- Triggers for automation
- Views for reporting
- Seed data for reference tables

### Step 2: Create First Admin User

After running the schema, create your first admin:

```sql
-- First, create the auth user in Supabase Auth UI
-- Then insert the profile:
INSERT INTO users (id, email, first_name, last_name, role, is_active)
VALUES (
  'AUTH_USER_UUID_HERE', 3682a487-a162-4f8d-a2c0-149154ae05ce
  'admin@cityofgodfoodbank.org',
  'Admin',
  'User',
  'super_admin',
  true
);
```

### Step 3: Create Centre

```sql
INSERT INTO centres (name, address, postcode, phone, email, opening_times, delivery_available)
VALUES (
  'Main Centre',
  '123 Main Street, City',
  'AB12 3CD',
  '+44 1234 567890',
  'main@foodbank.org',
  '{
    "monday": "9:00 AM - 5:00 PM",
    "tuesday": "9:00 AM - 5:00 PM",
    "wednesday": "9:00 AM - 5:00 PM",
    "thursday": "9:00 AM - 5:00 PM",
    "friday": "9:00 AM - 5:00 PM",
    "saturday": "Closed",
    "sunday": "Closed"
  }'::jsonb,
  true
);
```

### Step 4: Assign User to Centre

```sql
INSERT INTO centre_assignments (user_id, centre_id)
VALUES (
  'ADMIN_USER_UUID',
  (SELECT id FROM centres WHERE name = 'Main Centre')
);
```

## Key Features

### Automatic Voucher Code Generation

Voucher codes are automatically generated in the format: `PREFIX-YYYYMMDD-XXXX`

Example: `COG-20260203-A1B2`

### Repeat Voucher Check Function

Check if a client has received multiple vouchers (configurable period; default 2 months):

```sql
SELECT * FROM check_repeat_voucher('CLIENT_UUID_HERE', 2);
```

Returns:
- `voucher_count`: Number of vouchers in period
- `is_repeat`: Boolean (true if ≥3)
- `last_vouchers`: JSON array of recent vouchers

### Audit Logging

All sensitive operations are automatically logged to `audit_logs` table.

### Views for Reporting

Two views are available:
- `voucher_stats_by_centre` - Statistics per centre
- `client_voucher_history` - Voucher history per client

## Row Level Security (RLS)

All tables have RLS enabled with policies that:

1. **Centre-based isolation**: Users only see data from their assigned centres
2. **Role-based access**: Different permissions for each role
3. **Secure by default**: No data visible without explicit policy

### RLS Roles

- **super_admin**: Full access to all data
- **centre_admin**: Full access within assigned centres
- **staff**: Create and update within assigned centres
- **read_only**: View only within assigned centres

## Maintenance Tasks

### Backup Recommendations

Regular backups are handled by Supabase, but you should also:
- Export critical data weekly
- Keep audit logs for 7+ years (compliance)

### Monitoring Queries

**Check active users:**
```sql
SELECT COUNT(*) FROM users WHERE is_active = true;
```

**Vouchers issued today:**
```sql
SELECT COUNT(*) FROM vouchers WHERE issue_date::date = CURRENT_DATE;
```

**Repeat vouchers this month:**
```sql
SELECT COUNT(*) FROM vouchers 
WHERE is_repeat_voucher = true 
AND issue_date >= date_trunc('month', CURRENT_DATE);
```

## Troubleshooting

### Users Can't See Data

1. Check user has record in `users` table
2. Verify `centre_assignments` exists
3. Check user role is correct
4. Test RLS policies:
   ```sql
   SET request.jwt.claim.sub = 'USER_UUID';
   SELECT * FROM clients;
   ```

### Voucher Code Generation Fails

Check the prefix setting:
```sql
SHOW app.voucher_prefix;
```

### Performance Issues

Run ANALYZE on tables:
```sql
ANALYZE clients;
ANALYZE vouchers;
ANALYZE audit_logs;
```

## Schema Modifications

When updating the schema:

1. Test changes in development first
2. Use migrations for version control
3. Update this documentation
4. Communicate changes to team

## Security Notes

- Never disable RLS on production tables
- Always use `supabaseAdmin` for service operations that need to bypass RLS
- Regularly review audit logs
- Rotate service role key periodically
