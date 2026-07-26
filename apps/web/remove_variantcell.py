#!/usr/bin/env python3
"""Remove dead VariantCell component from ProformaEditorPage."""
import re

with open('src/proforma-invoices/pages/ProformaEditorPage.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find the VariantCell component
start = content.find('  const VariantCell = ({ value, variants: vList, onChange }:')
if start < 0:
    print("ERROR: VariantCell not found")
    exit(1)

# Find the end - look for '  // Helpers for column visibility' after the component
end_marker = '  // Helpers for column visibility'
end = content.find(end_marker, start)
if end < 0:
    print("ERROR: End marker not found")
    exit(1)

# Print what we're removing
removed_text = content[start:end]
print(f"Removing {len(removed_text)} chars (lines {content[:start].count(chr(10))+1} to {content[:end].count(chr(10))+1})")

# Replace with just the comment
new_content = content[:start] + '  // Helpers for column visibility' + content[end + len(end_marker):]

with open('src/proforma-invoices/pages/ProformaEditorPage.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: VariantCell removed")

# Now add showItemPicker state if not present
if 'showItemPicker' not in new_content:
    print("ERROR: showItemPicker state not found - was it added?")
    exit(1)

print("Done")
