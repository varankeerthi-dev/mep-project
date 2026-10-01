/**
 * Vendor delivery/shipping addresses for the V2 purchase order.
 *
 * The CreateQuotation equivalent is client_shipping_addresses +
 * AddShippingAddressModal + the Shipping field in QuotationHeaderForm
 * (lines 319-382). Purchase had no such table, so this module is backed by
 * `vendor_shipping_addresses` (migration 20260929000005, not yet applied).
 *
 * Every read/write here is tolerant: if the table does not exist yet the
 * hooks resolve to an empty list / throw a friendly error instead of breaking
 * the editor. Selecting a saved address fills the PO's delivery_location
 * text; the text stays editable per PO.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase';

export interface VendorShippingAddress {
  id: string;
  vendor_id: string;
  organisation_id: string;
  address_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  contact: string | null;
  is_default: boolean | null;
}

/** One-line label for the selector, e.g. "Main godown (Default)" or "Line 1…". */
export function addressShortLabel(a: VendorShippingAddress): string {
  const base = a.address_name || `${(a.address_line1 || '').substring(0, 24)}…`;
  return a.is_default ? `${base} (Default)` : base;
}

/** Multi-line block written into the PO's delivery_location on selection. */
export function formatVendorAddressBlock(a: VendorShippingAddress): string {
  const lines = [
    a.address_line1,
    a.address_line2 || '',
    [a.city, a.state, a.pincode].filter(Boolean).join(', '),
    a.country && a.country !== 'India' ? a.country : '',
    a.contact ? `Contact: ${a.contact}` : '',
  ].filter((l) => l && l.trim().length > 0);
  return lines.join('\n');
}

/**
 * Saved delivery addresses for one vendor. Resolves to [] when the table is
 * absent (migration pending) so the editor keeps working.
 */
export function useVendorShippingAddresses(
  orgId: string | null | undefined,
  vendorId: string | null | undefined,
) {
  const [addresses, setAddresses] = useState<VendorShippingAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    if (!orgId || !vendorId) { setAddresses([]); setTableMissing(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_shipping_addresses')
          .select('*')
          .eq('organisation_id', orgId)
          .eq('vendor_id', vendorId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setAddresses((data || []) as VendorShippingAddress[]);
          setTableMissing(false);
        }
      } catch (e: any) {
        // 42P01 = table does not exist yet. Anything else is a real failure.
        const missing = String(e?.message || '').includes('vendor_shipping_addresses')
          && (String(e?.code || '') === '42P01' || String(e?.message || '').includes('does not exist'));
        if (!cancelled) {
          setAddresses([]);
          setTableMissing(missing);
          if (!missing) console.error('[poVendor] addresses:', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, vendorId]);

  return { addresses, loading, tableMissing, setAddresses };
}
