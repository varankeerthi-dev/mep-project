import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileDown, Package, Truck } from 'lucide-react';

const DISPATCH_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXCykygVpep9eq-6szekLKpcW6G6na2oymO2DxWIyTiIyTQQds7-MAMgTg_xN8HDQDN853qpfqOeUW/pubhtml?widget=true&headers=false";
const DISPATCH_EDIT_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXCykygVpep9eq-6szekLKpcW6G6na2oymO2DxWIyTiIyTQQds7-MAMgTg_xN8HDQDN853qpfqOeUW/edit?usp=sharing";

const STATUS_COLOURS: Record<string, string> = {
  Active: '#16a34a',
  Archived: '#6b7280',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  quotation: 'Quotation',
  boq: 'BOQ',
};

const SOURCE_COLOURS: Record<string, string> = {
  manual: '#6366f1',
  quotation: '#0891b2',
  boq: '#d97706',
};

export default function ProcurementList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'lists' | 'dispatch'>('lists');

  // Fetch all procurement lists
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['procurement-lists', orgId, showArchived],
    queryFn: async () => {
      let q = supabase
        .from('procurement_lists')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (!showArchived) {
        q = q.eq('status', 'Active');
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Archive a list
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('procurement_lists')
        .update({ status: 'Archived', archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement-lists'] }),
  });

  // Restore archived list
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('procurement_lists')
        .update({ status: 'Active', archived_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement-lists'] }),
  });

  // Create manual list
  const handleCreateManual = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('procurement_lists')
        .insert({
          organisation_id: orgId,
          title: newTitle.trim(),
          source: 'manual',
          notes: newNotes.trim() || null,
          status: 'Active',
        })
        .select()
        .single();
      if (error) throw error;
      setShowNewModal(false);
      setNewTitle('');
      setNewNotes('');
      queryClient.invalidateQueries({ queryKey: ['procurement-lists'] });
      navigate(`/procurement/detail?id=${data.id}`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return lists;
    const s = search.toLowerCase();
    return lists.filter(
      (l) =>
        l.title?.toLowerCase().includes(s) ||
        l.client_name?.toLowerCase().includes(s) ||
        l.boq_no?.toLowerCase().includes(s) ||
        l.quotation_no?.toLowerCase().includes(s)
    );
  }, [lists, search]);

  const active = filtered.filter((l) => l.status === 'Active');
  const archived = filtered.filter((l) => l.status === 'Archived');

  // Export procurement lists to PDF
  const exportToPDF = useCallback(() => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 14;
    const orgName = organisation?.name || 'Organization';

    // Header
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text('PROCUREMENT LISTS', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(orgName, pageWidth / 2, 22, { align: 'center' });

    const exportData = filtered.map((list, index) => [
      index + 1,
      list.title || '',
      SOURCE_LABELS[list.source] || list.source || '',
      list.client_name || '—',
      list.boq_no || list.quotation_no || '—',
      list.created_at ? new Date(list.created_at).toLocaleDateString('en-IN') : '—',
      list.status || ''
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Title', 'Source', 'Client', 'Reference', 'Created', 'Status']],
      body: exportData,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [55, 65, 81],
        fontSize: 9,
        fontStyle: 'bold',
        lineColor: [203, 213, 225],
        lineWidth: 0.1
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [203, 213, 225],
        lineWidth: 0.1,
        textColor: [75, 85, 99]
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 45, halign: 'left' },
        4: { cellWidth: 35, halign: 'left' },
        5: { cellWidth: 30, halign: 'center' },
        6: { cellWidth: 25, halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable?.finalY || 50;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Total Lists: ${filtered.length} | Active: ${active.length} | Archived: ${archived.length}`, marginX, finalY + 10);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth - marginX, finalY + 10, { align: 'right' });

    doc.save(`procurement-lists-${new Date().toISOString().split('T')[0]}.pdf`);
  }, [filtered, active, archived, organisation]);

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>Procurement</h1>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
            Stock check & sourcing tracker
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeSubTab === 'lists' && filtered.length > 0 && (
            <button
              onClick={exportToPDF}
              style={{
                padding: '7px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FileDown size={14} /> Export PDF
            </button>
          )}
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              padding: '7px 14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: showArchived ? '#f3f4f6' : '#fff',
              fontSize: '12px',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          {activeSubTab === 'lists' && (
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                padding: '7px 16px',
                border: 'none',
                borderRadius: '6px',
                background: '#1d4ed8',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New Manual List
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveSubTab('lists')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeSubTab === 'lists' ? '2px solid #1d4ed8' : '2px solid transparent',
            background: 'transparent',
            color: activeSubTab === 'lists' ? '#1d4ed8' : '#6b7280',
            fontSize: '14px',
            fontWeight: activeSubTab === 'lists' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          <Package size={18} />
          Lists
        </button>
        <button
          onClick={() => setActiveSubTab('dispatch')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeSubTab === 'dispatch' ? '2px solid #1d4ed8' : '2px solid transparent',
            background: 'transparent',
            color: activeSubTab === 'dispatch' ? '#1d4ed8' : '#6b7280',
            fontSize: '14px',
            fontWeight: activeSubTab === 'dispatch' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          <Truck size={18} />
          Dispatch
        </button>
      </div>

      {/* Content */}
      {activeSubTab === 'dispatch' ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
            <a
              href={DISPATCH_EDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '6px 12px', background: '#1d4ed8', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}
            >
              Open in Google Sheets
            </a>
          </div>
          <iframe
            src={DISPATCH_SHEET_URL}
            style={{ flex: 1, border: 'none' }}
            title="Dispatch Dispatch"
          />
        </div>
      ) : (
        <>
          {/* Search */}
          <input
            type="text"
            placeholder="Search by title, client, BOQ no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '20px',
              outline: 'none',
            }}
          />

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
              <div style={{ fontSize: '14px' }}>No procurement lists yet.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Create a manual list or launch Stock Check from a BOQ or Quotation.
              </div>
            </div>
          ) : (
            <>
              {/* Active Lists */}
              {active.length > 0 && (
                <ListTable
                  lists={active}
                  onOpen={(id) => navigate(`/procurement/detail?id=${id}`)}
                  onArchive={(id) => {
                    if (confirm('Archive this procurement list?')) archiveMutation.mutate(id);
                  }}
                  showRestore={false}
                />
              )}

              {/* Archived Lists */}
              {showArchived && archived.length > 0 && (
                <>
                  <div style={{ margin: '28px 0 12px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Archived
                  </div>
                  <ListTable
                    lists={archived}
                    onOpen={(id) => navigate(`/procurement/detail?id=${id}`)}
                    onRestore={(id) => restoreMutation.mutate(id)}
                    showRestore
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* New Manual List Modal */}
      {showNewModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '10px', padding: '28px', width: '400px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700 }}>New Manual Procurement List</h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                Title *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Client A Site - April Order"
                autoFocus
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateManual(); }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Any notes..."
                rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', resize: 'vertical', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowNewModal(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleCreateManual}
                disabled={creating || !newTitle.trim()}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#1d4ed8', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: creating || !newTitle.trim() ? 0.5 : 1 }}
              >
                {creating ? 'Creating...' : 'Create & Open'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── List Table Component ──────────────────────────────────────────────────────
function ListTable({ lists, onOpen, onArchive, onRestore, showRestore }: {
  lists: any[];
  onOpen: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  showRestore: boolean;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Client</th>
            <th style={thStyle}>Reference</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list, idx) => (
            <tr
              key={list.id}
              style={{ borderBottom: idx < lists.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <td style={tdStyle} onClick={() => onOpen(list.id)}>
                <span style={{ fontWeight: 600, color: '#111827' }}>{list.title}</span>
                {list.notes && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{list.notes}</div>}
              </td>
              <td style={tdStyle} onClick={() => onOpen(list.id)}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: `${SOURCE_COLOURS[list.source]}18`,
                  color: SOURCE_COLOURS[list.source],
                }}>
                  {SOURCE_LABELS[list.source] || list.source}
                </span>
              </td>
              <td style={tdStyle} onClick={() => onOpen(list.id)}>{list.client_name || '—'}</td>
              <td style={tdStyle} onClick={() => onOpen(list.id)}>
                {list.boq_no || list.quotation_no || '—'}
              </td>
              <td style={tdStyle} onClick={() => onOpen(list.id)}>
                {list.created_at ? new Date(list.created_at).toLocaleDateString('en-IN') : '—'}
              </td>
              <td style={tdStyle} onClick={() => onOpen(list.id)}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: list.status === 'Active' ? '#dcfce7' : '#f3f4f6',
                  color: list.status === 'Active' ? '#16a34a' : '#6b7280',
                }}>
                  {list.status}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => onOpen(list.id)}
                    style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: '5px', background: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Open
                  </button>
                  {!showRestore && onArchive && (
                    <button
                      onClick={() => onArchive(list.id)}
                      style={{ padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: '5px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}
                    >
                      Archive
                    </button>
                  )}
                  {showRestore && onRestore && (
                    <button
                      onClick={() => onRestore(list.id)}
                      style={{ padding: '4px 10px', border: '1px solid #86efac', borderRadius: '5px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#16a34a' }}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
  color: '#374151',
};
