// store.ts — UI-only Zustand state for the collaboration composer + filters.
import { create } from 'zustand';
import type { CollaborationFilter, MessageDraft } from './types';

export interface CollabTaskCreateInitial {
  title?: string;
  description?: string;
  assigneeIds?: string[];
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  checklistTitles?: string[];
  projectId?: string | null;
  channelId?: string;
}

export interface CollabReminderCreateInitial {
  messageId: string;
  channelId: string;
  projectId?: string | null;
  defaultTitle?: string;
  defaultNotes?: string;
}

export type CollabActiveScope = 'company' | 'project';

interface CollabUIState {
  composerDrafts: Record<string, MessageDraft>;     // keyed by channelId
  openThreadId: string | null;
  filter: CollaborationFilter;
  mobileDrawerOpen: boolean;
  prefersReducedMotion: boolean;
  centerCollapsed: boolean;
  threadCollapsed: boolean;
  openProjectIds: string[];                          // multi-pane: open project tabs
  activeProjectId: string | null;                    // pane the thread rail is anchored to

  // Company channels (e.g. #general for whole org)
  isCompanyChannelOpen: boolean;
  activeScope: CollabActiveScope;
  activeCompanyChannelName: string;

  // Task & Reminder drawers
  taskCreateDrawerOpen: boolean;
  taskCreateInitial: CollabTaskCreateInitial | null;
  taskDetailId: string | null;
  reminderDrawerOpen: boolean;
  reminderInitial: CollabReminderCreateInitial | null;

  /** A message id the list should scroll to, then clear. */
  scrolledToMessageId: string | null;
  setScrolledToMessageId: (id: string | null) => void;

  setDraft: (channelId: string, draft: MessageDraft) => void;
  clearDraft: (channelId: string) => void;
  setOpenThread: (messageId: string | null) => void;
  setFilter: (filter: CollaborationFilter) => void;
  toggleMobileDrawer: () => void;
  setMobileDrawer: (open: boolean) => void;
  setPrefersReducedMotion: (val: boolean) => void;
  toggleCenter: () => void;
  toggleThread: () => void;
  /** Open or focus a project in the multi-pane area. */
  openProject: (projectId: string) => void;
  /** Close a single project pane. */
  closeProject: (projectId: string) => void;
  /** Mark a pane as active (the thread rail is anchored to it). */
  setActiveProject: (projectId: string | null) => void;
  /** Hard reset when switching active project so no stale state leaks. */
  resetForProject: (projectId: string) => void;

  /** Open or focus company channel (e.g. #general). */
  openCompanyChannel: (name?: string) => void;
  /** Close company channel pane. */
  closeCompanyChannel: () => void;
  /** Set active scope ('company' | 'project'). */
  setActiveScope: (scope: CollabActiveScope) => void;

  openTaskCreate: (initial?: CollabTaskCreateInitial) => void;
  closeTaskCreate: () => void;
  openTaskDetail: (taskId: string) => void;
  closeTaskDetail: () => void;
  openReminderCreate: (initial: CollabReminderCreateInitial) => void;
  closeReminderCreate: () => void;
}

export const useCollabStore = create<CollabUIState>((set) => ({
  composerDrafts: {},
  openThreadId: null,
  filter: 'all',
  mobileDrawerOpen: false,
  prefersReducedMotion: false,
  centerCollapsed: false,
  threadCollapsed: false,
  openProjectIds: [],
  activeProjectId: null,

  isCompanyChannelOpen: false,
  activeScope: 'company',
  activeCompanyChannelName: 'general',

  taskCreateDrawerOpen: false,
  taskCreateInitial: null,
  taskDetailId: null,
  reminderDrawerOpen: false,
  reminderInitial: null,
  scrolledToMessageId: null,
  setScrolledToMessageId: (id) => set({ scrolledToMessageId: id }),

  openTaskCreate: (initial) =>
    set({
      taskCreateDrawerOpen: true,
      taskCreateInitial: initial ?? null,
    }),
  closeTaskCreate: () =>
    set({
      taskCreateDrawerOpen: false,
      taskCreateInitial: null,
    }),
  openTaskDetail: (taskId) => set({ taskDetailId: taskId }),
  closeTaskDetail: () => set({ taskDetailId: null }),

  openReminderCreate: (initial) =>
    set({
      reminderDrawerOpen: true,
      reminderInitial: initial,
    }),
  closeReminderCreate: () =>
    set({
      reminderDrawerOpen: false,
      reminderInitial: null,
    }),

  setDraft: (channelId, draft) =>
    set((s) => ({ composerDrafts: { ...s.composerDrafts, [channelId]: draft } })),

  clearDraft: (channelId) =>
    set((s) => {
      const next = { ...s.composerDrafts };
      delete next[channelId];
      return { composerDrafts: next };
    }),

  setOpenThread: (messageId) => set({ openThreadId: messageId }),
  setFilter: (filter) => set({ filter }),
  toggleMobileDrawer: () => set((s) => ({ mobileDrawerOpen: !s.mobileDrawerOpen })),
  setMobileDrawer: (open) => set({ mobileDrawerOpen: open }),
  setPrefersReducedMotion: (val) => set({ prefersReducedMotion: val }),
  toggleCenter: () => set((s) => ({ centerCollapsed: !s.centerCollapsed })),
  toggleThread: () => set((s) => ({ threadCollapsed: !s.threadCollapsed })),

  openProject: (projectId) =>
    set((s) => {
      if (s.openProjectIds.includes(projectId)) {
        return { activeProjectId: projectId, activeScope: 'project' };
      }
      return {
        openProjectIds: [...s.openProjectIds, projectId],
        activeProjectId: projectId,
        activeScope: 'project',
      };
    }),

  closeProject: (projectId) =>
    set((s) => {
      const next = s.openProjectIds.filter((id) => id !== projectId);
      const wasActive = s.activeProjectId === projectId;
      const nextActive = wasActive
        ? (next.length > 0 ? next[next.length - 1] : null)
        : s.activeProjectId;
      return {
        openProjectIds: next,
        activeProjectId: nextActive,
        activeScope: nextActive ? 'project' : (s.isCompanyChannelOpen ? 'company' : 'company'),
        // If the open thread was attached to the closed project, close it.
        openThreadId: wasActive ? null : s.openThreadId,
      };
    }),

  setActiveProject: (projectId) =>
    set({
      activeProjectId: projectId,
      activeScope: projectId ? 'project' : 'company',
    }),

  openCompanyChannel: (name = 'general') =>
    set({
      isCompanyChannelOpen: true,
      activeScope: 'company',
      activeCompanyChannelName: name,
    }),

  closeCompanyChannel: () =>
    set((s) => {
      const fallbackScope = s.openProjectIds.length > 0 ? 'project' : 'company';
      return {
        isCompanyChannelOpen: false,
        activeScope: fallbackScope,
        openThreadId: s.activeScope === 'company' ? null : s.openThreadId,
      };
    }),

  setActiveScope: (scope) => set({ activeScope: scope }),

  resetForProject: () =>
    set({
      openThreadId: null,
      mobileDrawerOpen: false,
    }),
}));
