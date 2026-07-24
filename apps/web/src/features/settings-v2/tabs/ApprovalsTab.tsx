import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { ApprovalSettings } from '@/components/ApprovalSettings';

export const ApprovalsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <SettingSection
        title="Approval Workflows & Authorization"
        description="Configure multi-level approval rules, dollar thresholds, and designated reviewers across key modules"
      >
        <div className="pt-2">
          <ApprovalSettings />
        </div>
      </SettingSection>
    </div>
  );
};
