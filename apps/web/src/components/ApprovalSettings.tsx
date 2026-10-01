import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  GripVertical,
  ShieldCheck,
  Users,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  FileText,
  ShoppingCart,
  CreditCard,
  Hammer,
  Package,
  Factory,
  Receipt,
  ClipboardList,
  MapPin,
  Wallet,
  X,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgApprovalWorkflows } from '@/hooks/useApprovals';
import { useQuery } from '@tanstack/react-query';
import { getOrganisationMembers } from '@/supabase';
import { useEmployees } from '@/rbac/hooks';
import { toast } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { ApprovalTierMode, ApprovalExecutionMode } from '@/types/approvals';

export type ModuleKey =
  | 'PURCHASE_REQUISITION'
  | 'PURCHASE_PAYMENT'
  | 'SUBCONTRACTOR_PAYMENT'
  | 'PAYMENT_REQUEST'
  | 'QUOTATION'
  | 'WORK_ORDER'
  | 'PURCHASE_ORDER'
  | 'SALES_ORDER'
  | 'JOB_CARD'
  | 'SITE_EXPENSE_REQUEST'
  | 'SITE_EXPENSE_POST_PURCHASE';

export interface WorkflowLevel {
  id: string;
  approverId: string;
  approverName?: string;
  approverRole?: string;
  minAmount: string;
  maxAmount: string;
  canBypassPriorLevels: boolean;
}

export interface ModuleConfig {
  enabled: boolean;
  tierMode: ApprovalTierMode;
  executionMode: ApprovalExecutionMode;
  singleApproverId: string | null;
  singleMinAmount: string;
  requiresReview?: boolean;
  reviewerId?: string | null;
  levels: WorkflowLevel[];
}

const MODULE_META: Record<ModuleKey, { label: string; description: string }> = {
  PURCHASE_REQUISITION: {
    label: 'Purchase Requisitions',
    description: 'Internal requests for procurement of materials or services',
  },
  PURCHASE_PAYMENT: {
    label: 'Purchase Payments',
    description: 'Vendor payments raised from the Purchase module',
  },
  SUBCONTRACTOR_PAYMENT: {
    label: 'Subcontractor Payments',
    description: 'Payments raised for subcontractors / vendors',
  },
  PAYMENT_REQUEST: {
    label: 'Payment Requests',
    description: 'Payment requests raised from the dashboard',
  },
  QUOTATION: {
    label: 'Quotations',
    description: 'Client quotations requiring approval and authorization gate',
  },
  WORK_ORDER: {
    label: 'Work Orders',
    description: 'Subcontractor work orders requiring approval',
  },
  PURCHASE_ORDER: {
    label: 'Purchase Orders',
    description: 'Purchase orders issued to vendors',
  },
  SALES_ORDER: {
    label: 'Sales Orders',
    description: 'Client sales orders requiring management approval',
  },
  JOB_CARD: {
    label: 'Manufacturing Job Cards',
    description: 'Production job cards requiring raw material issuance approval',
  },
  SITE_EXPENSE_REQUEST: {
    label: 'Site Expense Requests',
    description: 'Pre-approval for planned site expenses (crane, labour, consumables)',
  },
  SITE_EXPENSE_POST_PURCHASE: {
    label: 'Site Expense (Post-Purchase)',
    description: 'Post-purchase approval for out-of-pocket site spending',
  },
};

const MODULE_ICONS: Record<ModuleKey, React.ComponentType<{ className?: string }>> = {
  PURCHASE_REQUISITION: ClipboardList,
  PURCHASE_PAYMENT: CreditCard,
  SUBCONTRACTOR_PAYMENT: Users,
  PAYMENT_REQUEST: Receipt,
  QUOTATION: FileText,
  WORK_ORDER: Hammer,
  PURCHASE_ORDER: ShoppingCart,
  SALES_ORDER: Package,
  JOB_CARD: Factory,
  SITE_EXPENSE_REQUEST: MapPin,
  SITE_EXPENSE_POST_PURCHASE: Wallet,
};

const useOrgMembers = (orgId?: string) =>
  useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await getOrganisationMembers(orgId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2,
  });

type OrgMember = {
  user_id: string;
  role: string;
  user?: { full_name?: string | null; email?: string | null } | null;
};

type EmployeeSelectProps = {
  members: OrgMember[];
  value: string;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (userId: string) => void;
  placeholder?: string;
};

