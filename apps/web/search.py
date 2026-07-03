import os

tables = [
    'proforma_invoices', 'invoices', 'delivery_challans', 
    'payment_requests', 'purchase_payments', 'subcontractor_payments', 
    'purchase_orders', 'work_orders', 'client_purchase_orders',
    'material_dispatch', 'site_visits', 'expense_claims'
]

results = []
for root, _, files in os.walk('src'):
    for f in files:
        if not f.endswith('.tsx') and not f.endswith('.ts'): continue
        path = os.path.join(root, f)
        try:
            with open(path, 'r', encoding='utf-8') as file:
                content = file.readlines()
                for i, line in enumerate(content):
                    if '.delete' in line or 'delete(' in line:
                        for t in tables:
                            # Also check if it looks like a supabase delete
                            if f"'{t}'" in line or f'"{t}"' in line:
                                print(f'{path}:{i+1}: {line.strip()}')
        except Exception as e:
            pass
