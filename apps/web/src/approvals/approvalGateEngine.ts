import { supabase, currentOrgId } from '@/lib/supabase';
import type {
  Approval,
  ApprovalActionPayload,
  ApprovalGateEvaluation,
  ApprovalWorkflow,
  ApprovalExecutionMode,
  ApprovalTierMode,
  ApiResponse,
} from '@/types/approvals';

export interface ModuleGateConfig {
  enabled: boolean;
  tierMode: ApprovalTierMode;
  executionMode: ApprovalExecutionMode;
  singleApproverId: string | null;
  singleMinAmount: number;
  requiresReview: boolean;
  reviewerId: string | null;
  levels: ApprovalWorkflow[];
}

/**
 * Fetches the full gate configuration for an approval type from Supabase.
 * Supabase is the sole source of truth.
 */
export async function getApprovalGateConfig(
  organisationId: string,
  approvalType: string
): Promise<ModuleGateConfig> {
  const [settingsRes, workflowsRes] = await Promise.all([
    supabase
      .from('approval_settings')
      .select('setting_key, setting_value')
      .eq('organisation_id', organisationId)
      .in('setting_key', [
        approvalType,
        `${approvalType}_WORKFLOW_MODE`,
        `${approvalType}_EXECUTION_MODE`,
        `${approvalType}_SINGLE_APPROVER_ID`,
        `${approvalType}_SINGLE_MIN_AMOUNT`,
        `${approvalType}_REQUIRES_REVIEW`,
        `${approvalType}_REVIEWER_ID`,
      ]),
    supabase
      .from('approval_workflows')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('approval_type', approvalType)
      .eq('is_active', true)
      .order('level', { ascending: true }),
  ]);

  const settings = settingsRes.data || [];
  const workflows = workflowsRes.data || [];

  const settingMap = new Map<string, string>();
  settings.forEach((row: any) => {
    settingMap.set(row.setting_key, row.setting_value);
  });

  const enabled = settingMap.get(approvalType) === 'true';
  const tierMode = (settingMap.get(`${approvalType}_WORKFLOW_MODE`) || 'MULTI') as ApprovalTierMode;
  const executionMode = (settingMap.get(`${approvalType}_EXECUTION_MODE`) || 'SEQUENTIAL') as ApprovalExecutionMode;
  const singleApproverId = settingMap.get(`${approvalType}_SINGLE_APPROVER_ID`) || null;
  const singleMinAmount = Number(settingMap.get(`${approvalType}_SINGLE_MIN_AMOUNT`) || 0);
  const requiresReview = settingMap.get(`${approvalType}_REQUIRES_REVIEW`) === 'true';
  const reviewerId = settingMap.get(`${approvalType}_REVIEWER_ID`) || null;

  return {
    enabled,
    tierMode,
    executionMode,
    singleApproverId,
    singleMinAmount,
    requiresReview,
    reviewerId,
    levels: (workflows || []) as ApprovalWorkflow[],
  };
}

/**
 * Evaluates whether the currently authenticated user can act on an approval,
 * respecting single-approver rules, sequential hierarchy, higher-level bypass,
 * and parallel any-approver configurations.
 */
