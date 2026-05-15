-- Migration 010: Add cheque_no and utr_no to receipts table

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS cheque_no TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS utr_no TEXT;

COMMENT ON COLUMN receipts.cheque_no IS 'Cheque number for bank/cheque payments';
COMMENT ON COLUMN receipts.utr_no IS 'UTR / bank reference number for online transfers';
