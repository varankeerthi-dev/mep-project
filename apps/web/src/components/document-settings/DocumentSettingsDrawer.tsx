import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { Drawer } from '../ui/Drawer';
import { cn } from '../../lib/utils';
import { Check, ChevronDown, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DOCUMENT_TYPES = [
  'Quotation',
  'Sales Order',
  'Proforma Invoice',
  'Delivery Challan',
  'Invoice',
  'Tools Delivery Challan',
  'Credit Note',
  'Debit Note',
];

const VISIBLE_TYPES = DOCUMENT_TYPES.slice(0, 5);
const MORE_TYPES = DOCUMENT_TYPES.slice(5);

interface DocumentSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  organisationId?: string;
  quotationId?: string | null;
  onTemplateChanged?: () => void;
}

export default function DocumentSettingsDrawer({
  isOpen,
  onClose,
  organisationId,
  quotationId,
  onTemplateChanged,
}: DocumentSettingsDrawerProps) {
  const [activeType, setActiveType] = useState(DOCUMENT_TYPES[0]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [quotationTemplateId, setQuotationTemplateId] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('document_templates')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('active', true)
        .order('is_default', { ascending: false });
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveType(DOCUMENT_TYPES[0]);
    setSavedType(null);
    setOpenMenu(false);
    loadTemplates();
    if (quotationId) {
      supabase
        .from('quotation_header')
        .select('template_id')
        .eq('id', quotationId)
        .maybeSingle()
        .then(({ data }) => setQuotationTemplateId(data?.template_id || null));
    } else {
      setQuotationTemplateId(null);
    }
  }, [isOpen, organisationId, quotationId, loadTemplates]);

  const typeTemplates = templates.filter(t => t.document_type === activeType);
  const defaultForType = templates.find(t => t.document_type === activeType && t.is_default);

  const selectedId =
    activeType === 'Quotation' && quotationTemplateId
      ? quotationTemplateId
      : defaultForType?.id || '';

  const selectedTemplate = templates.find(t => t.id === selectedId);

  const handleSelect = async (templateId: string) => {
    if (!templateId || !organisationId) return;
    setSaving(true);
    try {
      await supabase
        .from('document_templates')
        .update({ is_default: false })
        .eq('document_type', activeType)
        .eq('organisation_id', organisationId);

      await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', templateId)
        .eq('organisation_id', organisationId);

      if (activeType === 'Quotation' && quotationId) {
        await supabase
          .from('quotation_header')
          .update({ template_id: templateId })
          .eq('id', quotationId);
        setQuotationTemplateId(templateId);
      }

      await loadTemplates();
      setOpenMenu(false);
      setSavedType(activeType);
      setTimeout(() => setSavedType(null), 2500);
      onTemplateChanged?.();
    } catch (err: any) {
      console.error('Error updating print template:', err);
      alert('Error: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Document Settings"
      size="md"
    >
      {/* Module nav bar — Sub-Tabs Navigation Bar Pattern (DESIGN.md) */}
      <div
        className="sticky top-0 bg-white z-10"
        style={{
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          fontSynthesis: 'none',
          gap: '8px',
          MozOsxFontSmoothing: 'grayscale',
          WebkitFontSmoothing: 'antialiased',
          width: '100%',
          borderBottom: '1px solid #E5E7EB',
          marginBottom: '16px',
          paddingBottom: '4px',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            boxSizing: 'border-box',
            display: 'flex',
            flexShrink: '0',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'flex-start',
            padding: '3px',
            width: '100%',
          }}
        >
          {VISIBLE_TYPES.map(type => {
            const isActive = activeType === type;
            return (
              <Button variant="default" size="sm" key={type} onClick={() => {
                  setActiveType(type);
                  setOpenMenu(false);
                  setShowMoreMenu(false);
                }}
                style={{
                  alignItems: 'center',
                  borderColor: '#00000000',
                  borderRadius: '8px',
                  borderStyle: 'solid',
                  borderWidth: '0.888889px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexShrink: 0,
                  gap: '6px',
                  height: 'calc(100% - 1px)',
                  justifyContent: 'center',
                  paddingBlock: '2px',
                  paddingInline: '10px',
                  position: 'relative',
                  background: 'transparent',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    boxSizing: 'border-box',
                    color: isActive ? '#16A34A' : '#0A0A0A99',
                    display: 'flex',
                    flexShrink: '0',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    lineHeight: '142.857%',
                    textAlign: 'center',
                    width: 'max-content',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {type}
                </div>
                {isActive && (
                  <div
                    style={{
                      backgroundColor: '#16A34A',
                      bottom: '-5px',
                      boxSizing: 'border-box',
                      height: '2px',
                      left: '0px',
                      position: 'absolute',
                      right: '0px',
                      width: '100%',
                    }}
                  />
                )}
              </Button>
            );
          })}

          <div style={{ position: 'relative' }}>
            <Button variant="default" size="sm" onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{
                alignItems: 'center',
                borderColor: '#00000000',
                borderRadius: '8px',
                borderStyle: 'solid',
                borderWidth: '0.888889px',
                boxSizing: 'border-box',
                display: 'flex',
                flexShrink: 0,
                gap: '6px',
                height: 'calc(100% - 1px)',
                justifyContent: 'center',
                paddingBlock: '2px',
                paddingInline: '10px',
                position: 'relative',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <div
                style={{
                  boxSizing: 'border-box',
                  color: MORE_TYPES.includes(activeType) ? '#16A34A' : '#0A0A0A99',
                  display: 'flex',
                  flexShrink: '0',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: MORE_TYPES.includes(activeType) ? 600 : 500,
                  lineHeight: '142.857%',
                  textAlign: 'center',
                  width: 'max-content',
                  transition: 'color 0.15s ease',
                }}
              >
                More
              </div>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform', showMoreMenu && 'rotate-180')}
                style={{ color: showMoreMenu || MORE_TYPES.includes(activeType) ? '#16A34A' : '#0A0A0A99' }}
              />
              {MORE_TYPES.includes(activeType) && (
                <div
                  style={{
                    backgroundColor: '#16A34A',
                    bottom: '-5px',
                    boxSizing: 'border-box',
                    height: '2px',
                    left: '0px',
                    position: 'absolute',
                    right: '0px',
                    width: '100%',
                  }}
                />
              )}
            </Button>

            {showMoreMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 shadow-md rounded-md p-1">
                {MORE_TYPES.map(type => (
                  <Button variant="default" size="sm" key={type} onClick={() => {
                      setActiveType(type);
                      setOpenMenu(false);
                      setShowMoreMenu(false);
                    }}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm transition-colors',
                      activeType === type
                        ? 'text-[#16A34A] font-semibold bg-[#F0FDF4]'
                        : 'text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    {type}
                    {activeType === type && <Check className="w-3.5 h-3.5 inline ml-1.5" />}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[13px] font-semibold text-[#374151]">
            Print Template
          </label>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366F1]" />}
        </div>

        <Button variant="default" size="sm" onClick={() => setOpenMenu(!openMenu)}
          className={cn(
            'h-[46px] w-full min-w-0 flex items-center justify-between !rounded-[10px] !border !border-[#DCE3ED] bg-white !px-4 !py-0 text-sm font-medium text-[#111827] transition-[border-color,box-shadow] outline-none hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]',
            openMenu && '!border-[#6366F1] shadow-[0_0_0_4px_rgba(99,102,241,0.10)]',
          )}
        >
          <span className={cn('truncate', !selectedTemplate && 'text-[#9CA3AF] font-normal')}>
            {selectedTemplate?.template_name || 'Select template'}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-[#6B7280] shrink-0 transition-transform', openMenu && 'rotate-180')} />
        </Button>

        {openMenu && (
          <div className="mt-1.5 border border-zinc-200 rounded-lg bg-white shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-4 text-center text-sm text-zinc-400">Loading templates...</div>
            ) : typeTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                No templates for {activeType}.{' '}
                <a
                  href="/settings/template"
                  className="text-sky-600 font-semibold hover:underline"
                >
                  Configure in Template Settings
                </a>
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto">
                {typeTemplates.map(t => (
                  <Button variant="default" size="sm" key={t.id} onClick={() => handleSelect(t.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                      t.id === selectedId
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    <span className="truncate">{t.template_name}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {t.is_default && (
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Default</span>
                      )}
                      {t.id === selectedId && <Check className="w-4 h-4 text-sky-500" />}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="mt-1.5 text-[11px] text-[#6B7280]">
          Sets the default print template used for {activeType}.
        </p>
      </div>

      {savedType && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Check className="w-4 h-4 shrink-0" />
          Default print template updated for {savedType}.
        </div>
      )}

      <a
        href="/settings/template"
        className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
      >
        <FileText className="w-3.5 h-3.5" />
        Manage templates in Settings
      </a>
    </Drawer>
  );
}
