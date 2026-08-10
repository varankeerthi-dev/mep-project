#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const BUTTON_IMPORT = `import { Button } from '@/components/ui/button';`;

const FILES = [
  'src/features/materials/service/ServiceTab.tsx',
  'src/features/materials/components/toolbar/ItemsToolbar.tsx',
  'src/features/materials/settings/CategoryTab.tsx',
  'src/features/materials/components/table/columns.tsx',
  'src/features/materials/components/table/Pagination.tsx',
  'src/features/materials/components/editor/VendorSection.tsx',
  'src/features/materials/components/editor/VariantPricingSection.tsx',
  'src/features/materials/settings/WarehouseTab.tsx',
  'src/features/materials/settings/VariantsTab.tsx',
  'src/features/materials/settings/DiscountCategoriesTab.tsx',
  'src/features/materials/components/viewer/TransactionsTab.tsx',
  'src/features/materials/components/viewer/ItemDetailsDialog.tsx',
  'src/features/materials/components/viewer/AuditTab.tsx',
  'src/features/materials/components/toolbar/ColumnSettingsDropdown.tsx',
];

function determineVariantAndSize(fullTag) {
  let variant = 'default';
  let size = 'default';
  const className = fullTag.match(/className=["'`]([^"'`]*)["'`]/)?.[1] || '';
  const style = fullTag.match(/style=\{\{([^}]*)\}\}/)?.[1] || '';
  
  if (className.includes('bg-blue-600') || className.includes('bg-primary') || className.includes('bg-[#185FA5]') || className.includes('bg-blue-500')) {
    variant = 'default';
  } else if (className.includes('bg-emerald') || className.includes('bg-green')) {
    variant = 'success';
  } else if (className.includes('bg-amber') || className.includes('bg-yellow') || className.includes('bg-orange')) {
    variant = 'warning';
  } else if (className.includes('bg-red') || className.includes('text-red')) {
    variant = 'destructive';
  } else if (className.includes('bg-zinc-100') || className.includes('bg-zinc-200') || className.includes('bg-gray-100') || className.includes('bg-gray-200')) {
    variant = 'secondary';
  } else if (className.includes('border border-zinc-200') || className.includes('border border-zinc-300')) {
    variant = 'secondary';
  } else if (className.includes('border border-zinc-400') || className.includes('border-2')) {
    variant = 'outline';
  } else if (className.includes('bg-transparent') || className.includes('text-zinc-400') || className.includes('text-zinc-500') || className.includes('text-gray-400') || className.includes('text-gray-500')) {
    variant = 'ghost';
  } else if (className.includes('text-blue-600') && !className.includes('bg-blue')) {
    variant = 'ghost';
  } else if (className.includes('underline') || className.includes('link')) {
    variant = 'link';
  } else if (className.includes('bg-zinc-900') || className.includes('bg-zinc-800') || className.includes('bg-gray-900')) {
    variant = 'default';
  } else if (style.includes("background: '#185FA5'") || style.includes("background: '#2563eb'")) {
    variant = 'default';
  } else if (style.includes("background: '#dc2626'") || style.includes("background: '#ef4444'")) {
    variant = 'destructive';
  } else if (style.includes("background: 'transparent'") || style.includes("background: 'none'")) {
    variant = 'ghost';
  } else if (style.includes("background: 'white'") || style.includes("background: '#fff'")) {
    variant = 'outline';
  }

  if (className.includes('text-xs') || className.includes('px-2 py-1') || className.includes('p-0.5') || className.includes('py-0.5')) {
    size = 'xs';
  } else if (className.includes('text-sm') && (className.includes('px-3') || className.includes('py-1.5'))) {
    size = 'sm';
  } else if (className.includes('px-4') || className.includes('py-2') || className.includes('h-10')) {
    size = 'lg';
  }
  
  const children = fullTag.match(/>([^<]*)<\//)?.[1]?.trim() || '';
  if (children.length <= 2 || className.match(/p-[012](\.\d)?$/) || className.match(/rounded p-/)) {
    if (className.includes('p-0') || className.includes('p-0.5')) {
      size = 'icon-xs';
    } else if (className.includes('p-1')) {
      size = 'icon-sm';
    }
  }

  return { variant, size };
}

function processFile(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return { file: filePath, status: 'skipped', reason: 'not found' };
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  const originalContent = content;
  const beforeCount = (content.match(/<button[\s>]/g) || []).length;
  if (beforeCount === 0) return { file: filePath, status: 'skipped', reason: 'no buttons' };
  
  let migratedCount = 0;
  
  content = content.replace(/<button\b([^>]*)>/g, (match, attrs) => {
    if (match.startsWith('<Button')) return match;
    const { variant, size } = determineVariantAndSize(match);
    migratedCount++;
    let newAttrs = attrs;
    newAttrs = newAttrs.replace(/\s*className=["'`][^"'`]*["'`]/g, '');
    newAttrs = newAttrs.replace(/\s*style=\{\{\s*(padding|paddingLeft|paddingRight|paddingTop|paddingBottom|height|display|alignItems|justifyContent|gap|fontSize|fontWeight|borderRadius|border|cursor|textDecoration)[^}]*\}\}/g, '');
    newAttrs = newAttrs.replace(/\s*style=\{\{\s*\}\}/g, '');
    newAttrs = newAttrs.replace(/\s{2,}/g, ' ');
    return `<Button variant="${variant}" size="${size}"${newAttrs}>`;
  });
  
  const closingCount = (content.match(/<\/button>/g) || []).length;
  content = content.replace(/<\/button>/g, '</Button>');
  migratedCount += closingCount;
  
  if (migratedCount > 0 && !content.includes("import { Button }")) {
    const lines = content.split('\n');
    let lastImportEnd = -1;
    let inMultiLine = false;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (inMultiLine) {
        if (t.match(/^}\s*from\s+['"]/)) { lastImportEnd = i; inMultiLine = false; }
        continue;
      }
      if (t.match(/^import\s+.*from\s+['"].*['"];?\s*$/)) {
        lastImportEnd = i;
      } else if (t.match(/^import\s+\{[^}]*$/) || t.match(/^import\s+\*\s+as/)) {
        if (t.match(/^import\s+\{[^}]*\}\s*from\s+['"].*['"];?\s*$/)) {
          lastImportEnd = i;
        } else {
          inMultiLine = true;
        }
      }
    }
    if (lastImportEnd !== -1) {
      lines.splice(lastImportEnd + 1, 0, BUTTON_IMPORT);
      content = lines.join('\n');
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { file: filePath, status: 'migrated', before: beforeCount, migrated: migratedCount };
  }
  return { file: filePath, status: 'no changes', before: beforeCount };
}

console.log('Phase 5c Migration: Materials module remaining buttons\n');
let totalBefore = 0, totalMigrated = 0;
for (const file of FILES) {
  const result = processFile(file);
  if (result.before) totalBefore += result.before;
  if (result.migrated) totalMigrated += result.migrated;
  const icon = result.status === 'migrated' ? '✅' : '⏭️';
  const detail = result.status === 'migrated' ? `${result.before} buttons → ${result.migrated} converted` : result.reason;
  console.log(`${icon} ${result.file} — ${detail}`);
}
console.log(`\nTotal: ${totalBefore} buttons found, ${totalMigrated} converted`);
