import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/App';
import {
  CeoDashboardHeader,
  CeoPipelineStrip,
  CeoEscalationsSection,
  CeoProjectPortfolioMatrix,
  CeoManufacturingPulse,
  CeoStageDetailDrawer,
  CeoActionModal,
  useCeoDashboardData,
  type CeoMode,
  type DateRangeState,
  type StageKey,
  type ActionModalType,
} from '@/components/ceo-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function ProjectOverview() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const orgName = organisation?.name || 'Organisation';
  const currentFy = (organisation as any)?.current_financial_year || 'FY 24-25';

  // Mode state: 'projects' | 'manufacturing' | 'combined'
  const [mode, setMode] = useState<CeoMode>('projects');

  // Date horizon state
  const [dateRange, setDateRange] = useState<DateRangeState>({
    horizon: 'fy_current',
    startDate: null,
    endDate: null,
  });

  // Drawer & Modal state
  const [activeDrawerStage, setActiveDrawerStage] = useState<StageKey | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalType | null>(null);

  // Load consolidated CEO data
  const {
    modules,
    metrics,
    data,
    isLoading,
    mutations,
  } = useCeoDashboardData(orgId, dateRange, currentFy);

  // Auto-adapt mode when modules finish loading
  useEffect(() => {
    if (!modules.isLoading) {
      if (modules.hasProjects && modules.hasManufacturing) {
        setMode('combined');
      } else if (modules.hasManufacturing && !modules.hasProjects) {
        setMode('manufacturing');
      } else {
        setMode('projects');
      }
    }
  }, [modules.hasProjects, modules.hasManufacturing, modules.isLoading]);

  // Executive intervention handlers
  const handleConfirmApproval = async (
    approvalId: string,
    action: 'APPROVED' | 'REJECTED',
    comments: string
  ) => {
    await mutations.processApproval.mutateAsync({ approvalId, action, comments });
  };

  const handleResolveStoppage = async (
    stoppageId: string,
    date: string,
    notes: string
  ) => {
    await mutations.resolveStoppage.mutateAsync({
      id: stoppageId,
      actual_resolution_date: date,
      resolution_notes: notes,
    });
  };

  return (
    <motion.div
      className="min-h-screen bg-zinc-50/50 font-sans pb-16"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {/* 1. Sticky Header with Mode Switcher & Fiscal Horizons */}
      <CeoDashboardHeader
        orgName={orgName}
        currentFy={currentFy}
        mode={mode}
        onModeChange={setMode}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        hasProjects={modules.hasProjects}
        hasManufacturing={modules.hasManufacturing}
      />

      <main className="max-w-[1560px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl bg-zinc-200/60" />
              ))}
            </div>
            <Skeleton className="h-44 rounded-xl bg-zinc-200/60" />
            <Skeleton className="h-96 rounded-xl bg-zinc-200/60" />
          </div>
        ) : (
          <>
            {/* 2. Linear 5-Stage Value Pipeline Strip */}
            <motion.section variants={itemVariants}>
              <CeoPipelineStrip
                metrics={metrics}
                mode={mode}
                activeDrawerStage={activeDrawerStage}
                onSelectStage={setActiveDrawerStage}
              />
            </motion.section>

            {/* 3. Critical Escalations & Executive Interventions Desk */}
            <motion.section variants={itemVariants}>
              <CeoEscalationsSection
                approvals={data.approvals}
                stoppages={data.stoppages}
                budgetAlerts={data.budgetAlerts}
                onOpenAction={setActionModal}
                onNavigate={(href) => navigate(href)}
              />
            </motion.section>

            {/* 4. Execution Matrix: Projects Portfolio & Manufacturing Pulse */}
            <motion.section variants={itemVariants} className="space-y-6">
              {(mode === 'projects' || mode === 'combined') && modules.hasProjects && (
                <CeoProjectPortfolioMatrix
                  projects={data.projects}
                  onNavigate={(href) => navigate(href)}
                />
              )}

              {(mode === 'manufacturing' || mode === 'combined') && modules.hasManufacturing && (
                <CeoManufacturingPulse
                  jobCards={data.jobCards}
                  onNavigate={(href) => navigate(href)}
                />
              )}
            </motion.section>
          </>
        )}
      </main>

      {/* 5. Slide-Over Detail Drawer for deep inspection */}
      <CeoStageDetailDrawer
        stage={activeDrawerStage}
        mode={mode}
        onClose={() => setActiveDrawerStage(null)}
        data={{
          quotes: data.quotes,
          orders: data.orders,
          projects: data.projects,
          jobCards: data.jobCards,
          invoices: data.invoices,
          approvals: data.approvals,
          stoppages: data.stoppages,
        }}
        onNavigate={(href) => navigate(href)}
        onOpenAction={setActionModal}
      />

      {/* 6. Executive Action Dialog (Approve/Reject or Resolve Stoppage) */}
      <CeoActionModal
        modalState={actionModal}
        onClose={() => setActionModal(null)}
        onConfirmApproval={handleConfirmApproval}
        onResolveStoppage={handleResolveStoppage}
      />
    </motion.div>
  );
}
