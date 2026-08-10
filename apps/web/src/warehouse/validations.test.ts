import { describe, it, expect } from 'vitest';
import { validateDraft } from './validations';
import { createEmptyWarehouse } from './types';

function namedDraft() {
  const draft = createEmptyWarehouse();
  draft.id = 'wh-1';
  draft.name = 'Main Warehouse';
  draft.code = 'MW';
  return draft;
}

describe('validateDraft (PRD §5.21)', () => {
  it('passes a complete, well-formed draft', () => {
    const problems = validateDraft(namedDraft());
    expect(problems).toHaveLength(0);
  });

  it('requires a warehouse name and code', () => {
    const draft = namedDraft();
    draft.name = '';
    draft.code = '';
    const keys = validateDraft(draft).map(p => p.key);
    expect(keys).toContain('warehouse.name');
    expect(keys).toContain('warehouse.code');
  });

  it('requires at least one floor', () => {
    const draft = namedDraft();
    draft.floors = [];
    expect(validateDraft(draft).map(p => p.key)).toContain('warehouse.floors');
  });

  it('requires every floor and zone to have a name', () => {
    const draft = namedDraft();
    draft.floors[0].name = '';
    draft.floors[0].zones[0].name = '';
    const keys = validateDraft(draft).map(p => p.key);
    expect(keys).toContain('floor.name');
    expect(keys).toContain('zone.name');
  });

  it('flags a zone with no layouts (PRD §3.8)', () => {
    const draft = namedDraft();
    draft.floors[0].zones[0].layouts = [];
    expect(validateDraft(draft).map(p => p.key)).toContain('zone.layouts');
  });

  it('flags invalid rack dimensions', () => {
    const draft = namedDraft();
    draft.floors[0].zones[0].layouts[0].racks.rows = 0;
    const keys = validateDraft(draft).map(p => p.key);
    expect(keys).toContain('layout.racks.dims');
  });

  it('flags layouts that would generate too many racks (cap 200)', () => {
    const draft = namedDraft();
    draft.floors[0].zones[0].layouts[0].racks.rows = 20;
    draft.floors[0].zones[0].layouts[0].racks.columns = 20;
    const keys = validateDraft(draft).map(p => p.key);
    expect(keys).toContain('layout.racks.too_many');
  });

  it('flags naming conflicts (no prefix + non-numeric numbering)', () => {
    const draft = namedDraft();
    draft.floors[0].zones[0].layouts[0].naming.prefix = '';
    draft.floors[0].zones[0].layouts[0].naming.numberingStyle = 'alpha';
    const keys = validateDraft(draft).map(p => p.key);
    expect(keys).toContain('layout.naming.conflict');
  });

  it('flags duplicate rack names across layouts', () => {
    const draft = namedDraft();
    // Two zones with identical naming → rack names collide.
    const zone2 = {
      ...draft.floors[0].zones[0],
      id: 'zn-2',
      name: 'FG Zone',
      layouts: [
        {
          ...draft.floors[0].zones[0].layouts[0],
          id: 'ly-2',
          name: 'Grid Layout 2',
        },
      ],
    };
    draft.floors[0].zones = [draft.floors[0].zones[0], zone2];
    const keys = validateDraft(draft).map(p => p.key);
    expect(keys).toContain('racks.duplicate');
  });

  it('flags duplicate bin names across layouts', () => {
    const draft = namedDraft();
    // Same prefix in both zones' layouts → bin names collide.
    const zone2 = {
      ...draft.floors[0].zones[0],
      id: 'zn-2',
      name: 'FG Zone',
      layouts: [
        {
          ...draft.floors[0].zones[0].layouts[0],
          id: 'ly-2',
          name: 'Grid Layout 2',
          naming: { ...draft.floors[0].zones[0].layouts[0].naming, prefix: 'A' },
        },
      ],
    };
    draft.floors[0].zones[0].layouts[0].naming.prefix = 'A';
    draft.floors[0].zones = [draft.floors[0].zones[0], zone2];
    expect(validateDraft(draft).map(p => p.key)).toContain('bins.duplicate');
  });

  it('does not flag duplicates when prefixes differ', () => {
    const draft = namedDraft();
    draft.floors[0].zones[0].layouts[0].naming.prefix = 'RM';
    const zone2 = {
      ...draft.floors[0].zones[0],
      id: 'zn-2',
      name: 'FG Zone',
      layouts: [
        {
          ...draft.floors[0].zones[0].layouts[0],
          id: 'ly-2',
          name: 'Grid Layout 2',
          naming: { ...draft.floors[0].zones[0].layouts[0].naming, prefix: 'FG' },
        },
      ],
    };
    draft.floors[0].zones = [draft.floors[0].zones[0], zone2];
    expect(validateDraft(draft)).toHaveLength(0);
  });
});
