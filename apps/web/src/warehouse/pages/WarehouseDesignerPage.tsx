import { Button } from '../../components/ui/button';
// src/warehouse/pages/WarehouseDesignerPage.tsx
// Warehouse Designer (PRD §5). Split screen: configuration wizard (left)
// + live 2D preview (right). Workflow mirrors PRD §5.4:
//   Warehouse → Floors → Zones → Layout → Racks → Naming → Generate → Save
//
// Phase 1.5 additions (gap closure):
//   • Multiple layouts per zone (PRD §3.8/§5.9) — layout tabs + add/dup/remove
//   • Undo/redo history stack (PRD §5.20) via useDesignerHistory
//   • Full validation checklist (PRD §5.21) via validations.validateDraft
//   • Layout config fields (PRD §5.10) — orientation/scale/rotation/aisle/walkway/direction
//   • Visual layout template cards (PRD §5.8)
//   • Drag & drop floor/zone reordering (PRD §5.6/§5.18)
//   • Duplicate zone/layout (PRD §5.19)
//   • Dialog-based feedback instead of alert()

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Warehouse, Building2, LayoutGrid, Rows3, Type, Save, ArrowLeft, ArrowRight, Check, Loader2,
  Trash2, Plus, Undo2, Redo2, Copy, History, X, Settings2, GripVertical, Boxes, TriangleAlert,
} from 'lucide-react';
import type { WarehouseDraft, LayoutType, StorageRole, LayoutDraft, LayoutVersionRow, CapacityProfileRow } from '../types';
import { STORAGE_ROLES, LAYOUT_TYPES, RACK_TYPES, createEmptyFloor, createEmptyWarehouse, DEFAULT_LAYOUT_CONFIG } from '../types';
import { binNamePreview, expandRacks, overridesFromPositions } from '../namingEngine';
import {
  updateWarehouse as reduceWarehouse,
  updateFloor as reduceFloor,
  updateZone as reduceZone,
  updateLayout as reduceLayout,
  updateLayoutConfig as reduceLayoutConfig,
  updateRacks as reduceRacks,
  updateNaming as reduceNaming,
  addFloor as reduceAddFloor,
  removeFloor as reduceRemoveFloor,
  addZone as reduceAddZone,
  removeZone as reduceRemoveZone,
  duplicateZone as reduceDuplicateZone,
  addLayout as reduceAddLayout,
  removeLayout as reduceRemoveLayout,
  duplicateLayout as reduceDuplicateLayout,
  moveFloor as reduceMoveFloor,
  moveZone as reduceMoveZone,
  reduceMoveRack,
  countRacks as reduceCountRacks,
  remapDraftIds as reduceRemapDraftIds,
} from '../draftReducers';
import { validateDraft, type ValidationProblem } from '../validations';
import { useDesignerHistory } from '../hooks/useDesignerHistory';
import { useSaveWarehouseDraft, useWarehouseStructure } from '../hooks/useWarehouseData';
import { useAuth } from '../../contexts/AuthContext';
import { useMyPermissions } from '../../rbac/hooks';
import WarehousePreview from '../components/designer/WarehousePreview';
import CapacityProfilesDialog from '../components/designer/CapacityProfilesDialog';
import VersionHistoryDialog from '../components/designer/VersionHistoryDialog';

interface Props {
  onNavigate?: (path: string) => void;
}

