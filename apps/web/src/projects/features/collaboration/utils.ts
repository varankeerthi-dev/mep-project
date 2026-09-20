// utils.ts — small helpers for the collaboration module.

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - t) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function groupConsecutive<T>(items: T[], key: (t: T) => string): T[][] {
  const groups: T[][] = [];
  for (const it of items) {
    const k = key(it);
    const last = groups[groups.length - 1];
    if (last && key(last[last.length - 1]) === k) {
      last.push(it);
    } else {
      groups.push([it]);
    }
  }
  return groups;
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith('optimistic:');
}

export function buildAttachmentPath(args: {
  organisationId: string;
  channelId: string;
  messageId: string;
  fileName: string;
}): string {
  const safe = args.fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${args.organisationId}/${args.channelId}/${args.messageId}/${Date.now()}_${safe}`;
}

export function parseTaskFromMessage(content: string, mentions?: string[]) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const rawTitle = lines[0] || 'Task from message';
  const title = rawTitle.length > 80 ? rawTitle.slice(0, 77) + '…' : rawTitle;

  const checklistTitles: string[] = [];
  lines.forEach((line) => {
    const match = line.match(/^[-*•]\s*(?:\[[ x]\]\s*)?(.+)$/i) || line.match(/^\d+[.)]\s*(.+)$/);
    if (match && match[1]?.trim()) {
      checklistTitles.push(match[1].trim());
    }
  });

  return {
    title,
    description: `${content}\n\n[Created from collaboration message]`,
    assigneeIds: mentions ?? [],
    checklistTitles: checklistTitles.length > 0 ? checklistTitles : undefined,
  };
}

