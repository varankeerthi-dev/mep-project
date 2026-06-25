import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { withSessionCheck } from '../queryClient';
import type {
  IssueFilters,
  IssueInput,
  IssueUpdateInput,
  IssueStatusUpdate,
  Issue,
} from './types';
import {
  getIssues,
  getIssueCount,
  getIssueById,
  createIssue,
  updateIssue,
  updateIssueStatus,
  assignIssue,
  deleteIssue,
  getIssueAttachments,
  addIssueAttachment,
  deleteIssueAttachment,
  getIssueActivityLogs,
  getIssueComments,
  addIssueComment,
  deleteIssueComment,
  getIssueStats,
  getIssuesBySystem,
  getIssuesBySubcontractor,
  type IssueStats,
  type IssuesBySystem,
  type IssuesBySubcontractor,
} from './api';

export const issueKeys = {
  all: ['issues'] as const,
  lists: () => [...issueKeys.all, 'list'] as const,
  list: (filters: IssueFilters) => [...issueKeys.lists(), filters] as const,
  counts: () => [...issueKeys.all, 'count'] as const,
  count: (filters: IssueFilters) => [...issueKeys.counts(), filters] as const,
  details: () => [...issueKeys.all, 'detail'] as const,
  detail: (id: string) => [...issueKeys.details(), id] as const,
  attachments: (issueId: string) => [...issueKeys.all, 'attachments', issueId] as const,
  activity: (issueId: string) => [...issueKeys.all, 'activity', issueId] as const,
  comments: (issueId: string) => [...issueKeys.all, 'comments', issueId] as const,
  stats: (orgId: string, projectId?: string) => [...issueKeys.all, 'stats', orgId, projectId] as const,
  bySystem: (orgId: string, projectId?: string) => [...issueKeys.all, 'bySystem', orgId, projectId] as const,
  bySubcontractor: (orgId: string, projectId?: string) => [...issueKeys.all, 'bySub', orgId, projectId] as const,
};

export function useIssues(filters: IssueFilters) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: issueKeys.list(filters),
    queryFn: () => getIssues(filters),
    enabled: !!filters.organisationId || !!organisation?.id,
  });
}

export function useIssueCount(filters: IssueFilters) {
  const { organisation } = useAuth();
  return useQuery({
    queryKey: issueKeys.count(filters),
    queryFn: () => getIssueCount(filters),
    enabled: !!filters.organisationId || !!organisation?.id,
  });
}

export function useIssue(id: string | null) {
  return useQuery({
    queryKey: issueKeys.detail(id || ''),
    queryFn: () => getIssueById(id!),
    enabled: !!id,
  });
}

export function useIssueAttachments(issueId: string) {
  return useQuery({
    queryKey: issueKeys.attachments(issueId),
    queryFn: () => getIssueAttachments(issueId),
    enabled: !!issueId,
  });
}

export function useIssueActivityLogs(issueId: string) {
  return useQuery({
    queryKey: issueKeys.activity(issueId),
    queryFn: () => getIssueActivityLogs(issueId),
    enabled: !!issueId,
  });
}

export function useIssueComments(issueId: string) {
  return useQuery({
    queryKey: issueKeys.comments(issueId),
    queryFn: () => getIssueComments(issueId),
    enabled: !!issueId,
  });
}

export function useIssueStats(organisationId: string, projectId?: string) {
  return useQuery({
    queryKey: issueKeys.stats(organisationId, projectId),
    queryFn: () => getIssueStats(organisationId, projectId),
    enabled: !!organisationId,
  });
}

export function useIssuesBySystem(organisationId: string, projectId?: string) {
  return useQuery({
    queryKey: issueKeys.bySystem(organisationId, projectId),
    queryFn: () => getIssuesBySystem(organisationId, projectId),
    enabled: !!organisationId,
  });
}

export function useIssuesBySubcontractor(organisationId: string, projectId?: string) {
  return useQuery({
    queryKey: issueKeys.bySubcontractor(organisationId, projectId),
    queryFn: () => getIssuesBySubcontractor(organisationId, projectId),
    enabled: !!organisationId,
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((input: IssueInput) => {
      if (!organisation?.id) throw new Error('Organisation not found');
      if (!user?.id) throw new Error('User not found');
      const userName = (user as any)?.full_name || user.email || 'Unknown User';
      return createIssue(input, user.id, userName);
    }),
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.stats(organisation?.id || '') });
      queryClient.setQueryData(issueKeys.detail(issue.id), issue);
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck(({ id, input }: { id: string; input: IssueUpdateInput }) => {
      if (!user?.id) throw new Error('User not found');
      const userName = (user as any)?.full_name || user.email || 'Unknown User';
      return updateIssue(id, input, user.id, userName);
    }),
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.stats(organisation?.id || '') });
      queryClient.setQueryData(issueKeys.detail(issue.id), issue);
    },
  });
}

export function useUpdateIssueStatus() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck(({ id, update }: { id: string; update: IssueStatusUpdate }) => {
      if (!user?.id) throw new Error('User not found');
      const userName = (user as any)?.full_name || user.email || 'Unknown User';
      return updateIssueStatus(id, update, user.id, userName);
    }),
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.stats(organisation?.id || '') });
      queryClient.invalidateQueries({ queryKey: issueKeys.activity(issue.id) });
      queryClient.setQueryData(issueKeys.detail(issue.id), issue);
    },
  });
}

export function useAssignIssue() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck(({ id, assignTo, assignToName }: { id: string; assignTo: string; assignToName: string }) => {
      if (!user?.id) throw new Error('User not found');
      const userName = (user as any)?.full_name || user.email || 'Unknown User';
      return assignIssue(id, assignTo, assignToName, user.id, userName);
    }),
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.activity(issue.id) });
      queryClient.setQueryData(issueKeys.detail(issue.id), issue);
    },
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck((id: string) => deleteIssue(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.stats(organisation?.id || '') });
    },
  });
}

export function useAddIssueAttachment() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck(({
      issueId,
      attachment,
    }: {
      issueId: string;
      attachment: {
        file_url: string;
        file_name?: string;
        file_type?: string;
        file_size?: number;
        caption?: string;
        is_before?: boolean;
        is_after?: boolean;
      };
    }) => {
      if (!organisation?.id) throw new Error('Organisation not found');
      if (!user?.id) throw new Error('User not found');
      return addIssueAttachment(issueId, organisation.id, attachment, user.id);
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.attachments(variables.issueId) });
      queryClient.invalidateQueries({ queryKey: issueKeys.activity(variables.issueId) });
    },
  });
}

export function useDeleteIssueAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(({ id, issueId }: { id: string; issueId: string }) =>
      deleteIssueAttachment(id)
    ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.attachments(variables.issueId) });
    },
  });
}

export function useAddIssueComment() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: withSessionCheck(({
      issueId,
      comment,
      isInternal,
    }: {
      issueId: string;
      comment: string;
      isInternal?: boolean;
    }) => {
      if (!organisation?.id) throw new Error('Organisation not found');
      if (!user?.id) throw new Error('User not found');
      const userName = (user as any)?.full_name || user.email || 'Unknown User';
      return addIssueComment(issueId, organisation.id, comment, isInternal || false, user.id, userName);
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.comments(variables.issueId) });
      queryClient.invalidateQueries({ queryKey: issueKeys.activity(variables.issueId) });
    },
  });
}

export function useDeleteIssueComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(({ id, issueId }: { id: string; issueId: string }) =>
      deleteIssueComment(id)
    ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.comments(variables.issueId) });
    },
  });
}