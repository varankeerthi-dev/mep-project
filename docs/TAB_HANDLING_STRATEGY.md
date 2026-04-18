# Tab Handling Strategy

## Overview

This document explains how the MEP Project handles tab visibility and user presence to prevent performance issues like page freezing and query storms.

## Problem

Previously, the app had multiple conflicting tab visibility systems:
1. `useTabVisibility` - Core visibility detection
2. `useTabFocus` - Window focus tracking  
3. `PresenceContext` - Idle detection (30s timeout)
4. `useRequestManager` - Aggressively cancelled requests on hidden

This caused:
- Pages becoming inactive/frozen after a few seconds
- In-flight requests being cancelled mid-execution
- Data inconsistency on tab return
- Query storms when returning to the tab

## Current Solution

### 1. React Query Configuration (`src/queryClient.ts`)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min - data stays fresh
      gcTime: 10 * 60 * 1000,          // 10 min - reduced from 30min
      refetchOnWindowFocus: false,      // ❌ PREVENTS query storm
      refetchOnMount: 'ifStale',        // ✅ Only refetch stale data
      refetchOnReconnect: false,         // ❌ PREVENTS network recovery storm
      retry: 1,                         // Single retry
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'online',
    },
  },
});
```

**Why this works:**
- `staleTime: 5min` - Data is served from cache for 5 minutes without loading
- `gcTime: 10min` - Cache survives 10 minutes of inactivity
- `refetchOnWindowFocus: false` - Tab return doesn't trigger all queries
- `refetchOnReconnect: false` - Network recovery doesn't cause query storm

### 2. Request Manager (`src/hooks/useRequestManager.ts`)

The request manager:
- ✅ Does NOT cancel in-flight requests when tab becomes hidden
- ✅ Uses 500ms debounce to prevent rapid toggle issues
- ✅ Only pauses NEW request creation when tab is hidden
- ✅ Allows in-flight requests to complete naturally

```typescript
// Debounce visibility changes
visibilityTimeoutRef.current = window.setTimeout(() => {
  globalPausedRef.current = true;  // Only pauses new requests
}, 500);
```

### 3. Session Heartbeat (`src/App.tsx`)

The auth session check:
- Throttled to once every 5 minutes
- Uses `requestIdleCallback` to avoid blocking
- Only checks auth token validity, not data

## Tab Return Flow

1. **User returns to tab** → `handleVisibility` fires
2. **Session check queued** via `requestIdleCallback`
3. **React Query serves cached data immediately** (no loading spinner)
4. **Background refetch** happens only for stale queries
5. **No query storm** because `refetchOnWindowFocus: false`

## Deprecated/Unused Hooks

The following hooks are **NOT used** anywhere in the app:

| Hook | File | Status |
|------|------|--------|
| `PresenceProvider` | `PresenceContext.tsx` | ❌ Unused |
| `usePresence` | `usePresence.ts` | ❌ Unused |
| `useTabFocus` | `useTabFocus.ts` | ❌ Unused |
| `usePresenceAware` | `usePresenceAware.ts` | ❌ Unused |
| `TabActivityProvider` | `TabActivityContext.tsx` | ❌ Unused |

These hooks are kept for reference but should NOT be used in new code.

## Standardized Query Keys

All data hooks use standardized query keys from `src/utils/queryKeys.ts`:

```typescript
import { queryKeys } from '../utils/queryKeys';

// Example usage
useQuery({
  queryKey: queryKeys.materials(organisation?.id),
  queryFn: () => supabase.from('materials').select('*'),
});
```

Benefits:
- Consistent cache coordination
- Easy query invalidation
- Type-safe key generation
