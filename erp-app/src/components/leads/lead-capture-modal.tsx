import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLead, useLeads, useLeadStatuses, useLeadIndustries, useOrgUsers } from '@/hooks/use-leads';
import type { LeadSource, NewLeadInput } from '@/types/leads';
import { ChevronDown, ChevronRight, Plus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId?: string | null;
  defaultClientName?: string | null;
  defaultOwnerUserId?: string | null;
  mode?: 'quick' | 'full';
}

const SOURCES: LeadSource[] = [
  'Referral', 'Trade Show', 'Cold Call', 'Website',
  'Existing Client', 'LinkedIn', 'Advertisement', 'Walk-in',
  'IndiaMART', 'JustDial', 'Other',
];

function inThreeDaysLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const cardBody = { padding: '24px' };
const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelColStyle = {
  minWidth: '70px', maxWidth: '70px',
  fontWeight: 600, fontSize: '11px', color: '#374151',
} as const;
const fieldColStyle = { flex: 1 };
const sectionHeaderStyle = {
  fontWeight: 600, fontSize: '11px', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px',
} as const;
const inputStyle = { padding: '4px 8px', fontSize: '12px' };

function renderHeaderField(label: string, field: React.ReactNode, isLast = false) {
  return (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );
}

export function LeadCaptureModal({
  open, onOpenChange, defaultClientId, defaultClientName, defaultOwnerUserId,
  mode = 'quick',
}: LeadCaptureModalProps) {
  const createLead = useCreateLead();
  const { data: allLeads = [] } = useLeads();
  const { data: statuses = [] } = useLeadStatuses();
  const { data: industries = [] } = useLeadIndustries();
  const { data: orgUsers = [] } = useOrgUsers();
  const openLeadCount = allLeads.filter((l) => l.status === 'New' || l.status === 'Qualified').length;
  const defaultStatus = statuses.find(s => s.is_default);

  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState(defaultClientName ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('Referral');
  const [leadStatusId, setLeadStatusId] = useState(defaultStatus?.id || '');
  const [industryId, setIndustryId] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [projectName, setProjectName] = useState('');
  const [requirementSummary, setRequirementSummary] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>('');
  const [nextActionAt, setNextActionAt] = useState<string>(inThreeDaysLocal());
  const [nextActionLabel, setNextActionLabel] = useState<string>('Initial call');
  const [ownerUserId, setOwnerUserId] = useState<string | undefined>(defaultOwnerUserId ?? undefined);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pin, setPin] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setContactName('');
      setCompanyName(defaultClientName ?? '');
      setContactPhone('');
      setContactEmail('');
      setSource('Referral');
      setLeadStatusId(defaultStatus?.id || '');
      setIndustryId('');
      setReferredBy('');
      setRemarks('');
      setProjectName('');
      setRequirementSummary('');
      setEstimatedValue('');
      setExpectedCloseDate('');
      setNextActionAt(inThreeDaysLocal());
      setNextActionLabel('Initial call');
      setOwnerUserId(defaultOwnerUserId ?? undefined);
      setCity('');
      setState('');
      setPin('');
      setShowAdvanced(false);
      setError('');
    }
  }, [open, defaultClientName, defaultStatus?.id, defaultOwnerUserId]);

  useEffect(() => {
    if (pin.length === 6 && /^\d{6}$/.test(pin)) {
      setPincodeLoading(true);
      fetch(`/api/pincode/${pin}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.city && data?.state) {
            setCity(data.city);
            setState(data.state);
          }
        })
        .catch(() => {})
        .finally(() => setPincodeLoading(false));
    }
  }, [pin]);

  const canSubmit = useMemo(() => contactName.trim().length > 0, [contactName]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError('');
    const input: NewLeadInput = {
      contact_name: contactName.trim(),
      company_name: companyName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      source,
      lead_status_id: leadStatusId || null,
      industry_id: industryId || null,
      referred_by: referredBy.trim(),
      remarks: remarks.trim(),
      client_id: defaultClientId ?? null,
      project_name: projectName.trim(),
      requirement_summary: requirementSummary.trim(),
      estimated_value: estimatedValue ? Number(estimatedValue) : 0,
      expected_close_date: expectedCloseDate || null,
      owner_user_id: ownerUserId ?? defaultOwnerUserId ?? null,
      next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
      next_action_label: nextActionLabel.trim(),
      city: city.trim(),
      state: state.trim(),
      pin: pin.trim(),
    };
    createLead.mutate(input, {
      onSuccess: (saved) => {
        const label = saved.contact_name || input.contact_name;
        toast.success(`Lead saved · ${label}`, {
          description: nextActionAt
            ? `Next action: "${nextActionLabel}" on ${new Date(nextActionAt).toLocaleString()}`
            : 'No next action set — open the lead to schedule one.',
        });
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        toast.error('Could not save lead', { description: msg });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <div style={cardBody}>
          <DialogHeader style={{ marginBottom: '20px' }}>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              {mode === 'quick' ? 'Capture a lead' : 'New Lead'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {mode === 'quick'
                ? 'Quick-add. The essentials now; fill the rest later from the lead\'s detail page.'
                : 'Full lead profile. All fields available.'}
              {openLeadCount > 0 && (
                <span className="ml-1 text-zinc-700">
                  · {openLeadCount} open in queue
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px', padding: '8px 12px', background: '#fef2f2', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
              {/* Column 1: Contact + Project */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={sectionHeaderStyle}>Contact</div>
                {renderHeaderField('Name *', <Input autoFocus value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Aarav Mehta" style={inputStyle} />)}
                {renderHeaderField('Company', <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Lumen MEP" style={inputStyle} />)}
                {renderHeaderField('Source', <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} style={{ ...inputStyle, height: '28px', width: '100%', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff' }}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>)}
                {mode === 'full' && renderHeaderField('Referred By', <Input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Referrer name" style={inputStyle} />)}

                <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Address</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} />
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" style={inputStyle} />
                  <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                    <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" style={inputStyle} />
                    {pincodeLoading && <span style={{ position: 'absolute', right: '8px', top: '5px', fontSize: '10px', color: '#6b7280' }}>...</span>}
                  </div>
                </div>

                <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Project</div>
                {renderHeaderField('Name', <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Tower B HVAC retrofit" style={inputStyle} />, true)}
              </div>

              {/* Column 2: Reach + Cadence + Classification */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={sectionHeaderStyle}>Reach</div>
                {renderHeaderField('Phone', <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 98xxx xxxxx" style={inputStyle} />)}
                {renderHeaderField('Email', <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="name@company.in" style={inputStyle} />)}

                {mode === 'full' && (
                  <>
                    <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Classification</div>
                    {renderHeaderField('Status', <select value={leadStatusId} onChange={(e) => setLeadStatusId(e.target.value)} style={{ ...inputStyle, height: '28px', width: '100%', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff' }}>
                      {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>)}
                    {renderHeaderField('Industry', <select value={industryId} onChange={(e) => setIndustryId(e.target.value)} style={{ ...inputStyle, height: '28px', width: '100%', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff' }}>
                      <option value="">Select industry</option>
                      {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>)}
                    {renderHeaderField('Owner', <select value={ownerUserId || ''} onChange={(e) => setOwnerUserId(e.target.value || undefined)} style={{ ...inputStyle, height: '28px', width: '100%', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff' }}>
                      <option value="">Unassigned</option>
                      {orgUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>, true)}
                  </>
                )}

                <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Next action</div>
                {renderHeaderField('When', <Input type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} style={inputStyle} />)}
                {renderHeaderField('What', <Input value={nextActionLabel} onChange={(e) => setNextActionLabel(e.target.value)} placeholder="Send revised quote v2" style={inputStyle} />)}
                {mode === 'quick' && (
                  <>
                    <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Assignment</div>
                    {renderHeaderField('Owner', <select value={ownerUserId || ''} onChange={(e) => setOwnerUserId(e.target.value || undefined)} style={{ ...inputStyle, height: '28px', width: '100%', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff' }}>
                      <option value="">Unassigned</option>
                      {orgUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>, true)}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Advanced: requirement + value + close date */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={cn(
              'mt-3 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium',
              'text-zinc-600 hover:bg-zinc-100'
            )}
          >
            {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showAdvanced ? 'Hide' : 'Show'} details (requirement, value, expected close)
          </button>

          {showAdvanced && (
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', marginTop: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionHeaderStyle}>Requirement</div>
                  {renderHeaderField('One line', <Textarea value={requirementSummary} onChange={(e) => setRequirementSummary(e.target.value)} placeholder="What do they need? Scope, site, timing." className="min-h-[60px] resize-none" style={inputStyle} />, true)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionHeaderStyle}>Forecast</div>
                  {renderHeaderField('Value ₹', <Input type="number" inputMode="numeric" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="0" style={inputStyle} />)}
                  {renderHeaderField('Close by', <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} style={inputStyle} />, true)}
                </div>
              </div>

            </div>
          )}

          {/* Remarks — always visible in full mode, shown in quick mode only when advanced is expanded */}
          {(mode === 'full' || showAdvanced) && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ ...sectionHeaderStyle, marginBottom: '4px' }}>Remarks</div>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', minHeight: '48px', resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="Additional notes..."
              />
            </div>
          )}
        </div>

        <DialogFooter
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e4e4e7',
            background: '#fafafa',
            borderRadius: '0 0 8px 8px',
          }}
        >
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || createLead.isPending}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            {createLead.isPending ? 'Saving…' : mode === 'quick' ? 'Add lead' : 'Create Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
