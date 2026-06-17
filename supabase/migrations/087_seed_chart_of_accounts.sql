-- Migration: 087_seed_chart_of_accounts.sql
-- Description: Automatically seeds the standard Tally-style Chart of Accounts for all existing organisations,
-- and automatically generates sub-ledgers for all existing Clients and Vendors.

DO $$
DECLARE
    org RECORD;
    v_asset_id UUID;
    v_liab_id UUID;
    v_income_id UUID;
    v_expense_id UUID;
    v_debtors_id UUID;
    v_creditors_id UUID;
    v_bank_id UUID;
    v_cash_id UUID;
    v_sales_id UUID;
    v_purchase_id UUID;
    v_duties_id UUID;
    
    client_rec RECORD;
    vendor_rec RECORD;
BEGIN
    -- Loop through every existing organisation
    FOR org IN SELECT id FROM organisations LOOP
        
        -- 1. Create Base Roots
        -- ASSETS
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
        VALUES (org.id, org.id, '1000', 'Current Assets', true, 'Asset')
        RETURNING id INTO v_asset_id;

        -- LIABILITIES
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
        VALUES (org.id, org.id, '2000', 'Current Liabilities', true, 'Liability')
        RETURNING id INTO v_liab_id;

        -- INCOME
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
        VALUES (org.id, org.id, '3000', 'Direct Income', true, 'Income')
        RETURNING id INTO v_income_id;

        -- EXPENSES
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
        VALUES (org.id, org.id, '4000', 'Direct Expenses', true, 'Expense')
        RETURNING id INTO v_expense_id;

        -- 2. Create Core Groups under Roots
        -- Sundry Debtors (Clients)
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '1100', 'Sundry Debtors', true, 'Asset', v_asset_id)
        RETURNING id INTO v_debtors_id;

        -- Bank Accounts
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '1200', 'Bank Accounts', true, 'Asset', v_asset_id)
        RETURNING id INTO v_bank_id;

        -- Cash-in-Hand
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '1300', 'Cash-in-Hand', true, 'Asset', v_asset_id)
        RETURNING id INTO v_cash_id;

        -- Sundry Creditors (Vendors)
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '2100', 'Sundry Creditors', true, 'Liability', v_liab_id)
        RETURNING id INTO v_creditors_id;

        -- Duties & Taxes (GST, TDS)
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '2200', 'Duties & Taxes', true, 'Liability', v_liab_id)
        RETURNING id INTO v_duties_id;

        -- Sales Accounts
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '3100', 'Sales Accounts', true, 'Income', v_income_id)
        RETURNING id INTO v_sales_id;

        -- Purchase Accounts
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES (org.id, org.id, '4100', 'Purchase Accounts', true, 'Expense', v_expense_id)
        RETURNING id INTO v_purchase_id;

        -- 3. Seed Default Ledgers
        INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
        VALUES 
            (org.id, org.id, '1301', 'Main Cash', false, 'Asset', v_cash_id),
            (org.id, org.id, '2201', 'CGST Output', false, 'Liability', v_duties_id),
            (org.id, org.id, '2202', 'SGST Output', false, 'Liability', v_duties_id),
            (org.id, org.id, '2203', 'IGST Output', false, 'Liability', v_duties_id),
            (org.id, org.id, '2204', 'CGST Input', false, 'Liability', v_duties_id),
            (org.id, org.id, '2205', 'SGST Input', false, 'Liability', v_duties_id),
            (org.id, org.id, '2206', 'IGST Input', false, 'Liability', v_duties_id),
            (org.id, org.id, '3101', 'Local Sales', false, 'Income', v_sales_id),
            (org.id, org.id, '4101', 'Local Purchase', false, 'Expense', v_purchase_id);

        -- 4. Auto-Generate Ledgers for existing Clients (Sundry Debtors)
        FOR client_rec IN SELECT id, client_name FROM clients WHERE organisation_id = org.id LOOP
            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
            VALUES (
                org.id,
                org.id, 
                '11' || left(replace(gen_random_uuid()::text, '-', ''), 4), 
                client_rec.client_name, 
                false, 
                'Asset', 
                v_debtors_id
            );
        END LOOP;

        -- 5. Auto-Generate Ledgers for existing Vendors (Sundry Creditors)
        FOR vendor_rec IN SELECT id, company_name FROM purchase_vendors WHERE organisation_id = org.id LOOP
            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
            VALUES (
                org.id,
                org.id, 
                '21' || left(replace(gen_random_uuid()::text, '-', ''), 4), 
                vendor_rec.company_name, 
                false, 
                'Liability', 
                v_creditors_id
            );
        END LOOP;

