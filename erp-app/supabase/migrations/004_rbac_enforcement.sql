-- 004_rbac_enforcement.sql
-- This script updates the Row Level Security (RLS) policies on core business tables
-- to use the existing `has_permission(organisation_id, permission_key)` function.

-- Performance Indexes
CREATE INDEX IF NOT EXISTS org_members_user_org_status_idx ON public.org_members(user_id, organisation_id, status);
CREATE INDEX IF NOT EXISTS role_permissions_role_key_idx ON public.role_permissions(role_id, permission_key);

-- 1. Quotations
DROP POLICY IF EXISTS "quotation_header_select" ON public.quotation_header;
CREATE POLICY "quotation_header_select" ON public.quotation_header
  FOR SELECT USING (public.has_permission(organisation_id, 'quotations.read'));

DROP POLICY IF EXISTS "quotation_header_insert" ON public.quotation_header;
CREATE POLICY "quotation_header_insert" ON public.quotation_header
  FOR INSERT WITH CHECK (public.has_permission(organisation_id, 'quotations.create'));

DROP POLICY IF EXISTS "quotation_header_update" ON public.quotation_header;
CREATE POLICY "quotation_header_update" ON public.quotation_header
  FOR UPDATE USING (public.has_permission(organisation_id, 'quotations.update'));

DROP POLICY IF EXISTS "quotation_header_delete" ON public.quotation_header;
CREATE POLICY "quotation_header_delete" ON public.quotation_header
  FOR DELETE USING (public.has_permission(organisation_id, 'quotations.delete'));

-- 2. Materials
DROP POLICY IF EXISTS "materials_select" ON public.materials;
CREATE POLICY "materials_select" ON public.materials
  FOR SELECT USING (public.has_permission(organisation_id, 'materials.read'));

DROP POLICY IF EXISTS "materials_insert" ON public.materials;
CREATE POLICY "materials_insert" ON public.materials
  FOR INSERT WITH CHECK (public.has_permission(organisation_id, 'materials.create'));

DROP POLICY IF EXISTS "materials_update" ON public.materials;
CREATE POLICY "materials_update" ON public.materials
  FOR UPDATE USING (public.has_permission(organisation_id, 'materials.update'));

DROP POLICY IF EXISTS "materials_delete" ON public.materials;
CREATE POLICY "materials_delete" ON public.materials
  FOR DELETE USING (public.has_permission(organisation_id, 'materials.delete'));

-- 3. Invoices
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT USING (public.has_permission(organisation_id, 'invoices.read'));

DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT WITH CHECK (public.has_permission(organisation_id, 'invoices.create'));

DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE USING (public.has_permission(organisation_id, 'invoices.update'));

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE USING (public.has_permission(organisation_id, 'invoices.delete'));

-- 4. Delivery Challans
DROP POLICY IF EXISTS "delivery_challans_select" ON public.delivery_challans;
CREATE POLICY "delivery_challans_select" ON public.delivery_challans
  FOR SELECT USING (public.has_permission(organisation_id, 'delivery_challans.read'));

DROP POLICY IF EXISTS "delivery_challans_insert" ON public.delivery_challans;
CREATE POLICY "delivery_challans_insert" ON public.delivery_challans
  FOR INSERT WITH CHECK (public.has_permission(organisation_id, 'delivery_challans.create'));

DROP POLICY IF EXISTS "delivery_challans_update" ON public.delivery_challans;
CREATE POLICY "delivery_challans_update" ON public.delivery_challans
  FOR UPDATE USING (public.has_permission(organisation_id, 'delivery_challans.update'));

DROP POLICY IF EXISTS "delivery_challans_delete" ON public.delivery_challans;
CREATE POLICY "delivery_challans_delete" ON public.delivery_challans
  FOR DELETE USING (public.has_permission(organisation_id, 'delivery_challans.delete'));
