import React, { useState, useMemo, useCallback } from 'react';
import {
  SettingsShell,
  SettingsSidebar,
  SettingsContent,
  SettingsGlobalSaveBar,
  UnsavedChangesDialog,
} from './components';
import {
  GeneralTab,
  OrganisationTab,
  NumberingTab,
  ApprovalsTab,
  PlaceholderTab,
  TemplatesTab,
} from './tabs';
import { SettingsTabDefinition } from './types';
import {
  Building2,
  Sliders,
  Users,
  Hash,
  FileText,
  Printer,
  Percent,
  Zap,
  ShieldCheck,
  Workflow,
  FolderTree,
  Ruler,
  Layers,
  Warehouse,
  FileCode,
} from 'lucide-react';

export const SETTINGS_TABS: SettingsTabDefinition[] = [
  // Organisation
  {
    id: 'general',
    label: 'General & Config',
    category: 'Organisation',
    icon: Sliders,
    description: 'System-wide preferences, calculation rounding, and auto-generation',
    searchIndex: ['general', 'config', 'round off', 'rounding', 'integer rounding', 'item code generation'],
  },
  {
    id: 'organisation',
    label: 'Organisation Info',
    category: 'Organisation',
    icon: Building2,
    description: 'Company identity, tax registration, address, and branding',
    searchIndex: ['organisation', 'company', 'gst', 'gstin', 'pan', 'logo', 'address', 'phone', 'email'],
  },
  {
    id: 'team-members',
    label: 'Team Members',
    category: 'Organisation',
    icon: Users,
    description: 'User access levels, team roles, and invitations',
    searchIndex: ['team members', 'users', 'roles', 'employee', 'invite', 'access'],
  },

  // Documents
  {
    id: 'numbering-series',
    label: 'Numbering Series',
    category: 'Documents',
    icon: Hash,
    description: 'Transaction prefixes, start numbers, zero padding, and duplicate prevention',
    searchIndex: [
      'numbering series',
      'document numbers',
      'prefix',
      'suffix',
      'padding',
      'start number',
      'quotation prefix',
      'invoice prefix',
      'po prefix',
      'prevent duplicate numbers',
    ],
  },
  {
    id: 'document-templates',
    label: 'Document Templates',
    category: 'Documents',
    icon: FileText,
    description: 'Custom PDF templates, layout columns, and labels',
    searchIndex: ['document templates', 'templates', 'pdf template', 'columns', 'labels', 'custom template'],
  },
  {
    id: 'print-layouts',
    label: 'Print Layouts',
    category: 'Documents',
    icon: Printer,
    description: 'Printer defaults, page size, orientation, and margins',
    searchIndex: ['print layouts', 'print', 'printer', 'page size', 'orientation', 'margins', 'a4'],
  },

  // Commerce
  {
    id: 'discounts',
    label: 'Discount Settings',
    category: 'Commerce',
    icon: Percent,
    description: 'Default, minimum, and maximum discount percentage rules by variant',
    searchIndex: ['discount settings', 'discount rules', 'min discount', 'max discount', 'margin'],
  },
  {
    id: 'quick-quote',
    label: 'Quick Quote',
    category: 'Commerce',
    icon: Zap,
    description: 'Quick estimation matrix, standard size pricing, and defaults',
    searchIndex: ['quick quote', 'quote matrix', 'size pricing', 'estimation defaults'],
  },

  // Advanced
  {
    id: 'modules',
    label: 'Module Management',
    category: 'Advanced',
    icon: ShieldCheck,
    description: 'Enable or disable feature modules across the application',
    searchIndex: ['modules', 'module management', 'feature toggles', 'enable module'],
  },
  {
    id: 'approvals',
    label: 'Approval Workflows',
    category: 'Advanced',
    icon: Workflow,
    description: 'Multi-level approval authorization rules, thresholds, and reviewers',
    searchIndex: [
      'approval workflows',
      'approvals',
      'workflow',
      'approver',
      'reviewer',
      'purchase payment',
      'subcontractor payment',
      'payment request',
      'quotation',
      'work order',
      'purchase order',
      'sales order',
      'job card',
      'site expense',
    ],
  },

  // Master Data
  {
    id: 'categories',
    label: 'Item Categories',
    category: 'Master Data',
    icon: FolderTree,
    description: 'Item taxonomy and classification hierarchy',
    searchIndex: ['categories', 'item categories', 'taxonomy', 'classification'],
  },
  {
    id: 'units',
    label: 'Units of Measure',
    category: 'Master Data',
    icon: Ruler,
    description: 'UOM definitions, symbols, and decimal precision',
    searchIndex: ['units of measure', 'uom', 'units', 'kg', 'nos', 'meters', 'decimal'],
  },
  {
    id: 'variants',
    label: 'Variants & Discount Cats',
    category: 'Master Data',
    icon: Layers,
    description: 'Product variants and discount category assignments',
    searchIndex: ['variants', 'discount categories', 'product variants', 'company variants'],
  },
  {
    id: 'warehouses',
    label: 'Warehouses & Locations',
    category: 'Master Data',
    icon: Warehouse,
    description: 'Inventory storage locations and godowns',
    searchIndex: ['warehouses', 'locations', 'godown', 'storage', 'inventory site'],
  },
  {
    id: 'terms-conditions',
    label: 'Terms & Conditions',
    category: 'Master Data',
    icon: FileCode,
    description: 'Standard clause templates for quotations, invoices, and POs',
    searchIndex: ['terms & conditions', 'terms', 'conditions', 'legal terms', 'contract clauses'],
  },
];

