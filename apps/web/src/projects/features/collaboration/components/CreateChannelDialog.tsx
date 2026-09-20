// CreateChannelDialog.tsx — create a company channel.
//
// Collects name, description, visibility (company/private) and join policy
// (everyone/invite-only), plus the invitee list when the channel is
// invite-only. Colleagues can be picked from the organisation directory or any
// address can be typed in.
//
// All of this is validated here with Zod for fast feedback and re-validated by
// the create_company_channel RPC, which owns the rules that matter (organization
// boundary, name uniqueness, invitations).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, Hash, Loader2, Lock, Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCreateCompanyChannel, useOrgMemberEmails } from '../hooks';
import {
  CHANNEL_DESCRIPTION_MAX,
  CHANNEL_NAME_MAX,
  ChannelNameSchema,
  InviteEmailSchema,
  channelCreateErrorMessage,
  channelCreateErrorField,
  createCreateChannelSchema,
  isChannelNameTaken,
  normalizeChannelName,
} from '../schemas';
import type { Channel, ChannelJoinPolicy, ChannelVisibility } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Company channels already in the organisation — used for the name check. */
  existingChannelNames?: string[];
  onCreated?: (channel: Channel) => void;
}

export function CreateChannelDialog({
  open,
  onClose,
  existingChannelNames = [],
  onCreated,
}: Props) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';
  const createChannel = useCreateCompanyChannel();

  const schema = useMemo(
    () => createCreateChannelSchema(existingChannelNames),
    [existingChannelNames],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>('company');
  const [joinPolicy, setJoinPolicy] = useState<ChannelJoinPolicy>('all');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // A private channel is invite-only by definition.
  useEffect(() => {
    if (visibility === 'private' && joinPolicy !== 'invite_only') {
      setJoinPolicy('invite_only');
    }
  }, [visibility, joinPolicy]);

  // Fresh form each time it opens.
  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setVisibility('company');
    setJoinPolicy('all');
    setInviteEmails([]);
    setEmailDraft('');
    setEmailError(undefined);
    setErrors({});
    const id = window.setTimeout(() => nameRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /** Live name feedback: format first, then the duplicate rule. */
  const nameError = useMemo(() => {
    if (!name.trim()) return undefined;
    const format = ChannelNameSchema.safeParse(name);
    if (!format.success) return format.error.issues[0]?.message;
    if (isChannelNameTaken(name, existingChannelNames)) {
      return 'A channel with this name already exists';
    }
    return undefined;
  }, [name, existingChannelNames]);

  const inviteOnly = joinPolicy === 'invite_only';

  const addEmail = (raw: string) => {
    const parsed = InviteEmailSchema.safeParse(raw);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    const email = parsed.data.toLowerCase();
    if (inviteEmails.some((existing) => existing.toLowerCase() === email)) {
      setEmailError('This email is already in the list');
      return;
    }
    setInviteEmails((prev) => [...prev, email]);
    setEmailDraft('');
    setEmailError(undefined);
  };

  const removeEmail = (email: string) => {
    setInviteEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgId) {
      toast.error('No organisation on this session');
      return;
    }

    const parsed = schema.safeParse({ name, description, visibility, joinPolicy, inviteEmails });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    try {
      setSubmitting(true);
      const channel = await createChannel.mutateAsync({
        organisationId: orgId,
        name: parsed.data.name,
        description: parsed.data.description ? parsed.data.description : null,
        visibility: parsed.data.visibility,
        joinPolicy: parsed.data.joinPolicy,
        inviteEmails: parsed.data.inviteEmails,
      });
      toast.success(`✓ #${channel.name} created`);
      onCreated?.(channel);
      onClose();
    } catch (err) {
      const message = channelCreateErrorMessage(err as { message?: string });
      if (channelCreateErrorField(err as { message?: string }) === 'name') {
        setErrors({ name: message });
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const canSubmit = Boolean(orgId) && !!name.trim() && !nameError && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-xs p-4 sm:items-center"
      data-testid="create-channel-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-blue-50/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Create channel</h2>
              <p className="text-xs text-gray-500">Company channels are visible across your organisation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition"
            aria-label="Close"
            data-testid="create-channel-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="channel-name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Channel name *
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                id="channel-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Chennai"
                maxLength={CHANNEL_NAME_MAX}
                autoComplete="off"
                className={`w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                  nameError
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                data-testid="channel-name-input"
              />
            </div>
            {nameError ? (
              <p className="mt-1 text-[11px] text-red-600" data-testid="channel-name-error">
                {nameError}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-500">
                Letters, numbers, spaces, hyphen, underscore or dot. Names that differ
                only in spacing, punctuation or case are considered duplicates and will
                be rejected.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="channel-description" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel for?"
              rows={2}
              maxLength={CHANNEL_DESCRIPTION_MAX}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              data-testid="channel-description-input"
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">
              {description.length}/{CHANNEL_DESCRIPTION_MAX}
            </p>
          </div>

          {/* Visibility */}
          <div>
            <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Visibility
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: 'company' as ChannelVisibility,
                    icon: Building2,
                    title: 'Company',
                    hint: 'Everyone in the organisation can find it',
                  },
                  {
                    value: 'private' as ChannelVisibility,
                    icon: Lock,
                    title: 'Private',
                    hint: 'Only invited people can see it',
                  },
                ] satisfies { value: ChannelVisibility; icon: typeof Building2; title: string; hint: string }[]
              ).map((option) => {
                const active = visibility === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                    className={`text-left rounded-lg border p-3 transition ${
                      active
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid={`visibility-${option.value}`}
                    data-active={active ? 'true' : 'false'}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-gray-500'}`} />
                      <span className="text-sm font-semibold text-gray-800">{option.title}</span>
                      {active && <Check className="h-3.5 w-3.5 text-blue-600 ml-auto" />}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 leading-snug">{option.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Join policy (company channels only; private is always invite-only) */}
          <div>
            <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Who can join
            </span>
            {visibility === 'private' ? (
              <p className="text-[11px] text-gray-500 rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                A private channel is always invite-only.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'all' as ChannelJoinPolicy,
                      title: 'Everyone',
                      hint: 'Any organisation member can read and post',
                    },
                    {
                      value: 'invite_only' as ChannelJoinPolicy,
                      title: 'Invite only',
                      hint: 'Only invited people can read and post',
                    },
                  ] satisfies { value: ChannelJoinPolicy; title: string; hint: string }[]
                ).map((option) => {
                  const active = joinPolicy === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setJoinPolicy(option.value)}
                      className={`text-left rounded-lg border p-3 transition ${
                        active
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      data-testid={`join-policy-${option.value}`}
                      data-active={active ? 'true' : 'false'}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{option.title}</span>
                        {active && <Check className="h-3.5 w-3.5 text-blue-600 ml-auto" />}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500 leading-snug">{option.hint}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invites */}
          {inviteOnly && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-2.5 bg-gray-50/60">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Invite by email
                </span>
                <span className="text-[11px] text-gray-400">— pick an employee or type any address</span>
              </div>

              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => {
                      setEmailDraft(e.target.value);
                      if (emailError) setEmailError(undefined);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        if (emailDraft.trim()) addEmail(emailDraft);
                      }
                    }}
                    placeholder="name@company.com"
                    className={`w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 ${
                      emailError
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    data-testid="invite-email-input"
                  />
                  {emailError && (
                    <p className="mt-1 text-[11px] text-red-600" data-testid="invite-email-error">
                      {emailError}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => emailDraft.trim() && addEmail(emailDraft)}
                  disabled={!emailDraft.trim()}
                  data-testid="invite-email-add"
                >
                  Add
                </Button>
              </div>

              {inviteEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5" data-testid="invite-chip-list">
                  {inviteEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[11px] text-gray-700"
                      data-testid="invite-chip"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`Remove ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <EmployeePicker orgId={orgId} selected={inviteEmails} onAdd={addEmail} />
            </div>
          )}

          {errors.form && <p className="text-[11px] text-red-600">{errors.form}</p>}

          {/* Footer */}
          <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canSubmit}
              data-testid="create-channel-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating…
                </>
              ) : (
                'Create channel'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Colleagues from the organisation directory. Mounted only while the channel is
 * invite-only, so the contact list is not fetched for open channels.
 */
function EmployeePicker({
  orgId,
  selected,
  onAdd,
}: {
  orgId: string;
  selected: string[];
  onAdd: (email: string) => void;
}) {
  const { data: contacts = [], isLoading } = useOrgMemberEmails(orgId);
  const [filter, setFilter] = useState('');

  const selectedSet = useMemo(
    () => new Set(selected.map((e) => normalizeChannelName(e))),
    [selected],
  );

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const list = term
      ? contacts.filter(
          (c) =>
            c.email.toLowerCase().includes(term) ||
            (c.full_name ?? '').toLowerCase().includes(term),
        )
      : contacts;
    return list.slice(0, 40);
  }, [contacts, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading colleagues…
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <p className="text-[11px] text-gray-400">
        No employee email addresses available — add addresses above.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search employees…"
        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        data-testid="invite-employee-search"
      />
      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
        {visible.map((contact) => {
          const already = selectedSet.has(normalizeChannelName(contact.email));
          return (
            <button
              key={contact.user_id ?? contact.employee_id ?? contact.email}
              type="button"
              onClick={() => onAdd(contact.email)}
              disabled={already}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition ${
                already ? 'opacity-50 cursor-default' : 'hover:bg-blue-50'
              }`}
              data-testid="invite-employee-option"
            >
              {contact.avatar_url ? (
                <img src={contact.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="h-5 w-5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-semibold flex items-center justify-center">
                  {(contact.full_name ?? contact.email).slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-800 truncate">
                  {contact.full_name ?? contact.email}
                </span>
                {contact.full_name && (
                  <span className="block text-[10px] text-gray-500 truncate">{contact.email}</span>
                )}
              </span>
              {contact.source === 'employee' && (
                <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500">
                  Employee
                </span>
              )}
              {already ? (
                <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              ) : (
                <span className="text-[10px] font-semibold text-blue-600 shrink-0">Add</span>
              )}
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="px-2.5 py-3 text-[11px] text-gray-400 text-center">No matches.</p>
        )}
      </div>
    </div>
  );
}
