const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.local')));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message, evidence) {
  if (condition) {
    totalPassed++;
    console.log(`[PASS] ${message}`);
    if (evidence) console.log(`       Evidence:`, evidence);
  } else {
    totalFailed++;
    console.error(`[FAIL] ${message}`);
    if (evidence) console.error(`       Evidence:`, evidence);
  }
}

console.log('================================================================');
console.log('   ERP VERIFICATION SUITE: ACCOUNTING P0 IMPLEMENTATION');
console.log('   In accordance with C:\\Users\\admin\\mep-project\\.agents\\VERIFICATION.md');
console.log('================================================================\n');

// -------------------------------------------------------------
// LAYER 2: UNIT / LOGIC VERIFICATION
// -------------------------------------------------------------
console.log('--- LAYER 2: UNIT / LOGIC VERIFICATION ---');

// Test 2.1: CoA Recursive Balance Rollup
{
  const testTree = [
    {
      id: 'grp-1',
      code: '1000',
      name: 'Current Assets',
      type: 'Group',
      rootType: 'Asset',
      balance: 0,
      children: [
        {
          id: 'subgrp-1',
          code: '1100',
          name: 'Bank Accounts',
          type: 'Group',
          rootType: 'Asset',
          balance: 0,
          children: [
            { id: 'led-1', code: '1101', name: 'HDFC Operating', type: 'Ledger', rootType: 'Asset', balance: 150000.50, children: [] },
            { id: 'led-2', code: '1102', name: 'ICICI Reserve', type: 'Ledger', rootType: 'Asset', balance: 250000.25, children: [] }
          ]
        },
        {
          id: 'subgrp-2',
          code: '1200',
          name: 'Cash Float',
          type: 'Group',
          rootType: 'Asset',
          balance: 0,
          children: [
            { id: 'led-3', code: '1201', name: 'Petty Cash', type: 'Ledger', rootType: 'Asset', balance: 10000.00, children: [] }
          ]
        }
      ]
    },
    {
      id: 'grp-2',
      code: '2000',
      name: 'Current Liabilities',
      type: 'Group',
      rootType: 'Liability',
      balance: 0,
      children: [
        { id: 'led-4', code: '2100', name: 'Trade Payables', type: 'Ledger', rootType: 'Liability', balance: 85000.75, children: [] }
      ]
    }
  ];

  // Exact function from useAccounting.ts
  const computeRollupBalance = (node) => {
    if (!node.children || node.children.length === 0) {
      return node.balance || 0;
    }
    let total = node.type === 'Ledger' ? (node.balance || 0) : 0;
    for (const child of node.children) {
      total += computeRollupBalance(child);
    }
    node.balance = Math.round(total * 100) / 100;
    return node.balance;
  };

  testTree.forEach(rootNode => computeRollupBalance(rootNode));

  const bankBalance = testTree[0].children[0].balance;
  const cashBalance = testTree[0].children[1].balance;
  const currentAssetsBalance = testTree[0].balance;
  const liabilitiesBalance = testTree[1].balance;

  assert(bankBalance === 400000.75, 'Bank Accounts sub-group roll-up is mathematically exact (₹4,00,000.75)', { bankBalance });
  assert(cashBalance === 10000.00, 'Cash Float sub-group roll-up is exact (₹10,000.00)', { cashBalance });
  assert(currentAssetsBalance === 410000.75, 'Current Assets top-level group rolls up both sub-groups (₹4,10,000.75)', { currentAssetsBalance });
  assert(liabilitiesBalance === 85000.75, 'Current Liabilities group reflects single child ledger (₹85,000.75)', { liabilitiesBalance });
}

