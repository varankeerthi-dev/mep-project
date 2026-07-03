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
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Zoho Payroll -...', false, 'Asset', v_grp_2),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'Arun Pipes & OLSTERMLOAN78 93', false, 'Asset', v_grp_2),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'OSLTERM7892 ARUN PIPES &...', false, 'Asset', v_grp_2),
                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), 'ARUN PIPES &... OLC3147', false, 'Asset', v_grp_2),
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
