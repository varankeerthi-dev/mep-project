import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
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
import { SETTINGS_TABS } from './types';
import { PageSkeleton } from '@/components/ui/skeleton';

// Lazy load heavy settings tab components
const AccessControlPage = lazy(() => import('../../pages/AccessControl'));
const PrintSettings = lazy(() => import('../../pages/PrintSettings'));
const DiscountSettings = lazy(() => import('../../pages/DiscountSettings'));
const QuickQuoteSettings = lazy(() => import('../../pages/QuickQuoteSettings'));
const ModuleSettings = lazy(() => import('../../components/ModuleSettings'));
const ApprovalSettings = lazy(() => import('../../components/ApprovalSettings'));
const CategoryTab = lazy(() => import('../materials/settings/CategoryTab').then(m => ({ default: m.CategoryTab })));
const UnitTab = lazy(() => import('../materials/settings/UnitTab').then(m => ({ default: m.UnitTab })));
const VariantsTab = lazy(() => import('../materials/settings/VariantsTab').then(m => ({ default: m.VariantsTab })));
const WarehouseTab = lazy(() => import('../materials/settings/WarehouseTab').then(m => ({ default: m.WarehousesTab })));
const TermsConditionsSettings = lazy(() => import('../../pages/TermsConditionsSettings'));
const ToolsSettings = lazy(() => import('../../pages/ToolsSettings'));
const TransactionNumberSeries = lazy(() => import('../../pages/TransactionNumberSeries'));

export const SettingsV2Page: React.FC<{ initialTab?: string }> = ({ initialTab }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const tabFromUrl = useMemo(() => {
    // 1. Check query param: ?tab=xxx
    const paramTab = searchParams.get('tab');
    if (paramTab && SETTINGS_TABS.some((t) => t.id === paramTab)) return paramTab;

    // 2. Check path suffix: /settings/xxx
    const path = location.pathname.replace(/\/$/, '');
    const segments = path.split('/');
    if (segments.length >= 3 && segments[1] === 'settings') {
      const subPath = segments[2];
      const aliasMap: Record<string, string> = {
        print: 'print-layouts',
        template: 'document-templates',
        templates: 'document-templates',
        discounts: 'discounts',
        'quick-quote': 'quick-quote',
        'terms-conditions': 'terms-conditions',
        terms: 'terms-conditions',
        'document-series': 'numbering-series',
        numbering: 'numbering-series',
        organisation: 'organisation',
        'access-control': 'team-members',
        access: 'team-members',
        modules: 'modules',
        approval: 'approvals',
        approvals: 'approvals',
        tools: 'tools',
      };
      if (aliasMap[subPath]) return aliasMap[subPath];
      if (SETTINGS_TABS.some((t) => t.id === subPath)) return subPath;
    }

    return initialTab || 'general';
  }, [searchParams, location.pathname, initialTab]);

  const [activeTabId, setActiveTabId] = useState<string>(tabFromUrl);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTabId) {
      setActiveTabId(tabFromUrl);
    }
  }, [tabFromUrl]);

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
    setSearchParams({ tab: targetTabId }, { replace: true });
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
      setSearchParams({ tab: pendingTabId }, { replace: true });
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
    setSearchParams({ tab: pendingTabId }, { replace: true });
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
      case 'team-members':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <AccessControlPage />
          </Suspense>
        );
      case 'numbering-series':
        return (
          <Suspense fallback={<PageSkeleton variant="table" rows={6} />}>
            <TransactionNumberSeries />
          </Suspense>
        );
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
      case 'print-layouts':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <PrintSettings />
          </Suspense>
        );
      case 'discounts':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <DiscountSettings />
          </Suspense>
        );
      case 'quick-quote':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <QuickQuoteSettings />
          </Suspense>
        );
      case 'modules':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <ModuleSettings />
          </Suspense>
        );
      case 'approvals':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <ApprovalSettings />
          </Suspense>
        );
      case 'categories':
        return (
          <Suspense fallback={<PageSkeleton variant="list" rows={6} />}>
            <CategoryTab />
          </Suspense>
        );
      case 'units':
        return (
          <Suspense fallback={<PageSkeleton variant="list" rows={6} />}>
            <UnitTab />
          </Suspense>
        );
      case 'variants':
        return (
          <Suspense fallback={<PageSkeleton variant="list" rows={6} />}>
            <VariantsTab />
          </Suspense>
        );
      case 'warehouses':
        return (
          <Suspense fallback={<PageSkeleton variant="list" rows={6} />}>
            <WarehouseTab />
          </Suspense>
        );
      case 'terms-conditions':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <TermsConditionsSettings />
          </Suspense>
        );
      case 'tools':
        return (
          <Suspense fallback={<PageSkeleton variant="form" rows={6} />}>
            <ToolsSettings />
          </Suspense>
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
