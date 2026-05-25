-- Update po_line_items to support drag and drop, sections, subtotals, and advanced discount logic
ALTER TABLE public.po_line_items
ADD COLUMN IF NOT EXISTS is_header boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_subtotal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS subtotal_label text,
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS variant_id uuid,
ADD COLUMN IF NOT EXISTS make text,
ADD COLUMN IF NOT EXISTS original_discount_percent numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS override_flag boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS base_rate_snapshot numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS applied_discount_percent numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS final_rate_snapshot numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom1 text,
ADD COLUMN IF NOT EXISTS custom2 text;

-- Update client_purchase_orders header to support PO level discounts and totals
ALTER TABLE public.client_purchase_orders
ADD COLUMN IF NOT EXISTS total_item_discount numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_discount_percent numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_discount_amount numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tax numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS round_off numeric(15,2) DEFAULT 0;

-- Optional: Create a table for vendor/PO variant-level discounts similar to quotation_revision_variant_discount
CREATE TABLE IF NOT EXISTS public.po_variant_discounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id uuid REFERENCES public.client_purchase_orders(id) ON DELETE CASCADE,
    variant_id uuid,
    header_discount_percent numeric(5,2) DEFAULT 0,
    organisation_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(po_id, variant_id)
);

-- Table to store default discounts per vendor (Enterprise MVP practical feature)
CREATE TABLE IF NOT EXISTS public.vendor_discounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    variant_id uuid,
    default_discount_percent numeric(5,2) DEFAULT 0,
    organisation_id uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(vendor_id, variant_id)
);

-- Enterprise Auto-Learning Vendor Catalog
CREATE TABLE IF NOT EXISTS public.vendor_material_pricing (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    material_id uuid,
    variant_id uuid,
    make text,
    vendor_item_code text,
    base_rate numeric(15,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    is_preferred boolean DEFAULT false,
    organisation_id uuid,
    created_by uuid,
    updated_by uuid,
    last_purchased_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(vendor_id, material_id, variant_id, make)
);

-- PO Activity Log for Audit Trails
CREATE TABLE IF NOT EXISTS public.po_activity_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id uuid REFERENCES public.client_purchase_orders(id) ON DELETE CASCADE,
    user_id uuid,
    organisation_id uuid,
    action text NOT NULL, -- e.g., 'CREATED', 'UPDATED', 'STATUS_CHANGED', 'ITEM_ADDED'
    description text,
    details jsonb, -- Storing old/new values
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add created_by, updated_by to client_purchase_orders if not exists
ALTER TABLE public.client_purchase_orders
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS updated_by uuid;
