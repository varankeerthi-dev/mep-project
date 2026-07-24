import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Building2,
  Users,
  Hash,
  FileText,
  Receipt,
  Percent,
  Zap,
  LayoutGrid,
  Shield,
  CheckSquare,
  Package,
  Ruler,
  Tag,
  Warehouse,
  FileType,
} from 'lucide-react';
import { SettingsShell } from './components/SettingsShell';
import { SettingsSidebar } from './components/SettingsSidebar';
import type { SettingsNavSection } from './components/SettingsSidebar';
import { SettingsContent } from './components/SettingsContent';

const NAV_SECTIONS: SettingsNavSection[] = [
  {
    title: 'Organisation',
    items: [
      { id: 'general', label: 'General & Config', icon: Settings },
      { id: 'organisation-info', label: 'Organisation Info', icon: Building2 },
      { id: 'team-members', label: 'Team Members', icon: Users },
    ],
  },
  {
    title: 'Documents',
    items: [
      { id: 'numbering-series', label: 'Numbering Series', icon: Hash },
      { id: 'templates', label: 'Document Templates', icon: FileText },
      { id: 'print-layouts', label: 'Print Layouts', icon: Receipt },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { id: 'discounts', label: 'Discount Settings', icon: Percent },
      { id: 'quick-quote', label: 'Quick Quote', icon: Zap },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { id: 'modules', label: 'Modules', icon: LayoutGrid },
      { id: 'approvals', label: 'Approval Workflows', icon: CheckSquare },
      { id: 'access-control', label: 'Access Control', icon: Shield },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { id: 'categories', label: 'Item Categories', icon: Package },
      { id: 'units', label: 'Units of Measure', icon: Ruler },
      { id: 'variants', label: 'Variants', icon: Tag },
      { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
      { id: 'terms', label: 'Terms & Conditions', icon: FileType },
    ],
  },
];

export default function SettingsV2Page() {
  const { user, organisation, handleLogout } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  const renderTabContent = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg p-6">
          <h2 className="text-base font-semibold text-[#171717] mb-1">
            {getTabLabel(activeTab)}
          </h2>
          <p className="text-[13px] text-[#525252]">
            {getTabDescription(activeTab)}
          </p>
        </div>

        {/* Placeholder content for the active tab */}
        <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 flex items-center justify-center min-h-[200px]">
          <p className="text-sm text-[#a3a3a3]">
            Settings for "{getTabLabel(activeTab)}" will be implemented here.
          </p>
        </div>
      </div>
    );
  };

  const handleLogoutWrapper = () => {
    handleLogout?.();
  };

  return (
    <SettingsShell
      organisationName={organisation?.name || 'Settings'}
      userEmail={user?.email}
      onLogout={handleLogoutWrapper}
    >
      <SettingsSidebar
        sections={NAV_SECTIONS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <SettingsContent>{renderTabContent()}</SettingsContent>
    </SettingsShell>
  );
}

function getTabLabel(tabId: string): string {
  const labels: Record<string, string> = {
    general: 'General & Config',
    'organisation-info': 'Organisation Info',
    'team-members': 'Team Members',
    'numbering-series': 'Numbering Series',
    templates: 'Document Templates',
    'print-layouts': 'Print Layouts',
    discounts: 'Discount Settings',
    'quick-quote': 'Quick Quote',
    modules: 'Modules',
    approvals: 'Approval Workflows',
    'access-control': 'Access Control',
    categories: 'Item Categories',
    units: 'Units of Measure',
    variants: 'Variants',
    warehouses: 'Warehouses',
    terms: 'Terms & Conditions',
  };
  return labels[tabId] || tabId;
}

function getTabDescription(tabId: string): string {
  const descriptions: Record<string, string> = {
    general: 'Basic preferences and defaults for your workspace.',
    'organisation-info': 'Company details, logo, and contact information.',
    'team-members': 'Invite and manage access levels for your organisation.',
    'numbering-series': 'Structure the sequential identifiers for your records.',
    templates: 'Manage document templates. Customise columns, labels, and default content.',
    'print-layouts': 'Configure printing layouts for different document types.',
    discounts: 'Set discount rules per variant.',
    'quick-quote': 'Configure quick quote pricing and variant defaults.',
    modules: 'Enable or disable modules across the workspace.',
    approvals: 'Configure approval workflows and levels for different modules.',
    'access-control': 'Define user roles and permissions.',
    categories: 'Manage item categories used across materials and products.',
    units: 'Manage units of measure.',
    variants: 'Manage product variants and their attributes.',
    warehouses: 'Manage warehouse locations and stock points.',
    terms: 'Manage terms and conditions templates for documents.',
  };
  return descriptions[tabId] || '';
}