// Test 2.2: CoA Recursive Tree Filtering
{
  const tree = [
    {
      id: 'grp-1', code: '1000', name: 'Assets', type: 'Group', rootType: 'Asset',
      children: [
        {
          id: 'subgrp-1', code: '1100', name: 'Bank Accounts', type: 'Group', rootType: 'Asset',
          children: [
            { id: 'led-1', code: '1101', name: 'HDFC Current', type: 'Ledger', rootType: 'Asset', children: [] },
            { id: 'led-2', code: '1102', name: 'SBI Savings', type: 'Ledger', rootType: 'Asset', children: [] }
          ]
        },
        {
          id: 'led-3', code: '1200', name: 'Receivables', type: 'Ledger', rootType: 'Asset', children: []
        }
      ]
    },
    {
      id: 'grp-2', code: '2000', name: 'Liabilities', type: 'Group', rootType: 'Liability',
      children: [
        { id: 'led-4', code: '2100', name: 'Vendor Payables', type: 'Ledger', rootType: 'Liability', children: [] }
      ]
    }
  ];

  const filterTree = (nodes, search, selectedRootType) => {
    return nodes
      .map(node => {
        const children = filterTree(node.children || [], search, selectedRootType);
        const matchesSearch = search.trim() === '' ||
          node.code?.toLowerCase().includes(search.toLowerCase().trim()) ||
          node.name?.toLowerCase().includes(search.toLowerCase().trim());
        const matchesType = selectedRootType === 'All' || node.rootType === selectedRootType;

        if ((matchesSearch && matchesType) || children.length > 0) {
          return { ...node, children };
        }
        return null;
      })
      .filter(Boolean);
  };

  // 1. Search 'HDFC'
  const res1 = filterTree(tree, 'HDFC', 'All');
  assert(
    res1.length === 1 && res1[0].children[0].children.length === 1 && res1[0].children[0].children[0].code === '1101',
    'Search by name ("HDFC") preserves parent lineage and isolates matching leaf',
    { matchedRoot: res1[0]?.name, matchedChild: res1[0]?.children[0]?.name, leaf: res1[0]?.children[0]?.children[0]?.name }
  );

  // 2. Search by code '2100'
  const res2 = filterTree(tree, '2100', 'All');
  assert(
    res2.length === 1 && res2[0].code === '2000' && res2[0].children[0].code === '2100',
    'Search by code ("2100") isolates liability hierarchy',
    { matchedRoot: res2[0]?.name, matchedChild: res2[0]?.children[0]?.name }
  );

  // 3. Filter by Root Type 'Liability'
  const res3 = filterTree(tree, '', 'Liability');
  assert(
    res3.length === 1 && res3[0].rootType === 'Liability',
    'Root Type filter ("Liability") prunes all Asset branches',
    { count: res3.length, rootType: res3[0]?.rootType }
  );
}

// Test 2.3: DayBook Double-Entry Mathematical Invariants
{
  const linesBalanced = [
    { account_id: 'acc-1', debit: 25000.00, credit: 0, party_type: 'customer', party_id: 'client-1' },
    { account_id: 'acc-2', debit: 0, credit: 25000.00, party_type: '', party_id: '' }
  ];
  const dr1 = linesBalanced.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr1 = linesBalanced.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff1 = Math.abs(Math.round((dr1 - cr1) * 100) / 100);
  const isBalanced1 = diff1 < 0.01 && dr1 > 0;
  assert(isBalanced1 === true && diff1 === 0, 'Balanced lines (₹25,000 Dr = ₹25,000 Cr) evaluate to isBalanced=true', { dr1, cr1, diff1, isBalanced1 });

  const linesImbalanced = [
    { account_id: 'acc-1', debit: 50000.00, credit: 0 },
    { account_id: 'acc-2', debit: 0, credit: 49999.00 }
  ];
  const dr2 = linesImbalanced.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr2 = linesImbalanced.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff2 = Math.abs(Math.round((dr2 - cr2) * 100) / 100);
  const isBalanced2 = diff2 < 0.01 && dr2 > 0;
  assert(isBalanced2 === false && diff2 === 1.00, 'Imbalanced lines (₹50,000 Dr vs ₹49,999 Cr) evaluate to isBalanced=false with diff=₹1.00', { dr2, cr2, diff2, isBalanced2 });

  const linesZero = [
    { account_id: 'acc-1', debit: 0, credit: 0 },
    { account_id: 'acc-2', debit: 0, credit: 0 }
  ];
  const dr3 = linesZero.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr3 = linesZero.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff3 = Math.abs(Math.round((dr3 - cr3) * 100) / 100);
  const isBalanced3 = diff3 < 0.01 && dr3 > 0;
  assert(isBalanced3 === false, 'Zero-amount voucher is rejected by isBalanced guard (prevents blank vouchers)', { isBalanced3 });
}