export const SettingsV2Page: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>('general');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dirty state tracking per tab
  const [dirtyTabIds, setDirtyTabIds] = useState<Set<string>>(new Set());
  const saveRegistryRef = React.useRef<
    Record<string, { save: () => Promise<void>; discard: () => void }>
  >({});

  // Tab switch guard dialog state
  const [pendingTabId, setPendingTabId] = useState<string | null>(null);
  const [showGuardDialog, setShowGuardDialog] = useState<boolean>(false);
  const [isDialogSaving, setIsDialogSaving] = useState<boolean>(false);

  const activeTab = useMemo(
    () => SETTINGS_TABS.find((t) => t.id === activeTabId) || SETTINGS_TABS[0],
    [activeTabId]
  );

  const isCurrentTabDirty = dirtyTabIds.has(activeTabId);

  const handleDirtyChange = useCallback((tabId: string, isDirty: boolean) => {
    setDirtyTabIds((prev) => {
      if (prev.has(tabId) === isDirty) return prev;
      const next = new Set(prev);
      if (isDirty) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  const handleRegisterSave = useCallback(
    (tabId: string, saveFn: () => Promise<void>, discardFn: () => void) => {
      saveRegistryRef.current[tabId] = { save: saveFn, discard: discardFn };
    },
    []
  );

  // Tab switch request
  const handleSelectTab = (targetTabId: string) => {
    if (targetTabId === activeTabId) return;

    if (isCurrentTabDirty) {
      setPendingTabId(targetTabId);
      setShowGuardDialog(true);
      return;
    }

    setActiveTabId(targetTabId);
  };

  // Guard Dialog Actions
  const handleGuardSaveAndProceed = async () => {
    if (!pendingTabId) return;
    const currentSaveObj = saveRegistryRef.current[activeTabId];
    setIsDialogSaving(true);
    try {
      if (currentSaveObj) {
        await currentSaveObj.save();
      }
      setShowGuardDialog(false);
      setActiveTabId(pendingTabId);
      setPendingTabId(null);
    } catch (e) {
      console.error('Failed to save before tab switch:', e);
    } finally {
      setIsDialogSaving(false);
    }
  };

  const handleGuardDiscardAndProceed = () => {
    if (!pendingTabId) return;
    const currentSaveObj = saveRegistryRef.current[activeTabId];
    if (currentSaveObj) {
      currentSaveObj.discard();
    }
    setShowGuardDialog(false);
    setActiveTabId(pendingTabId);
    setPendingTabId(null);
  };

  const handleGuardCancel = () => {
    setShowGuardDialog(false);
    setPendingTabId(null);
  };

  // Global Save Bar Handlers
  const handleGlobalSave = async () => {
    const currentSaveObj = saveRegistryRef.current[activeTabId];
    if (currentSaveObj) {
      await currentSaveObj.save();
    }
  };

  const handleGlobalDiscard = () => {
    const currentSaveObj = saveRegistryRef.current[activeTabId];
    if (currentSaveObj) {
      currentSaveObj.discard();
    }
  };

  const renderActiveTabContent = () => {
    switch (activeTabId) {
      case 'general':
        return (
          <GeneralTab
            onDirtyChange={(isDirty) => handleDirtyChange('general', isDirty)}
            onRegisterSave={(saveFn, discardFn) =>
              handleRegisterSave('general', saveFn, discardFn)
            }
          />
        );
      case 'organisation':
        return (
          <OrganisationTab
            onDirtyChange={(isDirty) => handleDirtyChange('organisation', isDirty)}
            onRegisterSave={(saveFn, discardFn) =>
              handleRegisterSave('organisation', saveFn, discardFn)
            }
          />
        );
      case 'numbering-series':
        return (
          <NumberingTab
            onDirtyChange={(isDirty) =>
              handleDirtyChange('numbering-series', isDirty)
            }
            onRegisterSave={(saveFn, discardFn) =>
              handleRegisterSave('numbering-series', saveFn, discardFn)
            }
          />
        );
      case 'approvals':
        return <ApprovalsTab />;
      case 'document-templates':
        return (
          <TemplatesTab
            onDirtyChange={(isDirty) =>
              handleDirtyChange('document-templates', isDirty)
            }
            onRegisterSave={(saveFn, discardFn) =>
              handleRegisterSave('document-templates', saveFn, discardFn)
            }
          />
        );
      default:
        return <PlaceholderTab tab={activeTab} />;
    }
  };

  return (
    <SettingsShell
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      hasUnsavedChanges={dirtyTabIds.size > 0}
    >
      <SettingsSidebar
        tabs={SETTINGS_TABS}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        searchQuery={searchQuery}
        dirtyTabIds={dirtyTabIds}
      />

      <SettingsContent title={activeTab.label} description={activeTab.description}>
        {renderActiveTabContent()}
      </SettingsContent>

      <SettingsGlobalSaveBar
        hasChanges={isCurrentTabDirty}
        isSaving={isDialogSaving}
        onSave={handleGlobalSave}
        onDiscard={handleGlobalDiscard}
        tabLabel={activeTab.label}
      />

      <UnsavedChangesDialog
        isOpen={showGuardDialog}
        tabLabel={activeTab.label}
        onSaveAndProceed={handleGuardSaveAndProceed}
        onDiscardAndProceed={handleGuardDiscardAndProceed}
        onCancel={handleGuardCancel}
        isSaving={isDialogSaving}
      />
    </SettingsShell>
  );
};

export default SettingsV2Page;