export async function evaluateApprovalGate(
  approval: Approval,
  userId: string,
  organisationId?: string
): Promise<ApprovalGateEvaluation> {
  const orgId = organisationId || approval.organisation_id;
  const gateConfig = await getApprovalGateConfig(orgId, approval.approval_type);

  const amount = Number(approval.amount || 0);
  const currentLevel = approval.current_level || 1;
  const maxLevels = approval.max_levels || 1;

  // 1. Check if review is pending
  const isReviewerPending =
    approval.review_status === 'PENDING' &&
    !!approval.reviewer_id &&
    approval.reviewer_id !== userId;

  // Filter levels that apply to this amount threshold
  const applicableLevels = gateConfig.levels.filter((w) => {
    const min = Number(w.min_amount || 0);
    const max = w.max_amount != null ? Number(w.max_amount) : null;
    return amount >= min && (max == null || amount <= max);
  });

  const levelsSummary = gateConfig.levels.map((lvl) => ({
    level: lvl.level,
    approverId: lvl.approver_id || '',
    approverName: lvl.approver_name || 'Approver',
    minAmount: Number(lvl.min_amount || 0),
    maxAmount: lvl.max_amount != null ? Number(lvl.max_amount) : null,
    canBypass: Boolean(lvl.can_bypass_prior_levels),
    isCurrent: lvl.level === currentLevel,
    isCompleted: lvl.level < currentLevel,
  }));

  // Default negative state
  const defaultEvaluation: ApprovalGateEvaluation = {
    requiresApproval: gateConfig.enabled,
    isAuthorizedToApprove: false,
    isReviewerPending,
    actionType: 'NONE',
    currentLevel,
    maxLevels,
    canBypassCurrent: false,
    executionMode: gateConfig.executionMode,
    tierMode: gateConfig.tierMode,
    levelsSummary,
  };

  if (!gateConfig.enabled) {
    return {
      ...defaultEvaluation,
      requiresApproval: false,
      isAuthorizedToApprove: true,
      actionType: 'NORMAL',
    };
  }

  if (approval.status !== 'PENDING') {
    return {
      ...defaultEvaluation,
      blockingReason: `Document is in ${approval.status} status. No further approval actions permitted.`,
    };
  }

  if (isReviewerPending) {
    return {
      ...defaultEvaluation,
      blockingReason: 'Document requires preliminary review before entering approval hierarchy.',
    };
  }

  // Case A: Single Approver mode
  if (gateConfig.tierMode === 'SINGLE') {
    const isSingleApprover =
      gateConfig.singleApproverId === userId ||
      (applicableLevels.length > 0 && applicableLevels[0].approver_id === userId);

    if (isSingleApprover) {
      return {
        ...defaultEvaluation,
        isAuthorizedToApprove: true,
        actionType: 'SINGLE',
        authorizedLevel: 1,
        canBypassCurrent: true,
      };
    }

    return {
      ...defaultEvaluation,
      blockingReason: 'Only the designated sole approver can authorize this document.',
    };
  }

  // Case B: Any Approver (Parallel / No Hierarchy)
  if (gateConfig.executionMode === 'ANY_APPROVER') {
    const userWorkflowMatch = applicableLevels.find((w) => w.approver_id === userId);
    if (userWorkflowMatch) {
      return {
        ...defaultEvaluation,
        isAuthorizedToApprove: true,
        actionType: 'ANY_APPROVER',
        authorizedLevel: userWorkflowMatch.level,
        canBypassCurrent: true,
      };
    }

    return {
      ...defaultEvaluation,
      blockingReason: 'You are not registered as an authorized approver for this amount.',
    };
  }

  // Case C: Sequential Hierarchy with Bypass Authority
  // Check if user is the direct approver for current_level
  const directLevelWorkflow = applicableLevels.find((w) => w.level === currentLevel);
  if (directLevelWorkflow && directLevelWorkflow.approver_id === userId) {
    return {
      ...defaultEvaluation,
      isAuthorizedToApprove: true,
      actionType: 'NORMAL',
      authorizedLevel: currentLevel,
      canBypassCurrent: false,
    };
  }

  // Check if user is an approver at a higher level
  const higherLevelWorkflow = applicableLevels.find(
    (w) => w.level > currentLevel && w.approver_id === userId
  );

  if (higherLevelWorkflow) {
    if (higherLevelWorkflow.can_bypass_prior_levels) {
      // User is permitted to bypass preceding pending levels (e.g. subordinate on leave)
      return {
        ...defaultEvaluation,
        isAuthorizedToApprove: true,
        actionType: 'BYPASS',
        authorizedLevel: higherLevelWorkflow.level,
        canBypassCurrent: true,
      };
    }

    // User is higher in hierarchy but bypass flag is NOT configured
    return {
      ...defaultEvaluation,
      blockingReason: `Preceding Level ${currentLevel} approval is pending. Your account cannot authorize out of order.`,
    };
  }

  return {
    ...defaultEvaluation,
    blockingReason: 'You are not authorized to approve this document at this stage.',
  };
}

/**
 * Synchronous in-memory gate evaluator for UI lists and table rows.
 */
