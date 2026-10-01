-- ---------------------------------------------------------------------------
-- Purchase V2 — vendor delivery/shipping addresses.
--
-- CreateQuotation has a client shipping-address module
-- (client_shipping_addresses + AddShippingAddressModal + the Shipping field in
-- QuotationHeaderForm). Purchase orders had no equivalent: the Vendor card
-- showed a name and the delivery location was one free-text field, so every PO
-- re-typed the site address and nothing was reusable.
--
-- This creates the vendor-side equivalent. A saved address fills the PO's
-- delivery_location text on selection; the text remains editable per PO, so a
-- one-off site never needs a saved row.
--
-- NOT APPLIED YET — same status as 20260929000004. The V2 editor reads this
-- table through a tolerant query: present -> selector works; absent -> the
-- delivery field stays free-text and the Add button explains the migration is
-- pending instead of failing.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_shipping_addresses (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id       uuid        NOT NULL REFERENCES public.purchase_vendors(id) ON DELETE CASCADE,
  organisation_id uuid        NOT NULL,
  address_name    text,
  address_line1   text        NOT NULL,
  address_line2   text,
  city            text        NOT NULL,
  state           text        NOT NULL,
  pincode         text        NOT NULL,
  country         text        NOT NULL DEFAULT 'India',
  contact         text,
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_shipping_addresses_vendor_idx
  ON public.vendor_shipping_addresses (organisation_id, vendor_id);

ALTER TABLE public.vendor_shipping_addresses ENABLE ROW LEVEL SECURITY;

-- Tenant isolation, mirroring the materials policy convention
-- (user_can_access_org(organisation_id)).
DROP POLICY IF EXISTS vendor_shipping_addresses_select ON public.vendor_shipping_addresses;
CREATE POLICY vendor_shipping_addresses_select ON public.vendor_shipping_addresses
  FOR SELECT USING (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS vendor_shipping_addresses_insert ON public.vendor_shipping_addresses;
CREATE POLICY vendor_shipping_addresses_insert ON public.vendor_shipping_addresses
  FOR INSERT WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS vendor_shipping_addresses_update ON public.vendor_shipping_addresses;
CREATE POLICY vendor_shipping_addresses_update ON public.vendor_shipping_addresses
  FOR UPDATE USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS vendor_shipping_addresses_delete ON public.vendor_shipping_addresses;
CREATE POLICY vendor_shipping_addresses_delete ON public.vendor_shipping_addresses
  FOR DELETE USING (public.user_can_access_org(organisation_id));
