-- Purchase Module - Complete Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PURCHASE VENDORS (Suppliers)
CREATE TABLE IF NOT EXISTS purchase_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_code VARCHAR(20) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  gstin VARCHAR(50),
  pan VARCHAR(20),
  address TEXT,
  state VARCHAR(100),
  pincode VARCHAR(10),
  default_currency VARCHAR(10) DEFAULT 'INR',
  payment_terms VARCHAR(50) DEFAULT 'Net 30',
  credit_limit DECIMAL(15,2) DEFAULT 0,
  opening_balance DECIMAL(15,2) DEFAULT 0,
  bank_account_no VARCHAR(100),
  bank_ifsc VARCHAR(20),
  bank_name VARCHAR(100),
  bank_branch VARCHAR(100),
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_vendors FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_purchase_vendors_org ON purchase_vendors(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_vendors_status ON purchase_vendors(status);

-- 2. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE RESTRICT,
  po_date DATE NOT NULL,
  delivery_date DATE,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  exchange_rate_date DATE,
  delivery_location TEXT,
  project_id UUID,
  reference_no VARCHAR(100),
  terms_conditions TEXT,
  internal_notes TEXT,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_amount_inr DECIMAL(15,2) DEFAULT 0,
  approval_status VARCHAR(30) DEFAULT 'Draft',
  -- Draft → Pending Approval → Approved → Sent → Acknowledged → Partially Received → Completed/Cancelled
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_date DATE,
  acknowledged_date DATE,
  email_sent BOOLEAN DEFAULT false,
  email_sent_to VARCHAR(255),
  email_sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) DEFAULT 'Draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(po_date);

-- 3. PURCHASE ORDER ITEMS
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID,
  item_code VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  hsn_code VARCHAR(20),
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(20) DEFAULT 'Nos',
  rate DECIMAL(15,4) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_value DECIMAL(15,2) DEFAULT 0,
  cgst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_percent DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_percent DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_amount_inr DECIMAL(15,2) DEFAULT 0,
  received_qty DECIMAL(12,3) DEFAULT 0,
  balance_qty DECIMAL(12,3) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_po_items_org ON purchase_order_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- 4. PURCHASE BILLS (Invoices)
