#!/usr/bin/env python3
"""Fix Subcontractors.tsx - add communication feature without duplicate imports"""

with open('src/pages/Subcontractors.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add MessageSquare and Smartphone to lucide-react import
# The import currently ends with "Clock\n} from 'lucide-react';"
# Phone and Mail are already imported (lines 21-22), so only add the new ones
old_import_end = "  Clock\n} from 'lucide-react';"
new_import_end = "  Clock,\n  MessageSquare,\n  Smartphone\n} from 'lucide-react';"
if old_import_end in content:
    content = content.replace(old_import_end, new_import_end)
    print("OK: Added MessageSquare and Smartphone to import")
else:
    print("WARN: Could not find import end pattern - checking if already added")
    if "MessageSquare" in content.split("} from 'lucide-react';")[0]:
        print("  -> MessageSquare already in import, skipping")

# 2. Check if communications state was already added
if "const [communications, setCommunications]" in content:
    print("OK: Communications state already present")
else:
    # Add after labourCategories state
    old_state = "  const [labourCategories, setLabourCategories] = useState<any[]>([])\n  const [dailyLogsSubTab"
    new_state = "  const [labourCategories, setLabourCategories] = useState<any[]>([])\n  const [communications, setCommunications] = useState<any[]>([])\n  const [dailyLogsSubTab"
    if old_state in content:
        content = content.replace(old_state, new_state)
        print("OK: Added communications state")
    else:
        print("WARN: Could not find state insertion point")

# 3. Add client_communication fetch in useEffect
if "client_communication" in content:
    print("OK: client_communication fetch already present")
else:
    old_fetch = ".then(({ data }) => setLabourCategories(data || []))\n    }"
    new_fetch = ".then(({ data }) => setLabourCategories(data || []))\n      supabase.from('client_communication').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('created_at', { ascending: false }).then(({ data }) => setCommunications(data || []))\n    }"
    if old_fetch in content:
        content = content.replace(old_fetch, new_fetch)
        print("OK: Added client_communication fetch")
    else:
        print("WARN: Could not find fetch insertion point")

# 4. Fix the communications tab in tabs array
# Check if the tab was added with or without proper label
if "id: 'communications'" in content:
    # Tab exists, check if label is correct
    if "Communication Log" in content:
        print("OK: Communications tab already present with correct label")
    else:
        # The tab was added but label is broken, fix it
        # Find and replace the broken tab entry
        import re
        # Try to find any broken communications tab entry
        broken_patterns = [
            "    { id: 'communications', label: , icon: MessageSquare },",
            "    { id: 'communications', label: `Communication Log (${communications.length})`, icon: MessageSquare },",
        ]
        fixed_tab = "    { id: 'communications', label: `Communication Log (${communications.length})`, icon: MessageSquare },"
        for pat in broken_patterns:
            if pat in content:
                content = content.replace(pat, fixed_tab)
                print(f"OK: Fixed broken tab label")
                break
        else:
            # Try regex to fix any variant
            content = re.sub(
                r"\{ id: 'communications', label: .*?, icon: MessageSquare \},",
                fixed_tab,
                content
            )
            print("OK: Fixed tab label via regex")
else:
    # Add the tab after payments tab
    old_tab = "    { id: 'payments', label: 'Payout History', icon: CheckCircle },\n  ]"
    new_tab = "    { id: 'payments', label: 'Payout History', icon: CheckCircle },\n    { id: 'communications', label: `Communication Log (${communications.length})`, icon: MessageSquare },\n  ]"
    if old_tab in content:
        content = content.replace(old_tab, new_tab)
        print("OK: Added communications tab to tabs array")
    else:
        print("WARN: Could not find tabs array insertion point")

# 5. Add communications tab content rendering
if "activeTab === 'communications'" in content:
    print("OK: Communications tab content already present")
else:
    # Find the payments tab content block and add communications after it
    # We need to find the closing of the payments tab rendering
    # Look for the pattern: after the payments tab content block
    payments_content_end = content.find("{activeTab === 'payments' && sub && (")
    if payments_content_end == -1:
        # Try alternate pattern
        payments_content_end = content.find("activeTab === 'payments'")
    
    if payments_content_end != -1:
        # Find the end of the payments content block by looking for the next tab or closing div
        # We'll insert the communications content before the closing </div> of the tab content area
        # Actually, let's find a good insertion point - after the last tab content block
        
        # Find the closing of the payments section - look for the pattern that ends the payments rendering
        # Search for the next major section after payments
        search_from = payments_content_end
        # Find the pattern: closing of payments block
        # Look for the section that comes after the payments block
        pos = search_from
        depth = 0
        found_start = False
        end_pos = None
        
        while pos < len(content):
            if content[pos] == '{' and not found_start:
                found_start = True
                depth = 1
            elif content[pos] == '{' and found_start:
                depth += 1
            elif content[pos] == '}':
                depth -= 1
                if depth == 0:
                    end_pos = pos + 1
                    break
            pos += 1
        
        if end_pos:
            comm_content = """

          {activeTab === 'communications' && (
            <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', padding: '8px' }}>
              {communications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                  <MessageSquare size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>No Communications</h3>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>No communication logs found for this subcontractor.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
                  {communications.map((comm) => {
                    const CATEGORY_MAP: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
                      incoming: { icon: Phone, bg: '#ecfdf5', text: '#059669' },
                      outgoing: { icon: Phone, bg: '#eff6ff', text: '#2563eb' },
                      Incoming: { icon: Phone, bg: '#ecfdf5', text: '#059669' },
                      Outgoing: { icon: Phone, bg: '#eff6ff', text: '#2563eb' },
                      whatsapp: { icon: Smartphone, bg: '#f0fdf4', text: '#16a34a' },
                      email: { icon: Mail, bg: '#fef3c7', text: '#d97706' },
                      meeting: { icon: Users, bg: '#f3e8ff', text: '#7c3aed' },
                    };
                    const cat = CATEGORY_MAP[comm.call_category] || { icon: MessageSquare, bg: '#f5f5f5', text: '#737373' };
                    const CatIcon = cat.icon;
                    return (
                      <div key={comm.id} style={{ display: 'flex', gap: '12px', padding: '10px 12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.text, flexShrink: 0 }}>
                          <CatIcon size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>{comm.call_brief || 'No brief'}</span>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: (comm.status === 'Open' || comm.status === 'open') ? '#fef3c7' : (comm.status === 'Resolved' || comm.status === 'resolved') ? '#ecfdf5' : '#f3f4f6', color: (comm.status === 'Open' || comm.status === 'open') ? '#d97706' : (comm.status === 'Resolved' || comm.status === 'resolved') ? '#059669' : '#6b7280' }}>{comm.status}</span>
                          </div>
                          {comm.next_action && (
                            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '4px' }}>Next: {comm.next_action}</div>
                          )}
                          <div style={{ fontSize: '11px', color: '#a3a3a3' }}>{new Date(comm.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(comm.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
"""
            content = content[:end_pos] + comm_content + content[end_pos:]
            print("OK: Added communications tab content")
        else:
            print("WARN: Could not find end of payments content block")
    else:
        print("WARN: Could not find payments content block for insertion")

with open('src/pages/Subcontractors.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nScript completed. File written.")
