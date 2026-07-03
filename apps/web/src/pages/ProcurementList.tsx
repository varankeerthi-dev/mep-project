import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FileDown, 
  Package, 
  Truck, 
  Search, 
  Plus, 
  Filter, 
  Archive, 
  RefreshCcw, 
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Calendar,
  User,
  Hash,
  Info
} from 'lucide-react';
import { AppTable, type AppTableColumn } from '../components/ui/AppTable';
import { Modal } from '../components/ui/Modal';
import { cn } from '../lib/utils';

const DISPATCH_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXCykygVpep9eq-6szekLKpcW6G6na2oymO2DxWIyTiIyTQQds7-MAMgTg_xN8HDQDN853qpfqOeUW/pubhtml?widget=true&headers=false";
const DISPATCH_EDIT_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXCykygVpep9eq-6szekLKpcW6G6na2oymO2DxWIyTiIyTQQds7-MAMgTg_xN8HDQDN853qpfqOeUW/edit?usp=sharing";

const SOURCE_CONFIG: Record<string, { label: string, color: string, bg: string }> = {
  manual:    { label: 'Manual',    color: '#6366f1', bg: '#eef2ff' },
  quotation: { label: 'Quoted',    color: '#0891b2', bg: '#ecfeff' },
  boq:       { label: 'BOQ Ref',   color: '#d97706', bg: '#fffbeb' },
};

const inputClass = "w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] text-zinc-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-zinc-400";

