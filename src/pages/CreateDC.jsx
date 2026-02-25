import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { fetchProjects, fetchMaterials, createDeliveryChallan, addDeliveryChallanItems } from '../api';

export default function CreateDC({ onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    project_id: '',
    dc_date: new Date().toISOString().split('T')[0],
    client_name: '',
    site_address: '',
    vehicle_number: '',
    driver_name: '',
    remarks: ''
  });
  const [items, setItems] = useState([
    { s_no: 1, material_name: '', unit: 'nos', size: '', quantity: '', rate: '' }
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, materialsData] = await Promise.all([
        fetchProjects(),
        fetchMaterials()
      ]);
      setProjects(projectsData || []);
      setMaterials(materialsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'material_name') {
      const material = materials.find(m => m.name === value);
      if (material) {
        newItems[index].unit = material.unit;
        newItems[index].rate = material.default_rate || '';
      }
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { 
      s_no: items.length + 1, 
      material_name: '', 
      unit: 'nos', 
      size: '', 
      quantity: '', 
      rate: '' 
    }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index).map((item, i) => ({ ...item, s_no: i + 1 })));
    }
  };

  const calculateAmount = (quantity, rate) => {
    const qty = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return (qty * r).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const validItems = items.filter(item => item.material_name && item.quantity);
      
      if (validItems.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', formData.project_id)
        .single();

      const ChallanData = {
        ...formData,
        client_name: formData.client_name || project?.name || ''
      };

      const createdChallan = await createDeliveryChallan(ChallanData);
      
      const itemsToSave = validItems.map(item => ({
        delivery_challan_id: createdChallan.id,
        material_name: item.material_name,
        unit: item.unit,
        size: item.size,
        quantity: parseFloat(item.quantity),
        rate: item.rate ? parseFloat(item.rate) : null,
        amount: parseFloat(calculateAmount(item.quantity, item.rate))
      }));

      await addDeliveryChallanItems(createdChallan.id, itemsToSave);
      
      if (onSuccess) {
        onSuccess(createdChallan);
      }
    } catch (error) {
      console.error('Error creating DC:', error);
      alert('Error creating Delivery Challan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Create Delivery Challan</h2>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project</label>
            <select 
              name="project_id" 
              className="form-select"
              value={formData.project_id}
              onChange={handleInputChange}
            >
              <option value="">Select Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">DC Date</label>
            <input 
              type="date" 
              name="dc_date"
              className="form-input"
              value={formData.dc_date}
              onChange={handleInputChange}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Client Name</label>
            <input 
              type="text" 
              name="client_name"
              className="form-input"
              value={formData.client_name}
              onChange={handleInputChange}
              placeholder="Enter client name"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Site Address</label>
            <input 
              type="text" 
              name="site_address"
              className="form-input"
              value={formData.site_address}
              onChange={handleInputChange}
              placeholder="Enter site address"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Vehicle Number</label>
            <input 
              type="text" 
              name="vehicle_number"
              className="form-input"
              value={formData.vehicle_number}
              onChange={handleInputChange}
              placeholder="Enter vehicle number"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Driver Name</label>
            <input 
              type="text" 
              name="driver_name"
              className="form-input"
              value={formData.driver_name}
              onChange={handleInputChange}
              placeholder="Enter driver name"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Remarks</label>
          <textarea 
            name="remarks"
            className="form-textarea"
            value={formData.remarks}
            onChange={handleInputChange}
            placeholder="Enter any remarks"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Items</label>
          <div className="item-list">
            <div className="item-row header">
              <span>S.No</span>
              <span>Material</span>
              <span>Unit</span>
              <span>Size</span>
              <span>Qty</span>
              <span>Rate</span>
              <span></span>
            </div>
            
            {items.map((item, index) => (
              <div className="item-row" key={index}>
                <span>{index + 1}</span>
                <input 
                  type="text"
                  list="materials-list"
                  value={item.material_name}
                  onChange={(e) => handleItemChange(index, 'material_name', e.target.value)}
                  placeholder="Material name"
                />
                <select 
                  value={item.unit}
                  onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                >
                  <option value="nos">Nos</option>
                  <option value="kg">Kg</option>
                  <option value="m">Mtr</option>
                  <option value="sqft">Sqft</option>
                  <option value="sqm">Sqm</option>
                  <option value="ft">Ft</option>
                  <option value="liters">Liters</option>
                  <option value="bags">Bags</option>
                </select>
                <input 
                  type="text"
                  value={item.size}
                  onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                  placeholder="Size"
                />
                <input 
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  placeholder="Qty"
                  step="0.01"
                />
                <input 
                  type="number"
                  value={item.rate}
                  onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                  placeholder="Rate"
                  step="0.01"
                />
                <span className="delete-btn" onClick={() => removeItem(index)}>
                  ×
                </span>
              </div>
            ))}
          </div>
          
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: '12px' }}>
            + Add Item
          </button>
          
          <datalist id="materials-list">
            {materials.map(m => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create DC'}
          </button>
        </div>
      </form>
    </div>
  );
}