const STEPS = [
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse },
  { id: 'floors', label: 'Floors', icon: Building2 },
  { id: 'zone', label: 'Zones & Layout', icon: LayoutGrid },
  { id: 'racks', label: 'Rack Generator', icon: Rows3 },
  { id: 'naming', label: 'Naming Engine', icon: Type },
  { id: 'save', label: 'Review & Save', icon: Save },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function WarehouseDesignerPage({ onNavigate }: Props) {
  const navigate = onNavigate ?? (useNavigate() as (p: string) => void);
  // App.tsx routes via a plain switch (no <Route> elements), so useParams()
  // is dead here. Parse the id from the pathname, same as ManufacturingShell.
  const location = useLocation();
  const existingWarehouseId = location.pathname.split('/warehouse/designer/')[1] || undefined;
  const saveDraft = useSaveWarehouseDraft();
  const { data: structure, isLoading: structureLoading } = useWarehouseStructure(existingWarehouseId);

  const [initialDraft] = useState(() => createEmptyWarehouse());
  const { draft, setDraft, undo, redo, reset, canUndo, canRedo } = useDesignerHistory(initialDraft);

  const [step, setStep] = useState<StepId>('warehouse');
  const [selectedFloorId, setSelectedFloorId] = useState<string>(initialDraft.floors[0]?.id ?? '');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(initialDraft.floors[0]?.zones[0]?.id ?? '');
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>(initialDraft.floors[0]?.zones[0]?.layouts[0]?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<ValidationProblem[] | null>(null);
  const [saveResult, setSaveResult] = useState<{ rackCount: number; binCount: number; layoutCount: number; warehouseId: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCapacity, setShowCapacity] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Permission guard (Phase 0 deliverable — RBAC). Design/save requires
  // warehouses.create (new) or warehouses.update (existing); admin overrides.
  const { user, organisation } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions(user?.id, (organisation as any)?.id ?? null);
  const canDesign = useMemo(() => {
    if (permissionsLoading || !permissions) return false; // permissions not loaded yet — optimistically allow
    if (permissions.includes('admin_all_access' as any)) return true;
    return existingWarehouseId
      ? permissions.includes('warehouses.update' as any) || permissions.includes('warehouses.design' as any)
      : permissions.includes('warehouses.create' as any) || permissions.includes('warehouses.design' as any);
  }, [permissions, permissionsLoading, existingWarehouseId]);

  // Hydrate the draft from the saved structure when opening an existing warehouse.
  useEffect(() => {
    if (!existingWarehouseId || !structure || structureLoading) return;
    const wh = structure.warehouse as any;
    const floors: WarehouseDraft['floors'] = structure.floors.map((f, fi) => ({
      id: f.id,
      name: f.name,
      code: f.code ?? '',
      description: f.description ?? '',
      displayOrder: fi + 1,
      zones: structure.zones
        .filter(z => z.floor_id === f.id)
        .map(z => {
          const layoutRows = structure.layouts.filter(l => l.zone_id === z.id);
          const layouts: LayoutDraft[] = layoutRows.map(layoutRow => {
            const rackRows = structure.racks.filter(r => r.layout_id === layoutRow.id);
            const rack = rackRows[0];
            const namingRule = structure.namingRules.find(r => r.layout_id === layoutRow.id && r.entity_type === 'bin');
            const firstTier = structure.tiers.find(t => t.rack_id === rack?.id);
            const bins = structure.bins.filter(b => b.tier_id === firstTier?.id);
            return {
              id: layoutRow.id,
              name: layoutRow.name ?? 'Layout',
              layoutType: (layoutRow.layout_type as LayoutType) ?? 'grid',
              orientation: (layoutRow.orientation as 'horizontal' | 'vertical') ?? 'horizontal',
              description: layoutRow.description ?? '',
              config: {
                scale: Number(layoutRow.scale ?? DEFAULT_LAYOUT_CONFIG.scale),
                rotationDeg: Number(layoutRow.rotation_deg ?? DEFAULT_LAYOUT_CONFIG.rotationDeg),
                aisleWidthM: Number(layoutRow.aisle_width_m ?? DEFAULT_LAYOUT_CONFIG.aisleWidthM),
                walkwayWidthM: Number(layoutRow.walkway_width_m ?? DEFAULT_LAYOUT_CONFIG.walkwayWidthM),
                rackDirection: layoutRow.default_rack_direction ?? DEFAULT_LAYOUT_CONFIG.rackDirection,
              },
              naming: {
                prefix: namingRule?.prefix ?? '',
                separator: namingRule?.separator ?? '-',
                numberingStyle: namingRule?.numbering_style ?? 'numeric',
                padding: namingRule?.padding ?? 2,
                levelFormat: namingRule?.level_format ?? 'L{n}',
                suffix: namingRule?.suffix ?? '',
              },
              racks: {
                rows: rackRows.length
                  ? Math.max(1, Math.ceil(rackRows.length / Math.max(1, Number(rack?.columns_count ?? 5))))
                  : 2,
                columns: rack?.columns_count ?? 5,
                levels: rack?.levels_count ?? 3,
                rackPrefix: namingRule?.prefix ?? 'A',
                rackType: (rack?.rack_type as any) ?? 'pallet_rack',
                maxQuantity: Number(bins[0]?.max_quantity ?? 500),
                spacingM: Number(layoutRow.spacing_m ?? 1),
              },
              // Reconstruct manual drag placements (PRD §5.18) from the persisted
              // design-grid coordinates so re-publishing preserves them.
              rackOverrides: (() => {
                const sorted = [...rackRows].sort((a, b) =>
                  String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { numeric: true })
                );
                if (sorted.length === 0 || sorted.every(r => r.position_x == null && r.position_y == null)) return undefined;
                const cfg = {
                  rows: rackRows.length
                    ? Math.max(1, Math.ceil(rackRows.length / Math.max(1, Number(rack?.columns_count ?? 5))))
                    : 2,
                  columns: rack?.columns_count ?? 5,
                  levels: rack?.levels_count ?? 3,
                } as LayoutDraft['racks'];
                return overridesFromPositions(
                  cfg,
                  (layoutRow.layout_type as LayoutType) ?? 'grid',
                  sorted.map(r => ({ x: r.position_x, y: r.position_y }))
                );
              })(),
            };
          });
          return {
            id: z.id,
            name: z.name,
            code: z.code ?? '',
            storageRole: (z.storage_role as StorageRole) ?? 'bulk_storage',
            color: z.color ?? STORAGE_ROLES[0].color,
            description: z.description ?? '',
            layouts: layouts.length ? layouts : [createEmptyWarehouse().floors[0].zones[0].layouts[0]],
          };
        }),
    }));
    const hydrated: WarehouseDraft = {
      id: existingWarehouseId,
      name: wh?.warehouse_name ?? wh?.name ?? '',
      code: wh?.warehouse_code ?? '',
      address: wh?.address ?? '',
      city: wh?.city ?? '',
      state: wh?.state ?? '',
      manager: wh?.manager ?? '',
      description: wh?.description ?? '',
      floors: floors.length ? floors : [createEmptyFloor(1)],
    };
    reset(hydrated);
    if (floors.length) {
      setSelectedFloorId(floors[0].id);
      setSelectedZoneId(floors[0].zones[0]?.id ?? '');
      setSelectedLayoutId(floors[0].zones[0]?.layouts[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingWarehouseId, structureLoading, structure]);

  // ── Derived values ───────────────────────────────────────────────────────────

  const selectedFloor = draft.floors.find(f => f.id === selectedFloorId) ?? draft.floors[0];
  const selectedZone = selectedFloor?.zones.find(z => z.id === selectedZoneId) ?? selectedFloor?.zones[0];
  const selectedLayout =
    selectedZone?.layouts.find(l => l.id === selectedLayoutId) ?? selectedZone?.layouts[0];

  const rackCount = useMemo(() => {
    if (!selectedLayout) return 0;
    // expandRacks applies U/L shape filtering (shared with the preview
    // and the save generator), so this count always matches what saves.
    return expandRacks(selectedLayout.racks, selectedLayout.naming, selectedLayout.layoutType).length;
  }, [selectedLayout]);

  const binCount = useMemo(() => {
    if (!selectedLayout) return 0;
    return rackCount * selectedLayout.racks.levels * selectedLayout.racks.columns;
  }, [selectedLayout, rackCount]);

  const namingSamples = useMemo(() => {
    if (!selectedLayout) return [];
    return binNamePreview(selectedLayout.naming, selectedLayout.racks.columns, selectedLayout.racks.levels, 10);
  }, [selectedLayout]);

  // Current published layout version for the badge (from the loaded structure).
  const currentVersion = useMemo(() => {
    const versions = (structure?.layouts ?? []).map(l => l.version ?? 1);
    return versions.length ? Math.max(...versions) : 1;
  }, [structure]);

  const totalLayouts = draft.floors.reduce((n, f) => n + f.zones.reduce((z, zo) => z + zo.layouts.length, 0), 0);

  // Undo / redo keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  /** Apply a capacity profile's max qty to the selected layout (G9). */
  const applyCapacityProfile = (p: CapacityProfileRow) => {
    if (selectedFloor && selectedZone && selectedLayout && p.max_quantity) {
      updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { maxQuantity: p.max_quantity });
      setShowCapacity(false);
    }
  };

  /** Restore an archived layout version into the draft (G10, TAD §4.9). */
  const restoreVersion = (v: LayoutVersionRow) => {
    const layout: LayoutDraft = {
      id: v.layout.id,
      name: v.layout.name ?? 'Layout',
      layoutType: (v.layout.layout_type as LayoutType) ?? 'grid',
      orientation: (v.layout.orientation as 'horizontal' | 'vertical') ?? 'horizontal',
      description: v.layout.description ?? '',
      config: {
        scale: Number(v.layout.scale ?? DEFAULT_LAYOUT_CONFIG.scale),
        rotationDeg: Number(v.layout.rotation_deg ?? DEFAULT_LAYOUT_CONFIG.rotationDeg),
        aisleWidthM: Number(v.layout.aisle_width_m ?? DEFAULT_LAYOUT_CONFIG.aisleWidthM),
        walkwayWidthM: Number(v.layout.walkway_width_m ?? DEFAULT_LAYOUT_CONFIG.walkwayWidthM),
        rackDirection: v.layout.default_rack_direction ?? DEFAULT_LAYOUT_CONFIG.rackDirection,
      },
      naming: {
        prefix: v.namingRule?.prefix ?? '',
        separator: v.namingRule?.separator ?? '-',
        numberingStyle: v.namingRule?.numbering_style ?? 'numeric',
        padding: v.namingRule?.padding ?? 2,
        levelFormat: v.namingRule?.level_format ?? 'L{n}',
        suffix: v.namingRule?.suffix ?? '',
      },
      racks: {
        rows: v.rack
          ? Math.max(1, Math.ceil(v.rackCount / Math.max(1, Number(v.rack.columns_count ?? 5))))
          : 2,
        columns: v.rack?.columns_count ?? 5,
        levels: v.rack?.levels_count ?? 3,
        rackPrefix: v.namingRule?.prefix ?? 'A',
        rackType: (v.rack?.rack_type as any) ?? 'pallet_rack',
        maxQuantity: Number(v.bins[0]?.max_quantity ?? 500),
        spacingM: Number(v.layout.spacing_m ?? 1),
      },
    };
    setDraft(d => {
      const zone: WarehouseDraft['floors'][number]['zones'][number] = {
        id: v.zone.id,
        name: v.zone.name,
        code: v.zone.code ?? '',
        storageRole: (v.zone.storage_role as StorageRole) ?? 'bulk_storage',
        color: v.zone.color ?? STORAGE_ROLES[0].color,
        description: v.zone.description ?? '',
        layouts: [layout],
      };
      const floorIdx = d.floors.findIndex(f => f.id === v.floor.id);
      if (floorIdx >= 0) {
        return {
          ...d,
          floors: d.floors.map((f, i) =>
            i === floorIdx
              ? { ...f, zones: f.zones.some(z => z.id === v.zone.id) ? f.zones.map(z => (z.id === v.zone.id ? zone : z)) : [...f.zones, zone] }
              : f
          ),
        };
      }
      return {
        ...d,
        floors: [
          ...d.floors,
          {
            id: v.floor.id,
            name: v.floor.name,
            code: v.floor.code ?? '',
            description: v.floor.description ?? '',
            displayOrder: d.floors.length + 1,
            zones: [zone],
          },
        ],
      };
    });
    setSelectedFloorId(v.floor.id);
    setSelectedZoneId(v.zone.id);
    setSelectedLayoutId(layout.id);
    setShowHistory(false);
    setStep('zone');
  };

  // ── Mutators (all route through the history hook → undoable) ───────────────

  const updateWarehouse = (patch: Partial<WarehouseDraft>) => setDraft(d => reduceWarehouse(d, patch));
  const updateFloor = (floorId: string, patch: Partial<WarehouseDraft['floors'][number]>) =>
    setDraft(d => reduceFloor(d, floorId, patch));
  const updateZone = (floorId: string, zoneId: string, patch: Partial<WarehouseDraft['floors'][number]['zones'][number]>) =>
    setDraft(d => reduceZone(d, floorId, zoneId, patch));
  const updateLayout = (floorId: string, zoneId: string, layoutId: string, patch: Partial<LayoutDraft>) =>
    setDraft(d => reduceLayout(d, floorId, zoneId, layoutId, patch));
  const updateLayoutConfig = (floorId: string, zoneId: string, layoutId: string, patch: Partial<LayoutDraft['config']>) =>
    setDraft(d => reduceLayoutConfig(d, floorId, zoneId, layoutId, patch));
  const updateRacks = (floorId: string, zoneId: string, layoutId: string, patch: Partial<LayoutDraft['racks']>) =>
    setDraft(d => reduceRacks(d, floorId, zoneId, layoutId, patch));
  const updateNaming = (floorId: string, zoneId: string, layoutId: string, patch: Partial<LayoutDraft['naming']>) =>
    setDraft(d => reduceNaming(d, floorId, zoneId, layoutId, patch));

  const addFloor = () => {
    setDraft(d => {
      const { draft: next, floor } = reduceAddFloor(d);
      setSelectedFloorId(floor.id);
      setSelectedZoneId(floor.zones[0].id);
      setSelectedLayoutId(floor.zones[0].layouts[0].id);
      return next;
    });
  };

  const removeFloor = (floorId: string) => {
    const remaining = draft.floors.filter(f => f.id !== floorId);
    setDraft(d => reduceRemoveFloor(d, floorId));
    if (selectedFloorId === floorId && remaining.length > 0) {
      setSelectedFloorId(remaining[0]?.id ?? '');
      setSelectedZoneId(remaining[0]?.zones[0]?.id ?? '');
      setSelectedLayoutId(remaining[0]?.zones[0]?.layouts[0]?.id ?? '');
    }
  };

  const addZone = (floorId: string) => {
    setDraft(d => {
      const { draft: next, zone } = reduceAddZone(d, floorId);
      setSelectedZoneId(zone.id);
      setSelectedLayoutId(zone.layouts[0].id);
      return next;
    });
  };

  const duplicateZone = (floorId: string, zoneId: string) => {
    setDraft(d => {
      const { draft: next, zone } = reduceDuplicateZone(d, floorId, zoneId);
      setSelectedZoneId(zone.id);
      setSelectedLayoutId(zone.layouts[0].id);
      return next;
    });
  };

  const removeZone = (floorId: string, zoneId: string) => {
    setDraft(d => reduceRemoveZone(d, floorId, zoneId));
    if (selectedZoneId === zoneId) {
      const floor = draft.floors.find(f => f.id === floorId);
      const first = floor?.zones.find(z => z.id !== zoneId);
      setSelectedZoneId(first?.id ?? '');
      setSelectedLayoutId(first?.layouts[0]?.id ?? '');
    }
  };

  const addLayout = (floorId: string, zoneId: string, layoutType?: LayoutType) => {
    setDraft(d => {
      const { draft: next, layout } = reduceAddLayout(d, floorId, zoneId, layoutType);
      setSelectedLayoutId(layout.id);
      return next;
    });
  };

  const duplicateLayout = (floorId: string, zoneId: string, layoutId: string) => {
    setDraft(d => {
      const { draft: next, layout } = reduceDuplicateLayout(d, floorId, zoneId, layoutId);
      setSelectedLayoutId(layout.id);
      return next;
    });
  };

  const removeLayout = (floorId: string, zoneId: string, layoutId: string) => {
    setDraft(d => reduceRemoveLayout(d, floorId, zoneId, layoutId));
    if (selectedLayoutId === layoutId) {
      const zone = draft.floors.find(f => f.id === floorId)?.zones.find(z => z.id === zoneId);
      const first = zone?.layouts.find(l => l.id !== layoutId);
      setSelectedLayoutId(first?.id ?? '');
    }
  };

  // ── Drag & drop (PRD §5.6 floors, §5.18 zones) ─────────────────────────────

  const [dragFloorId, setDragFloorId] = useState<string | null>(null);
  const [dragZoneKey, setDragZoneKey] = useState<string | null>(null); // `${floorId}:${zoneId}`

  const onFloorDrop = (toIndex: number) => {
    if (dragFloorId) setDraft(d => reduceMoveFloor(d, dragFloorId, toIndex));
    setDragFloorId(null);
  };

  const onZoneDrop = (floorId: string, toIndex: number) => {
    if (dragZoneKey) {
      const [fromFloorId, zoneId] = dragZoneKey.split(':');
      if (fromFloorId === floorId) setDraft(d => reduceMoveZone(d, floorId, zoneId, toIndex));
    }
    setDragZoneKey(null);
  };

  const handleSave = async () => {
    const found = validateDraft(draft);
    if (found.length > 0) {
      setProblems(found);
      // Jump to the step that owns the first problem.
      const key = found[0].key;
      if (key.startsWith('warehouse.')) setStep('warehouse');
      else if (key.startsWith('floor.') || key.startsWith('zone.')) setStep('floors');
      else if (key.includes('racks')) setStep('racks');
      else if (key.includes('naming') || key.includes('bins')) setStep('naming');
      return;
    }
    try {
      const result = await saveDraft.mutateAsync({ draft, warehouseId: draft.id || undefined });
      // Remap draft ids to the persisted ones so a second save in this
      // session still version-chains (archive lookup keys on zone id).
      setDraft(d => reduceRemapDraftIds({ ...d, id: result.warehouseId }, result.zoneIdMap, result.layoutIdMap));
      setSelectedZoneId(prev => result.zoneIdMap[prev] ?? prev);
      setSelectedLayoutId(prev => result.layoutIdMap[prev] ?? prev);
      setSaveResult({
        rackCount: result.rackCount,
        binCount: result.binCount,
        layoutCount: result.layoutCount,
        warehouseId: result.warehouseId,
      });
    } catch (err: any) {
      setSaveError(err?.message || 'Unknown error');
    }
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const goPrev = () => { if (stepIndex > 0) setStep(STEPS[stepIndex - 1].id); };
  const goNext = () => {
    if (step === 'warehouse') {
      if (!draft.name.trim() || !draft.code.trim()) {
        setErrors({ name: draft.name.trim() ? '' : 'Warehouse name is required', code: draft.code.trim() ? '' : 'Warehouse code is required' });
        return;
      }
      setErrors({});
    }
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].id);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1400px] mx-auto px-4 pt-4 pb-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 m-0 flex items-center gap-2">
              <Warehouse size={18} className="text-blue-600" />
              Warehouse Designer
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Configure your warehouse once — the system generates racks and bins automatically.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo / Redo (PRD §5.20) */}
            <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-600 text-xs font-semibold hover:bg-zinc-50 transition-all disabled:opacity-40 disabled:pointer-events-none">
              <Undo2 size={13} /> Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-600 text-xs font-semibold hover:bg-zinc-50 transition-all disabled:opacity-40 disabled:pointer-events-none">
              <Redo2 size={13} /> Redo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCapacity(true)} title="Capacity profiles (PRD §5.17)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-600 text-xs font-semibold hover:bg-zinc-50 transition-all">
              <Boxes size={13} /> Capacity
            </Button>
            {draft.id && (
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)} title="Layout version history (TAD §4.9)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-600 text-xs font-semibold hover:bg-zinc-50 transition-all">
                <History size={13} /> History
              </Button>
            )}
            {draft.id && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                v{currentVersion} published — saving will publish v{currentVersion + 1}
              </span>
            )}
          </div>
        </div>

        {permissionsLoading ? (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
            <Loader2 size={13} className="animate-spin" /> Checking warehouse permissions...
          </div>
        ) : !canDesign ? (
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Settings2 size={13} />
            You don't have permission to {existingWarehouseId ? 'edit this' : 'create a'} warehouse. Saving is disabled.
          </div>
        ) : null}

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-4 bg-white border border-zinc-200 rounded-lg p-2 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = stepIndex > i;
            return (
              <Button variant="ghost" size="sm"
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                  active ? 'bg-blue-600 text-white shadow-sm' : done ? 'text-blue-600 hover:bg-blue-50' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {done ? <Check size={13} /> : <Icon size={13} />}
                {s.label}
                {i < STEPS.length - 1 && <span className={`mx-0.5 ${active ? 'text-blue-300' : 'text-zinc-300'}`}>·</span>}
              </Button>
            );
          })}
        </div>

        {/* Split screen */}
        <div className="grid grid-cols-[400px_1fr] gap-4 items-start">
          {/* LEFT — Wizard */}
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            {step === 'warehouse' && (
              <div className="p-4 space-y-3">
                <StepHeader title="Create Warehouse" subtitle="PRD §5.5 — identity & location" />
                <Field label="Warehouse Name *" error={errors.name}>
                  <input className={inputCls(errors.name)} value={draft.name} onChange={e => updateWarehouse({ name: e.target.value })} placeholder="e.g. Main Factory Warehouse" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Code *" error={errors.code}>
                    <input className={inputCls(errors.code)} value={draft.code} onChange={e => updateWarehouse({ code: e.target.value.toUpperCase() })} placeholder="e.g. MFW" maxLength={10} />
                  </Field>
                  <Field label="Manager">
                    <input className={inputCls()} value={draft.manager ?? ''} onChange={e => updateWarehouse({ manager: e.target.value })} placeholder="Name" />
                  </Field>
                </div>
                <Field label="Address">
                  <input className={inputCls()} value={draft.address ?? ''} onChange={e => updateWarehouse({ address: e.target.value })} placeholder="Street address" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City"><input className={inputCls()} value={draft.city ?? ''} onChange={e => updateWarehouse({ city: e.target.value })} /></Field>
                  <Field label="State"><input className={inputCls()} value={draft.state ?? ''} onChange={e => updateWarehouse({ state: e.target.value })} /></Field>
                </div>
                <Field label="Description">
                  <textarea className={inputCls('', true)} value={draft.description ?? ''} onChange={e => updateWarehouse({ description: e.target.value })} placeholder="Optional notes" rows={2} />
                </Field>
              </div>
            )}

            {step === 'floors' && (
              <div className="p-4 space-y-3">
                <StepHeader title="Floors" subtitle="PRD §5.6 — unlimited floors, drag to reorder" />
                <div className="space-y-2">
                  {draft.floors.map((f, i) => (
                    <div key={f.id}
                      draggable
                      onDragStart={() => setDragFloorId(f.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onFloorDrop(i)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${selectedFloorId === f.id ? 'border-blue-400 bg-blue-50/40' : 'border-zinc-200 hover:border-zinc-300'} ${dragFloorId === f.id ? 'opacity-50' : ''}`}
                      onClick={() => { setSelectedFloorId(f.id); setSelectedZoneId(f.zones[0]?.id ?? ''); setSelectedLayoutId(f.zones[0]?.layouts[0]?.id ?? ''); }}>
                      <div className="flex items-center gap-2">
                        <GripVertical size={13} className="text-zinc-300 shrink-0" />
                        <span className="text-[10px] font-bold text-zinc-400 w-4">{i + 1}</span>
                        <input
                          className={`flex-1 bg-transparent border-none outline-none text-sm font-semibold text-zinc-800 ${errors.floorName && !f.name ? 'ring-1 ring-red-300 rounded' : ''}`}
                          value={f.name}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateFloor(f.id, { name: e.target.value })}
                        />
                        <div className="flex gap-0.5">
                          <IconBtn title="Move up" disabled={i === 0} onClick={() => setDraft(d => reduceMoveFloor(d, f.id, i - 1))}>↑</IconBtn>
                          <IconBtn title="Move down" disabled={i === draft.floors.length - 1} onClick={() => setDraft(d => reduceMoveFloor(d, f.id, i + 1))}>↓</IconBtn>
                          <IconBtn title="Remove floor" danger disabled={draft.floors.length <= 1} onClick={() => removeFloor(f.id)}><Trash2 size={13} /></IconBtn>
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1 ml-6">
                        {f.zones.length} zone{f.zones.length !== 1 ? 's' : ''} ·{' '}
                        {f.zones.reduce((n, z) => n + z.layouts.reduce((l, lo) => l + lo.racks.rows * lo.racks.columns, 0), 0)} racks
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={addFloor} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-zinc-300 text-xs font-semibold text-zinc-600 hover:border-blue-400 hover:text-blue-600 transition-all">
                  <Plus size={14} /> Add Floor
                </Button>
              </div>
            )}

            {step === 'zone' && selectedFloor && (
              <div className="p-4 space-y-3">
                <StepHeader title="Zones & Layout" subtitle="PRD §5.7–5.9 — storage roles, multiple layouts per zone" />
                {/* Zone chips (draggable — PRD §5.18) */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {selectedFloor.zones.map((z, zi) => (
                    <Button variant="ghost" size="sm" key={z.id}
                      draggable
                      onDragStart={() => setDragZoneKey(`${selectedFloor.id}:${z.id}`)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onZoneDrop(selectedFloor.id, zi)}
                      onClick={() => { setSelectedZoneId(z.id); setSelectedLayoutId(z.layouts[0]?.id ?? ''); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                        selectedZoneId === z.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                      }`}>
                      <GripVertical size={10} className="opacity-50" />
                      {z.name}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => selectedFloor && addZone(selectedFloor.id)}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold border border-dashed border-zinc-300 text-zinc-500 hover:text-blue-600 hover:border-blue-400">
                    + Zone
                  </Button>
                </div>

                {selectedZone && (
                  <div className="space-y-3 border-t border-zinc-100 pt-3">
                    <Field label="Zone Name">
                      <div className="flex gap-2 items-center">
                        <input className={inputCls(errors.zoneName)} value={selectedZone.name}
                          onChange={e => updateZone(selectedFloor.id, selectedZone.id, { name: e.target.value })} />
                        <Button variant="ghost" size="sm" title="Duplicate zone" onClick={() => duplicateZone(selectedFloor.id, selectedZone.id)}
                          className="p-2 rounded-md border border-zinc-200 text-zinc-500 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0">
                          <Copy size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" title="Remove zone" onClick={() => removeZone(selectedFloor.id, selectedZone.id)}
                          className="p-2 rounded-md border border-zinc-200 text-zinc-500 hover:text-red-500 hover:border-red-300 transition-all shrink-0">
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </Field>
                    <Field label="Storage Role">
                      <div className="grid grid-cols-3 gap-1.5">
                        {STORAGE_ROLES.map(role => (
                          <Button variant="ghost" size="sm" key={role.code}
                            onClick={() => updateZone(selectedFloor.id, selectedZone.id, { storageRole: role.code as StorageRole, color: role.color })}
                            className={`px-1.5 py-1.5 rounded-md text-[10px] font-semibold border transition-all ${
                              selectedZone.storageRole === role.code
                                ? 'text-white border-transparent'
                                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                            }`}
                            style={selectedZone.storageRole === role.code ? { backgroundColor: role.color } : undefined}>
                            {role.name}
                          </Button>
                        ))}
                      </div>
                    </Field>

                    {/* Layout tabs (multiple per zone — PRD §3.8/§5.9) */}
                    <div className="border-t border-zinc-100 pt-3">
                      <div className="text-[11px] font-bold text-zinc-600 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                        <span>Layouts in this zone</span>
                        <span className="text-zinc-400 font-medium normal-case">{selectedZone.layouts.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {selectedZone.layouts.map(l => (
                          <span key={l.id}
                            onClick={() => setSelectedLayoutId(l.id)}
                            className={`group inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-all ${
                              selectedLayout?.id === l.id
                                ? 'bg-blue-50 border-blue-400 text-blue-700'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                            }`}>
                            <LayoutGrid size={11} />
                            {l.name}
                            <Button variant="ghost" size="sm" title="Duplicate layout"
                              onClick={e => { e.stopPropagation(); duplicateLayout(selectedFloor.id, selectedZone.id, l.id); }}
                              className="opacity-40 group-hover:opacity-100 hover:text-blue-600 transition-all">
                              <Copy size={11} />
                            </Button>
                            <Button variant="ghost" size="sm" title="Remove layout"
                              onClick={e => { e.stopPropagation(); removeLayout(selectedFloor.id, selectedZone.id, l.id); }}
                              disabled={selectedZone.layouts.length <= 1}
                              className="opacity-40 group-hover:opacity-100 hover:text-red-500 transition-all disabled:opacity-20">
                              <Trash2 size={11} />
                            </Button>
                          </span>
                        ))}
                        <Button variant="ghost" size="sm" onClick={() => addLayout(selectedFloor.id, selectedZone.id)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold border border-dashed border-zinc-300 text-zinc-500 hover:text-blue-600 hover:border-blue-400">
                          + Layout
                        </Button>
                      </div>
                    </div>

                    {selectedLayout && (
                      <>
                        {/* Layout type template cards (PRD §5.8) */}
                        <Field label="Layout Template">
                          <div className="grid grid-cols-4 gap-1.5">
                            {LAYOUT_TYPES.map(lt => (
                              <LayoutTemplateCard
                                key={lt.value}
                                type={lt.value}
                                name={lt.name}
                                active={selectedLayout.layoutType === lt.value}
                                onClick={() => updateLayout(selectedFloor.id, selectedZone.id, selectedLayout.id, { layoutType: lt.value as LayoutType })}
                              />
                            ))}
                          </div>
                        </Field>

                        {/* Layout config (PRD §5.10) */}
                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 uppercase tracking-wide">
                            <Settings2 size={12} /> Layout Config
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <Field label="Orientation">
                              <select className={inputCls()} value={selectedLayout.orientation}
                                onChange={e => updateLayout(selectedFloor.id, selectedZone.id, selectedLayout.id, { orientation: e.target.value as any })}>
                                <option value="horizontal">Horizontal</option>
                                <option value="vertical">Vertical</option>
                              </select>
                            </Field>
                            <Field label="Rack Direction">
                              <select className={inputCls()} value={selectedLayout.config.rackDirection}
                                onChange={e => updateLayoutConfig(selectedFloor.id, selectedZone.id, selectedLayout.id, { rackDirection: e.target.value })}>
                                <option value="north">North</option>
                                <option value="south">South</option>
                                <option value="east">East</option>
                                <option value="west">West</option>
                              </select>
                            </Field>
                            <Field label="Scale">
                              <NumberInput value={selectedLayout.config.scale} min={0.5} max={3} step={0.25} decimals
                                onChange={v => updateLayoutConfig(selectedFloor.id, selectedZone.id, selectedLayout.id, { scale: v })} />
                            </Field>
                            <Field label="Rotation (°)">
                              <NumberInput value={selectedLayout.config.rotationDeg} min={0} max={360} step={15}
                                onChange={v => updateLayoutConfig(selectedFloor.id, selectedZone.id, selectedLayout.id, { rotationDeg: v })} />
                            </Field>
                            <Field label="Aisle Width (m)">
                              <NumberInput value={selectedLayout.config.aisleWidthM} min={1} max={12} step={0.5} decimals
                                onChange={v => updateLayoutConfig(selectedFloor.id, selectedZone.id, selectedLayout.id, { aisleWidthM: v })} />
                            </Field>
                            <Field label="Walkway Width (m)">
                              <NumberInput value={selectedLayout.config.walkwayWidthM} min={0.5} max={8} step={0.5} decimals
                                onChange={v => updateLayoutConfig(selectedFloor.id, selectedZone.id, selectedLayout.id, { walkwayWidthM: v })} />
                            </Field>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 'racks' && selectedFloor && selectedZone && selectedLayout && (
              <div className="p-4 space-y-3">
                <StepHeader title="Rack Generator" subtitle={`PRD §5.11–5.13 — layout: ${selectedLayout.name}`} />
                <div className="grid grid-cols-3 gap-2.5">
                  <Field label="Rows">
                    <NumberInput value={selectedLayout.racks.rows} min={1} max={20}
                      onChange={v => updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { rows: v })} />
                  </Field>
                  <Field label="Columns">
                    <NumberInput value={selectedLayout.racks.columns} min={1} max={30}
                      onChange={v => updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { columns: v })} />
                  </Field>
                  <Field label="Levels">
                    <NumberInput value={selectedLayout.racks.levels} min={1} max={10}
                      onChange={v => updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { levels: v })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Rack Type">
                    <select className={inputCls()} value={selectedLayout.racks.rackType}
                      onChange={e => updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { rackType: e.target.value as any })}>
                      {RACK_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Bin Prefix" hint="applied in Naming step">
                    <input className={inputCls()} value={selectedLayout.naming.prefix}
                      onChange={e => updateNaming(selectedFloor.id, selectedZone.id, selectedLayout.id, { prefix: e.target.value.toUpperCase() })} placeholder="e.g. RM" maxLength={6} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Max Qty / Bin">
                    <NumberInput value={selectedLayout.racks.maxQuantity} min={1} step={50}
                      onChange={v => updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { maxQuantity: v })} />
                  </Field>
                  <Field label="Spacing (m)">
                    <NumberInput value={selectedLayout.racks.spacingM} min={0} step={0.5} decimals
                      onChange={v => updateRacks(selectedFloor.id, selectedZone.id, selectedLayout.id, { spacingM: v })} />
                  </Field>
                </div>

                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                  <div className="flex justify-between text-[11px] font-semibold text-zinc-700 mb-1">
                    <span>Generated in this layout</span>
                    <span className="text-blue-600">{rackCount} racks · {binCount} bins</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {expandRacks(selectedLayout.racks, selectedLayout.naming, selectedLayout.layoutType).slice(0, 12).map(r => r.name).join(' · ')}
                    {rackCount > 12 && <span> · …</span>}
                  </div>
                </div>
              </div>
            )}

            {step === 'naming' && selectedFloor && selectedZone && selectedLayout && (
              <div className="p-4 space-y-3">
                <StepHeader title="Naming Engine" subtitle={`PRD §5.14–5.16 — layout: ${selectedLayout.name}`} />
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Prefix">
                    <input className={inputCls()} value={selectedLayout.naming.prefix}
                      onChange={e => updateNaming(selectedFloor.id, selectedZone.id, selectedLayout.id, { prefix: e.target.value.toUpperCase() })} placeholder="e.g. RM" maxLength={6} />
                  </Field>
                  <Field label="Separator">
                    <input className={inputCls()} value={selectedLayout.naming.separator}
                      onChange={e => updateNaming(selectedFloor.id, selectedZone.id, selectedLayout.id, { separator: e.target.value.slice(0, 3) })} placeholder="-" maxLength={3} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Numbering">
                    <select className={inputCls()} value={selectedLayout.naming.numberingStyle}
                      onChange={e => updateNaming(selectedFloor.id, selectedZone.id, selectedLayout.id, { numberingStyle: e.target.value as any })}>
                      <option value="numeric">Numeric (01, 02)</option>
                      <option value="alpha">Alphabetic (A, B)</option>
                      <option value="alphanumeric">Alpha-Numeric (A1)</option>
                    </select>
                  </Field>
                  <Field label="Padding">
                    <NumberInput value={selectedLayout.naming.padding} min={1} max={4}
                      onChange={v => updateNaming(selectedFloor.id, selectedZone.id, selectedLayout.id, { padding: v })} />
                  </Field>
                </div>
                <Field label="Level Format" hint="{n} = tier number, e.g. L{n} → L1">
                  <input className={inputCls()} value={selectedLayout.naming.levelFormat}
                    onChange={e => updateNaming(selectedFloor.id, selectedZone.id, selectedLayout.id, { levelFormat: e.target.value })} />
                </Field>

                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                  <div className="text-[11px] font-semibold text-zinc-700 mb-1.5">Bin Name Preview</div>
                  <div className="flex flex-wrap gap-1">
                    {namingSamples.map(s => (
                      <code key={s} className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-[10.5px] font-mono text-blue-700">{s}</code>
                    ))}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-1.5">Format: {selectedLayout.naming.prefix || '(no prefix)'}{selectedLayout.naming.separator}01{selectedLayout.naming.separator}L1</div>
                </div>
              </div>
            )}

            {step === 'save' && (
              <div className="p-4 space-y-3">
                <StepHeader title="Review & Save" subtitle="PRD §5.21–5.22 — validation then generation" />
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-1.5 text-xs">
                  <SummaryRow label="Warehouse" value={draft.name || '—'} />
                  <SummaryRow label="Code" value={draft.code || '—'} />
                  <SummaryRow label="Floors" value={String(draft.floors.length)} />
                  <SummaryRow label="Zones" value={String(draft.floors.reduce((n, f) => n + f.zones.length, 0))} />
                  <SummaryRow label="Layouts" value={String(totalLayouts)} />
                  <SummaryRow label="Racks (estimate)" value={String(reduceCountRacks(draft))} />
                </div>
                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  Saving will publish new layout versions (the previous ones stay archived in history), create the warehouse structure
                  and generate every rack, tier and bin automatically.
                </div>
                {saveDraft.isPending ? (
                  <Button variant="ghost" size="sm" disabled className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold opacity-70">
                    <Loader2 size={14} className="animate-spin" /> Saving & generating…
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleSave} disabled={!canDesign}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:pointer-events-none">
                    <Save size={14} /> Save Warehouse & Generate Bins
                  </Button>
                )}
              </div>
            )}

            {/* Wizard footer */}
            <div className="flex items-center justify-between p-3 border-t border-zinc-100 bg-zinc-50/60">
              <Button variant="ghost" size="sm" onClick={goPrev} disabled={stepIndex === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-500 hover:bg-white border border-transparent hover:border-zinc-200 transition-all disabled:opacity-40 disabled:pointer-events-none">
                <ArrowLeft size={13} /> Back
              </Button>
              {step !== 'save' && (
                <Button variant="ghost" size="sm" onClick={goNext}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all">
                  Continue <ArrowRight size={13} />
                </Button>
              )}
            </div>
          </div>

          {/* RIGHT — Preview */}
          <div className="bg-white border border-zinc-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs font-bold text-zinc-800">Warehouse Preview</div>
              <div className="text-[11px] text-zinc-400">
                {selectedFloor?.name}
                {selectedZone ? ` → ${selectedZone.name}` : ''}
                {selectedLayout ? ` → ${selectedLayout.name}` : ''}
              </div>
            </div>
            <WarehousePreview
              draft={draft}
              selectedFloorId={selectedFloorId}
              selectedZoneId={selectedZoneId}
              onMoveRack={(floorId, zoneId, layoutId, rackIndex, row, col) =>
                setDraft(d => reduceMoveRack(d, floorId, zoneId, layoutId, rackIndex, row, col))
              }
            />
          </div>
        </div>
      </div>

      {/* ── Dialogs (replaces alert()) ──────────────────────────────────────── */}
      {problems && (
        <Modal onClose={() => setProblems(null)} title="Fix these before saving" tone="warn">
          <ul className="space-y-1.5 max-h-64 overflow-auto">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {p.message}
              </li>
            ))}
          </ul>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={() => setProblems(null)}
              className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all">
              Back to wizard
            </Button>
          </div>
        </Modal>
      )}

      {saveResult && (
        <Modal onClose={() => setSaveResult(null)} title="Warehouse saved & published" tone="ok">
          <div className="space-y-2 text-xs text-zinc-700">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold"><Check size={14} /> Structure generated successfully</div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <StatChip label="Layouts" value={String(saveResult.layoutCount)} />
              <StatChip label="Racks" value={String(saveResult.rackCount)} />
              <StatChip label="Bins" value={String(saveResult.binCount)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => setSaveResult(null)}
              className="px-4 py-2 rounded-md border border-zinc-200 bg-white text-zinc-600 text-xs font-bold hover:bg-zinc-50 transition-all">
              Keep editing
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setSaveResult(null); navigate(`/warehouse/viewer/${saveResult.warehouseId}`); }}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all">
              Open in Viewer →
            </Button>
          </div>
        </Modal>
      )}

      {showCapacity && (
        <CapacityProfilesDialog
          onClose={() => setShowCapacity(false)}
          onApply={applyCapacityProfile}
        />
      )}

      {showHistory && existingWarehouseId && (
        <VersionHistoryDialog
          warehouseId={existingWarehouseId}
          onClose={() => setShowHistory(false)}
          onRestore={restoreVersion}
        />
      )}

      {saveError && (
        <Modal onClose={() => setSaveError(null)} title="Save failed" tone="error">
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{saveError}</div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={() => setSaveError(null)}
              className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all">
              Close
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Layout template card (PRD §5.8 — visual picker with SVG previews) ────────

function LayoutTemplateCard({ type, name, active, onClick }: { type: LayoutType; name: string; active: boolean; onClick: () => void }) {
  const cells: { x: number; y: number }[] = [];
  const cols = 4;
  const rows = 3;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      let keep = true;
      if (type === 'u_shape') keep = r === rows || c === 1 || c === cols;
      if (type === 'l_shape') keep = r === rows || c === 1;
      if (type === 'single_aisle') keep = c !== 2; // central aisle
      if (type === 'double_aisle') keep = c !== 2 && c !== 3; // two aisles
      if (keep) cells.push({ x: c - 1, y: r - 1 });
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick}
      title={name}
      className={`p-1.5 rounded-md border transition-all text-left ${active ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}>
      <svg viewBox="0 0 40 30" className="w-full h-9">
        <rect x={0.5} y={0.5} width={39} height={29} rx={2} fill={active ? '#eff6ff' : '#fafafa'} stroke={active ? '#93c5fd' : '#e4e4e7'} />
        {cells.map((c, i) => (
          <rect key={i} x={3 + c.x * 9} y={3 + c.y * 8} width={7} height={6} rx={1}
            fill={active ? '#3b82f6' : '#a1a1aa'} opacity={active ? 0.9 : 0.55} />
        ))}
      </svg>
      <div className={`mt-1 text-[9px] font-semibold leading-tight truncate ${active ? 'text-blue-700' : 'text-zinc-500'}`}>{name}</div>
    </Button>
  );
}

// ── Modal dialog ───────────────────────────────────────────────────────────────

function Modal({ title, tone, onClose, children }: { title: string; tone: 'ok' | 'warn' | 'error'; onClose: () => void; children: React.ReactNode }) {
  const toneCls = tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-500' : 'text-red-500';
  const Icon = tone === 'ok' ? Check : tone === 'warn' ? TriangleAlert : X;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Icon size={16} className={toneCls} />
          <h3 className="text-sm font-bold text-zinc-900 m-0">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2 text-center">
      <div className="text-base font-bold text-zinc-900">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

// ── Small UI helpers ───────────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <div className="text-sm font-bold text-zinc-900">{title}</div>
      <div className="text-[11px] text-zinc-400">{subtitle}</div>
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
        {label} {hint && <span className="font-normal text-zinc-400">— {hint}</span>}
      </label>
      {children}
      {error && <div className="text-[10px] text-red-500 mt-0.5">{error}</div>}
    </div>
  );
}

function IconBtn({ title, onClick, disabled, danger, children }: { title: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" title={title} onClick={e => { e.stopPropagation(); onClick(); }} disabled={disabled}
      className={`p-1 rounded text-zinc-400 hover:bg-zinc-100 transition-all disabled:opacity-30 disabled:pointer-events-none ${danger ? 'hover:text-red-500' : 'hover:text-zinc-700'}`}>
      {children}
    </Button>
  );
}

function NumberInput({ value, onChange, min, max, step, decimals }: { value: number; onChange: (v: number) => void; min: number; max?: number; step?: number; decimals?: boolean }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') return;
        const v = Number(raw);
        if (Number.isNaN(v)) return;
        if (max !== undefined && v > max) return;
        onChange(decimals ? Math.max(min, v) : Math.max(min, Math.round(v)));
      }}
      className={inputCls()}
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold text-zinc-800">{value}</span>
    </div>
  );
}

const inputCls = (error?: string, area = false) =>
  `w-full ${area ? 'py-2 resize-none' : 'h-8'} px-2.5 rounded-md border text-xs text-zinc-800 bg-white outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
    error ? 'border-red-300' : 'border-zinc-200'
  }`;
