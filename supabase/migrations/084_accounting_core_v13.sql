-- Migration: 084_accounting_core_v13.sql
-- Description: Core Accounting Ledger, PDC, Dual Depreciation, and MCA Audit Trail

-- 1. ENUMS
CREATE TYPE account_root_type AS ENUM ('Asset', 'Liability', 'Income', 'Expense');
CREATE TYPE system_account_type AS ENUM ('AR_CONTROL', 'AP_CONTROL', 'SALES_ACCOUNT', 'CGST_OUTPUT', 'IGST_OUTPUT', 'SGST_OUTPUT', 'TDS_PAYABLE', 'TCS_PAYABLE', 'MANUFACTURING_VARIANCE', 'EXCHANGE_GAIN_LOSS', 'INTER_BRANCH_REC', 'INTER_BRANCH_PAY', 'CASH', 'BANK');
CREATE TYPE voucher_type AS ENUM ('Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Credit Note', 'Debit Note', 'Contra');
CREATE TYPE cheque_status AS ENUM ('Held', 'Presented', 'Cleared', 'Bounced', 'Cancelled');
CREATE TYPE msme_type_enum AS ENUM ('Micro', 'Small', 'Medium');

-- 2. ACCOUNTS (Chart of Accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    organisation_id UUID,
    branch_id UUID,
    account_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    root_type account_root_type NOT NULL,
    account_type VARCHAR(100),
    schedule_iii_line VARCHAR(255),
    tax_section VARCHAR(50),
    default_hsn_sac VARCHAR(50),
    parent_id UUID REFERENCES accounts(id),
    is_group BOOLEAN DEFAULT false,
    system_account system_account_type,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. JOURNAL ENTRIES & LINES
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    branch_id UUID,
    voucher_no VARCHAR(100) NOT NULL,
    voucher_date DATE NOT NULL,
    voucher_type voucher_type NOT NULL,
    narration TEXT,
    currency_code VARCHAR(3) DEFAULT 'INR',
    exchange_rate NUMERIC(15, 6) DEFAULT 1.0,
    place_of_supply_state VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Draft',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    party_type VARCHAR(50), -- e.g., 'Client', 'Vendor'
    party_id UUID,
    debit NUMERIC(15, 2) DEFAULT 0.00,
    credit NUMERIC(15, 2) DEFAULT 0.00,
    narration TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MCA RULE 11(g) AUDIT LOG
CREATE TABLE journal_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL, -- Do not cascade delete; audit logs must be immutable
    user_id UUID,
    action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    previous_state JSONB,
    new_state JSONB
);

-- 5. POSTING RULES
CREATE TABLE posting_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL, 
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE posting_rule_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES posting_rules(id) ON DELETE CASCADE,
    system_account system_account_type NOT NULL,
    entry_side VARCHAR(10) NOT NULL, -- 'DEBIT' or 'CREDIT'
    amount_source VARCHAR(100) NOT NULL,
    condition_logic TEXT
);

-- 6. PDC REGISTER
CREATE TABLE pdc_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    cheque_no VARCHAR(50) NOT NULL,
    cheque_date DATE NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    party_type VARCHAR(50) NOT NULL,
    party_id UUID NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    presentation_date DATE,
    linked_journal_id UUID REFERENCES journal_entries(id),
    status cheque_status DEFAULT 'Held',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DUAL DEPRECIATION ENGINE
CREATE TABLE asset_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    branch_id UUID,
    asset_name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    put_to_use_date DATE,
    original_cost NUMERIC(15, 2) NOT NULL,
    companies_act_useful_life_years INT,
    companies_act_method VARCHAR(10), 
    it_act_block_id UUID,
    it_act_depreciation_rate NUMERIC(5, 2),
    linked_journal_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE depreciation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES asset_register(id) ON DELETE CASCADE,
    fiscal_year_id VARCHAR(20) NOT NULL,
    companies_act_depreciation_amount NUMERIC(15, 2),
    companies_act_closing_wdv NUMERIC(15, 2),
    it_act_depreciation_amount NUMERIC(15, 2),
    it_act_closing_wdv NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asset_disposal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES asset_register(id),
    disposal_date DATE NOT NULL,
    sale_value NUMERIC(15, 2) NOT NULL,
    profit_loss_amount NUMERIC(15, 2) NOT NULL,
    linked_journal_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MCA Audit Trigger Functions
CREATE OR REPLACE FUNCTION log_journal_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO journal_audit_logs (journal_id, action, new_state)
        VALUES (NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO journal_audit_logs (journal_id, action, previous_state, new_state)
        VALUES (NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO journal_audit_logs (journal_id, action, previous_state)
        VALUES (OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_audit
AFTER INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION log_journal_audit();

CREATE TRIGGER trg_journal_lines_audit
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION log_journal_audit();

-- End Phase 1 Setup.
