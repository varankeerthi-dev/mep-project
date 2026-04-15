import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { fetchDeliveryChallans, deleteDeliveryChallan } from '../api';
import { format } from 'date-fns';
import { exportDCToPDF } from '../utils/pdfExport';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useProjects } from '../hooks/useProjects';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

export default function NonBillableDCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(() => ({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'all',
    dc_type: 'non-billable',
    organisation_id: organisation?.id
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'all',
    dc_type: 'non-billable',
    organisation_id: organisation?.id
  }));

  useEffect(() => {
    if (organisation?.id) {
      setFilters(prev => ({ ...prev, organisation_id: organisation.id }));
      setAppliedFilters(prev => ({ ...prev, organisation_id: organisation.id }));
    }
  }, [organisation]);

  const challansQuery = useQuery({
    queryKey: ['deliveryChallans', appliedFilters.projectId, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.status, appliedFilters.dc_type, appliedFilters.organisation_id],
    queryFn: () => fetchDeliveryChallans(appliedFilters),
    placeholderData: keepPreviousData
  });

  const projectsQuery = useProjects();

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryChallan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryChallans'] });
    }
  });

  const challans = challansQuery.data || [];
  const projects = projectsQuery.data || [];
  const loading = challansQuery.isLoading || projectsQuery.isLoading;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const handleDelete = async (id, dcNumber) => {
    if (confirm(`Are you sure you want to delete Non-Billable DC ${dcNumber}?`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting NB-DC:', error);
        alert('Error deleting Non-Billable Delivery Challan');
      }
    }
  };

  const handleExport = (challan) => {
    exportDCToPDF(challan);
  };

  const calculateTotal = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const columns = useMemo(() => [
    {
      header: 'NB-DC No',
      accessorKey: 'dc_number',
      cell: (info) => <span className="table-number">{info.getValue()}</span>
    },
    {
      header: 'Date',
      accessorKey: 'dc_date',
      cell: (info) => info.getValue() ? format(new Date(info.getValue()), 'dd/MM/yyyy') : '-'
    },
    {
      header: 'Project',
      accessorKey: 'project',
      cell: (info) => info.getValue()?.project_name || info.getValue()?.name || '-'
    },
    {
      header: 'Client',
      accessorKey: 'client_name',
      cell: (info) => info.getValue() || '-'
    },
    {
      header: 'Items',
      accessorKey: 'items',
      cell: (info) => <span className="table-number">{info.getValue()?.length || 0}</span>
    },
    {
      header: 'Total Amount',
      accessorKey: 'items_total',
      cell: ({ row }) => (
        <span className="table-number">
          ₹{calculateTotal(row.original.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info) => (
        <span className={`badge ${info.getValue() === 'active' ? 'badge-success' : 'badge-neutral'}`}>
          {info.getValue()}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const challan = row.original;
        return (
          <div className="actions">
            <button 
              className="action-btn" 
              title="View PDF"
              onClick={() => handleExport(challan)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </button>
            <button 
              className="action-btn" 
              title="Edit"
              onClick={() => navigate(`/nb-dc/edit/${challan.id}`)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button 
              className="action-btn danger" 
              title="Delete"
              onClick={() => handleDelete(challan.id, challan.dc_number)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        );
      }
    }
  ], [navigate, handleDelete, handleExport]);

  const table = useReactTable({
    data: challans,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Non-Billable Delivery Challan List</h1>
          <p className="page-subtitle">View and manage all non-billable delivery challans</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">Project</label>
          <select 
            name="projectId" 
            className="filter-input"
            value={filters.projectId}
            onChange={handleFilterChange}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label className="filter-label">From Date</label>
          <input 
            type="date" 
            name="startDate"
            className="filter-input"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="filter-group">
          <label className="filter-label">To Date</label>
          <input 
            type="date" 
            name="endDate"
            className="filter-input"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
        
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select 
            name="status"
            className="filter-input"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : challans.length === 0 ? (
          <div className="empty-state">
            <h3>No Non-Billable Delivery Challans Found</h3>
            <p>Create your first non-billable delivery challan to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
