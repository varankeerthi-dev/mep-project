const fs = require('fs');

const data = [
  { "account_name": "Advance Tax", "account_type": "Other Current Asset" },
  { "account_name": "Employee Adv...", "account_type": "Other Current Asset" },
  { "account_name": "Prepaid Expen...", "account_type": "Other Current Asset" },
  { "account_name": "TDS Receivable", "account_type": "Other Current Asset" },
  { "account_name": "Reverse Char...", "account_type": "Other Current Asset" },
  { "account_name": "Input Tax Cre...", "account_type": "Other Current Asset" },
  { "account_name": "Input IGST", "account_type": "Other Current Asset" },
  { "account_name": "Input CGST", "account_type": "Other Current Asset" },
  { "account_name": "Input SGST", "account_type": "Other Current Asset" },
  { "account_name": "Sales to Custo...", "account_type": "Other Current Asset" },
  { "account_name": "Guru Petty cash", "account_type": "Other Current Asset" },
  { "account_name": "Goods In Tran...", "account_type": "Other Current Asset" },
  { "account_name": "Deepak Petty... employee", "account_type": "Other Current Asset" },
  { "account_name": "advance", "account_type": "Other Current Asset" },
  { "account_name": "purchase 01", "account_type": "Other Current Asset" },
  { "account_name": "Undeposited ...", "account_type": "Cash" },
  { "account_name": "Petty Cash", "account_type": "Cash" },
  { "account_name": "Zoho Payroll -...", "account_type": "Bank" },
  { "account_name": "Arun Pipes & OLSTERMLOAN78 93", "account_type": "Bank" },
  { "account_name": "OSLTERM7892 ARUN PIPES &...", "account_type": "Bank" },
  { "account_name": "ARUN PIPES &... OLC3147", "account_type": "Bank" },
  { "account_name": "Accounts Receivable", "account_type": "Accounts Receivable" },
  { "account_name": "Furniture and ...", "account_type": "Fixed Asset" },
  { "account_name": "Tax Payable", "account_type": "Other Current Liability" },
  { "account_name": "Employee Rei...", "account_type": "Other Current Liability" },
  { "account_name": "Opening Bala...", "account_type": "Other Current Liability" },
  { "account_name": "Unearned Rev....", "account_type": "Other Current Liability" },
  { "account_name": "TDS Payable", "account_type": "Other Current Liability" },
  { "account_name": "GST Payable", "account_type": "Other Current Liability" },
  { "account_name": "Output IGST", "account_type": "Other Current Liability" },
  { "account_name": "Output CGST", "account_type": "Other Current Liability" },
  { "account_name": "Output SGST", "account_type": "Other Current Liability" },
  { "account_name": "Reimburseme...", "account_type": "Other Current Liability" },
  { "account_name": "Payroll-001 Payroll Tax Pa...", "account_type": "Other Current Liability" },
  { "account_name": "Payroll-002 Statutory Ded...", "account_type": "Other Current Liability" },
  { "account_name": "Payroll-003 Deductions Pa...", "account_type": "Other Current Liability" },
  { "account_name": "Payroll-004", "account_type": "Other Current Liability" },
  { "account_name": "Payroll-005 Net Salary Pa...", "account_type": "Other Current Liability" },
  { "account_name": "Payroll-006 Hold Salary P...", "account_type": "Other Current Liability" },
  { "account_name": "Inter Branch A...", "account_type": "Other Current Liability" },
  { "account_name": "Accounts Payable", "account_type": "Accounts Payable" },
  { "account_name": "Mortgages", "account_type": "Non Current Liability" },
  { "account_name": "Construction", "account_type": "Non Current Liability" },
  { "account_name": "Dimension Adj...", "account_type": "Other Liability" },
  { "account_name": "Retained Earni...", "account_type": "Equity" },
  { "account_name": "Owner's Equity", "account_type": "Equity" },
  { "account_name": "Opening Bala...", "account_type": "Equity" },
  { "account_name": "Drawings", "account_type": "Equity" },
  { "account_name": "Investments", "account_type": "Equity" },
  { "account_name": "Distributions", "account_type": "Equity" },
  { "account_name": "Capital Stock", "account_type": "Equity" },
  { "account_name": "Dividends Paid", "account_type": "Equity" },
  { "account_name": "Sales", "account_type": "Income" },
  { "account_name": "General Income", "account_type": "Income" },
  { "account_name": "Interest Income", "account_type": "Income" },
  { "account_name": "Late Fee Inco...", "account_type": "Income" },
  { "account_name": "Discount", "account_type": "Income" },
  { "account_name": "Other Charges", "account_type": "Income" },
  { "account_name": "Shipping Char...", "account_type": "Income" },
  { "account_name": "Office Supplies", "account_type": "Expense" },
  { "account_name": "Advertising A...", "account_type": "Expense" },
  { "account_name": "Bank Fees an...", "account_type": "Expense" },
  { "account_name": "Credit Card C...", "account_type": "Expense" },
  { "account_name": "Travel Expense", "account_type": "Expense" },
  { "account_name": "Telephone Ex...", "account_type": "Expense" },
  { "account_name": "Automobile Ex...", "account_type": "Expense" },
  { "account_name": "IT and Interne...", "account_type": "Expense" },
  { "account_name": "Rent Expense", "account_type": "Expense" },
  { "account_name": "Janitorial Exp...", "account_type": "Expense" },
  { "account_name": "Postage", "account_type": "Expense" },
  { "account_name": "Bad Debt", "account_type": "Expense" },
  { "account_name": "Printing and S...", "account_type": "Expense" },
  { "account_name": "Salaries and E...", "account_type": "Expense" },
  { "account_name": "Meals and Ent...", "account_type": "Expense" },
  { "account_name": "Depreciation", "account_type": "Expense" },
  { "account_name": "Consultant Ex...", "account_type": "Expense" },
  { "account_name": "Repairs and M...", "account_type": "Expense" },
  { "account_name": "Other Expenses", "account_type": "Expense" },
  { "account_name": "Lodging", "account_type": "Expense" },
  { "account_name": "Uncategorized", "account_type": "Expense" },
  { "account_name": "Purchase Disc...", "account_type": "Expense" },
  { "account_name": "Raw Materials...", "account_type": "Expense" },
  { "account_name": "Merchandise", "account_type": "Expense" },
  { "account_name": "Transportation...", "account_type": "Expense" },
  { "account_name": "Depreciation...", "account_type": "Expense" },
  { "account_name": "Contract Assets", "account_type": "Expense" },
  { "account_name": "GST LATE FEE LATEFEE0001", "account_type": "Expense" },
  { "account_name": "INTEREST ON... INTEREST001", "account_type": "Expense" },
  { "account_name": "Cost of Goods...", "account_type": "Cost Of Goods Sold" },
  { "account_name": "Labor", "account_type": "Cost Of Goods Sold" },
  { "account_name": "Materials", "account_type": "Cost Of Goods Sold" },
  { "account_name": "Subcontractor", "account_type": "Cost Of Goods Sold" },
  { "account_name": "Job Costing", "account_type": "Cost Of Goods Sold" }
];

