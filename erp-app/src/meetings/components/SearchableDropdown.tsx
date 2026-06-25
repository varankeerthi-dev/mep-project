import { useState, useRef, useEffect, memo } from 'react';
import { X } from 'lucide-react';

interface Option {
  id: string;
  [key: string]: string | undefined;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: Option) => void;
  options: Option[];
  optionLabel: string;
  optionSubLabel?: string;
  placeholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
  minHeight?: string;
}

export const SearchableDropdown = memo(function SearchableDropdown({
  value,
  onChange,
  onSelect,
  options,
  optionLabel,
  optionSubLabel,
  placeholder = 'Search...',
  searchValue = '',
  onSearchChange,
  disabled = false,
  minHeight = '40px',
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(searchValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (onSearchChange) {
      onSearchChange(search);
    }
  }, [search, onSearchChange]);
  
  useEffect(() => {
    setSearch(searchValue);
  }, [searchValue]);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);
    onChange(newValue);
    setIsOpen(true);
  };
  
  const handleSelect = (option: Option) => {
    const label = option[optionLabel] || '';
    onChange(label);
    onSelect(option);
    setSearch('');
    setIsOpen(false);
  };
  
  const handleClear = () => {
    onChange('');
    setSearch('');
    inputRef.current?.focus();
  };
  
  const filteredOptions = options.filter((option) => {
    const label = option[optionLabel]?.toLowerCase() || '';
    const sub = optionSubLabel ? (option[optionSubLabel]?.toLowerCase() || '') : '';
    return label.includes(search.toLowerCase()) || sub.includes(search.toLowerCase());
  });
  
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-3 pr-8 py-[10px] border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px] text-sm"
          style={{ minHeight }}
          value={isOpen ? search : value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {value && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
          >
            <X size={14} className="text-slate-400" />
          </button>
        )}
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              {search ? 'No results found' : 'Type to search...'}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.id || index}
                className="px-4 py-[10px] hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                onClick={() => handleSelect(option)}
              >
                <div className="text-xs font-medium text-slate-800">
                  {option[optionLabel]}
                </div>
                {optionSubLabel && option[optionSubLabel] && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {option[optionSubLabel]}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

export default SearchableDropdown;