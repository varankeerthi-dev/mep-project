import { useState, useEffect } from 'react';
import { getConsolidationDateWise, fetchProjects } from '../api';
import { format } from 'date-fns';
import { exportDateWiseConsolidationPDF } from '../utils/pdfExport';

export default function DateWiseConsolidation() {
  const [loading, setLoading] = useState(true);
  const [consolidatedData, setConsolidatedData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: '',
    dc_type: 'billable'
  });
  const [summary, setSummary] = useState({ totalDCs: 0, totalAmount: 0, totalItems: 0 });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getConsolidationDateWise(filters);
      
      const grouped = {};
      data.forEach(dc => {
        const dateKey = dc.dc_date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            dcs: [],
            totalAmount: 0,
            totalItems: 0
          };
        }
        grouped[dateKey].dcs.push(dc);
        grouped[dateKey].totalAmount += dc.items?.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) || 0;
        grouped[dateKey].totalItems += dc.items?.length || 0;
      });

      const sortedData = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
      setConsolidatedData(sortedData);

      const totalDCs = data.length;
      const totalAmount = data.reduce((sum, dc) => 
        sum + (dc.items?.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0) || 0), 0);
      const totalItems = data.reduce((sum, dc) => sum + (dc.items?.length || 0), 0);
      
      setSummary({ totalDCs, totalAmount, totalItems });
    } catch (error) {
      console.error('Error loading consolidation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      loadData();
    }
  }, [filters, projects]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleExport = () => {
    exportDateWiseConsolidationPDF(consolidatedData, filters);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Date-wise Consolidation</h1>
          <p className="page-subtitle">View delivery challans grouped by date</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export PDF
        </button>
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
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : consolidatedData.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No Data Found</h3>
            <p>No delivery challans found for the selected filters.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <div className="filter-label">Total DCs</div>
                <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.totalDCs}</div>
              </div>
              <div>
                <div className="filter-label">Total Items</div>
                <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.totalItems}</div>
              </div>
              <div>
                <div className="filter-label">Total Amount</div>
                <div style={{ fontSize: '24px', fontWeight: '600' }}>₹{summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {consolidatedData.map(group => (
            <div key={group.date} className="date-wise-group">
              <div className="date-wise-header">
                <span className="date">{format(new Date(group.date), 'dd MMMM yyyy')}</span>
                <span className="dc-info">
                  {group.dcs.length} DC(s) • {group.totalItems} Items • ₹{group.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="card">
                {group.dcs.map(dc => (
                  <div key={dc.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <strong>{dc.dc_number}</strong>
                      <span>{dc.client_name || '-'}</span>
                    </div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Material</th>
                          <th>Unit</th>
                          <th>Size</th>
                          <th>Qty</th>
                          <th>Rate/Unit</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dc.items?.map((item, idx) => (
                          <tr key={item.id}>
                            <td className="table-number">{idx + 1}</td>
                            <td>{item.material_name}</td>
                            <td>{item.unit}</td>
                            <td>{item.size || '-'}</td>
                            <td className="table-number">{item.quantity}</td>
                            <td className="table-number">₹{item.rate ? parseFloat(item.rate).toFixed(2) : '-'}</td>
                            <td className="table-number">₹{item.amount ? parseFloat(item.amount).toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}


