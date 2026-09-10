// schemas.test.ts — Vitest unit tests for the collaboration module's pure logic.
// Deterministic: no I/O, no Supabase, no React. Zod schemas + utility fns only.
import { describe, it, expect } from 'vitest';
import {
  LinkedEntitySchema,
  MessageMetadataSchema,
  MessageDraftSchema,
  AttachmentMetaSchema,
  SendMessageRpcSchema,
} from './schemas';
import {
  formatRelativeTime,
  groupConsecutive,
  isOptimisticId,
  buildAttachmentPath,
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

import { addAttachment } from './api';

describe('addAttachment client contract', () => {
  it('is exported and callable (runtime requires a live Supabase)', () => {
    expect(typeof addAttachment).toBe('function');
  });
});
