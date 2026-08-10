import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { EditorSection } from './EditorSection';
import { inputField, inputFieldSm, fieldLabel, addButton, addLink } from './formStyles';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { Plus, ChevronDown, Check } from 'lucide-react';

interface BasicInformationSectionProps {
  color?: 'indigo' | 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'slate';
  formData: {
    item_name: string;
    display_name: string;
    item_code: string;
    main_category: string;
    sub_category: string;
    unit: string;
    has_alternative_unit?: boolean;
    alternative_units?: { unit_name: string; conversion_factor: string }[];
  };
  categoryOptions: string[];
  unitOptions: { unit_code: string; unit_name: string }[];
  onChange: (field: string, value: any) => void;
  onCategoryCreated?: (newCategory: string) => void;
  onUnitCreated?: (newUnit: string) => void;
}

const fieldSpacing = 'space-y-2';

export function BasicInformationSection({
  color,
  formData,
  categoryOptions,
  unitOptions = [],
  onChange,
  onCategoryCreated,
  onUnitCreated
}: BasicInformationSectionProps) {
  const { organisation } = useAuth();

  // Category dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Unit dropdown state
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitSearchText, setUnitSearchText] = useState('');
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveNewCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSavingCat(true);
    try {
      const { data, error } = await supabase
        .from('item_categories')
        .insert({ category_name: newCatName.trim(), is_active: true })
        .select();

      if (error) throw error;

      onChange('main_category', newCatName.trim());

      if (onCategoryCreated) {
        onCategoryCreated(newCatName.trim());
      }

      setShowNewCatInput(false);
      setNewCatName('');
    } catch (err: any) {
      alert('Error creating category: ' + err.message);
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleSaveNewUnit = async () => {
    if (!newUnitCode.trim() || !newUnitName.trim()) return;
    setIsSavingUnit(true);
    try {
      const code = newUnitCode.trim().toLowerCase();
      const name = newUnitName.trim();
      const { data, error } = await supabase
        .from('item_units')
        .insert({
          unit_code: code,
          unit_name: name,
          is_active: true,
          organisation_id: organisation?.id
        })
        .select();

      if (error) throw error;

      onChange('unit', code);

      if (onUnitCreated) {
        onUnitCreated(code);
      }

      setShowNewUnitInput(false);
      setNewUnitCode('');
      setNewUnitName('');
    } catch (err: any) {
      alert('Error creating unit: ' + err.message);
    } finally {
      setIsSavingUnit(false);
    }
  };

  const addAlternativeUnitRow = () => {
    const updated = [...(formData.alternative_units || []), { unit_name: '', conversion_factor: '' }];
    onChange('has_alternative_unit', true);
    onChange('alternative_units', updated);
  };

  const removeAlternativeUnitRow = (index: number) => {
    const updated = (formData.alternative_units || []).filter((_: any, idx: number) => idx !== index);
    onChange('alternative_units', updated);
    if (updated.length === 0) {
      onChange('has_alternative_unit', false);
    }
  };

  const updateAlternativeUnitRow = (index: number, field: string, value: any) => {
    const updated = (formData.alternative_units || []).map((row: any, idx: number) => {
      if (idx === index) {
        return { ...row, [field]: value };
      }
      return row;
    });
    onChange('alternative_units', updated);
  };

  const filteredCategories = useMemo(() => {
    return categoryOptions.filter(c => !searchText || c.toLowerCase().includes(searchText.toLowerCase()));
  }, [categoryOptions, searchText]);

  const filteredUnits = useMemo(() => {
    return unitOptions.filter(u =>
      !unitSearchText ||
      u.unit_code.toLowerCase().includes(unitSearchText.toLowerCase()) ||
      u.unit_name.toLowerCase().includes(unitSearchText.toLowerCase())
    );
  }, [unitOptions, unitSearchText]);

  const dropdownPanel = 'absolute left-0 right-0 top-full z-50 mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-[#E7EAF1] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]';

  return (
    <EditorSection color={color || 'green'} title="Basic Information" badge="Required" description="Enter the essential details about this item.">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className={fieldSpacing}>
          <label className={fieldLabel}>Item Name <span className="text-[#EF4444]">*</span></label>
          <Input
            value={formData.item_name}
            onChange={(e) => onChange('item_name', e.target.value)}
            placeholder="Enter item name"
            required
            data-required="true"
            className={inputField}
          />
        </div>
        <div className={fieldSpacing}>
          <label className={fieldLabel}>Display Name</label>
          <Input
            value={formData.display_name}
            onChange={(e) => onChange('display_name', e.target.value)}
            placeholder="Display name (defaults to item name)"
            className={inputField}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className={fieldSpacing}>
          <label className={fieldLabel}>Item Code</label>
          <Input
            value={formData.item_code}
            onChange={(e) => onChange('item_code', e.target.value)}
            placeholder="Auto-generated if empty"
            className={inputField}
          />
        </div>
        <div className={fieldSpacing}>
          <label className={fieldLabel}>Main Category</label>

          {showNewCatInput ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Enter category name..."
                className={inputField + ' flex-1'}
                autoFocus
              />
              <Button type="button" size="sm" onClick={handleSaveNewCategory} disabled={isSavingCat}>
                {isSavingCat ? '...' : 'Save'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div ref={dropdownRef} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={isDropdownOpen ? searchText : (formData.main_category || '')}
                  onChange={(e) => { setSearchText(e.target.value); setIsDropdownOpen(true); }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Search or select category..."
                  className={inputField}
                />
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
                />
                {isDropdownOpen && (
                  <div className={dropdownPanel}>
                    <div
                      className="cursor-pointer border-b border-[#F1F5F9] px-3 py-2 text-xs italic text-[#6B7280] hover:bg-[#F8FAFC]"
                      onClick={() => { onChange('main_category', ''); setIsDropdownOpen(false); setSearchText(''); }}
                    >
                      Clear selection
                    </div>
                    {filteredCategories.map(c => {
                      const isSelected = formData.main_category === c;
                      return (
                        <div
                          key={c}
                          className={`flex cursor-pointer items-center justify-between border-b border-[#F1F5F9] px-4 py-2.5 text-sm transition-colors ${
                            isSelected ? 'bg-[#EEF2FF] font-semibold text-[#111827]' : 'text-[#6B7280] hover:bg-[#F8FAFC]'
                          }`}
                          onClick={() => { onChange('main_category', c); setSearchText(''); setIsDropdownOpen(false); }}
                        >
                          <span>{c}</span>
                          {isSelected && <Check size={14} className="text-[#4F46E5]" />}
                        </div>
                      );
                    })}
                    {filteredCategories.length === 0 && (
                      <div className="px-3 py-3 text-center text-xs italic text-[#6B7280]">
                        No categories found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button variant="default" size="sm" type="button" onClick={() => setShowNewCatInput(true)}
                title="Create new category"
                className={addButton}
              >
                <Plus size={18} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className={fieldSpacing}>
          <label className={fieldLabel}>Sub Category</label>
          <Input
            value={formData.sub_category}
            onChange={(e) => onChange('sub_category', e.target.value)}
            placeholder="Sub category (optional)"
            className={inputField}
          />
        </div>

        <div className={fieldSpacing}>
          <label className={fieldLabel}>Primary Unit <span className="text-[#EF4444]">*</span></label>
          {showNewUnitInput ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={newUnitCode}
                onChange={(e) => setNewUnitCode(e.target.value)}
                placeholder="Code (e.g. kg)"
                className={inputField + ' w-24'}
                autoFocus
              />
              <Input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="Name (e.g. Kilograms)"
                className={inputField + ' flex-1'}
              />
              <Button type="button" size="sm" onClick={handleSaveNewUnit} disabled={isSavingUnit}>
                {isSavingUnit ? '...' : 'Save'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowNewUnitInput(false); setNewUnitCode(''); setNewUnitName(''); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div ref={unitDropdownRef} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={isUnitDropdownOpen ? unitSearchText : (formData.unit || '')}
                  onChange={(e) => { setUnitSearchText(e.target.value); setIsUnitDropdownOpen(true); }}
                  onFocus={() => setIsUnitDropdownOpen(true)}
                  placeholder="Search or select unit..."
                  data-required="true"
                  className={inputField}
                />
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
                />
                {isUnitDropdownOpen && (
                  <div className={dropdownPanel}>
                    {filteredUnits.map(u => {
                      const isSelected = formData.unit === u.unit_code;
                      return (
                        <div
                          key={u.unit_code}
                          className={`flex cursor-pointer items-center justify-between border-b border-[#F1F5F9] px-4 py-2.5 text-sm transition-colors ${
                            isSelected ? 'bg-[#EEF2FF] font-semibold text-[#111827]' : 'text-[#6B7280] hover:bg-[#F8FAFC]'
                          }`}
                          onClick={() => { onChange('unit', u.unit_code); setUnitSearchText(''); setIsUnitDropdownOpen(false); }}
                        >
                          <span>{u.unit_code} {u.unit_name ? `(${u.unit_name})` : ''}</span>
                          {isSelected && <Check size={14} className="text-[#4F46E5]" />}
                        </div>
                      );
                    })}
                    {filteredUnits.length === 0 && (
                      <div className="px-4 py-3 text-center text-xs italic text-[#6B7280]">
                        No units found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button variant="default" size="sm" type="button" onClick={() => setShowNewUnitInput(true)}
                title="Create new unit"
                className={addButton}
              >
                <Plus size={18} />
              </Button>
            </div>
          )}

          {/* Alternative Units link and editor */}
          <div className="pt-1">
            {(!formData.has_alternative_unit || !formData.alternative_units || formData.alternative_units.length === 0) ? (
              <Button variant="default" size="sm" type="button" onClick={addAlternativeUnitRow} className={addLink} >
                <Plus size={14} /> Add Alternative Unit
              </Button>
            ) : (
              <div className="mt-2 space-y-2 rounded-xl border border-dashed border-[#D6DAE6] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#6B7280]">Alternative Units</span>
                  <Button variant="default" size="sm" type="button" onClick={() => {
                      onChange('has_alternative_unit', false);
                      onChange('alternative_units', []);
                    }}
                    className="text-[10px] font-medium text-[#EF4444] hover:underline"
                  >
                    Clear All
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  {(formData.alternative_units || []).map((altRow: any, altIdx: number) => (
                    <div key={altIdx} className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-[11px] text-[#6B7280]">1 {formData.unit || 'Nos'} =</span>
                      <Input
                        type="text"
                        placeholder="Conversion"
                        value={altRow.conversion_factor}
                        onChange={(e) => updateAlternativeUnitRow(altIdx, 'conversion_factor', e.target.value)}
                        className={inputFieldSm + ' w-20'}
                      />

                      <select
                        value={altRow.unit_name}
                        onChange={(e) => updateAlternativeUnitRow(altIdx, 'unit_name', e.target.value)}
                        className={inputFieldSm + ' flex-1 cursor-pointer'}
                      >
                        <option value="">Select Unit</option>
                        {unitOptions.filter(u => u.unit_code !== formData.unit).map(u => (
                          <option key={u.unit_code} value={u.unit_code}>
                            {u.unit_code} {u.unit_name ? `(${u.unit_name})` : ''}
                          </option>
                        ))}
                      </select>

                      <Button variant="default" size="sm" type="button" onClick={() => removeAlternativeUnitRow(altIdx)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#EF4444]/40 text-[#EF4444] transition-colors hover:bg-[#EF4444]/10"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="default" size="sm" type="button" onClick={addAlternativeUnitRow} className={addLink} >
                  <Plus size={14} /> Add Another Row
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </EditorSection>
  );
}
