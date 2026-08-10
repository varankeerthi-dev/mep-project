// src/warehouse/viewer/viewerTypes.ts
// Shared UI types for the Warehouse Viewer.

export type Selection =
  | { kind: 'floor'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'rack'; id: string }
  | { kind: 'bin'; id: string }
  | null;

export type ViewMode = 'occupancy' | 'role';