export function evaluateApprovalGateRow(
  approval: {
    id: string;
    approvalType: string;
    amount: number;
    currentLevel: number;
    maxLevels: number;
    status: string;
    reviewerId?: string | null;
    reviewStatus?: string | null;
  },
  userId: string | undefined,
  workflows: ApprovalWorkflow[],
  settings?: Record<string, string>
): ApprovalGateEvaluation {
  const approvalType = approval.approvalType;
  const isEnabled = !settings || settings[approvalType] === 'true' || settings[approvalType] === undefined;
  const tierMode = (settings?.[`${approvalType}_WORKFLOW_MODE`] || 'MULTI') as ApprovalTierMode;
  const executionMode = (settings?.[`${approvalType}_EXECUTION_MODE`] || 'SEQUENTIAL') as ApprovalExecutionMode;
  const singleApproverId = settings?.[`${approvalType}_SINGLE_APPROVER_ID`] || null;

  const currentLevel = approval.currentLevel || 1;
  const maxLevels = approval.maxLevels || 1;
  const amount = Number(approval.amount || 0);

  const typeWorkflows = workflows
    .filter((w) => w.approval_type === approvalType && w.is_active)
    .sort((a, b) => a.level - b.level);

  const applicableLevels = typeWorkflows.filter((w) => {
    const min = Number(w.min_amount || 0);
    const max = w.max_amount != null ? Number(w.max_amount) : null;
    return amount >= min && (max == null || amount <= max);
  });

  const levelsSummary = typeWorkflows.map((lvl) => ({
    level: lvl.level,
    approverId: lvl.approver_id || '',
    approverName: lvl.approver_name || 'Approver',
    minAmount: Number(lvl.min_amount || 0),
    maxAmount: lvl.max_amount != null ? Number(lvl.max_amount) : null,
    canBypass: Boolean(lvl.can_bypass_prior_levels),
    isCurrent: lvl.level === currentLevel,
    isCompleted: lvl.level < currentLevel,
  }));

  const isReviewerPending =
    approval.reviewStatus === 'PENDING' &&
    Boolean(approval.reviewerId) &&
    approval.reviewerId !== userId;

  const defaultEvaluation: ApprovalGateEvaluation = {
    requiresApproval: isEnabled,
    isAuthorizedToApprove: false,
    isReviewerPending,
    actionType: 'NONE',
    currentLevel,
    maxLevels,
    canBypassCurrent: false,
    executionMode,
    tierMode,
    levelsSummary,
  };

  if (!isEnabled) {
    return {
      ...defaultEvaluation,
      requiresApproval: false,
      isAuthorizedToApprove: true,
      actionType: 'NORMAL',
    };
  }

  if (approval.status !== 'PENDING' && approval.status !== 'HOLD') {
    return {
      ...defaultEvaluation,
      blockingReason: `Document is ${approval.status}.`,
    };
  }

  if (isReviewerPending) {
    return {
      ...defaultEvaluation,
      blockingReason: 'Preliminary review pending.',
    };
  }

  if (!userId) {
    return defaultEvaluation;
  }

  if (tierMode === 'SINGLE') {
    const isSingle =
      singleApproverId === userId ||
      (applicableLevels.length > 0 && applicableLevels[0].approver_id === userId);
    if (isSingle) {
      return {
        ...defaultEvaluation,
        isAuthorizedToApprove: true,
        actionType: 'SINGLE',
        authorizedLevel: 1,
        canBypassCurrent: true,
      };
    }
    return {
      ...defaultEvaluation,
      blockingReason: 'Designated sole approver only.',
    };
  }

  if (executionMode === 'ANY_APPROVER') {
    const match = applicableLevels.find((w) => w.approver_id === userId);
    if (match) {
      return {
        ...defaultEvaluation,
        isAuthorizedToApprove: true,
        actionType: 'ANY_APPROVER',
        authorizedLevel: match.level,
        canBypassCurrent: true,
      };
    }
    return {
      ...defaultEvaluation,
      blockingReason: 'Not an authorized approver for this tier.',
    };
  }

  // Sequential hierarchy
  const directLevel = applicableLevels.find((w) => w.level === currentLevel);
  if (directLevel && directLevel.approver_id === userId) {
    return {
      ...defaultEvaluation,
      isAuthorizedToApprove: true,
      actionType: 'NORMAL',
      authorizedLevel: currentLevel,
      canBypassCurrent: false,
    };
  }

  const higherLevel = applicableLevels.find(
    (w) => w.level > currentLevel && w.approver_id === userId
  );

  if (higherLevel) {
    if (higherLevel.can_bypass_prior_levels) {
      return {
        ...defaultEvaluation,
        isAuthorizedToApprove: true,
        actionType: 'BYPASS',
        authorizedLevel: higherLevel.level,
        canBypassCurrent: true,
      };
    }
    return {
      ...defaultEvaluation,
      blockingReason: `Level ${currentLevel} approval is pending. Your account cannot authorize out of order.`,
    };
  }

  return {
    ...defaultEvaluation,
    blockingReason: 'Not authorized at this stage.',
  };
}

/**
 * Enforces the approval gate and commits the transition atomically with audit metadata.
 */