const EmployeeSelect: React.FC<EmployeeSelectProps> = ({
  members,
  value,
  search,
  onSearchChange,
  onChange,
  placeholder = 'Search employee by name, role or email',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeSearch = (search || '').trim().toLowerCase();
  const selected = members.find((member) => member.user_id === value);

  const matchesSearch = (member: OrgMember) => {
    if (!activeSearch) return true;
    const fullName = (member.user?.full_name || '').toLowerCase();
    const email = (member.user?.email || '').toLowerCase();
    const userId = member.user_id.toLowerCase();
    const role = (member.role || '').toLowerCase();
    return fullName.includes(activeSearch) || email.includes(activeSearch) || userId.includes(activeSearch) || role.includes(activeSearch);
  };

  const filteredMembers = members.filter(matchesSearch);

  return (
    <div className="dropdown-container relative">
      <div
        className="relative cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selected ? selected.user?.full_name || selected.user?.email || 'Select employee' : placeholder}
          className="h-9 pl-8 pr-8 text-xs bg-white"
        />
        {search ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSearchChange('');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-zinc-100">
          {filteredMembers.length === 0 ? (
            <div className="p-3 text-xs text-zinc-400 text-center">No matching employees found</div>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = value === member.user_id;
              return (
                <button
                  key={member.user_id}
                  type="button"
                  className={cn(
                    'flex w-full flex-col px-3 py-2 text-left transition-colors',
                    isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-zinc-50'
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(member.user_id);
                    onSearchChange('');
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-medium text-zinc-900">
                      {member.user?.full_name || 'Unnamed employee'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">
                      {member.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-0.5">
                    {member.user?.email || member.user_id}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {value && selected && !search && !isOpen && (
        <div className="mt-1 text-[11px] font-medium text-zinc-600 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Selected:</span>
          <span className="text-zinc-900 font-semibold">{selected.user?.full_name || 'Unnamed employee'}</span>
          <span className="text-zinc-400">({selected.role})</span>
        </div>
      )}
    </div>
  );
};

interface SortableLevelItemProps {
  id: string;
  level: WorkflowLevel;
  index: number;
  totalLevels: number;
  module: ModuleKey;
  allMembers: OrgMember[];
  memberSearch: Record<string, string>;
  setMemberSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateLevel: (module: ModuleKey, levelId: string, patch: Partial<WorkflowLevel>) => void;
  removeLevel: (module: ModuleKey, levelId: string) => void;
  moveLevel: (module: ModuleKey, fromIndex: number, toIndex: number) => void;
}

const SortableLevelItem: React.FC<SortableLevelItemProps> = ({
  level,
  index,
  totalLevels,
  module,
  allMembers,
  memberSearch,
  setMemberSearch,
  updateLevel,
  removeLevel,
  moveLevel,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white border rounded-xl p-3.5 space-y-3 transition-all',
        isDragging ? 'border-blue-400 shadow-md ring-2 ring-blue-100' : 'border-zinc-200 hover:border-zinc-300'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Drag Handle & Order Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-grab active:cursor-grabbing rounded hover:bg-zinc-100"
            title="Drag to reorder hierarchy level"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => moveLevel(module, index, index - 1)}
              className="p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-20 disabled:hover:text-zinc-400"
              title="Move Up in Hierarchy"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={index === totalLevels - 1}
              onClick={() => moveLevel(module, index, index + 1)}
              className="p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-20 disabled:hover:text-zinc-400"
              title="Move Down in Hierarchy"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200">
            Level {index + 1}
          </span>
        </div>

        {/* Approver Selection */}
        <div className="flex-1 min-w-[220px]">
          <EmployeeSelect
            members={allMembers}
            value={level.approverId}
            search={memberSearch[level.id] || ''}
            onSearchChange={(text) =>
              setMemberSearch((prev) => ({
                ...prev,
                [level.id]: text,
              }))
            }
            onChange={(userId) => {
              const selectedMember = allMembers.find((m) => m.user_id === userId);
              updateLevel(module, level.id, {
                approverId: userId,
                approverName: selectedMember?.user?.full_name || undefined,
                approverRole: selectedMember?.role || undefined,
              });
            }}
          />
        </div>

        {/* Min Threshold */}
        <div className="w-full sm:w-28 shrink-0">
          <Label className="text-[10px] text-zinc-500 mb-1 block">Min Amount (₹)</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            placeholder="Min (₹)"
            value={level.minAmount}
            onChange={(e) =>
              updateLevel(module, level.id, { minAmount: e.target.value })
            }
          />
        </div>

        {/* Max Threshold */}
        <div className="w-full sm:w-28 shrink-0">
          <Label className="text-[10px] text-zinc-500 mb-1 block">Max Amount (₹)</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            placeholder="No limit"
            value={level.maxAmount}
            onChange={(e) =>
              updateLevel(module, level.id, { maxAmount: e.target.value })
            }
          />
        </div>

        {/* Delete button */}
        <div className="shrink-0 flex items-center justify-end sm:pt-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50"
            onClick={removeLevel}
            title="Delete this level"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bypass Setting Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100 bg-zinc-50/70 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-xl">
        <div className="flex items-center gap-2">
          <Switch
            id={`bypass-${level.id}`}
            checked={Boolean(level.canBypassPriorLevels)}
            onCheckedChange={(checked) =>
              updateLevel(module, level.id, { canBypassPriorLevels: checked })
            }
          />
          <Label
            htmlFor={`bypass-${level.id}`}
            className="text-xs font-normal text-zinc-800 cursor-pointer flex items-center gap-1.5"
          >
            <span>Can approve without previous approval pending</span>
            {level.canBypassPriorLevels && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Bypass Permitted
              </span>
            )}
          </Label>
        </div>
        <span className="text-[11px] text-zinc-500">
          Allows this level to authorize if lower tiers are unavailable or on leave
        </span>
      </div>
    </div>
  );
};

interface ApprovalGateTimelineProps {
  moduleKey: ModuleKey;
  config: ModuleConfig;
  allMembers: OrgMember[];
}

interface TimelineStageItem {
  id: string;
  stepLabel: string;
  nodeNumber?: string | number;
  nodeIcon?: React.ComponentType<{ className?: string }>;
  name: string;
  role?: string;
  gate: string;
  canBypass?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
}

export const ApprovalGateTimeline: React.FC<ApprovalGateTimelineProps> = ({
  moduleKey,
  config,
  allMembers,
}) => {
  const meta = MODULE_META[moduleKey];

  const formatINR = (val: string | number | undefined | null) => {
    if (val === undefined || val === null || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatGateThreshold = (minStr?: string, maxStr?: string) => {
    const min = minStr ? Number(minStr) : null;
    const max = maxStr ? Number(maxStr) : null;

    if ((min === null || min === 0) && (max === null || max === 0)) {
      return 'Unlimited';
    }
    if ((min === null || min === 0) && max !== null && max > 0) {
      return `Below ₹${formatINR(max)}`;
    }
    if (min !== null && min > 0 && (max === null || max === 0)) {
      return `Above ₹${formatINR(min)} (Unlimited)`;
    }
    if (min !== null && max !== null) {
      return `₹${formatINR(min)} – ₹${formatINR(max)}`;
    }
    return 'Unlimited';
  };

  const stages: TimelineStageItem[] = [];

  // 1. Initial stage
  stages.push({
    id: 'start',
    stepLabel: 'Draft',
    nodeIcon: FileText,
    name: 'Initiator',
    role: `${meta?.label || 'Document'} Draft`,
    gate: 'Submission',
    isStart: true,
  });

  // 2. Preliminary review stage (if enabled)
  if (config.requiresReview) {
    const reviewer = allMembers.find((m) => String(m.user_id) === String(config.reviewerId));
    stages.push({
      id: 'preliminary_review',
      stepLabel: 'Review',
      nodeIcon: CheckCircle2,
      name: reviewer?.user?.full_name || 'Designated Reviewer',
      role: reviewer?.role || 'Technical / Commercial',
      gate: 'Pre-Check Gate',
    });
  }

  // 3. Approval Gates
  if (config.tierMode === 'SINGLE') {
    const soleApprover = allMembers.find((m) => String(m.user_id) === String(config.singleApproverId));
    const minAmt = Number(config.singleMinAmount || 0);
    stages.push({
      id: 'sole_approver',
      stepLabel: 'Approval 1 (Sole)',
      nodeIcon: UserCheck,
      name: soleApprover?.user?.full_name || 'Designated Approver',
      role: soleApprover?.role || 'Sole Authority / MD',
      gate: minAmt > 0 ? `Above ₹${formatINR(minAmt)} (Unlimited)` : 'Unlimited',
    });
  } else if (config.levels.length === 0) {
    stages.push({
      id: 'no_levels',
      stepLabel: 'Approval 1',
      name: 'Unassigned Approver',
      role: 'No tiers configured',
      gate: 'Pending Setup',
    });
  } else {
    config.levels.forEach((level, idx) => {
      const member = allMembers.find((m) => String(m.user_id) === String(level.approverId));
      const isSequential = config.executionMode === 'SEQUENTIAL';
      stages.push({
        id: level.id,
        stepLabel: isSequential ? `Level ${idx + 1}` : `Approval ${idx + 1}`,
        nodeNumber: idx + 1,
        name: level.approverName || member?.user?.full_name || 'Unassigned Approver',
        role: level.approverRole || member?.role || `Tier ${idx + 1} Approver`,
        gate: formatGateThreshold(level.minAmount, level.maxAmount),
        canBypass: Boolean(level.canBypassPriorLevels),
      });
    });
  }

  // 4. Final Authorized stage
  stages.push({
    id: 'final_authorization',
    stepLabel: 'Authorized',
    nodeIcon: ShieldCheck,
    name: 'Final Approval',
    role: 'Watermark Cleared',
    gate: 'Dispatched',
    isEnd: true,
  });

  return (
    <div className="bg-white/95 border border-zinc-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
      {/* Top Header (Compact) */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100/90 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-[11px] font-semibold text-zinc-900 tracking-tight">
            Approval Gate Pipeline
          </h4>
          <span className="text-[10px] text-zinc-400 font-normal hidden sm:inline">
            (Live Timeline)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {config.tierMode === 'SINGLE' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-full">
              <UserCheck className="w-2.5 h-2.5" />
              Sole Gate
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full">
              <Users className="w-2.5 h-2.5" />
              <span>{config.executionMode === 'ANY_APPROVER' ? 'Parallel' : 'Sequential'}</span>
              <span className="text-indigo-300">•</span>
              <span>{config.levels.length} {config.levels.length === 1 ? 'Tier' : 'Tiers'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Connected Horizontal Timeline (Compact & Responsive for 6+ Stages) */}
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex items-stretch min-w-max w-full px-1">
          {stages.map((stage, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stages.length - 1;
            const IconComp = stage.nodeIcon;

            return (
              <div
                key={stage.id}
                className="flex-1 min-w-[96px] max-w-[130px] shrink-0 sm:shrink flex flex-col items-center text-center relative px-1"
              >
                {/* 1. ABOVE THE LINE: Approval 1 / Level 1 */}
                <div className="h-5 flex items-center justify-center w-full px-1">
                  <span className="text-[11px] font-semibold text-zinc-700 tracking-tight truncate max-w-full">
                    {stage.stepLabel}
                  </span>
                </div>

                {/* 2. THE HORIZONTAL CONNECTED LINE & CENTERED NODE */}
                <div className="h-6 relative w-full flex items-center justify-center">
                  {/* Left connecting line */}
                  {!isFirst && (
                    <div className="absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-[2px] bg-zinc-200" />
                  )}

                  {/* Right connecting line */}
                  {!isLast && (
                    <div className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-zinc-200" />
                  )}

                  {/* Centered Node Dot / Circle */}
                  <div
                    className={cn(
                      'relative z-10 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-2xs transition-transform',
                      stage.isStart
                        ? 'bg-blue-600 text-white ring-2 ring-blue-100'
                        : stage.isEnd
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-100'
                        : 'bg-white border-2 border-emerald-600 text-emerald-700 ring-2 ring-emerald-50'
                    )}
                  >
                    {IconComp ? (
                      <IconComp className="w-2.5 h-2.5" />
                    ) : (
                      <span>{stage.nodeNumber}</span>
                    )}
                  </div>
                </div>

                {/* 3. BELOW THE LINE: Name & Approval Gates */}
                <div className="pt-1.5 flex flex-col items-center text-center w-full px-0.5">
                  <span
                    className="text-[11px] font-semibold text-zinc-900 truncate max-w-full"
                    title={`${stage.name}${stage.role ? ` (${stage.role})` : ''}`}
                  >
                    {stage.name}
                  </span>
                  <div
                    className={cn(
                      'mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded max-w-full truncate',
                      stage.isStart || stage.isEnd
                        ? 'bg-zinc-100 text-zinc-600 border border-zinc-200/80'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
                    )}
                    title={`${stage.gate}${stage.canBypass ? ' • Bypass permitted' : ''}${stage.role ? ` • ${stage.role}` : ''}`}
                  >
                    <span className="truncate">{stage.gate}</span>
                    {stage.canBypass && (
                      <span className="shrink-0 text-amber-600 font-bold" title="Bypass permitted">
                        ⚡
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const ApprovalSettings: React.FC = () => {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { data: workflows = [], loading: loadingWorkflows, refetch } = useOrgApprovalWorkflows(orgId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: settingsRows = [], isLoading: loadingSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['approval-settings', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('approval_settings')
        .select('*')
        .eq('organisation_id', orgId);
      if (error && error.code !== 'PGRST205') throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const [modules, setModules] = useState<Record<ModuleKey, ModuleConfig>>(() => ({
    PURCHASE_REQUISITION: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    PURCHASE_PAYMENT: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    SUBCONTRACTOR_PAYMENT: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    PAYMENT_REQUEST: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    QUOTATION: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    WORK_ORDER: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    PURCHASE_ORDER: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    SALES_ORDER: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    JOB_CARD: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    SITE_EXPENSE_REQUEST: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    SITE_EXPENSE_POST_PURCHASE: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
  }));

  const [memberSearch, setMemberSearch] = useState<Record<string, string>>({});
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const { data: employeeRows = [] } = useEmployees(orgId);

  const employeeMap = useMemo(() => {
    const map = new Map<string, (typeof employeeRows)[0]>();
    for (const e of employeeRows) map.set(e.id, e);
    return map;
  }, [employeeRows]);

  const allMembers = useMemo(() => {
    const memberMap = new Map<string, OrgMember>();
    for (const m of orgMembers) memberMap.set(m.user_id, m);
    const seenIds = new Set(memberMap.keys());
    for (const e of employeeRows) {
      if (!seenIds.has(e.id)) {
        memberMap.set(e.id, {
          user_id: e.id,
          role: e.designation || e.role || 'Employee',
          user: { full_name: e.name, email: e.email },
        });
        seenIds.add(e.id);
      }
    }
    return Array.from(memberMap.values());
  }, [orgMembers, employeeRows]);

  const [saving, setSaving] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('QUOTATION');
  const [moduleSearch, setModuleSearch] = useState('');

  const filteredModuleKeys = useMemo(() => {
    const query = moduleSearch.trim().toLowerCase();
    const allKeys = Object.keys(MODULE_META) as ModuleKey[];
    if (!query) return allKeys;
    return allKeys.filter((key) => {
      const meta = MODULE_META[key];
      return (
        meta.label.toLowerCase().includes(query) ||
        meta.description.toLowerCase().includes(query) ||
        key.toLowerCase().includes(query)
      );
    });
  }, [moduleSearch]);

  const activeCount = useMemo(() => {
    return (Object.keys(modules) as ModuleKey[]).filter((k) => modules[k]?.enabled).length;
  }, [modules]);

  useEffect(() => {
    setHasInitialized(false);
  }, [orgId]);

  useEffect(() => {
    if (hasInitialized || loadingWorkflows || loadingSettings || !orgId) return;

    const next: Record<ModuleKey, ModuleConfig> = {
      PURCHASE_REQUISITION: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      PURCHASE_PAYMENT: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      SUBCONTRACTOR_PAYMENT: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      PAYMENT_REQUEST: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      QUOTATION: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      WORK_ORDER: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      PURCHASE_ORDER: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      SALES_ORDER: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      JOB_CARD: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      SITE_EXPENSE_REQUEST: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
      SITE_EXPENSE_POST_PURCHASE: { enabled: false, tierMode: 'MULTI', executionMode: 'SEQUENTIAL', singleApproverId: null, singleMinAmount: '0', requiresReview: false, reviewerId: null, levels: [] },
    };

    // 1. Initialize enabled state and strategies from approval_settings
    if (Array.isArray(settingsRows)) {
      settingsRows.forEach((row: any) => {
        const key = row.setting_key as string;
        const val = row.setting_value;

        if (next[key as ModuleKey]) {
          next[key as ModuleKey].enabled = val === 'true';
        }

        if (key.endsWith('_WORKFLOW_MODE')) {
          const modKey = key.replace('_WORKFLOW_MODE', '') as ModuleKey;
          if (next[modKey]) next[modKey].tierMode = val === 'SINGLE' ? 'SINGLE' : 'MULTI';
        } else if (key.endsWith('_EXECUTION_MODE')) {
          const modKey = key.replace('_EXECUTION_MODE', '') as ModuleKey;
          if (next[modKey]) next[modKey].executionMode = val === 'ANY_APPROVER' ? 'ANY_APPROVER' : 'SEQUENTIAL';
        } else if (key.endsWith('_SINGLE_APPROVER_ID')) {
          const modKey = key.replace('_SINGLE_APPROVER_ID', '') as ModuleKey;
          if (next[modKey]) next[modKey].singleApproverId = val;
        } else if (key.endsWith('_SINGLE_MIN_AMOUNT')) {
          const modKey = key.replace('_SINGLE_MIN_AMOUNT', '') as ModuleKey;
          if (next[modKey]) next[modKey].singleMinAmount = val;
        } else if (key.endsWith('_REQUIRES_REVIEW')) {
          const modKey = key.replace('_REQUIRES_REVIEW', '') as ModuleKey;
          if (next[modKey]) next[modKey].requiresReview = val === 'true';
        } else if (key.endsWith('_REVIEWER_ID')) {
          const modKey = key.replace('_REVIEWER_ID', '') as ModuleKey;
          if (next[modKey]) next[modKey].reviewerId = val;
        }
      });
    }

    // 2. Initialize levels from workflows
    if (Array.isArray(workflows)) {
      const sortedWorkflows = [...workflows].sort((a: any, b: any) => (a.level || 0) - (b.level || 0));
      sortedWorkflows.forEach((w: any) => {
        const moduleKey = w.approval_type as ModuleKey;
        if (!next[moduleKey]) return;

        next[moduleKey].levels.push({
          id: String(w.id),
          approverId: String(w.approver_id ?? ''),
          approverName: w.approver_name || '',
          approverRole: w.approver_role || '',
          minAmount: w.min_amount != null ? String(w.min_amount) : '',
          maxAmount: w.max_amount != null ? String(w.max_amount) : '',
          canBypassPriorLevels: Boolean(w.can_bypass_prior_levels),
        });

        const hasSetting = settingsRows.some((row: any) => row.setting_key === moduleKey);
        if (!hasSetting && w.is_active) {
          next[moduleKey].enabled = true;
        }
      });
    }

    setModules(next);
    setHasInitialized(true);
  }, [workflows, settingsRows, loadingWorkflows, loadingSettings, orgId, hasInitialized]);

  const addLevel = (module: ModuleKey) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: [
          ...prev[module].levels,
          {
            id: `${module}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            approverId: '',
            minAmount: '',
            maxAmount: '',
            canBypassPriorLevels: false,
          },
        ],
      },
    }));
  };

  const removeLevel = (module: ModuleKey, levelId: string) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: prev[module].levels.filter((l) => l.id !== levelId),
      },
    }));
  };

  const updateLevel = (
    module: ModuleKey,
    levelId: string,
    patch: Partial<WorkflowLevel>
  ) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: prev[module].levels.map((l) =>
          l.id === levelId ? { ...l, ...patch } : l
        ),
      },
    }));
  };

  const moveLevel = (module: ModuleKey, fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= modules[module].levels.length) return;
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: arrayMove(prev[module].levels, fromIndex, toIndex),
      },
    }));
  };

  const handleDragEnd = (module: ModuleKey, event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modules[module].levels.findIndex((l) => l.id === active.id);
      const newIndex = modules[module].levels.findIndex((l) => l.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        moveLevel(module, oldIndex, newIndex);
      }
    }
  };

  const handleSave = async () => {
    if (!orgId || !user?.id) return;
    try {
      setSaving(true);

      const moduleKeys = Object.keys(modules) as ModuleKey[];

      // 1. Clear existing workflows for these modules
      const { error: deleteError } = await supabase
        .from('approval_workflows')
        .delete()
        .eq('organisation_id', orgId)
        .in('approval_type', moduleKeys);

      if (deleteError) throw deleteError;

      const workflowRows: any[] = [];
      const settingsUpserts: any[] = [];

      for (const module of moduleKeys) {
        const config = modules[module];

        // Save module general settings
        settingsUpserts.push({
          organisation_id: orgId,
          setting_key: module,
          setting_value: config.enabled ? 'true' : 'false',
          updated_at: new Date().toISOString(),
        });
        settingsUpserts.push({
          organisation_id: orgId,
          setting_key: `${module}_WORKFLOW_MODE`,
          setting_value: config.tierMode,
          updated_at: new Date().toISOString(),
        });
        settingsUpserts.push({
          organisation_id: orgId,
          setting_key: `${module}_EXECUTION_MODE`,
          setting_value: config.executionMode,
          updated_at: new Date().toISOString(),
        });
        settingsUpserts.push({
          organisation_id: orgId,
          setting_key: `${module}_SINGLE_APPROVER_ID`,
          setting_value: config.singleApproverId || '',
          updated_at: new Date().toISOString(),
        });
        settingsUpserts.push({
          organisation_id: orgId,
          setting_key: `${module}_SINGLE_MIN_AMOUNT`,
          setting_value: config.singleMinAmount || '0',
          updated_at: new Date().toISOString(),
        });

        // Reviewer settings if applicable
        if (['QUOTATION', 'WORK_ORDER', 'INVOICE', 'SALES_ORDER', 'JOB_CARD'].includes(module)) {
          settingsUpserts.push({
            organisation_id: orgId,
            setting_key: `${module}_REQUIRES_REVIEW`,
            setting_value: config.requiresReview ? 'true' : 'false',
            updated_at: new Date().toISOString(),
          });
          if (config.reviewerId) {
            settingsUpserts.push({
              organisation_id: orgId,
              setting_key: `${module}_REVIEWER_ID`,
              setting_value: config.reviewerId,
              updated_at: new Date().toISOString(),
            });
          }
        }

        // Save workflow levels to Supabase
        if (config.tierMode === 'SINGLE') {
          if (config.singleApproverId) {
            const member = allMembers.find((m) => String(m.user_id) === String(config.singleApproverId));
            workflowRows.push({
              organisation_id: orgId,
              approval_type: module,
              level: 1,
              min_amount: Number(config.singleMinAmount || 0),
              max_amount: null,
              approver_role: member?.role || 'Sole Approver',
              approver_name: member?.user?.full_name || null,
              approver_id: config.singleApproverId,
              can_bypass_prior_levels: true,
              is_active: config.enabled,
            });
          }
        } else {
          for (let index = 0; index < config.levels.length; index++) {
            const level = config.levels[index];
            if (!level.approverId) continue;
            const member = allMembers.find((m) => String(m.user_id) === String(level.approverId));
            workflowRows.push({
              organisation_id: orgId,
              approval_type: module,
              level: index + 1,
              min_amount: level.minAmount ? Number(level.minAmount) : 0,
              max_amount: level.maxAmount ? Number(level.maxAmount) : null,
              approver_role: member?.role || 'Approver',
              approver_name: member?.user?.full_name || null,
              approver_id: level.approverId,
              can_bypass_prior_levels: Boolean(level.canBypassPriorLevels),
              is_active: config.enabled,
            });
          }
        }
      }

      if (workflowRows.length > 0) {
        const { error: insertError } = await supabase
          .from('approval_workflows')
          .insert(workflowRows);
        if (insertError) throw insertError;
      }

      const { error: settingsError } = await supabase
        .from('approval_settings')
        .upsert(settingsUpserts, { onConflict: 'organisation_id,setting_key' });

      if (settingsError && settingsError.code !== 'PGRST205') throw settingsError;

      toast.success('Approval Gate settings saved to Supabase');
      setHasInitialized(false);
      await Promise.all([refetch(), refetchSettings()]);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save approval gate settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Approval Gate Settings</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Configure multi-tier hierarchies, single approver gates, drag-and-drop ordering, and out-of-order bypass rules.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-sm flex items-center gap-2"
          >
            {saving ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            <span>{saving ? 'Saving to Supabase…' : 'Save Gate Settings'}</span>
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 space-y-1">
          <div className="font-semibold text-blue-950">Approval Gate Configuration Rules:</div>
          <p>
            • <strong>Single Approver:</strong> Routes all matching documents directly to a designated sole authority (e.g. Managing Director).
          </p>
          <p>
            • <strong>Multi-Level Hierarchy:</strong> Drag and drop employees to order the approval sequence (Level 1 → Level 2 → Level 3...).
          </p>
          <p>
            • <strong>Bypass Authority:</strong> Enable on higher-tier managers to allow emergency approval when lower-tier approvers are unavailable or on leave.
          </p>
        </div>
      </div>

      {/* Split Screen Master-Detail Layout */}
      <div className="flex flex-col md:flex-row items-start gap-6 pt-1">
        {/* Left Split: Cursor / Linear Inspired Module Navigation Rail */}
        <aside className="w-full md:w-72 lg:w-80 shrink-0 bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col md:sticky md:top-6">
          {/* Rail Header with Search */}
          <div className="p-3 border-b border-zinc-100 bg-zinc-50/50 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Modules
              </span>
              <span className="text-[11px] font-mono text-zinc-500 bg-zinc-200/60 px-1.5 py-0.5 rounded text-[10px]">
                {activeCount} / {Object.keys(MODULE_META).length} active
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search modules..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-8 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-zinc-400 text-zinc-800 transition-colors"
              />
              {moduleSearch && (
                <button
                  type="button"
                  onClick={() => setModuleSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Module Items List */}
          <div className="p-2 space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto">
            {filteredModuleKeys.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No matching modules found
              </div>
            ) : (
              filteredModuleKeys.map((key) => {
                const meta = MODULE_META[key];
                const config = modules[key];
                const isSelected = selectedModule === key;
                const IconComponent = MODULE_ICONS[key] || ShieldCheck;
                const isEnabled = config?.enabled;
                const isSingle = config?.tierMode === 'SINGLE';
                const levelCount = config?.levels?.length || 0;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedModule(key)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl transition-all relative flex items-center justify-between gap-3 group',
                      isSelected
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                    )}
                  >
                    {/* Active Accent Bar (Linear-style) */}
                    {isSelected && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full" />
                    )}

                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-800'
                        )}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs truncate font-medium flex items-center gap-1.5">
                          <span>{meta.label}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-normal flex items-center gap-1 mt-0.5">
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full inline-block shrink-0',
                              isEnabled ? 'bg-emerald-500' : 'bg-zinc-300'
                            )}
                          />
                          <span>
                            {!isEnabled
                              ? 'Disabled'
                              : isSingle
                              ? 'Sole Approver'
                              : `${levelCount} ${levelCount === 1 ? 'level' : 'levels'}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        'w-3.5 h-3.5 shrink-0 transition-transform',
                        isSelected ? 'text-zinc-900 opacity-100' : 'text-zinc-300 opacity-0 group-hover:opacity-100'
                      )}
                    />
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Split: Active Module Detail Configuration */}
        <main className="flex-1 min-w-0">
          {(() => {
            const meta = MODULE_META[selectedModule];
            const config = modules[selectedModule];
            const IconComponent = MODULE_ICONS[selectedModule] || ShieldCheck;
            if (!meta || !config) return null;

            return (
              <div className="border border-zinc-200 rounded-2xl bg-white shadow-sm overflow-hidden">
                {/* Module Header Bar */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/40">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                        <span>{meta.label}</span>
                        {config.enabled ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Gate Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
                            Gate Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{meta.description}</div>
                    </div>
                  </div>

                  {/* Enable Gate Toggle */}
                  <div
                    className="arc-toggle-oval"
                    onClick={() =>
                      setModules((prev) => ({
                        ...prev,
                        [selectedModule]: { ...prev[selectedModule], enabled: !config.enabled },
                      }))
                    }
                    role="switch"
                    aria-checked={config.enabled}
                    tabIndex={0}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      border: '1px solid',
                      borderColor: config.enabled ? '#86efac' : '#e4e4e7',
                      backgroundColor: config.enabled ? '#f0fdf4' : '#fafafa',
                      color: config.enabled ? '#166534' : '#52525b',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>Enable Gate</span>
                    <div
                      style={{
                        position: 'relative',
                        width: '32px',
                        height: '18px',
                        borderRadius: '9999px',
                        backgroundColor: config.enabled ? '#16a34a' : '#d4d4d8',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: '2px',
                          width: '14px',
                          height: '14px',
                          backgroundColor: 'white',
                          borderRadius: '9999px',
                          transform: config.enabled ? 'translateX(14px)' : 'translateX(0)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </div>
                    {config.enabled && (
                      <span style={{ fontSize: '9px', padding: '1px 5px', backgroundColor: '#16a34a', color: 'white', borderRadius: '9999px', fontWeight: 'bold' }}>
                        ON
                      </span>
                    )}
                  </div>
                </div>

                {/* Module Config Body */}
                {config.enabled ? (
                  <div className="p-5 space-y-5 bg-zinc-50/20">
                    {/* Live Virtual Approval Gate Timeline */}
                    <ApprovalGateTimeline
                      moduleKey={selectedModule}
                      config={config}
                      allMembers={allMembers}
                    />

                    {/* Preliminary Review Step (Optional preliminary verification) */}
                    {['QUOTATION', 'WORK_ORDER', 'INVOICE', 'SALES_ORDER', 'JOB_CARD'].includes(selectedModule) && (
                      <div className="bg-white p-4 rounded-xl border border-zinc-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-900">Preliminary Review Step</h4>
                            <p className="text-[11px] text-zinc-500">Require technical or commercial review before reaching approvers.</p>
                          </div>
                          <Switch
                            checked={Boolean(config.requiresReview)}
                            onCheckedChange={(checked) =>
                              setModules((prev) => ({
                                ...prev,
                                [selectedModule]: { ...prev[selectedModule], requiresReview: checked },
                              }))
                            }
                          />
                        </div>
                        {config.requiresReview && (
                          <div className="pt-2 border-t border-zinc-100">
                            <Label className="text-[11px] text-zinc-600 mb-1 block">Designated Reviewer</Label>
                            <EmployeeSelect
                              members={allMembers}
                              value={config.reviewerId || ''}
                              search={memberSearch[`${selectedModule}_reviewer`] || ''}
                              onSearchChange={(text) =>
                                setMemberSearch((prev) => ({
                                  ...prev,
                                  [`${selectedModule}_reviewer`]: text,
                                }))
                              }
                              onChange={(userId) =>
                                setModules((prev) => ({
                                  ...prev,
                                  [selectedModule]: { ...prev[selectedModule], reviewerId: userId },
                                }))
                              }
                              placeholder="Select reviewer"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode Selector: Single Approver vs Multi-Level Hierarchy */}
                    <div className="bg-white p-4 rounded-xl border border-zinc-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-900">Workflow Organization Mode</h4>
                          <p className="text-[11px] text-zinc-500">
                            Choose whether this module uses a direct single approver or an ordered multi-tier hierarchy.
                          </p>
                        </div>
                        <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setModules((prev) => ({
                                ...prev,
                                [selectedModule]: { ...prev[selectedModule], tierMode: 'SINGLE' },
                              }))
                            }
                            className={cn(
                              'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                              config.tierMode === 'SINGLE'
                                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                                : 'text-zinc-600 hover:text-zinc-900'
                            )}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Single Approver (Direct / MD)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setModules((prev) => ({
                                ...prev,
                                [selectedModule]: { ...prev[selectedModule], tierMode: 'MULTI' },
                              }))
                            }
                            className={cn(
                              'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                              config.tierMode === 'MULTI'
                                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                                : 'text-zinc-600 hover:text-zinc-900'
                            )}
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>Multi-Level Hierarchy</span>
                          </button>
                        </div>
                      </div>

                      {/* Single Approver Form */}
                      {config.tierMode === 'SINGLE' ? (
                        <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-[11px] text-zinc-600 mb-1 block">Designated Sole Approver (e.g. MD / Founder)</Label>
                            <EmployeeSelect
                              members={allMembers}
                              value={config.singleApproverId || ''}
                              search={memberSearch[`${selectedModule}_single`] || ''}
                              onSearchChange={(text) =>
                                setMemberSearch((prev) => ({
                                  ...prev,
                                  [`${selectedModule}_single`]: text,
                                }))
                              }
                              onChange={(userId) =>
                                setModules((prev) => ({
                                  ...prev,
                                  [selectedModule]: { ...prev[selectedModule], singleApproverId: userId },
                                }))
                              }
                              placeholder="Select sole approver"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-zinc-600 mb-1 block">Threshold Minimum Amount (₹)</Label>
                            <Input
                              type="number"
                              placeholder="0 (Applies to all amounts)"
                              value={config.singleMinAmount || ''}
                              onChange={(e) =>
                                setModules((prev) => ({
                                  ...prev,
                                  [selectedModule]: { ...prev[selectedModule], singleMinAmount: e.target.value },
                                }))
                              }
                              className="h-9 text-xs"
                            />
                            <p className="text-[10px] text-zinc-400 mt-1">Documents equal to or above this amount require authorization.</p>
                          </div>
                        </div>
                      ) : (
                        /* Multi-Level Execution Strategy Selector */
                        <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <Label className="text-[11px] font-semibold text-zinc-800">Hierarchy Authorization Strategy</Label>
                            <p className="text-[10px] text-zinc-500">
                              Choose between ordered sequential signoffs or parallel approval where any configured approver can authorize.
                            </p>
                          </div>
                          <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setModules((prev) => ({
                                  ...prev,
                                  [selectedModule]: { ...prev[selectedModule], executionMode: 'SEQUENTIAL' },
                                }))
                              }
                              className={cn(
                                'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                                config.executionMode === 'SEQUENTIAL'
                                  ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                                  : 'text-zinc-500 hover:text-zinc-900'
                              )}
                            >
                              Sequential Hierarchy
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModules((prev) => ({
                                  ...prev,
                                  [selectedModule]: { ...prev[selectedModule], executionMode: 'ANY_APPROVER' },
                                }))
                              }
                              className={cn(
                                'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                                config.executionMode === 'ANY_APPROVER'
                                  ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                                  : 'text-zinc-500 hover:text-zinc-900'
                              )}
                            >
                              Any Approver (No Hierarchy)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Multi-Level Draggable Hierarchy List */}
                    {config.tierMode === 'MULTI' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-900">Configured Hierarchy Levels</h4>
                            <p className="text-[11px] text-zinc-500">
                              Drag items by handle or use arrows to rearrange the approval order.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => addLevel(selectedModule)}
                            className="h-8 text-xs font-medium bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Add Approval Level</span>
                          </Button>
                        </div>

                        {config.levels.length === 0 ? (
                          <div className="p-8 text-center bg-white border border-dashed border-zinc-300 rounded-xl space-y-2">
                            <Users className="h-8 w-8 text-zinc-300 mx-auto" />
                            <p className="text-xs font-medium text-zinc-600">No approval levels defined yet</p>
                            <p className="text-[11px] text-zinc-400">Add levels such as Site Engineer, Deputy Manager, and Manager with amount bands.</p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => addLevel(selectedModule)}
                              className="mt-2 text-xs"
                            >
                              Add First Level
                            </Button>
                          </div>
                        ) : (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => handleDragEnd(selectedModule, event)}
                          >
                            <SortableContext
                              items={config.levels.map((l) => l.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2.5">
                                {config.levels.map((level, index) => (
                                  <SortableLevelItem
                                    key={level.id}
                                    id={level.id}
                                    level={level}
                                    index={index}
                                    totalLevels={config.levels.length}
                                    module={selectedModule}
                                    allMembers={allMembers}
                                    memberSearch={memberSearch}
                                    setMemberSearch={setMemberSearch}
                                    updateLevel={updateLevel}
                                    removeLevel={() => removeLevel(selectedModule, level.id)}
                                    moveLevel={moveLevel}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Disabled state callout */
                  <div className="p-12 text-center bg-zinc-50/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-800">
                        Approval Gate is disabled for {meta.label}
                      </h4>
                      <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
                        Documents and actions in this module will proceed directly without requiring multi-tier authorizations.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() =>
                        setModules((prev) => ({
                          ...prev,
                          [selectedModule]: { ...prev[selectedModule], enabled: true },
                        }))
                      }
                      className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4 rounded-lg font-medium"
                    >
                      Enable Gate for {meta.label}
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
};

export default ApprovalSettings;
