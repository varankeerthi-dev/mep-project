import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const DOCUMENT_TYPES = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'dc', label: 'DC' },
  { id: 'quote', label: 'Quote' },
  { id: 'po', label: 'PO' },
  { id: 'credit_note', label: 'Credit Note' },
  { id: 'debit_note', label: 'Debit Note' },
  { id: 'so', label: 'SO' },
  { id: 'self_invoice', label: 'Self Invoice' },
  { id: 'branch', label: 'Branch' },
  { id: 'site_visit', label: 'Site Visit' },
  { id: 'material_indent', label: 'Material Indent' },
  { id: 'client_request', label: 'Client Request' }
];

export default function TransactionNumberSeries() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [preventDuplicate, setPreventDuplicate] = useState(true);
  const [editingSeries, setEditingSeries] = useState(null);

  useEffect(() => {
    loadSeries();
    loadGlobalSettings();
  }, []);

  const loadGlobalSettings = async () => {
    const { data } = await supabase.from('settings').select('key, value').eq('key', 'prevent_duplicate_numbers');
    if (data && data.length > 0) {
      setPreventDuplicate(data[0].value === 'true');
    }
  };

  const loadSeries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('document_series')
      .select('*')
      .order('series_name', { ascending: true });
    
    if (!error) {
      setSeries(data || []);
    }
    setLoading(false);
  };

  const togglePreventDuplicate = async () => {
    const newValue = !preventDuplicate;
    setPreventDuplicate(newValue);
    await supabase.from('settings').upsert({ 
      key: 'prevent_duplicate_numbers', 
      value: String(newValue) 
    }, { onConflict: 'key' });
  };

  const filteredSeries = series.filter(s => 
    s.series_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generatePreview = (prefix, startNumber, suffix) => {
    const num = String(startNumber || 1).padStart(4, '0');
    return `${prefix || ''}${num}${suffix || ''}`;
  };

  const getPreviewForDocType = (seriesData, docType) => {
    const config = seriesData?.configs?.[docType];
    if (!config || !config.enabled) return '—';
    return generatePreview(config.prefix, config.start_number, config.suffix);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSeries(null);
  };

  const handleSaveSeries = () => {
    loadSeries();
    setShowModal(false);
    setEditingSeries(null);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transaction Number Series</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={preventDuplicate} 
              onChange={togglePreventDuplicate}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 500 }}>Prevent Duplicate Numbers</span>
          </label>
          <button className="btn btn-primary" onClick={() => { setEditingSeries(null); setShowModal(true); }}>
            + New Series
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search series..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '250px' }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0, minWidth: '1400px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Series Name</th>
                <th style={{ minWidth: '120px' }}>Invoice</th>
                <th style={{ minWidth: '100px' }}>DC</th>
                <th style={{ minWidth: '100px' }}>Quote</th>
                <th style={{ minWidth: '80px' }}>PO</th>
                <th style={{ minWidth: '120px' }}>Credit Note</th>
                <th style={{ minWidth: '120px' }}>Debit Note</th>
                <th style={{ minWidth: '80px' }}>SO</th>
                <th style={{ minWidth: '120px' }}>Self Invoice</th>
                <th style={{ minWidth: '100px' }}>Site Visit</th>
                <th style={{ minWidth: '130px' }}>Material Indent</th>
                <th style={{ minWidth: '130px' }}>Client Request</th>
                <th style={{ minWidth: '80px' }}>Default</th>
                <th style={{ minWidth: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
              ) : filteredSeries.length === 0 ? (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No series found. Create your first series.</td></tr>
              ) : (
                filteredSeries.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.series_name}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'invoice')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'dc')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'quote')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'po')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'credit_note')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'debit_note')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'so')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'self_invoice')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'site_visit')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'material_indent')}</td>
                    <td style={{ fontSize: '12px', color: '#666' }}>{getPreviewForDocType(s, 'client_request')}</td>
                    <td>
                      {s.is_default && (
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Default</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => { setEditingSeries(s); setShowModal(true); }}
                        disabled={s.has_transactions}
                        title={s.has_transactions ? 'Cannot edit - transactions exist' : 'Edit'}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <SeriesModal 
          series={editingSeries} 
          onClose={handleCloseModal} 
          onSave={handleSaveSeries}
          generatePreview={generatePreview}
        />
      )}
    </div>
  );
}