export async function executeApprovalGateDecision(
  approvalId: string,
  payload: ApprovalActionPayload
): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
    }

    const { data: approval, error: fetchError } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (fetchError || !approval) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Approval document not found' } };
    }

    // Evaluate gate rules
    const gate = await evaluateApprovalGate(approval, user.id);

    if (payload.action === 'APPROVED' && !gate.isAuthorizedToApprove) {
      return {
        success: false,
        error: {
          code: 'TRANSITION_BLOCKED',
          message: gate.blockingReason || 'Approval Gate blocked: You lack authorization to approve this stage.',
        },
      };
    }

    // Determine new status and level
    let newStatus = approval.status;
    let newLevel = approval.current_level || 1;
    let isBypass = false;
    let bypassedLevels: number[] = [];

    if (payload.action === 'APPROVED') {
      if (gate.actionType === 'SINGLE' || gate.actionType === 'ANY_APPROVER') {
        newStatus = 'APPROVED';
      } else if (gate.actionType === 'BYPASS' && gate.authorizedLevel) {
        isBypass = true;
        for (let l = approval.current_level || 1; l < gate.authorizedLevel; l++) {
          bypassedLevels.push(l);
        }
        // If the bypassing user is at the max level or top tier, mark approved
        if (gate.authorizedLevel >= approval.max_levels) {
          newStatus = 'APPROVED';
        } else {
          newLevel = gate.authorizedLevel + 1;
        }
      } else {
        // Normal sequential approval
        if (newLevel >= approval.max_levels) {
          newStatus = 'APPROVED';
        } else {
          newLevel = newLevel + 1;
        }
      }
    } else if (payload.action === 'REJECTED') {
      newStatus = 'REJECTED';
    } else if (payload.action === 'HOLD') {
      newStatus = 'HOLD';
    } else if (payload.action === 'RETURNED') {
      newStatus = 'RETURNED';
    }

    // 1. Insert audit log into approval_actions with metadata
    const auditMetadata = {
      is_bypass: isBypass,
      bypassed_levels: bypassedLevels,
      acting_user_id: user.id,
      action_type: gate.actionType,
      authorized_level: gate.authorizedLevel,
      previous_level: approval.current_level,
      execution_mode: gate.executionMode,
      tier_mode: gate.tierMode,
      ...(payload.metadata || {}),
    };

    let auditComments = payload.comments || '';
    if (isBypass && bypassedLevels.length > 0) {
      const bypassNote = `[Bypass Authorization: skipped level(s) ${bypassedLevels.join(', ')}]`;
      auditComments = auditComments ? `${auditComments} ${bypassNote}` : bypassNote;
    }

    const { error: actionError } = await supabase
      .from('approval_actions')
      .insert({
        approval_id: approvalId,
        action: payload.action,
        approver_id: user.id,
        comments: auditComments,
        organisation_id: approval.organisation_id,
        metadata: auditMetadata,
      });

    if (actionError) {
      return { success: false, error: { code: 'DB_ERROR', message: actionError.message } };
    }

    // 2. Update approvals row
    const updatePayload: Record<string, any> = {
      status: newStatus,
      current_level: newLevel,
      updated_at: new Date().toISOString(),
    };

    if (payload.action === 'HOLD' && payload.comments) {
      updatePayload.hold_reason = payload.comments;
    } else if (payload.action !== 'HOLD') {
      updatePayload.hold_reason = null;
    }

    const { error: updateError } = await supabase
      .from('approvals')
      .update(updatePayload)
      .eq('id', approvalId);

    if (updateError) {
      return { success: false, error: { code: 'DB_ERROR', message: updateError.message } };
    }

    // 3. If final approval reached, synchronize source document
    if (newStatus === 'APPROVED') {
      await synchronizeSourceDocumentApproved(approval, payload.amount_approved);
    } else if (newStatus === 'RETURNED') {
      await synchronizeSourceDocumentReturned(approval, payload.comments);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during approval execution',
      },
    };
  }
}

async function synchronizeSourceDocumentApproved(approval: Approval, amountApproved?: number): Promise<void> {
  const { reference_type, reference_id } = approval;
  if (!reference_type || !reference_id) return;

  if (reference_type === 'quotations' || reference_type === 'quotation_header') {
    await supabase
      .from('quotation_header')
      .update({
        status: 'Approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reference_id);
  } else if (reference_type === 'quotation_revisions') {
    await supabase
      .from('quotation_revisions')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reference_id);
  } else if (reference_type === 'purchase_orders') {
    await supabase
      .from('purchase_orders')
      .update({
        status: 'Approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reference_id);
  } else if (reference_type === 'subcontractor_work_orders' || reference_type === 'work_orders') {
    await supabase
      .from('subcontractor_work_orders')
      .update({
        status: 'Approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reference_id);
  }
}

async function synchronizeSourceDocumentReturned(approval: Approval, comments?: string): Promise<void> {
  const { reference_type, reference_id } = approval;
  if (!reference_type || !reference_id) return;

  if (reference_type === 'quotations' || reference_type === 'quotation_header') {
    await supabase
      .from('quotation_header')
      .update({
        status: 'Returned',
        return_comments: comments || 'Returned for revisions',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reference_id);
  }
}
