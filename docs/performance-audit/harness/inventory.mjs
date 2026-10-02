import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(scriptDir, '../../..');
const outputDir = path.join(process.env.TMPDIR || '/tmp', 'mep-perf-audit-run');
const src = path.join(repo, 'apps/web/src');
const require = createRequire(path.join(repo, 'apps/web/package.json'));
const ts = require('typescript');

function parse(file) {
  const full = path.join(src, file);
  return ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function prop(node, key) {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  const item = node.properties.find(p => ts.isPropertyAssignment(p) && p.name?.getText().replaceAll(/[\"']/g, '') === key);
  return item?.initializer;
}

function text(node) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function arr(node) {
  return node && ts.isArrayLiteralExpression(node) ? [...node.elements] : [];
}

function variable(root, name) {
  let found;
  function walk(node) {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = node.initializer;
    ts.forEachChild(node, walk);
  }
  walk(root);
  return found;
}

const included = [];
const excluded = [];
function add(rawPath, label, group, module, source, id = '') {
  if (!rawPath || !rawPath.startsWith('/')) return;
  const url = new URL(rawPath, 'https://inventory.invalid');
  const tab = url.searchParams.get('tab') || undefined;
  const subtab = url.searchParams.get('subtab') || undefined;
  const routePath = url.pathname || '/';
  if (/^\/manufacturing-v0(?:\/|$)/.test(routePath)) {
    excluded.push({ route: routePath, label, group, reason: 'legacy route family is explicitly not in the active sidebar' });
    return;
  }
  if (/\/(?:create|new|edit|view|detail)(?:\/|$)/i.test(routePath)) {
    excluded.push({ route: routePath, label, group, reason: 'non-read-only form or detail surface' });
    return;
  }
  if (/^\/(?:table-demo|custom-table-demo|dynamic-table-demo|pricing-demo|design-audit|skeleton-demo)$/.test(routePath)) {
    excluded.push({ route: routePath, label, group, reason: 'non-production demo or audit surface' });
    return;
  }
  included.push({ label, group, module, route: routePath, ...(tab ? { tab } : {}), ...(subtab ? { subtab } : {}), source });
}

function walkMenu(item, group, parent, moduleKey) {
  const id = text(prop(item, 'id')) || '';
  const label = text(prop(item, 'label')) || id || 'Navigation item';
  const submenu = arr(prop(item, 'submenu'));
  const owner = moduleKey || parent || label;
  const ownPath = text(prop(item, 'path'));
  if (ownPath) add(ownPath, label, group, owner, 'sidebar', id);
  if (submenu.length) for (const child of submenu) walkMenu(child, `${group} / ${label}`, label, owner);
}

const sidebar = parse('components/Sidebar.tsx');
const menuData = variable(sidebar, 'menuData');
for (const section of arr(menuData)) {
  const sectionName = text(prop(section, 'section')) || 'Workspace';
  for (const item of arr(prop(section, 'items'))) walkMenu(item, sectionName, '', '');
}

function collectPathTabs(file, variableName, group, moduleName, source) {
  const root = parse(file);
  const value = variable(root, variableName);
  for (const entry of arr(value)) {
    const route = text(prop(entry, 'path'));
    if (!route) continue;
    const label = text(prop(entry, 'label')) || text(prop(entry, 'title')) || text(prop(entry, 'id')) || 'Tab';
    const id = text(prop(entry, 'id')) || `${source}-${label}`;
    add(route, label, group, moduleName, source, id);
  }
}

collectPathTabs('features/materials/page/MaterialsPage.tsx', 'tabs', 'Supply chain / Materials', 'Materials', 'materials-tabs');
collectPathTabs('warehouse/WarehouseModule.tsx', 'TABS', 'Supply chain / Warehouse', 'Warehouse', 'warehouse-tabs');
collectPathTabs('pages/manufacturing/ManufacturingShell.tsx', 'TABS', 'Supply chain / Manufacturing', 'Manufacturing', 'manufacturing-tabs');
collectPathTabs('features/subcontractor-v2/components/Shared/SubcontractorModuleNav.tsx', 'SUBCONTRACTOR_V2_MODULE_TABS', 'Client and field / Sub-contractor', 'Sub-contractor', 'subcontractor-tabs');

const moduleTitles = {
  '': 'Dashboard', 'client-po': 'Clients', 'client-communication': 'Communication log',
  'advances-expenses': 'Advances & Expenses', 'accounting': 'Finance', 'finance': 'Finance',
  'gst': 'GST', 'hr': 'HR & Attendance', 'leads': 'Leads', 'manufacturing': 'Manufacturing',
  'procurement': 'Procurement', 'projects': 'Projects', 'purchase': 'Purchase',
  'quotation': 'Quotation', 'reports': 'Reports', 'store': 'Materials', 'subcontractors-v2': 'Sub-contractor',
  'tasks': 'Tasks', 'tools': 'Tools & Equipment', 'warehouse': 'Warehouse',
};
function moduleForRoute(route) {
  const first = new URL(route, 'https://inventory.invalid').pathname.split('/').filter(Boolean)[0] || '';
  return moduleTitles[first] || first.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ') || 'Dashboard';
}
const tabVariableNames = /^(?:tabs|TABS|tabItems|tabData|moduleTabs|SUBCONTRACTOR_V2_MODULE_TABS)$/;
for (const full of fs.readdirSync(src, { recursive: true }).filter(f => /\.(?:tsx?|jsx?)$/.test(f) && !/\.test\./.test(f) && !/\.spec\./.test(f))) {
  const file = String(full);
  const absolute = path.join(src, file);
  let contents;
  try { contents = fs.readFileSync(absolute, 'utf8'); } catch { continue; }
  if (!/\b(?:const|let)\s+(?:tabs|TABS|tabItems|tabData|moduleTabs|SUBCONTRACTOR_V2_MODULE_TABS)\b/.test(contents)) continue;
  const root = ts.createSourceFile(absolute, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && tabVariableNames.test(node.name.text)) {
      for (const entry of arr(node.initializer)) {
        const route = text(prop(entry, 'path'));
        const label = text(prop(entry, 'label')) || text(prop(entry, 'title')) || text(prop(entry, 'id'));
        if (!route || !label) continue;
        const module = moduleForRoute(route);
        const id = text(prop(entry, 'id')) || `${module}-${label}`;
        add(route, label, `Source tabs / ${module}`, module, 'source-tab-registry', id);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
}

const localSubtabs = [];
const tasksTabs = [
  { id: 'company', label: 'Company Tasks', tab: undefined },
  { id: 'my-tasks', label: 'My Tasks', tab: 'my-tasks' },
  { id: 'reminders', label: 'Reminders', tab: 'reminders' },
];
for (const entry of tasksTabs) {
  if (entry.tab) add(`/tasks?tab=${encodeURIComponent(entry.tab)}`, entry.label, 'Work / Tasks', 'Tasks', 'tasks-query-tabs', `tasks-${entry.id}`);
  localSubtabs.push({ module: 'Tasks', page: '/tasks', label: entry.label, source: 'tasks-subtab' });
}
for (const [id, label] of [['table', 'Table'], ['board', 'Board'], ['gantt', 'Gantt'], ['calendar', 'Calendar']]) {
  localSubtabs.push({ module: 'Tasks', page: '/tasks', label, source: 'tasks-view', whenTab: 'company' });
}

const projectsPage = parse('projects/pages/Projects.tsx');
for (const entry of arr(variable(projectsPage, 'TABS'))) {
  const id = text(prop(entry, 'id'));
  const label = text(prop(entry, 'label'));
  if (!id || !label) continue;
  add(`/projects?tab=${encodeURIComponent(id)}`, label, 'Projects', 'Projects', 'projects-query-tabs', `projects-${id}`);
  localSubtabs.push({ module: 'Projects', page: '/projects', label, source: 'projects-tab' });
}
for (const entry of arr(variable(projectsPage, 'MATERIAL_SUBTABS'))) {
  const id = text(prop(entry, 'id'));
  const label = text(prop(entry, 'label'));
  if (!id || !label) continue;
  add(`/projects?tab=material-management&subtab=${encodeURIComponent(id)}`, label, 'Projects', 'Projects', 'projects-material-subtabs', `projects-material-${id}`);
  localSubtabs.push({ module: 'Projects', page: '/projects', label, source: 'projects-material-subtab', whenTab: 'material-management' });
}

for (const entry of arr(variable(parse('warehouse/pages/OperationsPage.tsx'), 'TABS'))) {
  const id = text(prop(entry, 'id'));
  const label = text(prop(entry, 'label'));
  if (id && label) localSubtabs.push({ module: 'Warehouse', page: '/warehouse/operations', label, source: 'warehouse-operations-tab' });
}

const settings = parse('features/settings-v2/types.ts');
for (const entry of arr(variable(settings, 'SETTINGS_TABS'))) {
  const id = text(prop(entry, 'id'));
  const label = text(prop(entry, 'label'));
  if (id && label) add(`/settings?tab=${encodeURIComponent(id)}`, label, 'Settings', 'Settings', 'settings-tabs', `settings-${id}`);
}

const unique = new Map();
for (const entry of included) {
  const key = `${entry.route}\u0000${entry.tab || ''}\u0000${entry.subtab || ''}`;
  const existing = unique.get(key);
  if (!existing || (existing.source === 'sidebar' && entry.source !== 'sidebar')) unique.set(key, entry);
}
const routes = [...unique.values()].sort((a, b) => a.module.localeCompare(b.module) || a.group.localeCompare(b.group) || a.route.localeCompare(b.route) || (a.tab || '').localeCompare(b.tab || ''));

const manifest = {
  schema: 'mep-perf-manifest/v1',
  target: 'https://mep-project-drab.vercel.app',
  inventorySource: 'Sidebar.tsx menuData plus route-backed module tab registries',
  readOnlyPolicy: 'Navigation and visible subtab clicks only; forms/details excluded; REST mutations and unknown RPCs blocked.',
  routeCount: routes.length,
  routes,
  localSubtabCount: localSubtabs.length,
  localSubtabs,
  excludedCount: excluded.length,
  excluded: [...new Map(excluded.map(x => [`${x.route}\u0000${x.reason}`, x])).values()].sort((a, b) => a.route.localeCompare(b.route)),
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ routeCount: manifest.routeCount, excludedCount: manifest.excludedCount, modules: [...new Set(routes.map(x => x.module))] }, null, 2));
