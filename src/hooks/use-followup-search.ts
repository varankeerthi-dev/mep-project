import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 300;

export function useFollowupSearch(urlQuery: string, onCommit: (value: string) => void) {
  const [local, setLocal] = useState(urlQuery);

  useEffect(() => {
    setLocal(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (local !== urlQuery) {
        onCommit(local);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [local, urlQuery, onCommit]);

  return { search: local, setSearch: setLocal };
}
