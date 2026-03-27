import { useState, useEffect } from 'react';
import { getConsolidationMaterialWise, fetchProjects } from '../api';
import { format } from 'date-fns';
import { exportMaterialWiseConsolidationPDF } from '../utils/pdfExport';

export default function MaterialWiseConsolidation() {
  const [loading, setLoading] = useState(true);
  const [consolidatedData, setConsolidatedData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: ''
  });
  const [summary, setSummary] = useState({ uniqueMaterials: 0, totalQuantity: 0, totalAmount: 0 });

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
      const data = await getConsolidationMaterialWise(filters);
      
      const grouped = {};
      const dcMap = {};
      
      data.forEach(item => {
        const key = `${item.material_name}-${item.size || ''}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            materialName: item.material_name,
            unit: item.unit,
            size: item.size,
            dcItems: [],
            totalQuantity: 0,
            totalAmount: 0
          };
        }
        
        const dcKey = `${item.delivery_challan?.dc_number}-${item.delivery_challan?.dc_date}`;
        if (!dcMap[dcKey]) {
          dcMap[dcKey] = { dcNumber: item.delivery_challan?.dc_number, dcDate: item.delivery_challan?.dc_date, qty: 0 };
        }
        
        grouped[key].dcItems.push({
          dcNumber: item.delivery_challan?.dc_number,
          dcDate: item.delivery_challan?.dc_date,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount
        });
        
        grouped[key].totalQuantity += parseFloat(item.quantity) || 0;
        grouped[key].totalAmount += parseFloat(item.amount) || 0;
      });

      const dcColumns = [...new Set(data.map(item => `${item.delivery_challan?.dc_number}|${item.delivery_challan?.dc_date}`))]
        .sort((a, b) => {
          const dateA = new Date(a.split('|')[1]);
          const dateB = new Date(b.split('|')[1]);
          return dateA - dateB;
        });

      const sortedData = Object.values(grouped).sort((a, b) => a.materialName.localeCompare(b.materialName));
      setConsolidatedData(sortedData);
      setDcColumns(dcColumns);

      const uniqueMaterials = sortedData.length;
      const totalQuantity = sortedData.reduce((sum, item) => sum + item.totalQuantity, 0);
      const totalAmount = sortedData.reduce((sum, item) => sum + item.totalAmount, 0);
      
      setSummary({ uniqueMaterials, totalQuantity, totalAmount });
    } catch (error) {
      console.error('Error loading consolidation:', error);
    } finally {
      setLoading(false);
    }
  };

  const [dcColumns, setDcColumns] = useState([]);

  useEffect(() => {
    if (projects.length > 0) {
      loadData();
    }
  }, [filters, projects]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getQtyForDC = (dcItems, dcNumber) => {
    const item = dcItems.find(i => i.dcNumber === dcNumber);
    return item ? item.quantity : '-';
  };

  const handleExport = () => {
    exportMaterialWiseConsolidationPDF(consolidatedData, dcColumns, filters);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Material-wise Consolidation</h1>
          <p className="page-subtitle">View delivery challans grouped by material</p>
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
                <div className="filter-label">Unique Materials</div>
                <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.uniqueMaterials}</div>
              </div>
              <div>
                <div className="filter-label">Total Quantity</div>
                <div style={{ fontSize: '24px', fontWeight: '600' }}>{summary.totalQuantity.toFixed(2)}</div>
              </div>
              <div>
                <div className="filter-label">Total Amount</div>
                <div style={{ fontSize: '24px', fontWeight: '600' }}>₹{summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="table material-wise-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>S.No</th>
                    <th>Material</th>
                    <th>Size</th>
                    {dcColumns.slice(0, 6).map(dc => {
                      const [dcNumber, dcDate] = dc.split('|');
                      return (
                        <th key={dc} style={{ minWidth: '100px', textAlign: 'center' }}>
                          <div style={{ fontSize: '10px' }}>{dcNumber}</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                            {dcDate ? format(new Date(dcDate), 'dd/MM') : ''}
                          </div>
                        </th>
                      );
                    })}
                    {dcColumns.length > 6 && <th style={{ minWidth: '50px' }}>...</th>}
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate/Unit</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedData.map((item, idx) => (
                    <tr key={idx}>
                      <td className="table-number">{idx + 1}</td>
                      <td>{item.materialName}</td>
                      <td>{item.size || '-'}</td>
                      {dcColumns.slice(0, 6).map(dc => {
                        const [dcNumber] = dc.split('|');
                        return (
                          <td key={dc} className="table-number" style={{ textAlign: 'center' }}>
                            {getQtyForDC(item.dcItems, dcNumber)}
                          </td>
                        );
                      })}
                      {dcColumns.length > 6 && <td className="table-number">...</td>}
                      <td className="table-number" style={{ textAlign: 'right', fontWeight: '600' }}>
                        {item.totalQuantity.toFixed(2)} {item.unit}
                      </td>
                      <td className="table-number" style={{ textAlign: 'right' }}>
                        ₹{item.dcItems[0]?.rate ? parseFloat(item.dcItems[0].rate).toFixed(2) : '-'}
                      </td>
                      <td className="table-number" style={{ textAlign: 'right', fontWeight: '600' }}>
                        ₹{item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


