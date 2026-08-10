import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Plus, X, Wrench } from 'lucide-react';
import { EntryContainer } from '../../../components/ui/EntryContainer';
import { Button } from '../../../components/ui/button';

interface AddMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddMachineModal({ isOpen, onClose, onSuccess }: AddMachineModalProps) {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [wcType, setWcType] = useState('injection_moulding');
  const [make, setMake] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [clampingForce, setClampingForce] = useState<number | ''>('');
  const [maxShotWeight, setMaxShotWeight] = useState<number | ''>('');
  const [electricalKw, setElectricalKw] = useState<number | ''>('');
  const [dimensions, setDimensions] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Please provide machine name and code');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('work_centers').insert({
        name: name.trim(),
        code: code.trim(),
        work_center_type: 'machine',
        machine_type: wcType,
        make: make.trim() || null,
        model_number: modelNumber.trim() || null,
        clamping_force_tonnes: clampingForce === '' ? null : Number(clampingForce),
        max_shot_weight_grams: maxShotWeight === '' ? null : Number(maxShotWeight),
        electrical_kw: electricalKw === '' ? null : Number(electricalKw),
        dimensions_lwh: dimensions.trim() || null,
        capacity_per_hour: 100, // default capacity
        capacity_uom: 'Nos',
        hours_per_shift: 8.0,
        shifts_per_day: 3,
        is_active: true,
        organisation_id: organisation?.id,
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating machine:', err);
      alert(err.message || 'Failed to create machine');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '20px', paddingLeft: '16px' }}
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wrench size={18} className="text-indigo-600" /> Add New Machine / Work Center
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EntryContainer label="Machine Name *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engel 300T Injection Machine"
                style={inputStyle}
                required
              />
            </EntryContainer>

            <EntryContainer label="Machine Code / Tag *">
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
            <EntryContainer label="Machine Type">
              <select
                value={wcType}
                onChange={(e) => setWcType(e.target.value)}
                style={inputStyle}
              >
                <option value="injection_moulding">Injection Moulding</option>
                <option value="blow_moulding">Blow Moulding</option>
                <option value="press">Press Machine</option>
                <option value="extruder">Extruder</option>
                <option value="assembly">Assembly Line</option>
              </select>
            </EntryContainer>

            <EntryContainer label="Make / Manufacturer">
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Engel, Toshiba, Haitian"
                style={inputStyle}
              />
            </EntryContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EntryContainer label="Model Number">
              <input
                type="text"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                placeholder="e.g. Victory 330/80"
                style={inputStyle}
              />
            </EntryContainer>

            <EntryContainer label="Clamping Force (Tonnes)">
              <input
                type="number"
                value={clampingForce}
                onChange={(e) => setClampingForce(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 300"
                style={inputStyle}
              />
            </EntryContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EntryContainer label="Max Shot Weight (Grams)">
              <input
                type="number"
                value={maxShotWeight}
                onChange={(e) => setMaxShotWeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 500"
                style={inputStyle}
              />
            </EntryContainer>

            <EntryContainer label="Electrical Rating (kW)">
              <input
                type="number"
                value={electricalKw}
                onChange={(e) => setElectricalKw(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 45"
                style={inputStyle}
              />
            </EntryContainer>
          </div>

          <EntryContainer label="Dimensions (L x W x H)">
            <input
              type="text"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="e.g. 4.8m x 1.9m x 2.2m"
              style={inputStyle}
            />
          </EntryContainer>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} loading={loading} loadingText="Saving..." leftIcon={<Plus size={14} />}>Register Machine</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
