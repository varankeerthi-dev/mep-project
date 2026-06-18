import os

files_to_fix = [
    r"c:\Users\admin\mep-project\src\invoices\api.ts",
    r"c:\Users\admin\mep-project\src\invoices\pages\InvoiceView.tsx",
    r"c:\Users\admin\mep-project\src\modules\Purchase\hooks\usePurchaseQueries.ts",
    r"c:\Users\admin\mep-project\src\pages\POList.tsx",
    r"c:\Users\admin\mep-project\src\pages\Subcontractors.tsx",
    r"c:\Users\admin\mep-project\src\proforma-invoices\api.ts",
    r"c:\Users\admin\mep-project\src\api.ts"
]

def apply_fixes():
    for filepath in files_to_fix:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # invoices/api.ts
        if "invoices/api.ts" in filepath.replace('\\', '/'):
            content = content.replace(
                "await supabase.from('invoices').delete().eq('id', invoiceId);",
                "await supabase.from('approvals').delete().eq('reference_id', invoiceId);\n      await supabase.from('invoices').delete().eq('id', invoiceId);"
            )
            content = content.replace(
                "const { error } = await supabase.from('invoices').delete().eq('id', id).eq('organisation_id', organisationId);",
                "await supabase.from('approvals').delete().eq('reference_id', id);\n  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('organisation_id', organisationId);"
            )
            
        # InvoiceView.tsx
        elif "InvoiceView.tsx" in filepath.replace('\\', '/'):
            content = content.replace(
                "await supabase.from('invoices').delete().eq('id', selectedInvoice.id);",
                "await supabase.from('approvals').delete().eq('reference_id', selectedInvoice.id);\n      await supabase.from('invoices').delete().eq('id', selectedInvoice.id);"
            )
            
        # usePurchaseQueries.ts
        elif "usePurchaseQueries.ts" in filepath.replace('\\', '/'):
            content = content.replace(
                "const { error } = await supabase.from('purchase_orders').delete().eq('id', id);",
                "await supabase.from('approvals').delete().eq('reference_id', id);\n      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);"
            )
            
        # POList.tsx
        elif "POList.tsx" in filepath.replace('\\', '/'):
            content = content.replace(
                "supabase.from('client_purchase_orders').delete().eq('id', p.id).then",
                "supabase.from('approvals').delete().eq('reference_id', p.id).then(() => supabase.from('client_purchase_orders').delete().eq('id', p.id)).then"
            )
            
        # Subcontractors.tsx
        elif "Subcontractors.tsx" in filepath.replace('\\', '/'):
            content = content.replace(
                "await supabase.from('subcontractor_payments').delete().eq('id', id);",
                "await supabase.from('approvals').delete().eq('reference_id', id);\n      await supabase.from('subcontractor_payments').delete().eq('id', id);"
            )
            
        # proforma-invoices/api.ts
        elif "proforma-invoices/api.ts" in filepath.replace('\\', '/'):
            content = content.replace(
                "await supabase.from('proforma_invoices').delete().eq('id', proformaId);",
                "await supabase.from('approvals').delete().eq('reference_id', proformaId);\n      await supabase.from('proforma_invoices').delete().eq('id', proformaId);"
            )
            content = content.replace(
                ".from('proforma_invoices')\n    .delete()\n    .eq('id', id)\n    .eq('organisation_id', organisationId);",
                ".from('proforma_invoices')\n    .delete()\n    .eq('id', id)\n    .eq('organisation_id', organisationId);\n  await supabase.from('approvals').delete().eq('reference_id', id);"
            )
            
        # api.ts (delivery_challans)
        elif "src/api.ts" in filepath.replace('\\', '/'):
            content = content.replace(
                ".from('delivery_challans')\n    .delete()\n    .eq('id', id);",
                ".from('delivery_challans')\n    .delete()\n    .eq('id', id);\n  await supabase.from('approvals').delete().eq('reference_id', id);"
            )

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

apply_fixes()
print("Applied delete fixes for other entities.")
