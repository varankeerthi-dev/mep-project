import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { ChevronRight, ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronUp, Wrench, Calendar, Tag } from 'lucide-react';
import { EntryContainer } from '../../../components/ui/EntryContainer';
import { Button } from '../../../components/ui/button';
import { WorkCenterMachine, CustomAttribute } from '../../../api/machineBoard';

interface AddMachinePageProps {
  editingMachine?: WorkCenterMachine | null;
  onBack: () => void;
  onSuccess: () => void;
}

export function AddMachinePage({ editingMachine, onBack, onSuccess }: AddMachinePageProps) {
  const { organisation } = useAuth();
  const [saving, setSaving] = useState(false);

  // Collapsible cards state
  const [techOpen, setTechOpen] = useState(true);
  const [customAttrOpen, setCustomAttrOpen] = useState(true);

  // Machine Basic Info State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [wcType, setWcType] = useState<'injection_moulding' | 'blow_moulding' | 'press' | 'extruder' | 'assembly'>('injection_moulding');
  const [make, setMake] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [locationInPlant, setLocationInPlant] = useState('');

  // Technical Specs State
  const [clampingForce, setClampingForce] = useState<number | ''>('');
  const [maxShotWeight, setMaxShotWeight] = useState<number | ''>('');
  const [maxShotVolume, setMaxShotVolume] = useState<number | ''>('');
  const [connectedLoadKw, setConnectedLoadKw] = useState<number | ''>('');
  const [dimensionsLwh, setDimensionsLwh] = useState('');

  // Dynamic Custom Attributes State
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([
    {
      id: 'attr-1',
      label: 'Warranty Expiry',
      dataType: 'date',
      value: '',
    },
  ]);

  // Load editing machine data if present
  useEffect(() => {
    if (editingMachine) {
      setName(editingMachine.name || '');
      setCode(editingMachine.code || '');
      setWcType((editingMachine.machine_type as any) || 'injection_moulding');
      setMake(editingMachine.make || '');
      setModelNumber(editingMachine.model_number || '');
      setSerialNumber(editingMachine.serial_number || '');
      setLocationInPlant(editingMachine.location_in_plant || '');
      setClampingForce(editingMachine.clamping_force_tonnes ?? '');
      setMaxShotWeight(editingMachine.max_shot_weight_grams ?? '');
      setMaxShotVolume(editingMachine.max_shot_volume_cc ?? '');
      setConnectedLoadKw(editingMachine.connected_load_kw ?? '');
      setDimensionsLwh(
        editingMachine.length_mm && editingMachine.width_mm && editingMachine.height_mm
          ? `${editingMachine.length_mm}x${editingMachine.width_mm}x${editingMachine.height_mm} mm`
          : ''
      );

      if (editingMachine.custom_attributes && Array.isArray(editingMachine.custom_attributes)) {
        setCustomAttributes(editingMachine.custom_attributes);
      }
    }
  }, [editingMachine]);

  // Custom Attribute Handlers
  const handleAddAttribute = () => {
    const newAttr: CustomAttribute = {
      id: `attr-${Date.now()}`,
      label: '',
      dataType: 'text',
      value: '',
    };
    setCustomAttributes([...customAttributes, newAttr]);
  };

  const handleRemoveAttribute = (id: string) => {
    setCustomAttributes(customAttributes.filter((a) => a.id !== id));
  };

  const handleAttributeChange = (id: string, field: keyof CustomAttribute, value: any) => {
    setCustomAttributes(
      customAttributes.map((attr) => {
        if (attr.id === id) {
          const updated = { ...attr, [field]: value };
          if (field === 'dataType') {
            updated.value = '';
          }
          return updated;
        }
        return attr;
      })
    );
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Please fill in Machine Name and Machine Code');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim(),
        work_center_type: 'machine',
        machine_type: wcType,
        make: make.trim() || null,
        model_number: modelNumber.trim() || null,
        serial_number: serialNumber.trim() || null,
        location_in_plant: locationInPlant.trim() || null,
        clamping_force_tonnes: clampingForce === '' ? null : Number(clampingForce),
        max_shot_weight_grams: maxShotWeight === '' ? null : Number(maxShotWeight),
        max_shot_volume_cc: maxShotVolume === '' ? null : Number(maxShotVolume),
        connected_load_kw: connectedLoadKw === '' ? null : Number(connectedLoadKw),
        custom_attributes: customAttributes.filter((a) => a.label.trim() !== ''),
        capacity_per_hour: 100,
        capacity_uom: 'Nos',
        hours_per_shift: 8.0,
        shifts_per_day: 3,
        is_active: true,
        organisation_id: organisation?.id,
      };

      if (editingMachine?.id) {
        const { error } = await supabase.from('work_centers').update(payload).eq('id', editingMachine.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_centers').insert(payload);
        if (error) throw error;
      }

      onSuccess();
      onBack();
    } catch (err: any) {
      console.error('Error saving machine:', err);
      alert(err.message || 'Failed to save machine');
    } finally {
      setSaving(false);
    }
  };

  /* Input Style with 5px radius per user rule */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    fontSize: '13px',
    borderRadius: '5px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    background: '#ffffff',
  };

  return (
    <div className="add-machine-page-container p-6 max-w-[1000px] mx-auto font-['Inter'] space-y-6">
      {/* Ignore Global Button CSS - Use Component Button Styles */}
      <style>{`
        .add-machine-page-container .inner-container-20px {
          border-radius: 20px !important;
        }
        .add-machine-page-container .entry-field-container-5px {
          border-radius: 5px !important;
        }
        .add-machine-page-container .content-body-left-pad-12px {
          padding-left: 12px !important;
        }
        .add-machine-page-container label {
          margin-bottom: 8px !important;
        }
        .add-machine-page-container input,
        .add-machine-page-container select,
        .add-machine-page-container textarea {
          border-radius: 5px !important;
        }
      `}</style>

      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Button variant="link" size="sm" onClick={onBack} className="h-auto p-0 text-slate-500 hover:text-indigo-600 font-medium">
              Machine Board
            </Button>
            <ChevronRight size={12} />
            <span className="text-slate-900 font-semibold">
              {editingMachine ? 'Edit Machine' : 'Add New Machine'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {editingMachine ? `Edit Machine: ${editingMachine.name}` : 'Register New Shopfloor Machine'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            leftIcon={<ArrowLeft size={14} />}
          >
            Back to Machine Board
          </Button>
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Basic Machine Information (Inner Container - Radius 20px, Left Pad 12px) */}
        <div
          className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 p-6 shadow-2xs space-y-4"
          style={{ borderRadius: '20px', paddingLeft: '12px' }}
        >
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
            1. Basic Machine Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EntryContainer label="Machine Name *" className="entry-field-container-5px">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engel 300T Injection Machine"
                style={inputStyle}
                required
              />
            </EntryContainer>

            <EntryContainer label="Machine Code / Tag *" className="entry-field-container-5px">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. MC-300-01"
                style={inputStyle}
                required
              />
            </EntryContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EntryContainer label="Machine Type" className="entry-field-container-5px">
              <select
                value={wcType}
                onChange={(e) => setWcType(e.target.value as any)}
                style={inputStyle}
              >
                <option value="injection_moulding">Injection Moulding</option>
                <option value="blow_moulding">Blow Moulding</option>
                <option value="press">Press Machine</option>
                <option value="extruder">Extruder</option>
                <option value="assembly">Assembly Line</option>
              </select>
            </EntryContainer>

            <EntryContainer label="Make / Manufacturer" className="entry-field-container-5px">
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Engel, Toshiba, Haitian"
                style={inputStyle}
              />
            </EntryContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EntryContainer label="Model Number" className="entry-field-container-5px">
              <input
                type="text"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                placeholder="e.g. Victory 330/80"
                style={inputStyle}
              />
            </EntryContainer>

            <EntryContainer label="Serial Number" className="entry-field-container-5px">
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SN-884920"
                style={inputStyle}
              />
            </EntryContainer>

            <EntryContainer label="Plant Location / Bay" className="entry-field-container-5px">
              <input
                type="text"
                value={locationInPlant}
                onChange={(e) => setLocationInPlant(e.target.value)}
                placeholder="e.g. Shopfloor Bay 3"
                style={inputStyle}
              />
            </EntryContainer>
          </div>
        </div>

        {/* Card 2: Technical Specifications & Capacity (Inner Container - Radius 20px) */}
        <div
          className="inner-container-20px bg-white border border-slate-200 shadow-2xs overflow-hidden"
          style={{ borderRadius: '20px' }}
        >
          <Button
            type="button"
            fullWidth
            variant="ghost"
            onClick={() => setTechOpen(!techOpen)}
            className="content-body-left-pad-12px justify-between px-6 py-2 bg-slate-50 hover:bg-slate-100/80 text-sm font-bold text-slate-800 rounded-none"
            style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', height: 'auto', lineHeight: 'normal' }}
          >
            <span className="flex items-center gap-2">
              <span className="text-indigo-600 font-mono">2.</span> Technical Specifications & Capacity Metrics
            </span>
            {techOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>

          {techOpen && (
            <div
              className="content-body-left-pad-12px p-6 space-y-4 border-t border-slate-200"
              style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <EntryContainer label="Clamping Force (Tonnes)" className="entry-field-container-5px">
                  <input
                    type="number"
                    value={clampingForce}
                    onChange={(e) => setClampingForce(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 300"
                    style={inputStyle}
                  />
                </EntryContainer>

                <EntryContainer label="Max Shot Weight (Grams)" className="entry-field-container-5px">
                  <input
                    type="number"
                    value={maxShotWeight}
                    onChange={(e) => setMaxShotWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 500"
                    style={inputStyle}
                  />
                </EntryContainer>

                <EntryContainer label="Max Shot Volume (cc)" className="entry-field-container-5px">
                  <input
                    type="number"
                    value={maxShotVolume}
                    onChange={(e) => setMaxShotVolume(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 550"
                    style={inputStyle}
                  />
                </EntryContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EntryContainer label="Connected Electrical Load (kW)" className="entry-field-container-5px">
                  <input
                    type="number"
                    value={connectedLoadKw}
                    onChange={(e) => setConnectedLoadKw(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 45"
                    style={inputStyle}
                  />
                </EntryContainer>

                <EntryContainer label="Machine Dimensions (L x W x H)" className="entry-field-container-5px">
                  <input
                    type="text"
                    value={dimensionsLwh}
                    onChange={(e) => setDimensionsLwh(e.target.value)}
                    placeholder="e.g. 4800 x 1900 x 2200 mm"
                    style={inputStyle}
                  />
                </EntryContainer>
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Dynamic Custom Use-Case Attributes Builder (Inner Container - Radius 20px) */}
        <div
          className="inner-container-20px bg-white border border-slate-200 shadow-2xs overflow-hidden"
          style={{ borderRadius: '20px' }}
        >
          <Button
            type="button"
            fullWidth
            variant="ghost"
            onClick={() => setCustomAttrOpen(!customAttrOpen)}
            className="content-body-left-pad-12px justify-between px-6 py-2 bg-slate-50 hover:bg-slate-100/80 text-sm font-bold text-slate-800 rounded-none"
            style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', height: 'auto', lineHeight: 'normal' }}
          >
            <span className="flex items-center gap-2">
              <span className="text-indigo-600 font-mono">3.</span> Dynamic Use-Case Attributes (Custom Fields)
            </span>
            {customAttrOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>

          {customAttrOpen && (
            <div
              className="content-body-left-pad-12px p-6 space-y-4 border-t border-slate-200"
              style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}
            >
              <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900">Custom Attributes Builder</h4>
                  <p className="text-[11px] text-slate-600">
                    Add custom fields tailored to your plant (e.g., Warranty Expiry date, PLC version, Hydraulic Oil type).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onClick={handleAddAttribute}
                  leftIcon={<Plus size={14} />}
                >
                  Add Attribute
                </Button>
              </div>

              {customAttributes.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No custom attributes added yet. Click "+ Add Attribute" to define custom fields.
                </p>
              ) : (
                <div className="space-y-3">
                  {customAttributes.map((attr, index) => (
                    <div
                      key={attr.id}
                      className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                      style={{ borderRadius: '5px' }}
                    >
                      {/* Label Name */}
                      <div className="md:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Label Name #{index + 1}
                        </label>
                        <input
                          type="text"
                          value={attr.label}
                          onChange={(e) => handleAttributeChange(attr.id, 'label', e.target.value)}
                          placeholder="e.g. Warranty Expiry, PLC Version"
                          style={inputStyle}
                        />
                      </div>

                      {/* Data Type */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Data Type
                        </label>
                        <select
                          value={attr.dataType}
                          onChange={(e) => handleAttributeChange(attr.id, 'dataType', e.target.value as any)}
                          style={inputStyle}
                        >
                          <option value="date">📅 Date (Datepicker)</option>
                          <option value="text">📝 Text (String)</option>
                          <option value="number">🔢 Number (Numeric)</option>
                          <option value="boolean">🔘 Yes / No (Boolean)</option>
                        </select>
                      </div>

                      {/* Input Value (Dynamically rendered based on dataType) */}
                      <div className="md:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Attribute Value / Default
                        </label>
                        {attr.dataType === 'date' ? (
                          <input
                            type="date"
                            value={attr.value}
                            onChange={(e) => handleAttributeChange(attr.id, 'value', e.target.value)}
                            style={inputStyle}
                          />
                        ) : attr.dataType === 'number' ? (
                          <input
                            type="number"
                            value={attr.value}
                            onChange={(e) => handleAttributeChange(attr.id, 'value', e.target.value)}
                            placeholder="e.g. 2026"
                            style={inputStyle}
                          />
                        ) : attr.dataType === 'boolean' ? (
                          <select
                            value={attr.value}
                            onChange={(e) => handleAttributeChange(attr.id, 'value', e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">Select Option</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={attr.value}
                            onChange={(e) => handleAttributeChange(attr.id, 'value', e.target.value)}
                            placeholder="e.g. Comprehensive 3-Year"
                            style={inputStyle}
                          />
                        )}
                      </div>

                      {/* Delete Button */}
                      <div className="md:col-span-1 flex justify-end items-end pt-4 md:pt-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleRemoveAttribute(attr.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="default"
            onClick={onBack}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            size="default"
            loading={saving}
            loadingText="Saving Machine..."
            leftIcon={<Save size={15} />}
          >
            Save Machine
          </Button>
        </div>
      </form>
    </div>
  );
}