-- 3. Auto-Generate Zoho/Standard Groups
        DECLARE
            v_grp_0 UUID;
            v_grp_1 UUID;
            v_grp_2 UUID;
            v_grp_3 UUID;
            v_grp_4 UUID;
            v_grp_5 UUID;
            v_grp_6 UUID;
            v_grp_7 UUID;
            v_grp_8 UUID;
            v_grp_9 UUID;
            v_grp_10 UUID;
            v_grp_11 UUID;
            v_grp_12 UUID;
        BEGIN
            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Other Current Asset', true, 'Asset')
            RETURNING id INTO v_grp_0;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Cash', true, 'Asset')
            RETURNING id INTO v_grp_1;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Bank', true, 'Asset')
            RETURNING id INTO v_grp_2;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Accounts Receivable', true, 'Asset')
            RETURNING id INTO v_grp_3;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Fixed Asset', true, 'Asset')
            RETURNING id INTO v_grp_4;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Other Current Liability', true, 'Liability')
            RETURNING id INTO v_grp_5;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Accounts Payable', true, 'Liability')
            RETURNING id INTO v_grp_6;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Non Current Liability', true, 'Liability')
            RETURNING id INTO v_grp_7;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Other Liability', true, 'Liability')
            RETURNING id INTO v_grp_8;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Equity', true, 'Liability')
            RETURNING id INTO v_grp_9;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Income', true, 'Income')
            RETURNING id INTO v_grp_10;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Expense', true, 'Expense')
            RETURNING id INTO v_grp_11;

            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)
            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Cost Of Goods Sold', true, 'Expense')
            RETURNING id INTO v_grp_12;

            -- 4. Auto-Generate Custom Default Ledgers
            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)
            VALUES
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Advance Tax', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Employee Adv...', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Prepaid Expen...', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'TDS Receivable', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Reverse Char...', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Input Tax Cre...', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Input IGST', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Input CGST', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Input SGST', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Sales to Custo...', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Guru Petty cash', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Goods In Tran...', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Deepak Petty... employee', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'advance', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'purchase 01', false, 'Asset', v_grp_0),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Undeposited ...', false, 'Asset', v_grp_1),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Petty Cash', false, 'Asset', v_grp_1),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Accounts Receivable', false, 'Asset', v_grp_3),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Furniture and ...', false, 'Asset', v_grp_4),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Tax Payable', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Employee Rei...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Opening Bala...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Unearned Rev....', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'TDS Payable', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'GST Payable', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Output IGST', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Output CGST', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Output SGST', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Reimburseme...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Payroll-001 Payroll Tax Pa...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Payroll-002 Statutory Ded...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Payroll-003 Deductions Pa...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Payroll-004', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Payroll-005 Net Salary Pa...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Payroll-006 Hold Salary P...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Inter Branch A...', false, 'Liability', v_grp_5),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Accounts Payable', false, 'Liability', v_grp_6),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Mortgages', false, 'Liability', v_grp_7),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Construction', false, 'Liability', v_grp_7),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Dimension Adj...', false, 'Liability', v_grp_8),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Retained Earni...', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Owner''s Equity', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Opening Bala...', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Drawings', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Investments', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Distributions', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Capital Stock', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Dividends Paid', false, 'Liability', v_grp_9),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Sales', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'General Income', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Interest Income', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Late Fee Inco...', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Discount', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Other Charges', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Shipping Char...', false, 'Income', v_grp_10),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Office Supplies', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Advertising A...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Bank Fees an...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Credit Card C...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Travel Expense', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Telephone Ex...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Automobile Ex...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'IT and Interne...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Rent Expense', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Janitorial Exp...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Postage', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Bad Debt', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Printing and S...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Salaries and E...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Meals and Ent...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Depreciation', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Consultant Ex...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Repairs and M...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Other Expenses', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Lodging', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Uncategorized', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Purchase Disc...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Raw Materials...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Merchandise', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Transportation...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Depreciation...', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Contract Assets', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'GST LATE FEE LATEFEE0001', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'INTEREST ON... INTEREST001', false, 'Expense', v_grp_11),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Cost of Goods...', false, 'Expense', v_grp_12),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Labor', false, 'Expense', v_grp_12),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Materials', false, 'Expense', v_grp_12),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Subcontractor', false, 'Expense', v_grp_12),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Job Costing', false, 'Expense', v_grp_12);
        END;

    END LOOP;
END $$;