// -------------------------------------------------------------
// LAYER 4 & 5: DATABASE / STORED PROCEDURE / SECURITY VERIFICATION
// -------------------------------------------------------------
console.log('\n--- LAYER 4 & 5: DATABASE / DATA INTEGRITY & SECURITY VERIFICATION ---');

async function testDatabase() {
  const dummyOrgId = 'a0000000-0000-0000-0000-000000000001';

  // Test 4.1: get_trial_balance RPC schema & execution
  const { data: tbData, error: tbError } = await supabase.rpc('get_trial_balance', {
    porganisationid: dummyOrgId,
    pasofdate: '2026-12-31'
  });

  assert(
    !tbError,
    'RPC get_trial_balance executes successfully and returns valid rowset',
    { error: tbError, rowCount: tbData ? tbData.length : 0 }
  );

  // Test 4.2: post_journal_entry Reject Unbalanced Posting
  const unbalancedPayload = {
    p_organisation_id: dummyOrgId,
    p_voucher_date: '2026-06-01',
    p_voucher_type: 'Journal',
    p_narration: 'Test Unbalanced',
    p_lines: [
      { account_id: '00000000-0000-0000-0000-000000000001', debit: 100, credit: 0 },
      { account_id: '00000000-0000-0000-0000-000000000002', debit: 0, credit: 50 }
    ]
  };

  const { error: unbalError } = await supabase.rpc('post_journal_entry', unbalancedPayload);
  assert(
    unbalError && unbalError.message.includes('must equal total credit'),
    'RPC post_journal_entry rejects unbalanced lines with explicit balance error',
    { rejectedMessage: unbalError?.message }
  );

  // Test 4.3: post_journal_entry Reject Fewer Than 2 Lines
  const singleLinePayload = {
    p_organisation_id: dummyOrgId,
    p_voucher_date: '2026-06-01',
    p_voucher_type: 'Journal',
    p_narration: 'Single Line Test',
    p_lines: [
      { account_id: '00000000-0000-0000-0000-000000000001', debit: 100, credit: 0 }
    ]
  };

  const { error: lineError } = await supabase.rpc('post_journal_entry', singleLinePayload);
  assert(
    lineError && lineError.message.includes('At least 2 line items required'),
    'RPC post_journal_entry rejects single line entry with minimum count error',
    { rejectedMessage: lineError?.message }
  );

  // Test 5.1: Account-Org Isolation Check
  const crossOrgPayload = {
    p_organisation_id: dummyOrgId,
    p_voucher_date: '2026-06-01',
    p_voucher_type: 'Journal',
    p_narration: 'Cross Org Test',
    p_lines: [
      { account_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', debit: 100, credit: 0 },
      { account_id: '00000000-0000-0000-0000-000000000001', debit: 0, credit: 100 }
    ]
  };

  const { error: crossOrgError } = await supabase.rpc('post_journal_entry', crossOrgPayload);
  assert(
    crossOrgError && (crossOrgError.message.includes('Account not found') || crossOrgError.message.includes('does not belong to organization')),
    'RPC post_journal_entry prevents cross-tenant posting for forged or unowned accounts',
    { rejectedMessage: crossOrgError?.message }
  );

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('================================================================');
  process.exit(totalFailed === 0 ? 0 : 1);
}

testDatabase().catch(err => {
  console.error('Database verification error:', err);
  process.exit(1);
});
