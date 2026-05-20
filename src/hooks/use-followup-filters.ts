import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_FOLLOWUP_FILTERS,
  type FollowUpFiltersState,
  type FollowUpTab,
} from '../types/followup';

const TAB_VALUES: FollowUpTab[] = ['queue', 'quotation', 'podc', 'invoice', 'activity'];

function parseTab(value: string | null): FollowUpTab {
  if (value && TAB_VALUES.includes(value as FollowUpTab)) {
    return value as FollowUpTab;
  }
  return 'queue';
}

export function useFollowupFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FollowUpFiltersState = useMemo(
    () => ({
      tab: parseTab(searchParams.get('tab')),
      q: searchParams.get('q') ?? DEFAULT_FOLLOWUP_FILTERS.q,
      status: searchParams.get('status') ?? DEFAULT_FOLLOWUP_FILTERS.status,
      expiringSoon: searchParams.get('expiring') === '1',
      sort: searchParams.get('sort') ?? DEFAULT_FOLLOWUP_FILTERS.sort,
      dateFrom: searchParams.get('from') ?? '',
      dateTo: searchParams.get('to') ?? '',
      escalationStage: searchParams.get('stage') ?? DEFAULT_FOLLOWUP_FILTERS.escalationStage,
      assignee: searchParams.get('assignee') ?? DEFAULT_FOLLOWUP_FILTERS.assignee,
    }),
    [searchParams]
  );

  const setFilters = useCallback(
    (patch: Partial<FollowUpFiltersState>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (patch.tab !== undefined) next.set('tab', patch.tab);
          if (patch.q !== undefined) {
            if (patch.q) next.set('q', patch.q);
            else next.delete('q');
          }
          if (patch.status !== undefined) {
            if (patch.status && patch.status !== 'all') next.set('status', patch.status);
            else next.delete('status');
          }
          if (patch.expiringSoon !== undefined) {
            if (patch.expiringSoon) next.set('expiring', '1');
            else next.delete('expiring');
          }
          if (patch.sort !== undefined) next.set('sort', patch.sort);
          if (patch.dateFrom !== undefined) {
            if (patch.dateFrom) next.set('from', patch.dateFrom);
            else next.delete('from');
          }
          if (patch.dateTo !== undefined) {
            if (patch.dateTo) next.set('to', patch.dateTo);
            else next.delete('to');
          }
          if (patch.escalationStage !== undefined) {
            if (patch.escalationStage && patch.escalationStage !== 'all') {
              next.set('stage', patch.escalationStage);
            } else next.delete('stage');
          }
          if (patch.assignee !== undefined) {
            if (patch.assignee && patch.assignee !== 'all') next.set('assignee', patch.assignee);
            else next.delete('assignee');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setTab = useCallback(
    (tab: FollowUpTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();
          next.set('tab', tab);
          const q = prev.get('q');
          if (q) next.set('q', q);
          const assignee = prev.get('assignee');
          if (assignee) next.set('assignee', assignee);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { filters, setFilters, setTab };
}
