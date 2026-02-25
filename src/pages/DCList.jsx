import { useState, useEffect } from 'react';
import { fetchDeliveryChallans, deleteDeliveryChallan, fetchProjects } from '../api';
import { format } from 'date-fns';
import { exportDCToPDF } from '../utils/pdfExport';

export default function DCList() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'active'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [challansData, projectsData] = await Promise.all([
        fetchDeliveryChallans(filters),
        fetchProjects()
      ]);
      setChallans(challansData || []);
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Error loading DC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    loadData();
  };

  const handleDelete = async (id, dcNumber) => {
    if (confirm(`Are you sure you want to delete DC ${dcNumber}?`)) {
      try {
        await deleteDeliveryChallan(id);
        loadData();
      } catch (error) {
        console.error('Error deleting DC:', error);
        alert('Error deleting Delivery Challan');
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Challan List</h1>
          <p className="page-subtitle">View and manage all delivery challans</p>
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
            <h3>No Delivery Challans Found</h3>
            <p>Create your first delivery challan to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>DC No</th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challans.map(challan => (
                  <tr key={challan.id}>
                    <td className="table-number">{challan.dc_number}</td>
                    <td>{challan.dc_date ? format(new Date(challan.dc_date), 'dd/MM/yyyy') : '-'}</td>
                    <td>{challan.project?.name || '-'}</td>
                    <td>{challan.client_name || '-'}</td>
                    <td className="table-number">{challan.items?.length || 0}</td>
                    <td className="table-number">₹{calculateTotal(challan.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${challan.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {challan.status}
                      </span>
                    </td>
                    <td>
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
                    </td>
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
