const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../apps/web/src/features/subcontractor-v2/services/subcontractorService.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newMethods = `
  async requestTenantLink(initiatorOrgId: string, receiverOrgId: string, initiatorPartyId?: string) {
    const { data, error } = await supabase.rpc('request_tenant_link', {
      p_initiator_org_id: initiatorOrgId,
      p_receiver_org_id: receiverOrgId,
      p_initiator_party_id: initiatorPartyId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async acceptTenantLink(linkId: string, receiverOrgId: string, receiverPartyId?: string) {
    const { data, error } = await supabase.rpc('accept_tenant_link', {
      p_link_id: linkId,
      p_receiver_org_id: receiverOrgId,
      p_receiver_party_id: receiverPartyId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async revokeTenantLink(linkId: string, orgId: string, reason?: string) {
    const { data, error } = await supabase.rpc('revoke_tenant_link', {
      p_link_id: linkId,
      p_org_id: orgId,
      p_reason: reason || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getTenantLinks(orgId: string) {
    const { data, error } = await supabase
      .from('labour_tenant_links')
      .select('*, initiator_org:initiator_org_id(id, name), receiver_org:receiver_org_id(id, name)')
      .or(\`initiator_org_id.eq.\${orgId},receiver_org_id.eq.\${orgId}\`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async submitSharedAttendance(payload: {
    linkId: string;
    senderOrgId: string;
    attendanceIds: string[];
    notes?: string;
  }) {
    const { data, error } = await supabase.rpc('submit_shared_attendance', {
      p_link_id: payload.linkId,
      p_sender_org_id: payload.senderOrgId,
      p_attendance_ids: payload.attendanceIds,
      p_notes: payload.notes || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getSharedInbox(receiverOrgId: string) {
    const { data, error } = await supabase
      .from('v_labour_share_inbox')
      .select('*')
      .eq('receiver_org_id', receiverOrgId)
      .order('attendance_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async reviewSharedAttendance(payload: {
    itemId: string;
    receiverOrgId: string;
    decision: 'approved' | 'rejected' | 'disputed';
    reason?: string;
    projectId?: string;
    workOrderId?: string;
  }) {
    const { data, error } = await supabase.rpc('review_shared_attendance', {
      p_item_id: payload.itemId,
      p_receiver_org_id: payload.receiverOrgId,
      p_decision: payload.decision,
      p_reason: payload.reason || null,
      p_project_id: payload.projectId || null,
      p_work_order_id: payload.workOrderId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }
`;

const lastBraceIdx = content.lastIndexOf('};');
if (lastBraceIdx !== -1) {
  content = content.slice(0, lastBraceIdx).trimEnd() + ',\n' + newMethods + '};\n';
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[SUCCESS] Appended Phase 4 methods to subcontractorService');
} else {
  console.error('[FAIL] Could not find closing brace');
}
