import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Package, AlertTriangle, X, Check } from 'lucide-react';

interface SerialPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (serials: string[]) => void;
  materialId: string;
  warehouseId?: string;
  quantity: number;
  organisationId: string;
}

interface SerialRecord {
  id: string;
  serial_number: string;
  warranty_start_date: string;
  warranty_end_date: string;
  warehouse_id: string;
  returned_to_supplier: boolean;
}

export function SerialPickerModal({
  isOpen,
  onClose,
  onSelect,
  materialId,
  warehouseId,
  quantity,
  organisationId
}: SerialPickerModalProps) {
  const { organisation } = useAuth();
  const [serials, setSerials] = useState<SerialRecord[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && materialId && organisationId) {
      fetchAvailableSerials();
    }
  }, [isOpen, materialId, organisationId, warehouseId]);

  const fetchAvailableSerials = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('warehouse_bin_items')
        .select('id, serial_number, warranty_start_date, warranty_end_date, warehouse_id, returned_to_supplier')
        .eq('material_id', materialId)
        .eq('organisation_id', organisationId)
        .eq('returned_to_supplier', false)
        .not('serial_number', 'is', null)
        .order('warranty_end_date', { ascending: true });

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSerials(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch serials');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSerial = (serialId: string) => {
    setSelectedSerials(prev => {
      const next = new Set(prev);
      if (next.has(serialId)) {
        next.delete(serialId);
      } else {
        if (next.size >= quantity) {
          setError(`Maximum ${quantity} serials can be selected`);
          return prev;
        }
        next.add(serialId);
      }
      return next;
    });
    setError('');
  };

  const handleConfirm = () => {
    if (selectedSerials.size !== quantity) {
      setError(`Please select exactly ${quantity} serial numbers`);
      return;
    }
    const selected = serials
      .filter(s => selectedSerials.has(s.id))
      .map(s => s.serial_number);
    onSelect(selected);
    onClose();
  };

  const handleClose = () => {
    setSelectedSerials(new Set());
    setSearchQuery('');
    setError('');
    onClose();
  };

  const filteredSerials = serials.filter(s =>
    s.serial_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>Select Serial Numbers</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
              Select {quantity} serial number{quantity > 1 ? 's' : ''} from available stock
            </p>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search serial numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #d1d5db', borderRadius: '6px',
                fontSize: '13px', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Serial List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading serials...</div>
          ) : filteredSerials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <Package size={40} color="#d1d5db" style={{ marginBottom: '12px' }} />
              <p>No serials available in stock</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Add serials via GRN or enter manually</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredSerials.map(serial => (
                <div
                  key={serial.id}
                  onClick={() => handleToggleSerial(serial.id)}
                  style={{
                    padding: '12px 16px', border: `1px solid ${selectedSerials.has(serial.id) ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: '6px', cursor: 'pointer', background: selectedSerials.has(serial.id) ? '#eff6ff' : '#fff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>
                      {serial.serial_number}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                      Warranty: {serial.warranty_start_date} to {serial.warranty_end_date}
                    </div>
                  </div>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedSerials.has(serial.id) ? '#2563eb' : '#d1d5db'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedSerials.has(serial.id) ? '#2563eb' : 'transparent'
                  }}>
                    {selectedSerials.has(serial.id) && <Check size={12} color="#fff" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Selected: {selectedSerials.size} / {quantity}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selectedSerials.size !== quantity}>
              Confirm Selection
            </Button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 24px', background: '#fef2f2', borderTop: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#dc2626" />
            <span style={{ fontSize: '13px', color: '#991b1b' }}>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