function SeriesModal({ series, onClose, onSave, generatePreview }) {
  const [formData, setFormData] = useState({
    series_name: series?.series_name || '',
    financial_year: series?.financial_year || 'auto',
    is_default: series?.is_default || false,
    current_number: series?.current_number || 1,
    configs: series?.configs || {}
  });

  useEffect(() => {
    if (!formData.configs || Object.keys(formData.configs).length === 0) {
      const initialConfigs = {};
      DOCUMENT_TYPES.forEach(dt => {
        initialConfigs[dt.id] = {
          enabled: false,
          prefix: '',
          start_number: 1,
          suffix: ''
        };
      });
      setFormData(prev => ({ ...prev, configs: initialConfigs }));
    }
  }, []);

  const updateConfig = (docType, field, value) => {
    setFormData(prev => ({
      ...prev,
      configs: {
        ...prev.configs,
        [docType]: {
          ...prev.configs[docType],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.series_name.trim()) {
      alert('Series name is required');
      return;
    }

    try {
      if (formData.is_default) {
        // First, remove default from all other series
        await supabase.from('document_series').update({ is_default: false }).neq('id', series?.id || '00000000-0000-0000-0000-000000000000');
      }

      const dataToSave = {
        series_name: formData.series_name,
        financial_year: formData.financial_year,
        is_default: formData.is_default,
        current_number: formData.current_number || 1,
        configs: formData.configs
      };

      let result;
      if (series?.id) {
        result = await supabase.from('document_series').update(dataToSave).eq('id', series.id).select();
      } else {
        result = await supabase.from('document_series').insert(dataToSave).select();
      }

      if (result.error) {
        alert('Error saving: ' + result.error.message);
        return;
      }

      onSave();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const getCurrentFinancialYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month < 3) return `${year - 1}-${year.toString().slice(-2)}`;
    return `${year}-${(year + 1).toString().slice(-2)}`;
  };

  const getFyPrefix = () => {
    if (formData.financial_year === 'auto') {
      return getCurrentFinancialYear();
    }
    return formData.financial_year;
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 className="modal-title">{series ? 'Edit Series' : 'New Series'}</h2>
          <button className="modal-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Series Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.series_name}
                  onChange={(e) => setFormData({ ...formData, series_name: e.target.value })}
                  placeholder="e.g., Main Series"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Financial Year</label>
                <select
                  className="form-select"
                  value={formData.financial_year}
                  onChange={(e) => setFormData({ ...formData, financial_year: e.target.value })}
                >
                  <option value="auto">Auto ({getCurrentFinancialYear()})</option>
                  <option value="25-26">25-26</option>
                  <option value="26-27">26-27</option>
                  <option value="27-28">27-28</option>
                  <option value="28-29">28-29</option>
                  <option value="29-30">29-30</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Current Number</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.current_number || 1}
                  onChange={(e) => setFormData({ ...formData, current_number: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.is_default} 
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 500 }}>Set as Default Series</span>
              </label>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>Number Format Builder</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {DOCUMENT_TYPES.map(docType => (
                <div key={docType.id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px', 
                  padding: '12px',
                  background: formData.configs[docType.id]?.enabled ? '#f0fdf4' : '#fafafa'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <input 
                      type="checkbox"
                      checked={formData.configs[docType.id]?.enabled || false}
                      onChange={(e) => updateConfig(docType.id, 'enabled', e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '14px' }}>{docType.label}</span>
                  </div>
                  
                  {formData.configs[docType.id]?.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Prefix</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={formData.configs[docType.id]?.prefix || ''}
                          onChange={(e) => updateConfig(docType.id, 'prefix', e.target.value)}
                          placeholder="Prefix"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Start No.</label>
                        <input
                          type="number"
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={formData.configs[docType.id]?.start_number || 1}
                          onChange={(e) => updateConfig(docType.id, 'start_number', parseInt(e.target.value) || 1)}
                          min={1}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Suffix</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={formData.configs[docType.id]?.suffix || ''}
                          onChange={(e) => updateConfig(docType.id, 'suffix', e.target.value)}
                          placeholder="Suffix"
                        />
                      </div>
                    </div>
                  )}
                  
                  {formData.configs[docType.id]?.enabled && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f3f4f6', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Preview: </span>
                      <span style={{ fontWeight: 600, color: '#1f2937', fontFamily: 'monospace' }}>
                        {generatePreview(
                          formData.configs[docType.id]?.prefix?.replace('{FY}', getFyPrefix()) || getFyPrefix() + '/',
                          formData.configs[docType.id]?.start_number || 1,
                          formData.configs[docType.id]?.suffix || ''
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{series ? 'Update' : 'Create'} Series</button>
          </div>
        </form>
      </div>
    </div>
  );
}