type ProcurementListType = {
  id: string;
  title: string;
  source: string;
  client_name: string | null;
  boq_no: string | null;
  quotation_no: string | null;
  created_at: string;
  status: string;
  notes: string | null;
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
  const { data: lists = [], isLoading, isFetching, refetch } = useQuery({
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
      return (data || []) as ProcurementListType[];
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-lists'] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-lists'] });
    },
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

    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text('PROCUREMENT LISTS', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(orgName, pageWidth / 2, 22, { align: 'center' });

    const exportData = filtered.map((list, index) => [
      index + 1,
      list.title || '',
      SOURCE_CONFIG[list.source]?.label || list.source || '',
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

    const finalY = (doc as any).lastAutoTable?.finalY || 50;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Total Lists: ${filtered.length}`, marginX, finalY + 10);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth - marginX, finalY + 10, { align: 'right' });

    doc.save(`procurement-lists-${new Date().toISOString().split('T')[0]}.pdf`);
  }, [filtered, organisation]);

  const columns = useMemo<AppTableColumn<ProcurementListType>[]>(() => [
    {
      header: 'Title',
      accessorKey: 'title',
      size: 300,
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5" onClick={() => navigate(`/procurement/detail?id=${row.original.id}`)}>
          <span className="font-semibold text-zinc-900 leading-tight">{row.original.title}</span>
          {row.original.notes && (
            <span className="text-[11px] text-zinc-400 line-clamp-1">{row.original.notes}</span>
          )}
        </div>
      )
    },
    {
      header: 'Source',
      accessorKey: 'source',
      size: 100,
      cell: ({ getValue }) => {
        const val = getValue() as string;
        const config = SOURCE_CONFIG[val] || { label: val, color: '#64748b', bg: '#f1f5f9' };
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: config.bg, color: config.color }}>
            {config.label}
          </span>
        );
      }
    },
    {
      header: 'Client',
      accessorKey: 'client_name',
      size: 200,
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1.5 text-zinc-600">
          <User size={13} className="text-zinc-400" />
          <span>{getValue() || '—'}</span>
        </div>
      )
    },
    {
      header: 'Reference',
      accessorKey: 'boq_no',
      size: 150,
      cell: ({ row }) => {
        const ref = row.original.boq_no || row.original.quotation_no;
        return (
          <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
            <Hash size={13} className="text-zinc-400" />
            <span>{ref || '—'}</span>
          </div>
        );
      }
    },
    {
      header: 'Created',
      accessorKey: 'created_at',
      size: 120,
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Calendar size={13} className="text-zinc-400" />
          <span>{getValue() ? new Date(getValue() as string).toLocaleDateString('en-IN') : '—'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      size: 100,
      cell: ({ getValue }) => (
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
          getValue() === 'Active' 
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
            : "bg-zinc-50 text-zinc-500 border border-zinc-100"
        )}>
          {getValue() as string}
        </span>
      )
    }
  ], [navigate]);

  return (
    <div className="min-h-screen bg-[#fcfcfd] p-6 lg:p-10">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Procurement</h1>
          <p className="mt-2 text-zinc-500 max-w-2xl font-medium">
            Manage your sourcing workflows, track warehouse status, and handle dispatch logistics in one unified dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => refetch()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-95"
            title="Refresh"
          >
            <RefreshCcw size={18} className={cn(isFetching && "animate-spin")} />
          </button>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold shadow-sm transition-all active:scale-95",
              showArchived 
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" 
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <Archive size={16} />
            {showArchived ? 'Active Mode' : 'View Archived'}
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-6 text-[13px] font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/30 active:scale-95"
          >
            <Plus size={18} />
            New List
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-2 border-b border-zinc-200 animate-in fade-in duration-700 delay-100">
        <button
          onClick={() => setActiveSubTab('lists')}
          className={cn(
            "relative flex items-center gap-2.5 px-6 py-4 text-sm font-bold transition-all",
            activeSubTab === 'lists' 
              ? "text-blue-600" 
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Package size={18} />
          <span>Sourcing Lists</span>
          {activeSubTab === 'lists' && (
            <div className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-blue-600 animate-in fade-in slide-in-from-bottom-1 duration-300" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('dispatch')}
          className={cn(
            "relative flex items-center gap-2.5 px-6 py-4 text-sm font-bold transition-all",
            activeSubTab === 'dispatch' 
              ? "text-blue-600" 
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Truck size={18} />
          <span>Dispatch Logistics</span>
          {activeSubTab === 'dispatch' && (
            <div className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-blue-600 animate-in fade-in slide-in-from-bottom-1 duration-300" />
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        {activeSubTab === 'dispatch' ? (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
              <div className="flex items-center gap-3 font-semibold text-zinc-900">
                <ExternalLink size={18} className="text-blue-500" />
                <span>Google Sheets Integration</span>
              </div>
              <a
                href={DISPATCH_EDIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-95"
              >
                Edit in Browser
              </a>
            </div>
            <div className="h-[700px] w-full bg-zinc-50">
              <iframe
                src={DISPATCH_SHEET_URL}
                className="h-full w-full"
                title="Dispatch Logistics Tracker"
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by title, client, or reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(inputClass, "pl-11 h-11 text-sm")}
                />
              </div>

              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button
                    onClick={exportToPDF}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 active:scale-95"
                  >
                    <FileDown size={16} className="text-emerald-500" />
                    Export PDF
                  </button>
                )}
              </div>
            </div>

            <AppTable
              data={filtered}
              columns={columns}
              loading={isLoading}
              className="rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-200/40"
              emptyMessage={search ? "No matches found for your search." : "No procurement lists available."}
              enableActions={true}
              actions={[
                {
                  label: 'Open Details',
                  onClick: (row) => navigate(`/procurement/detail?id=${row.id}`),
                },
                {
                  label: showArchived ? 'Restore List' : 'Archive List',
                  variant: showArchived ? 'default' : 'danger',
                  onClick: (row) => {
                    if (showArchived) {
                      restoreMutation.mutate(row.id);
                    } else {
                      if (confirm('Are you sure you want to archive this list?')) {
                        archiveMutation.mutate(row.id);
                      }
                    }
                  }
                }
              ]}
            />
          </div>
        )}
      </div>

      {/* New Manual List Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Create Sourcing List"
        size="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 text-[13px] font-semibold text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateManual}
              disabled={creating || !newTitle.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {creating ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Open'
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-6 py-4">
          <div className="flex items-start gap-3 rounded-2xl bg-blue-50/50 p-4 border border-blue-100">
            <Info size={20} className="mt-0.5 text-blue-500" />
            <div className="text-[13px] text-blue-700 leading-relaxed font-medium">
              Manual lists are perfect for one-off sourcing requirements for items not explicitly linked to a BOQ or Quotation.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-700 uppercase tracking-wider">List Title *</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Site Emergency Sourcing - Block A"
              autoFocus
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-zinc-700 uppercase tracking-wider">Internal Notes</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Describe the purpose of this procurement list..."
              rows={4}
              className={cn(inputClass, "resize-none h-32 py-3")}
            />
            <p className="text-[11px] text-zinc-400">Notes will be displayed in the dashboard and exported documents.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