CREATE TABLE IF NOT EXISTS purchase_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bill_number VARCHAR(50) NOT NULL,
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE RESTRICT,
  vendor_invoice_no VARCHAR(50),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  bill_date DATE NOT NULL,
  due_date DATE,
  received_date DATE,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  exchange_rate_date DATE,
  warehouse_id UUID,
  project_site_id UUID,
  direct_supply_to_site BOOLEAN DEFAULT false,
  site_address TEXT,
  site_contact_person VARCHAR(100),
  site_contact_phone VARCHAR(50),
  eway_bill_no VARCHAR(50),
  vehicle_no VARCHAR(20),
  transporter_name VARCHAR(100),
  freight_amount DECIMAL(15,2) DEFAULT 0,
  insurance_amount DECIMAL(15,2) DEFAULT 0,
  other_charges DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_amount_inr DECIMAL(15,2) DEFAULT 0,
  tds_percent DECIMAL(5,2) DEFAULT 0,
  tds_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) DEFAULT 0,
  reverse_charge BOOLEAN DEFAULT false,
  approval_status VARCHAR(30) DEFAULT 'Pending',
  -- Pending → Verified → Approved → Posted → Paid/Partially Paid
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  posted_by UUID,
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_to_inventory BOOLEAN DEFAULT false,
  payment_status VARCHAR(30) DEFAULT 'Unpaid',
  paid_amount DECIMAL(15,2) DEFAULT 0,
  balance_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  internal_remarks TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_bills FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_org ON purchase_bills(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_vendor ON purchase_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_po ON purchase_bills(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_status ON purchase_bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON purchase_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_due ON purchase_bills(due_date);

-- 5. PURCHASE BILL ITEMS
CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  item_id UUID,
  item_code VARCHAR(50),
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  hsn_code VARCHAR(20),
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(20) DEFAULT 'Nos',
  rate DECIMAL(15,4) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_value DECIMAL(15,2) DEFAULT 0,
  cgst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_percent DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_percent DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_amount_inr DECIMAL(15,2) DEFAULT 0,
  batch_no VARCHAR(50),
  expiry_date DATE,
  mfg_date DATE,
  warehouse_id UUID,
  godown_location VARCHAR(100),
  stock_updated BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_bill_items_org ON purchase_bill_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON purchase_bill_items(bill_id);

-- 6. DEBIT NOTES
CREATE TABLE IF NOT EXISTS debit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  dn_number VARCHAR(50) UNIQUE NOT NULL,
  bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE RESTRICT,
  dn_date DATE NOT NULL,
  dn_type VARCHAR(30) NOT NULL, -- Purchase Return, Rate Difference, Discount, Rejection
  reference_no VARCHAR(50),
  reason TEXT NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  subtotal DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_amount_inr DECIMAL(15,2) DEFAULT 0,
  stock_reversed BOOLEAN DEFAULT false,
  approval_status VARCHAR(30) DEFAULT 'Draft',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON debit_notes FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_debit_notes_org ON debit_notes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_bill ON debit_notes(bill_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_vendor ON debit_notes(vendor_id);

-- 7. DEBIT NOTE ITEMS
CREATE TABLE IF NOT EXISTS debit_note_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  dn_id UUID NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
  bill_item_id UUID REFERENCES purchase_bill_items(id) ON DELETE RESTRICT,
  item_id UUID,
  item_name VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(20),
  original_qty DECIMAL(12,3),
  return_qty DECIMAL(12,3) NOT NULL,
  unit VARCHAR(20),
  rate DECIMAL(15,4) NOT NULL,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_value DECIMAL(15,2) DEFAULT 0,
  cgst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_percent DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_percent DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  reason TEXT,
  stock_reversed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE debit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON debit_note_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_dn_items_org ON debit_note_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_dn_items_dn ON debit_note_items(dn_id);

-- 8. PURCHASE PAYMENTS
CREATE TABLE IF NOT EXISTS purchase_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  voucher_no VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(30) NOT NULL, -- Cash, Bank Transfer, Cheque, UPI, Card
  bank_account_id UUID,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  tds_deducted DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  reference_no VARCHAR(100),
  cheque_no VARCHAR(50),
  cheque_date DATE,
  bank_name VARCHAR(100),
  narration TEXT,
  is_advance BOOLEAN DEFAULT false,
  advance_adjusted BOOLEAN DEFAULT false,
  advance_remaining DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Completed',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_payments FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_org ON purchase_payments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_vendor ON purchase_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_date ON purchase_payments(payment_date);

-- 9. PAYMENT BILL LINKS (Many-to-Many)
CREATE TABLE IF NOT EXISTS purchase_payment_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES purchase_payments(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  adjusted_amount DECIMAL(15,2) NOT NULL,
  tds_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_payment_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_payment_bills FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_payment_bills_org ON purchase_payment_bills(organisation_id);
CREATE INDEX IF NOT EXISTS idx_payment_bills_payment ON purchase_payment_bills(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_bills_bill ON purchase_payment_bills(bill_id);

-- 10. PAYMENT REQUESTS (Approval Queue)
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  request_no VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE RESTRICT,
  request_date DATE NOT NULL,
  amount_requested DECIMAL(15,2) NOT NULL,
  priority VARCHAR(20) DEFAULT 'Normal', -- Low, Normal, High, Urgent
  due_date DATE,
  bill_ids UUID[], -- Array of bill IDs to be paid
  payment_mode VARCHAR(30),
  bank_account_id UUID,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'Pending', -- Pending, Approved, Rejected, Paid
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  converted_to_payment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON payment_requests FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_payment_requests_org ON payment_requests(organisation_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_vendor ON payment_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_due ON payment_requests(due_date);

-- Function to auto-generate vendor code
CREATE OR REPLACE FUNCTION generate_vendor_code(p_org_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_count INTEGER;
  v_code VARCHAR(20);
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM purchase_vendors WHERE organisation_id = p_org_id;
  v_code := 'VEN-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate PO number
CREATE OR REPLACE FUNCTION generate_po_number(p_org_id UUID, p_year INTEGER)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_count INTEGER;
  v_number VARCHAR(50);
BEGIN
  SELECT COUNT(*) + 1 INTO v_count 
  FROM purchase_orders 
  WHERE organisation_id = p_org_id 
  AND EXTRACT(YEAR FROM po_date) = p_year;
  v_number := 'PO-' || p_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update vendor balance
CREATE OR REPLACE FUNCTION update_vendor_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be called after bill/debit note/payment changes
  -- Implementation depends on your specific requirements
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;