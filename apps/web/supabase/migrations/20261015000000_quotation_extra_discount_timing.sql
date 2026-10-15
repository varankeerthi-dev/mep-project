-- Quotation: persist whether extra discount applies before or after GST.
ALTER TABLE public.quotation_header
  ADD COLUMN IF NOT EXISTS extra_discount_timing text NOT NULL DEFAULT 'after_gst';

ALTER TABLE public.quotation_header
  ADD CONSTRAINT quotation_header_extra_discount_timing_check
  CHECK (extra_discount_timing IN ('before_gst', 'after_gst'));
