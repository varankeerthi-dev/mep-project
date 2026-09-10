// schemas.ts — Zod validation at message + attachment boundaries
import { z } from 'zod';

export const LinkedEntitySchema = z.object({
  type: z.enum([
    'task', 'work_order', 'issue', 'daily_report',
    'document', 'rfi', 'boq', 'material', 'po',
  ]),
  id: z.string().uuid(),
  label: z.string().min(1).max(200),
  snapshot: z.record(z.string(), z.unknown()).optional(),
});

export const MessageMetadataSchema = z.object({
  mentions: z.array(z.string().uuid()).max(50).optional(),
  linked_entities: z.array(LinkedEntitySchema).max(20).optional(),
  client_msg_id: z.string().uuid().optional(),
  deleted: z.boolean().optional(),
  ai: z.object({
    classification: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    potential_action: z.boolean().optional(),
  }).optional(),
});

export const MessageDraftSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty').max(4000),
  parentMessageId: z.string().uuid().nullable().optional(),
  mentions: z.array(z.string().uuid()).max(50).optional(),
  linkedEntities: z.array(LinkedEntitySchema).max(20).optional(),
});

export type MessageDraftInput = z.infer<typeof MessageDraftSchema>;

export const AttachmentMetaSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().nonnegative().max(50 * 1024 * 1024), // 50 MB cap
  mime_type: z.string().min(1).max(200),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
});

export type AttachmentMeta = z.infer<typeof AttachmentMetaSchema>;

/** Server response shape from send_collaboration_message — sanity-checked in dev. */
export const SendMessageRpcSchema = z.object({
  id: z.string().uuid(),
  channel_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  created_at: z.string(),
  content: z.string(),
  message_type: z.string(),
  metadata: MessageMetadataSchema,
  client_msg_id: z.string().uuid().nullable(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  parent_message_id: z.string().uuid().nullable(),
  organisation_id: z.string().uuid(),
});
