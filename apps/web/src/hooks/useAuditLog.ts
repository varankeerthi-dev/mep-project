import { supabase } from '../supabase';

export type AuditAction = 'created' | 'updated' | 'deleted' | 'status_changed' | 'note_added';

export function useAuditLog(organisationId: string | undefined, userId: string | undefined) {
  const log = async (
    action: AuditAction,
    entityType: string,
    entityId: string,
    changes?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) => {
    if (!organisationId || !userId) return;
    try {
      await supabase.from('audit_log').insert({
        organisation_id: organisationId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      });
    } catch (err) {
      console.warn('Audit log insert failed:', err);
    }
  };

  return { log };
}
