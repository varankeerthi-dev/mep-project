// store.ts — UI-only Zustand state for the collaboration composer + filters.
import { create } from 'zustand';
import type { CollaborationFilter, MessageDraft } from './types';

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
        return { activeProjectId: projectId };
      }
      return {
        openProjectIds: [...s.openProjectIds, projectId],
        activeProjectId: projectId,
      };
    }),

  closeProject: (projectId) =>
    set((s) => {
      const next = s.openProjectIds.filter((id) => id !== projectId);
      const wasActive = s.activeProjectId === projectId;
      return {
        openProjectIds: next,
        activeProjectId: wasActive
          ? (next.length > 0 ? next[next.length - 1] : null)
          : s.activeProjectId,
        // If the open thread was attached to the closed project, close it.
        openThreadId: wasActive ? null : s.openThreadId,
      };
    }),

  setActiveProject: (projectId) => set({ activeProjectId: projectId }),

  resetForProject: () =>
    set({
      openThreadId: null,
      mobileDrawerOpen: false,
    }),
}));
