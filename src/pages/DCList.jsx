import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { fetchDeliveryChallans, deleteDeliveryChallan, fetchProjects, fetchQuotationById, fetchDeliveryChallanById } from '../api';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { exportDCToPDF } from '../utils/pdfExport';

export default function DCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showConvertMenu, setShowConvertMenu] = useState({});
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'all',
    organisation_id: organisation?.id
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (organisation?.id) {
      setFilters(prev => ({ ...prev, organisation_id: organisation.id }));
    }
  }, [organisation]);

  useEffect(() => {
    loadData();
  }, [filters.organisation_id]);

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

  const handleExport = async (challan) => {
    await exportDCToPDF(challan);
  };

  const handleConvertToQuotation = async (challan) => {
    try {
      const { data: existing } = await supabase
        .from('quotation_header')
        .select('quotation_no')
        .order('created_at', { ascending: false })
        .limit(1);
      
      let quotationNo = 'QT-0001';
      if (existing && existing.length > 0) {
        const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
        quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
      }

      const { data: dcWithItems } = await supabase
        .from('delivery_challans')
        .select('*, items:delivery_challan_items(*)')
        .eq('id', challan.id)
        .single();

      const quotationData = {
        quotation_no: quotationNo,
        client_id: dcWithItems.client_id,
        project_id: dcWithItems.project_id,
        billing_address: dcWithItems.site_address || dcWithItems.client_address,
        gstin: dcWithItems.client_gstin,
        state: dcWithItems.client_state,
        date: new Date().toISOString().split('T')[0],
        valid_till: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_terms: 'Net 30 Days',
        reference: `From DC: ${dcWithItems.dc_number}`,
        remarks: dcWithItems.remarks,
        status: 'Draft',
        negotiation_mode: false
      };

      const { data: quotation, error } = await supabase
        .from('quotation_header')
        .insert(quotationData)
        .select()
        .single();

      if (error) throw error;

      if (dcWithItems.items && dcWithItems.items.length > 0) {
        const itemsToInsert = dcWithItems.items.map(item => ({
          quotation_id: quotation.id,
          item_id: item.material_id,
          variant_id: item.variant_id,
          description: item.material_name,
          qty: item.quantity,
          uom: item.unit,
          rate: item.rate,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          line_total: item.amount,
          override_flag: false
        }));

        await supabase.from('quotation_items').insert(itemsToInsert);
      }

      alert('DC converted to Quotation successfully!');
      navigate(`/quotation/edit?id=${quotation.id}`);
    } catch (error) {
      console.error('Error converting to quotation:', error);
      alert('Error converting to quotation: ' + error.message);
    }
    setShowConvertMenu({});
  };

  const handleConvertToProforma = async (challan) => {
    try {
      alert('Proforma Invoice feature coming soon!');
    } catch (error) {
      console.error('Error converting to proforma:', error);
      alert('Error converting to proforma: ' + error.message);
    }
    setShowConvertMenu({});
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
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="Not sent">Not sent</option>
            <option value="Quoted">Quoted</option>
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
                    <td>{challan.project?.project_name || challan.project?.name || '-'}</td>
                    <td>{challan.client_name || '-'}</td>
                    <td className="table-number">{challan.items?.length || 0}</td>
                    <td className="table-number">₹{calculateTotal(challan.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${
                        challan.status === 'active' ? 'badge-success' : 
                        challan.status === 'Quoted' ? 'badge-success' :
                        challan.status === 'Not sent' ? 'badge-warning' :
                        'badge-neutral'
                      }`}>
                        {challan.status === 'active' ? 'Active' : challan.status}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button 
                          className="action-btn" 
                          title="Export PDF"
                          onClick={() => handleExport(challan)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        </button>
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <button 
                            className="action-btn" 
                            title="Convert"
                            onClick={() => setShowConvertMenu(prev => ({ ...prev, [challan.id]: !prev[challan.id] }))}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <polyline points="17 1 21 5 17 9"/>
                              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                              <polyline points="7 23 3 19 7 15"/>
                              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                            </svg>
                          </button>
                          {showConvertMenu[challan.id] && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              zIndex: 100,
                              minWidth: '160px',
                              marginTop: '4px'
                            }}>
                              <button 
                                style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                                onClick={() => handleConvertToQuotation(challan)}
                              >
                                Convert to Quotation
                              </button>
                              <button 
                                style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                                onClick={() => handleConvertToProforma(challan)}
                              >
                                Convert to Proforma
                              </button>
                            </div>
                          )}
                        </div>
                        <button 
                          className="action-btn" 
                          title="Edit"
                          onClick={() => navigate(`/dc/edit/${challan.id}`)}
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