const rootMapping = {
  "Other Current Asset": "Asset",
  "Cash": "Asset",
  "Bank": "Asset",
  "Accounts Receivable": "Asset",
  "Fixed Asset": "Asset",
  "Other Current Liability": "Liability",
  "Accounts Payable": "Liability",
  "Non Current Liability": "Liability",
  "Other Liability": "Liability",
  "Equity": "Liability", // As Equity
  "Income": "Income",
  "Expense": "Expense",
  "Cost Of Goods Sold": "Expense"
};

const sanitize = (str) => str.replace(/'/g, "''");

// Generate distinct groups
const groups = [...new Set(data.map(item => item.account_type))];

let output = `-- 3. Auto-Generate Zoho/Standard Groups\n`;
output += `        DECLARE\n`;
groups.forEach((g, i) => {
    output += `            v_grp_${i} UUID;\n`;
});
output += `        BEGIN\n`;

groups.forEach((g, i) => {
    const root = rootMapping[g];
    output += `            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type)\n`;
    output += `            VALUES (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), '${sanitize(g)}', true, '${root}')\n`;
    output += `            RETURNING id INTO v_grp_${i};\n\n`;
});

output += `            -- 4. Auto-Generate Custom Default Ledgers\n`;
output += `            INSERT INTO accounts (company_id, organisation_id, account_code, name, is_group, root_type, parent_id)\n`;
output += `            VALUES\n`;

data.forEach((item, index) => {
    const root = rootMapping[item.account_type];
    const groupVar = `v_grp_${groups.indexOf(item.account_type)}`;
    output += `                (org.id, org.id, 'Z' || left(replace(gen_random_uuid()::text, '-', ''), 4), '${sanitize(item.account_name)}', false, '${root}', ${groupVar})${index === data.length - 1 ? ';' : ','}\n`;
});

output += `        END;\n`;

fs.writeFileSync('generate_zoho.sql', output);
console.log('Done generating generate_zoho.sql');
