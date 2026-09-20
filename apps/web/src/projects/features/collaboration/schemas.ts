// schemas.ts — Zod validation at message + attachment boundaries
import { z } from 'zod';

export const LinkedEntitySchema = z.object({
  type: z.enum([
    'task', 'reminder', 'work_order', 'issue', 'daily_report',
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

/* -------------------------------------------------------------------------- */
/* Channels                                                                   */
/* -------------------------------------------------------------------------- */

export const CHANNEL_NAME_MIN = 2;
export const CHANNEL_NAME_MAX = 80;
export const CHANNEL_DESCRIPTION_MAX = 500;

export const ChannelVisibilitySchema = z.enum(['company', 'private']);
export const ChannelJoinPolicySchema = z.enum(['all', 'invite_only']);

/**
 * Fold a channel name for uniqueness. Case, spaces, hyphens, underscores and
 * dots are ignored, so "Sales Chennai", "Sales-Chennai" and "sales_chennai" all
 * collapse to "saleschennai" and collide. Mirrors the generated
 * project_collaboration_channels.name_normalized column — the database is the
 * authority; this exists to fail fast in the dialog.
 */
export function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Strip whatever the user typed into a sendable channel name. */
export function slugifyChannelName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, CHANNEL_NAME_MAX);
}

export const ChannelNameSchema = z
  .string()
  .trim()
  .min(CHANNEL_NAME_MIN, `Channel name must be at least ${CHANNEL_NAME_MIN} characters`)
  .max(CHANNEL_NAME_MAX, `Channel name must be ${CHANNEL_NAME_MAX} characters or fewer`)
  .regex(/^[A-Za-z0-9 ._-]+$/, 'Use letters, numbers, spaces, hyphen, underscore or dot only');

/**
 * Does `name` collide with any existing channel once separators/case are folded?
 * "Sales Chennai" vs "Sales-Chennai" vs "sales_chennai" all collide.
 */
export function isChannelNameTaken(name: string, existingNames: string[]): boolean {
  const normalized = normalizeChannelName(name);
  if (!normalized) return false;
  return existingNames.some((existing) => normalizeChannelName(existing) === normalized);
}

export const InviteEmailSchema = z
  .string()
  .trim()
  .min(1, 'Enter an email address')
  .max(254, 'Email address is too long')
  .email('Enter a valid email address');

/**
 * Build the create-channel form schema. `existingNames` is every company channel
 * already in the organisation, so a clash is reported on the field instead of
 * after a round trip — the RPC raises `channel_name_exists` for the same rule.
 */
export function createCreateChannelSchema(existingNames: string[] = []) {
  const taken = new Set(existingNames.map(normalizeChannelName));

  return z
    .object({
      name: ChannelNameSchema.refine(
        (name) => !taken.has(normalizeChannelName(name)),
        'A channel with this name already exists',
      ),
      description: z
        .string()
        .trim()
        .max(CHANNEL_DESCRIPTION_MAX, `Description must be ${CHANNEL_DESCRIPTION_MAX} characters or fewer`)
        .optional()
        .or(z.literal('')),
      visibility: ChannelVisibilitySchema,
      joinPolicy: ChannelJoinPolicySchema,
      inviteEmails: z.array(InviteEmailSchema).max(50, 'Too many invitations at once').default([]),
    })
    .superRefine((value, ctx) => {
      if (value.visibility === 'private' && value.joinPolicy !== 'invite_only') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['joinPolicy'],
          message: 'A private channel is always invite-only',
        });
      }

      const seen = new Map<string, number>();
      value.inviteEmails.forEach((email, index) => {
        const key = email.trim().toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['inviteEmails', index],
            message: 'This email is already in the list',
          });
        } else {
          seen.set(key, index);
        }
      });
    });
}

export type CreateChannelFormValues = z.infer<ReturnType<typeof createCreateChannelSchema>>;

/** Map an RPC failure onto a form field. */
export function channelCreateErrorField(error: { message?: string } | null | undefined): 'name' | 'inviteEmails' | 'form' {
  const message = (error?.message ?? '').toLowerCase();
  if (message.includes('channel_name_exists')) return 'name';
  if (message.includes('invalid_invite_email')) return 'inviteEmails';
  return 'form';
}

/** Human copy for the raw RPC error codes. */
export function channelCreateErrorMessage(error: { message?: string } | null | undefined): string {
  const message = (error?.message ?? '').trim();
  const code = message.split(':')[0]?.trim() ?? '';
  switch (true) {
    case message.includes('channel_name_exists'):
      return 'A channel with this name already exists';
    case message.includes('invalid_invite_email'):
      return 'One of the email addresses is not valid';
    case message.includes('channel_name_too_short'):
      return `Channel name must be at least ${CHANNEL_NAME_MIN} characters`;
    case message.includes('channel_name_too_long'):
      return `Channel name must be ${CHANNEL_NAME_MAX} characters or fewer`;
    case message.includes('channel_name_invalid_characters'):
      return 'Use letters, numbers, spaces, hyphen, underscore or dot only';
    case message.includes('forbidden'):
      return 'You do not have access to this organisation';
    case message.includes('not_authenticated'):
      return 'Your session expired — sign in again';
    default:
      return message || 'Could not create the channel';
  }
}

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
