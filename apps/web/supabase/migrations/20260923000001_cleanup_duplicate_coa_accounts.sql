-- Migration: 20260923000001_cleanup_duplicate_coa_accounts.sql
-- Description: Cleans up triplicated Chart of Accounts seed data, deletes unposted client sub-accounts
-- from Sundry Debtors / Creditors (enforcing the Control Account pattern), purges unposted synthetic Zoho accounts,
-- and adds a unique index on (organisation_id, account_code).

DO $$
DECLARE
    r RECORD;
    v_keeper_id UUID;
    v_dup_id UUID;
    v_deleted_children INT := 0;
    v_deleted_zoho INT := 0;
    v_deduped_groups INT := 0;
BEGIN
    -- 1. Delete unposted debtor/creditor client sub-accounts
    WITH deleted AS (
        DELETE FROM public.accounts a
        WHERE a.is_group = false
          AND a.parent_id IN (
            SELECT id FROM public.accounts WHERE name ILIKE '%debtor%' OR name ILIKE '%creditor%'
          )
          AND a.id NOT IN (
            SELECT DISTINCT account_id FROM public.journal_entry_lines WHERE account_id IS NOT NULL
          )
        RETURNING a.id
    )
    SELECT count(*) INTO v_deleted_children FROM deleted;

    -- 2. Delete unposted Zoho synthetic accounts
    WITH deleted_z AS (
        DELETE FROM public.accounts
        WHERE account_code LIKE 'Z%'
          AND id NOT IN (
            SELECT DISTINCT account_id FROM public.journal_entry_lines WHERE account_id IS NOT NULL
          )
        RETURNING id
    )
    SELECT count(*) INTO v_deleted_zoho FROM deleted_z;

    -- 3. Deduplicate standard accounts (Codes 1000..4101)
    FOR r IN 
        SELECT organisation_id, account_code 
        FROM public.accounts 
        WHERE organisation_id IS NOT NULL 
        GROUP BY organisation_id, account_code 
        HAVING count(*) > 1
    LOOP
        -- Determine keeper: prefer account with transactions, else earliest created
        SELECT a.id INTO v_keeper_id
        FROM public.accounts a
        LEFT JOIN (
            SELECT account_id, count(*) as tx_cnt 
            FROM public.journal_entry_lines 
            GROUP BY account_id
        ) tx ON tx.account_id = a.id
        WHERE a.organisation_id = r.organisation_id 
          AND a.account_code = r.account_code
        ORDER BY COALESCE(tx.tx_cnt, 0) DESC, a.created_at ASC, a.id ASC
        LIMIT 1;

        -- For all other duplicates
        FOR v_dup_id IN 
            SELECT a.id 
            FROM public.accounts a
            WHERE a.organisation_id = r.organisation_id 
              AND a.account_code = r.account_code
              AND a.id <> v_keeper_id
        LOOP
            -- Reparent children to keeper
            UPDATE public.accounts SET parent_id = v_keeper_id WHERE parent_id = v_dup_id;
            
            -- Remap journal entries if any
            UPDATE public.journal_entry_lines SET account_id = v_keeper_id WHERE account_id = v_dup_id;

            -- Delete the duplicate
            DELETE FROM public.accounts WHERE id = v_dup_id;
            v_deduped_groups := v_deduped_groups + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Deleted % client/vendor child accounts, % Zoho accounts, % duplicate group/root accounts', 
        v_deleted_children, v_deleted_zoho, v_deduped_groups;
END $$;

-- 4. Apply unique index to permanently prevent duplicate account codes per organisation
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_org_account_code 
ON public.accounts (organisation_id, account_code) 
WHERE organisation_id IS NOT NULL;
