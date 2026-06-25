import { useState, useEffect, useMemo } from 'react';
import { 
  FunnelIcon, 
  XMarkIcon,
  CalendarDaysIcon,
  FolderIcon,
  UserIcon,
  TagIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface FilterOption {
  id: string;
  label: string;
  value?: any;
}

interface FilterSection {
  id: string;
  title: string;
  type: 'date-range' | 'multi-select' | 'single-select' | 'text';
  options?: FilterOption[];
  placeholder?: string;
  value?: any;
  onChange?: (value: any) => void;
}

interface ReportFiltersProps {
  filters: FilterSection[];
  onFiltersChange: (filters: Record<string, any>) => void;
  onReset?: () => void;
  className?: string;
  savedFilters?: Array<{ id: string; name: string; filters: Record<string, any> }>;
  onSaveFilter?: (name: string, filters: Record<string, any>) => void;
  onLoadFilter?: (filterId: string) => void;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  className = '',
  savedFilters = [],
  onSaveFilter,
  onLoadFilter
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentFilters, setCurrentFilters] = useState<Record<string, any>>({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [showSavedFilters, setShowSavedFilters] = useState(false);

  useEffect(() => {
    const initialFilters: Record<string, any> = {};
    filters.forEach(filter => {
      if (filter.value !== undefined) {
        initialFilters[filter.id] = filter.value;
      }
    });
    setCurrentFilters(initialFilters);
  }, [filters]);

  const handleFilterChange = (filterId: string, value: any) => {
    const newFilters = { ...currentFilters, [filterId]: value };
    setCurrentFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    const resetFilters: Record<string, any> = {};
    filters.forEach(filter => {
      if (filter.type === 'date-range') {
        resetFilters[filter.id] = { start: '', end: '' };
      } else if (filter.type === 'multi-select') {
        resetFilters[filter.id] = [];
      } else {
        resetFilters[filter.id] = '';
      }
    });
    setCurrentFilters(resetFilters);
    onFiltersChange(resetFilters);
    onReset?.();
  };

  const handleSaveFilter = () => {
    if (filterName.trim() && onSaveFilter) {
      onSaveFilter(filterName.trim(), currentFilters);
      setFilterName('');
      setShowSaveModal(false);
    }
  };

  const activeFilterCount = useMemo(() => {
    return Object.values(currentFilters).filter(value => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== '' && v !== null && v !== undefined);
      }
      return value !== '' && value !== null && value !== undefined && 
             (Array.isArray(value) ? value.length > 0 : true);
    }).length;
  }, [currentFilters]);

  const renderFilterContent = (filter: FilterSection) => {
    switch (filter.type) {
      case 'date-range':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              placeholder="Start date"
              value={currentFilters[filter.id]?.start || ''}
              onChange={(e) => handleFilterChange(filter.id, { 
                ...currentFilters[filter.id], 
                start: e.target.value 
              })}
              className="px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              placeholder="End date"
              value={currentFilters[filter.id]?.end || ''}
              onChange={(e) => handleFilterChange(filter.id, { 
                ...currentFilters[filter.id], 
                end: e.target.value 
              })}
              className="px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case 'multi-select':
        return (
          <div className="relative">
            <select
              multiple
              value={currentFilters[filter.id] || []}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                handleFilterChange(filter.id, selectedOptions);
              }}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              size={4}
            >
              {filter.options?.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">
              {currentFilters[filter.id]?.length || 0} items selected
            </div>
          </div>
        );

      case 'single-select':
        return (
          <select
            value={currentFilters[filter.id] || ''}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{filter.placeholder || 'Select an option'}</option>
            {filter.options?.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'text':
        return (
          <input
            type="text"
            placeholder={filter.placeholder || 'Enter search term'}
            value={currentFilters[filter.id] || ''}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      default:
        return null;
    }
  };

  const getFilterIcon = (type: string) => {
    switch (type) {
      case 'date-range':
        return CalendarDaysIcon;
      case 'multi-select':
      case 'single-select':
        return FolderIcon;
      case 'text':
        return UserIcon;
      default:
        return TagIcon;
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-zinc-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <FunnelIcon className="w-5 h-5 text-zinc-600" />
          <h3 className="font-semibold text-zinc-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedFilters.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSavedFilters(!showSavedFilters)}
                className="flex items-center gap-1 px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Saved
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              {showSavedFilters && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-zinc-200 rounded-md shadow-lg z-10">
                  {savedFilters.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        onLoadFilter?.(filter.id);
                        setShowSavedFilters(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 first:rounded-t-md last:rounded-b-md"
                    >
                      {filter.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {onSaveFilter && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              Save
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-zinc-100 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-zinc-600 rotate-180" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-zinc-600" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {filters.map(filter => {
            const Icon = getFilterIcon(filter.type);
            return (
              <div key={filter.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-zinc-500" />
                  <label className="text-sm font-medium text-zinc-700">
                    {filter.title}
                  </label>
                </div>
                {renderFilterContent(filter)}
              </div>
            );
          })}
        </div>
      )}

      {/* Save Filter Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Save Filter Set</h3>
            <input
              type="text"
              placeholder="Enter filter name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setFilterName('');
                }}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFilter}
                disabled={!filterName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportFilters;
