import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to match supabase.from('quotation_header').delete().eq('id', <var>)
    # For QuotationList.tsx:
    # supabase.from('quotation_header').delete().eq('id', q.id)
    content = content.replace(
        "supabase.from('quotation_header').delete().eq('id', q.id)",
        "supabase.from('approvals').delete().eq('reference_id', q.id).then(() => supabase.from('quotation_header').delete().eq('id', q.id))"
    )

    # For QuotationView.tsx:
    # await supabase.from('quotation_header').delete().eq('id', quotationId);
    old_view = """      await supabase
        .from('quotation_header')
        .delete()
        .eq('id', quotationId);"""
        
    new_view = """      await supabase.from('approvals').delete().eq('reference_id', quotationId);
      await supabase
        .from('quotation_header')
        .delete()
        .eq('id', quotationId);"""

    content = content.replace(old_view, new_view)

    # Another format might be in QuotationView
    old_view2 = "await supabase.from('quotation_header').delete().eq('id', quotationId);"
    new_view2 = "await supabase.from('approvals').delete().eq('reference_id', quotationId);\n      await supabase.from('quotation_header').delete().eq('id', quotationId);"
    
    content = content.replace(old_view2, new_view2)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file(r'c:\Users\admin\mep-project\src\pages\QuotationList.tsx')
fix_file(r'c:\Users\admin\mep-project\src\pages\QuotationView.tsx')
print("Fixed app code")
