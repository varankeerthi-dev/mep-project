// schemas.test.ts — Vitest unit tests for the collaboration module's pure logic.
// Deterministic: no I/O, no Supabase, no React. Zod schemas + utility fns only.
import { describe, it, expect } from 'vitest';
import {
  LinkedEntitySchema,
  MessageMetadataSchema,
  MessageDraftSchema,
  AttachmentMetaSchema,
  SendMessageRpcSchema,
  ChannelNameSchema,
  CHANNEL_NAME_MAX,
  InviteEmailSchema,
  createCreateChannelSchema,
  normalizeChannelName,
  isChannelNameTaken,
  channelCreateErrorField,
  channelCreateErrorMessage,
} from './schemas';
import {
  formatRelativeTime,
  groupConsecutive,
  isOptimisticId,
  buildAttachmentPath,
  parseTaskFromMessage,
} from './utils';

describe('LinkedEntitySchema', () => {
  it('accepts a valid task link', () => {
    const ok = LinkedEntitySchema.safeParse({
      type: 'task',
      id: '11111111-1111-1111-1111-111111111111',
      label: 'Fix pump',
    });
    expect(ok.success).toBe(true);
  });

  it('accepts a valid reminder link', () => {
    const ok = LinkedEntitySchema.safeParse({
      type: 'reminder',
      id: '11111111-1111-1111-1111-111111111111',
      label: 'Check site cables tomorrow',
      snapshot: { status: 'pending', remind_at: '2026-09-20T09:00:00Z' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown type', () => {
    const bad = LinkedEntitySchema.safeParse({
      type: 'banana',
      id: '11111111-1111-1111-1111-111111111111',
      label: 'X',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects empty label', () => {
    const bad = LinkedEntitySchema.safeParse({
      type: 'issue',
      id: '11111111-1111-1111-1111-111111111111',
      label: '',
    });
    expect(bad.success).toBe(false);
  });
});

describe('parseTaskFromMessage', () => {
  it('extracts title and description from single line message', () => {
    const result = parseTaskFromMessage('Check chiller pump alignment');
    expect(result.title).toBe('Check chiller pump alignment');
    expect(result.description).toContain('Check chiller pump alignment');
    expect(result.checklistTitles).toBeUndefined();
    expect(result.assigneeIds).toEqual([]);
  });

  it('extracts first line as title and bullets as checklist items', () => {
    const msg = [
      'Site preparation checklist for Unit 4',
      '- Clear debris around pad',
      '- Check foundation bolts',
      '* Inspect conduit stub-ups',
      '1. Verify grounding rod resistance',
    ].join('\n');

    const result = parseTaskFromMessage(msg, ['11111111-1111-1111-1111-111111111111']);
    expect(result.title).toBe('Site preparation checklist for Unit 4');
    expect(result.assigneeIds).toEqual(['11111111-1111-1111-1111-111111111111']);
    expect(result.checklistTitles).toEqual([
      'Clear debris around pad',
      'Check foundation bolts',
      'Inspect conduit stub-ups',
      'Verify grounding rod resistance',
    ]);
  });

  it('truncates long titles to 80 chars with ellipsis', () => {
    const longLine = 'A'.repeat(100);
    const result = parseTaskFromMessage(longLine);
    expect(result.title.length).toBe(78);
    expect(result.title.endsWith('…')).toBe(true);
  });
});

describe('MessageMetadataSchema', () => {
  it('accepts empty metadata', () => {
    expect(MessageMetadataSchema.safeParse({}).success).toBe(true);
  });

  it('caps mentions at 50', () => {
    const ok = MessageMetadataSchema.safeParse({
      mentions: Array.from({ length: 50 }, () => '11111111-1111-1111-1111-111111111111'),
    });
    expect(ok.success).toBe(true);
    const bad = MessageMetadataSchema.safeParse({
      mentions: Array.from({ length: 51 }, () => '11111111-1111-1111-1111-111111111111'),
    });
    expect(bad.success).toBe(false);
  });
});

describe('MessageDraftSchema', () => {
  it('rejects empty text', () => {
    const bad = MessageDraftSchema.safeParse({ text: '' });
    expect(bad.success).toBe(false);
  });

  it('rejects text over 4000 chars', () => {
    const bad = MessageDraftSchema.safeParse({ text: 'x'.repeat(4001) });
    expect(bad.success).toBe(false);
  });

  it('accepts a clean draft', () => {
    const ok = MessageDraftSchema.safeParse({
      text: 'Pump room pipe route has a clash with cable tray.',
      parentMessageId: null,
    });
    expect(ok.success).toBe(true);
  });
});

describe('AttachmentMetaSchema', () => {
  it('caps file size at 50 MB', () => {
    const ok = AttachmentMetaSchema.safeParse({
      file_name: 'plan.pdf',
      file_size: 50 * 1024 * 1024,
      mime_type: 'application/pdf',
    });
    expect(ok.success).toBe(true);
    const bad = AttachmentMetaSchema.safeParse({
      file_name: 'plan.pdf',
      file_size: 50 * 1024 * 1024 + 1,
      mime_type: 'application/pdf',
    });
    expect(bad.success).toBe(false);
  });
});

describe('SendMessageRpcSchema', () => {
  it('parses a typical server response', () => {
    const ok = SendMessageRpcSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      channel_id: '22222222-2222-2222-2222-222222222222',
      sender_id: '33333333-3333-3333-3333-333333333333',
      created_at: '2026-09-01T10:00:00Z',
      content: 'hi',
      message_type: 'text',
      metadata: {},
      client_msg_id: null,
      edited_at: null,
      deleted_at: null,
      parent_message_id: null,
      organisation_id: '44444444-4444-4444-4444-444444444444',
    });
    expect(ok.success).toBe(true);
  });
});

describe('isOptimisticId', () => {
  it('detects optimistic placeholders', () => {
    expect(isOptimisticId('optimistic:abc-123')).toBe(true);
    expect(isOptimisticId('11111111-1111-1111-1111-111111111111')).toBe(false);
  });
});

describe('groupConsecutive', () => {
  it('groups by the key function', () => {
    const items = [
      { id: 'a', sender: 'r' },
      { id: 'b', sender: 'r' },
      { id: 'c', sender: 'k' },
      { id: 'd', sender: 'k' },
      { id: 'e', sender: 'r' },
    ];
    const groups = groupConsecutive(items, (x) => x.sender);
    expect(groups).toHaveLength(3);
    expect(groups[0].map((x) => x.id)).toEqual(['a', 'b']);
    expect(groups[1].map((x) => x.id)).toEqual(['c', 'd']);
    expect(groups[2].map((x) => x.id)).toEqual(['e']);
  });

  it('handles empty input', () => {
    expect(groupConsecutive([], () => 'k')).toEqual([]);
  });
});

describe('formatRelativeTime', () => {
  it('formats recent timestamps as "just now"', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');
  });
});

describe('buildAttachmentPath', () => {
  it('sanitises unsafe characters and stays under org/channel namespace', () => {
    const path = buildAttachmentPath({
      organisationId: 'org-1',
      channelId: 'ch-1',
      fileName: '../../etc/passwd',
    });
    expect(path).toMatch(/^org-1\/ch-1\//);
    // The dangerous ".." must not survive — only the sanitised safe
    // characters (dots between segments, dashes, underscores) remain.
    expect(path).not.toContain('/../');
    expect(path).toContain('etc_passwd');
  });
});

import { addAttachment, getOrCreateCompanyChannel, fetchCompanyChannels, postTaskChannelCard } from './api';
import { useCollabStore } from './store';

describe('Collaboration API client contracts', () => {
  it('exports addAttachment, getOrCreateCompanyChannel, fetchCompanyChannels, postTaskChannelCard', () => {
    expect(typeof addAttachment).toBe('function');
    expect(typeof getOrCreateCompanyChannel).toBe('function');
    expect(typeof fetchCompanyChannels).toBe('function');
    expect(typeof postTaskChannelCard).toBe('function');
  });
});

describe('useCollabStore Company Channel state transitions', () => {
  it('supports opening and switching between company channels and project channels', () => {
    const store = useCollabStore.getState();

    // 1. Open company channel
    store.openCompanyChannel('general');
    let state = useCollabStore.getState();
    expect(state.isCompanyChannelOpen).toBe(true);
    expect(state.activeScope).toBe('company');
    expect(state.activeCompanyChannelName).toBe('general');

    // 2. Open project channel
    store.openProject('proj-alpha');
    state = useCollabStore.getState();
    expect(state.openProjectIds).toContain('proj-alpha');
    expect(state.activeProjectId).toBe('proj-alpha');
    expect(state.activeScope).toBe('project');

    // 3. Switch back to company channel
    store.setActiveScope('company');
    state = useCollabStore.getState();
    expect(state.activeScope).toBe('company');

    // 4. Close project channel - should not crash and should update state
    store.closeProject('proj-alpha');
    state = useCollabStore.getState();
    expect(state.openProjectIds).not.toContain('proj-alpha');
    expect(state.activeScope).toBe('company');

    // 5. Open task drawer with null project_id for company task
    store.openTaskCreate({
      title: 'Company-wide quarterly review',
      projectId: null,
      channelId: 'general-channel-uuid',
    });
    state = useCollabStore.getState();
    expect(state.taskCreateDrawerOpen).toBe(true);
    expect(state.taskCreateInitial?.title).toBe('Company-wide quarterly review');
    expect(state.taskCreateInitial?.projectId).toBeNull();
    expect(state.taskCreateInitial?.channelId).toBe('general-channel-uuid');

    // 6. Close task drawer
    store.closeTaskCreate();
    state = useCollabStore.getState();
    expect(state.taskCreateDrawerOpen).toBe(false);
    expect(state.taskCreateInitial).toBeNull();
  });
});

describe('channel creation — name uniqueness that ignores separators', () => {
  it('normalizes case, spaces, hyphens, underscores and dots to the same key', () => {
    const forms = ['Sales Chennai', 'sales-chennai', 'Sales_Chennai', 'sales.chennai', '  SALES   CHENNAI  '];
    const keys = forms.map(normalizeChannelName);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('saleschennai');
  });

  it('rejects a channel name that collides with an existing one', () => {
    const existing = ['Sales Chennai'];
    expect(isChannelNameTaken('Sales-Chennai', existing)).toBe(true);
    expect(isChannelNameTaken('sales_chennai', existing)).toBe(true);
    expect(isChannelNameTaken('Sales.Chennai', existing)).toBe(true);
    expect(isChannelNameTaken('  sales   chennai ', existing)).toBe(true);
    expect(isChannelNameTaken('Sales Chennai 2', existing)).toBe(false);
    expect(isChannelNameTaken('Chennai Sales', existing)).toBe(false);
  });

  it('accepts a fresh name and rejects a separator variant of it', () => {
    const schema = createCreateChannelSchema(['Sales Chennai']);
    const base = {
      description: '',
      visibility: 'company' as const,
      joinPolicy: 'all' as const,
      inviteEmails: [],
    };

    expect(schema.safeParse({ ...base, name: 'Procurement North' }).success).toBe(true);

    const clash = schema.safeParse({ ...base, name: 'Procurement-North' });
    expect(clash.success).toBe(true); // not taken yet — only "Sales Chennai" exists
    const clash2 = schema.safeParse({ ...base, name: 'sales-chennai' });
    expect(clash2.success).toBe(false);
    if (!clash2.success) {
      expect(clash2.error.issues[0]?.message).toBe('A channel with this name already exists');
      expect(clash2.error.issues[0]?.path).toEqual(['name']);
    }
  });

  it('rejects invalid characters, too-short and too-long names', () => {
    expect(ChannelNameSchema.safeParse('QA <script>').success).toBe(false);
    expect(ChannelNameSchema.safeParse('A').success).toBe(false);
    expect(ChannelNameSchema.safeParse('x'.repeat(CHANNEL_NAME_MAX + 1)).success).toBe(false);
    expect(ChannelNameSchema.safeParse('QA Collab Chennai').success).toBe(true);
  });

  it('forces private channels to be invite-only', () => {
    const schema = createCreateChannelSchema([]);
    const result = schema.safeParse({
      name: 'Design Team',
      description: '',
      visibility: 'private',
      joinPolicy: 'all',
      inviteEmails: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'joinPolicy')).toBe(true);
    }
  });

  it('validates invite addresses and de-duplicates them case-insensitively', () => {
    const schema = createCreateChannelSchema([]);
    const input = (inviteEmails: string[]) => ({
      name: 'Design Team',
      description: '',
      visibility: 'private' as const,
      joinPolicy: 'invite_only' as const,
      inviteEmails,
    });

    expect(schema.safeParse(input(['qa.external@example.com'])).success).toBe(true);
    expect(schema.safeParse(input(['not-an-email'])).success).toBe(false);
    expect(InviteEmailSchema.safeParse('  QA.External@Example.COM ').success).toBe(true);

    const dupe = schema.safeParse(input(['a@b.com', 'A@B.COM']));
    expect(dupe.success).toBe(false);
    if (!dupe.success) {
      expect(dupe.error.issues.some((i) => i.message === 'This email is already in the list')).toBe(true);
    }
  });

  it('maps the server error codes onto form fields and copy', () => {
    const err = (m: string) => ({ message: m });
    expect(channelCreateErrorField(err('channel_name_exists'))).toBe('name');
    expect(channelCreateErrorMessage(err('channel_name_exists'))).toBe(
      'A channel with this name already exists',
    );
    expect(channelCreateErrorField(err('invalid_invite_email: x@y'))).toBe('inviteEmails');
    expect(channelCreateErrorMessage(err('invalid_invite_email: x@y'))).toBe(
      'One of the email addresses is not valid',
    );
    expect(channelCreateErrorField(err('not_authenticated'))).toBe('form');
    expect(channelCreateErrorMessage(err('channel_name_invalid_characters'))).toContain('letters, numbers');
  });
});
