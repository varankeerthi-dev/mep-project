import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBOQList, deleteBOQ } from '../api';
import { AppTable } from '../components/ui/AppTable';

export default function BOQList() {
  const navigate = useNavigate();
  const [boqs, setBoqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchBOQList();
        if (active) setBoqs(data || []);
      } catch (error) {
        console.error('Error loading BOQ list:', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this BOQ? This cannot be undone.');
    if (!ok) return;
    try {
      await deleteBOQ(id);
      setBoqs(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Delete BOQ failed:', err);
      alert('Failed to delete BOQ: ' + (err as Error)?.message);
    }
  };

  const tableColumns = useMemo(() => [
    {
      header: 'BOQ No',
      accessorKey: 'boq_no',
      cell: (info) => <span style={{ fontWeight: 600 }}>{info.getValue() || '-'}</span>,
      size: 140
    },
    {
      header: 'Revision No',
      accessorKey: 'revision_no',
      size: 120
    },
    {
      header: 'Date',
      accessorKey: 'boq_date',
      size: 120
    },
    {
      header: 'Client',
      accessorKey: 'client.client_name'
    },
    {
      header: 'Project',
      accessorKey: 'project.project_name'
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info) => (
        <span className={`badge ${info.getValue() === 'Approved' ? 'badge-success' : 'badge-neutral'}`}>
          {info.getValue() || 'Draft'}
        </span>
      ),
      size: 120
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => navigate(`/boq/create?editId=${row.original.id}`)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => handleDelete(row.original.id)}>
            Delete
          </button>
        </div>
      ),
      size: 120
    }
  ], [navigate, handleDelete]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>BOQ</h1>
          <div className="page-subtitle">All BOQ list with BOQ No & Revision No</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/boq/create')}>
          Create BOQ
        </button>
      </div>

      <div className="card" style={{ padding: '12px' }}>
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <AppTable
            data={boqs}
            columns={tableColumns}
            enableSorting={true}
            enablePagination={true}
            emptyMessage="No BOQs found"
          />
        )}
      </div>
    </div>
  );
}
