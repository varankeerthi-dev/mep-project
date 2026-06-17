// =============================================================================
// LeadCaptureModal — quick lead capture, redesigned using DESIGN.md tokens.
// Card body padding: 24px. Form rows: 70px label + 8px gap. 2-col grid.
// Section headers uppercase 11px. Optional fields collapsed under "Advanced".
// =============================================================================

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLead, useLeads } from '@/hooks/use-leads';
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
}

const SOURCES: LeadSource[] = [
  'Referral',
  'Trade Show',
  'Cold Call',
  'Website',
  'Existing Client',
  'LinkedIn',
  'Advertisement',
  'Walk-in',
  'Other',
];

function inThreeDaysLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(10, 0, 0, 0);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// DESIGN.md tokens
const cardBody = { padding: '24px' };
const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelColStyle = {
  minWidth: '70px',
  maxWidth: '70px',
  fontWeight: 600,
  fontSize: '11px',
  color: '#374151',
} as const;
const fieldColStyle = { flex: 1 };
const sectionHeaderStyle = {
  fontWeight: 600,
  fontSize: '11px',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '2px',
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
  open,
  onOpenChange,
  defaultClientId,
  defaultClientName,
  defaultOwnerUserId,
}: LeadCaptureModalProps) {
  const createLead = useCreateLead();
  const { data: allLeads = [] } = useLeads();
  const openLeadCount = allLeads.filter((l) => l.status === 'New' || l.status === 'Qualified').length;

  // --- form state ---
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState(defaultClientName ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('Referral');
  const [projectName, setProjectName] = useState('');
  const [requirementSummary, setRequirementSummary] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>('');
  const [nextActionAt, setNextActionAt] = useState<string>(inThreeDaysLocal());
  const [nextActionLabel, setNextActionLabel] = useState<string>('Initial call');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setContactName('');
      setCompanyName(defaultClientName ?? '');
      setContactPhone('');
      setContactEmail('');
      setSource('Referral');
      setProjectName('');
      setRequirementSummary('');
      setEstimatedValue('');
      setExpectedCloseDate('');
      setNextActionAt(inThreeDaysLocal());
      setNextActionLabel('Initial call');
      setShowAdvanced(false);
    }
  }, [open, defaultClientName]);

  const canSubmit = useMemo(() => contactName.trim().length > 0, [contactName]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const input: NewLeadInput = {
      contact_name: contactName.trim(),
      company_name: companyName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      source,
      client_id: defaultClientId ?? null,
      project_name: projectName.trim(),
      requirement_summary: requirementSummary.trim(),
      estimated_value: estimatedValue ? Number(estimatedValue) : 0,
      expected_close_date: expectedCloseDate || null,
      owner_user_id: defaultOwnerUserId ?? null,
      next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
      next_action_label: nextActionLabel.trim(),
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
              Capture a lead
            </DialogTitle>
            <DialogDescription className="text-xs">
              Quick-add. The essentials now; fill the rest later from the lead's detail page.
              {openLeadCount > 0 && (
                <span className="ml-1 text-zinc-700">
                  · {openLeadCount} open in queue
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div
            style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 20px',
              }}
            >
              {/* ── Column 1: Contact + Project ──────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={sectionHeaderStyle}>Contact</div>
                {renderHeaderField(
                  'Name *',
                  <Input
                    autoFocus
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Aarav Mehta"
                    style={inputStyle}
                  />
                )}
                {renderHeaderField(
                  'Company',
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Lumen MEP"
                    style={inputStyle}
                  />
                )}
                {renderHeaderField(
                  'Source',
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    style={{ ...inputStyle, height: '28px', width: '100%', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff' }}
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}

                <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Project</div>
                {renderHeaderField(
                  'Name',
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Tower B HVAC retrofit"
                    style={inputStyle}
                  />,
                  true
                )}
              </div>

              {/* ── Column 2: Reach + Cadence ────────────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={sectionHeaderStyle}>Reach</div>
                {renderHeaderField(
                  'Phone',
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98xxx xxxxx"
                    style={inputStyle}
                  />
                )}
                {renderHeaderField(
                  'Email',
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="name@company.in"
                    style={inputStyle}
                  />
                )}

                <div style={{ ...sectionHeaderStyle, marginTop: '8px' }}>Next action</div>
                {renderHeaderField(
                  'When',
                  <Input
                    type="datetime-local"
                    value={nextActionAt}
                    onChange={(e) => setNextActionAt(e.target.value)}
                    style={inputStyle}
                  />
                )}
                {renderHeaderField(
                  'What',
                  <Input
                    value={nextActionLabel}
                    onChange={(e) => setNextActionLabel(e.target.value)}
                    placeholder="Send revised quote v2"
                    style={inputStyle}
                  />,
                  true
                )}
              </div>
            </div>
          </div>

          {/* ── Advanced: requirement + value + close date ─────── */}
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
            <div
              style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                marginTop: '6px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px 20px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionHeaderStyle}>Requirement</div>
                  {renderHeaderField(
                    'One line',
                    <Textarea
                      value={requirementSummary}
                      onChange={(e) => setRequirementSummary(e.target.value)}
                      placeholder="What do they need? Scope, site, timing."
                      className="min-h-[60px] resize-none"
                      style={inputStyle}
                    />,
                    true
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionHeaderStyle}>Forecast</div>
                  {renderHeaderField(
                    'Value ₹',
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  )}
                  {renderHeaderField(
                    'Close by',
                    <Input
                      type="date"
                      value={expectedCloseDate}
                      onChange={(e) => setExpectedCloseDate(e.target.value)}
                      style={inputStyle}
                    />,
                    true
                  )}
                </div>
              </div>
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
            {createLead.isPending ? 'Saving…' : 'Add lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
