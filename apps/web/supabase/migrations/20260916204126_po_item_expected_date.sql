-- PO item expected-date tracking + procurement link (item ETA truth lives on PO lines)
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE NULL;

ALTER TABLE public.procurement_items
  ADD COLUMN IF NOT EXISTS expected_date DATE NULL;

ALTER TABLE public.procurement_items
  ADD COLUMN IF NOT EXISTS po_id UUID NULL REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE public.procurement_items
  ADD COLUMN IF NOT EXISTS po_item_id UUID NULL REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_expected_date
  ON public.purchase_order_items(po_id, expected_delivery_date);

CREATE INDEX IF NOT EXISTS idx_procurement_items_po_id
  ON public.procurement_items(po_id);
