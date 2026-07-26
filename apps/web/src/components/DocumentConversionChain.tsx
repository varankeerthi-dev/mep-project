import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { ArrowRight, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type DocType = 'quotation' | 'proforma' | 'invoice' | 'credit_note' | 'delivery_challan';

interface ChainLink {
  id: string;
  docType: DocType;
  number: string;
  label: string;
}

const docConfig: Record<DocType, { label: string; route: (id: string) => string; color: string }> = {
  quotation: {
    label: 'Quotation',
    route: (id) => `/quotation/view?id=${id}`,
    color: '#6366f1',
  },
  proforma: {
    label: 'Proforma',
    route: (id) => `/proforma-invoices/edit?id=${id}`,
    color: '#3b82f6',
  },
  invoice: {
    label: 'Invoice',
    route: (id) => `/invoices/view?id=${id}`,
    color: '#10b981',
  },
  credit_note: {
    label: 'Credit Note',
    route: (id) => `/credit-notes/view?id=${id}`,
    color: '#f59e0b',
  },
  delivery_challan: {
    label: 'Delivery Challan',
    route: (id) => `/dc/view/${id}`,
    color: '#8b5cf6',
  },
};

// Map source_type values from DB to our DocType
// Only include source types that point to a document we can look up
const sourceTypeMap: Record<string, DocType> = {
  quotation: 'quotation',
  challan: 'delivery_challan',
};

async function fetchChain(
  currentDocType: DocType,
  currentId: string,
): Promise<ChainLink[]> {
  // ── Factory: create a fetchDocInfo with its own visited set ──
  function createFetchDocInfo() {
    const visited = new Set<string>();
    return async function fetchDocInfo(type: DocType, id: string): Promise<{ number: string; sourceId?: string; sourceType?: string; convertedToId?: string } | null> {
      if (visited.has(`${type}:${id}`)) return null;
      visited.add(`${type}:${id}`);

      switch (type) {
        case 'quotation': {
          const { data } = await supabase
            .from('quotation_header')
            .select('quotation_no, source_id, source_type')
            .eq('id', id)
            .single();
          if (!data) return null;
          return { number: data.quotation_no, sourceId: data.source_id, sourceType: data.source_type };
        }
        case 'proforma': {
          const { data } = await supabase
            .from('proforma_invoices')
            .select('pi_number, source_id, source_type, converted_invoice_id')
            .eq('id', id)
            .single();
          if (!data) return null;
          return { number: data.pi_number || id.slice(0, 8), sourceId: data.source_id, sourceType: data.source_type, convertedToId: data.converted_invoice_id };
        }
        case 'invoice': {
          const { data } = await supabase
            .from('invoices')
            .select('invoice_no, source_id, source_type, converted_to_id, converted_to_type')
            .eq('id', id)
            .single();
          if (!data) return null;
          return { number: data.invoice_no || id.slice(0, 8), sourceId: data.source_id, sourceType: data.source_type, convertedToId: data.converted_to_id };
        }
        default:
          return null;
      }
    };
  }

  // ── Step 1: Walk backward (find source/parent) ──
  // NOTE: The first iteration starts at the current document but we skip adding it
  // because fetchChain adds it separately as currentLink. Only ancestors are added.
  async function walkBackward(type: DocType, id: string): Promise<ChainLink[]> {
    const fetchDocInfo = createFetchDocInfo();
    const ancestors: ChainLink[] = [];
    let current = { type, id };
    let isFirst = true;

    while (current.id) {
      const info = await fetchDocInfo(current.type, current.id);
      if (!info) break;

      // Skip the current document (first iteration) — fetchChain adds it as currentLink
      if (!isFirst) {
        ancestors.unshift({
          id: current.id,
          docType: current.type,
          number: info.number,
          label: `${docConfig[current.type].label} ${info.number}`,
        });
      }
      isFirst = false;

      // Check if it has a source (backward link)
      if (info.sourceId && info.sourceType && sourceTypeMap[info.sourceType]) {
        current = {
          type: sourceTypeMap[info.sourceType],
          id: info.sourceId,
        };
      } else {
        break;
      }
    }
    return ancestors;
  }

  // ── Step 2: Walk forward (find converted_to) ──
  async function walkForward(type: DocType, id: string): Promise<ChainLink[]> {
    const fetchDocInfo = createFetchDocInfo();
    const descendants: ChainLink[] = [];
    let current = { type, id };

    while (current.id) {
      const info = await fetchDocInfo(current.type, current.id);
      if (!info || !info.convertedToId) break;

      // Determine the next doc type
      let nextType: DocType | null = null;
      if (type === 'proforma') nextType = 'invoice';
      else if (type === 'invoice') nextType = 'credit_note';
      else break;

      if (!nextType) break;

      const nextInfo = await fetchDocInfo(nextType, info.convertedToId);
      if (!nextInfo) break;

      descendants.push({
        id: info.convertedToId,
        docType: nextType,
        number: nextInfo.number,
        label: `${docConfig[nextType].label} ${nextInfo.number}`,
      });

      current = { type: nextType, id: info.convertedToId };
    }
    return descendants;
  }

  // ── Build full chain ──
  const ancestors = await walkBackward(currentDocType, currentId);
  const fetchDocInfoForCurrent = createFetchDocInfo();
  const currentInfo = await fetchDocInfoForCurrent(currentDocType, currentId);
  const currentLink: ChainLink = {
    id: currentId,
    docType: currentDocType,
    number: currentInfo?.number || currentId.slice(0, 8),
    label: currentInfo?.number ? `${docConfig[currentDocType].label} ${currentInfo.number}` : `${docConfig[currentDocType].label}`,
  };
  const descendants = await walkForward(currentDocType, currentId);

  return [...ancestors, currentLink, ...descendants];
}

interface DocumentConversionChainProps {
  documentType: DocType;
  documentId: string;
}

export function DocumentConversionChain({ documentType, documentId }: DocumentConversionChainProps) {
  const navigate = useNavigate();

  const { data: chain, isLoading } = useQuery({
    queryKey: ['conversion-chain', documentType, documentId],
    queryFn: () => fetchChain(documentType, documentId),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', fontSize: '11px', color: '#94a3b8' }}>
        <Loader2 size={11} className="animate-spin" />
        Loading conversion chain...
      </div>
    );
  }

  if (!chain || chain.length <= 1) {
    return null; // No chain to show
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '11px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 600, color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Chain
      </span>
      {chain.map((link, idx) => (
        <span key={`${link.docType}-${link.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {idx > 0 && <ArrowRight size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />}
          <button
            type="button"
            onClick={() => navigate(docConfig[link.docType].route(link.id))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              border: 'none',
              borderRadius: '4px',
              background: idx === chain.length - 1 || (idx === 1 && chain.length === 2)
                ? `${docConfig[link.docType].color}15`
                : '#f1f5f9',
              color: idx === chain.length - 1 || (idx === 1 && chain.length === 2)
                ? docConfig[link.docType].color
                : '#475569',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '11px',
              transition: 'all 0.15s',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${docConfig[link.docType].color}25`; }}
            onMouseLeave={(e) => {
              const isActive = idx === chain.length - 1 || (idx === 1 && chain.length === 2);
              e.currentTarget.style.background = isActive ? `${docConfig[link.docType].color}15` : '#f1f5f9';
            }}
          >
            <FileText size={10} />
            {link.label}
          </button>
        </span>
      ))}
    </div>
  );
}
