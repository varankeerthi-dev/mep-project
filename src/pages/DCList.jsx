import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { fetchDeliveryChallans, deleteDeliveryChallan, fetchProjects } from '../api';
import { supabase } from '../supabase';
import { format } from 'date-fns';

export default function DCList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDC, setConvertDC] = useState(null);
  const [showPrintMenu, setShowPrintMenu] = useState({});
  const [templates, setTemplates] = useState([]);
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: '',
    status: 'all',
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
      const [challansData, projectsData, templatesData] = await Promise.all([
        fetchDeliveryChallans(filters),
        fetchProjects(),
        supabase.from('document_templates').select('*').eq('document_type', 'Delivery Challan').order('template_name')
      ]);
      setChallans(challansData || []);
      setProjects(projectsData || []);
      setTemplates(templatesData.data || []);
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

  const loadDCWithItems = async (dcId) => {
    const { data } = await supabase
      .from('delivery_challans')
      .select('*, items:delivery_challan_items(*)')
      .eq('id', dcId)
      .single();
    return data;
  };

  const handlePrintDC = async (challan, templateId = null) => {
    try {
      let template = null;
      
      if (templateId) {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        if (error) throw error;
        template = data;
      } else {
        const { data, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('document_type', 'Delivery Challan')
          .eq('is_default', true)
          .maybeSingle();
        template = data;
      }

      if (!template) {
        alert('No template found. Please select a template from Template Settings.');
        return;
      }

      const dcWithItems = await loadDCWithItems(challan.id);
      
      const isLandscape = template.orientation === 'Landscape';
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: template.page_size === 'Letter' ? 'letter' : 'a4'
      });

      const colSettings = (template && typeof template.column_settings === 'object' && template.column_settings) || {};
      const optionalCols = colSettings.optional || {};
      const labels = colSettings.labels || {};

      const columnConfig = [];
      if (optionalCols.sno !== false) columnConfig.push({ header: '#', key: 'sno', width: 10 });
      if (optionalCols.hsn_code) columnConfig.push({ header: labels.hsn_code || 'HSN/SAC', key: 'hsn_code', width: 20 });
      columnConfig.push({ header: labels.item || 'Item', key: 'item', width: optionalCols.description ? 50 : 70 });
      if (optionalCols.description) columnConfig.push({ header: labels.description || 'Description', key: 'description', width: 40 });
      if (optionalCols.variant) columnConfig.push({ header: labels.variant || 'Variant', key: 'variant', width: 25 });
      if (optionalCols.size) columnConfig.push({ header: labels.size || 'Size', key: 'size', width: 20 });
      columnConfig.push({ header: labels.qty || 'Qty', key: 'qty', width: 20 });
      columnConfig.push({ header: labels.unit || 'Unit', key: 'unit', width: 15 });
      if (optionalCols.rate !== false) columnConfig.push({ header: labels.rate || 'Rate', key: 'rate', width: 25 });
      if (optionalCols.discount) columnConfig.push({ header: labels.discount || 'Disc %', key: 'discount', width: 15 });
      if (optionalCols.tax) columnConfig.push({ header: labels.tax || 'Tax %', key: 'tax', width: 15 });
      if (optionalCols.amount !== false) columnConfig.push({ header: labels.amount || 'Amount', key: 'amount', width: 30 });

      const tableData = (dcWithItems.items || []).map((item, index) => {
        const row = { sno: index + 1 };
        if (optionalCols.sno !== false) row.sno = index + 1;
        if (optionalCols.hsn_code) row.hsn_code = item.hsn_code || '-';
        row.item = item.material_name || '-';
        if (optionalCols.description) row.description = item.description || '-';
        if (optionalCols.variant) row.variant = item.variant_name || '-';
        if (optionalCols.size) row.size = item.size || '-';
        row.qty = parseFloat(item.quantity) || 0;
        row.unit = item.unit || '-';
        if (optionalCols.rate !== false) row.rate = parseFloat(item.rate) || 0;
        if (optionalCols.discount) row.discount = item.discount_percent || 0;
        if (optionalCols.tax) row.tax = item.tax_percent || 0;
        if (optionalCols.amount !== false) row.amount = parseFloat(item.amount) || 0;
        return row;
      });

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DELIVERY CHALLAN', 105, 20, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`DC No: ${challan.dc_number}`, 14, 32);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${challan.dc_date ? format(new Date(challan.dc_date), 'dd/MM/yyyy') : '-'}`, 14, 38);

      let yPos = 48;
      doc.setFont('helvetica', 'bold');
      doc.text('Client Details:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
      doc.text(`Client: ${challan.client_name || '-'}`, 14, yPos);
      yPos += 6;
      doc.text(`Site Address: ${challan.site_address || '-'}`, 14, yPos);
      yPos += 6;
      doc.text(`Vehicle No: ${challan.vehicle_number || '-'}`, 14, yPos);
      yPos += 6;
      doc.text(`Driver: ${challan.driver_name || '-'}`, 14, yPos);

      yPos += 10;

      doc.autoTable({
        startY: yPos,
        head: [columnConfig.map(col => col.header)],
        body: tableData.map(row => columnConfig.map(col => {
          const val = row[col.key];
          if (col.key === 'rate' || col.key === 'amount') {
            return typeof val === 'number' ? `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : val;
          }
          if (col.key === 'qty' || col.key === 'discount' || col.key === 'tax') {
            return typeof val === 'number' ? val.toString() : val;
          }
          return val;
        })),
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 26], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: columnConfig.reduce((acc, col, idx) => {
          acc[idx] = { cellWidth: col.width };
          return acc;
        }, {})
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      const totalAmount = (dcWithItems.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Amount:', 140, finalY);
      doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 175, finalY, { align: 'right' });

      if (challan.remarks) {
        doc.setFont('helvetica', 'normal');
        doc.text(`Remarks: ${challan.remarks}`, 14, finalY + 15);
      }

      doc.setFontSize(10);
      doc.text('Authorized Signature', 140, finalY + 35);
      doc.line(130, finalY + 33, 190, finalY + 33);

      doc.save(`${challan.dc_number}.pdf`);
      setShowPrintMenu({});
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
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

  const handleConvertClick = (challan) => {
    setConvertDC(challan);
    setShowConvertModal(true);
  };

  const handleConvertToQuotation = async () => {
    if (!convertDC) return;
    
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

      const dcWithItems = await loadDCWithItems(convertDC.id);

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
    setShowConvertModal(false);
    setConvertDC(null);
  };

  const handleConvertToProforma = () => {
    alert('Proforma Invoice feature coming soon!');
    setShowConvertModal(false);
    setConvertDC(null);
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
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <button 
                            className="action-btn" 
                            title="Download PDF"
                            onClick={() => setShowPrintMenu(prev => ({ ...prev, [challan.id]: !prev[challan.id] }))}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          </button>
                          {showPrintMenu[challan.id] && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              zIndex: 100,
                              minWidth: '180px',
                              marginTop: '4px'
                            }}>
                              <div style={{ padding: '8px 12px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                                Select Template
                              </div>
                              {templates.length > 0 ? (
                                templates.map(t => (
                                  <button 
                                    key={t.id}
                                    style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                                    onClick={() => handlePrintDC(challan, t.id)}
                                  >
                                    {t.template_name} {t.is_default && '(Default)'}
                                  </button>
                                ))
                              ) : (
                                <button 
                                  style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}
                                  onClick={() => handlePrintDC(challan)}
                                >
                                  Default Template
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <button 
                          className="action-btn" 
                          title="Convert"
                          onClick={() => handleConvertClick(challan)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <polyline points="17 1 21 5 17 9"/>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                            <polyline points="7 23 3 19 7 15"/>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                          </svg>
                        </button>
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

      {/* Convert Modal */}
      {showConvertModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowConvertModal(false)}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1e293b' }}>
              Convert DC: {convertDC?.dc_number}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
              Select an option to convert this Delivery Challan
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn btn-primary"
                onClick={handleConvertToQuotation}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Convert to Quotation
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleConvertToProforma}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Convert to Proforma Invoice
              </button>
            </div>
            <button 
              onClick={() => setShowConvertModal(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
