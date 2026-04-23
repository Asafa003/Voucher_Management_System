-- Migration: Allow staff to view clients they created (before any voucher exists)
-- Fixes RLS gap where new clients weren't visible to their creator
-- Run this in Supabase SQL Editor after initial schema

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view clients from their centres" ON clients;

-- Recreate with additional condition: staff can see clients they created
CREATE POLICY "Users can view clients from their centres"
  ON clients FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'super_admin'
    OR
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM vouchers v
      JOIN centre_assignments ca ON ca.centre_id = v.centre_id
      WHERE v.client_id = clients.id AND ca.user_id = auth.uid()
    )
  );
