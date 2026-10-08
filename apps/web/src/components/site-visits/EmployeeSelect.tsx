import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface EmployeeItem {
  id: string;
  name: string;
  designation?: string | null;
  employee_code?: string | null;
  [key: string]: any;
}

export interface EmployeeSelectProps {
  value: string;
  onChange: (value: string, employee?: EmployeeItem) => void;
  employees: EmployeeItem[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const EmployeeSelect: React.FC<EmployeeSelectProps> = ({
  value,
  onChange,
  employees,
  placeholder = 'Select engineer / assigned to...',
  className = '',
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  const selectedEmployee = useMemo(() => {
    if (!value) return null;
    return employees.find(
      (e) => e.name?.trim().toLowerCase() === value.trim().toLowerCase() || e.id === value
    );
  }, [employees, value]);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchName = e.name?.toLowerCase().includes(q);
      const matchDesig = e.designation?.toLowerCase().includes(q);
      const matchCode = e.employee_code?.toLowerCase().includes(q);
      return matchName || matchDesig || matchCode;
    });
  }, [employees, search]);

  const handleSelect = (emp: EmployeeItem) => {
    onChange(emp.name, emp);
    setOpen(false);
  };

  const handleCustomSelect = () => {
    if (search.trim()) {
      onChange(search.trim());
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const selectedSubtitle = selectedEmployee
    ? [selectedEmployee.designation, selectedEmployee.employee_code].filter(Boolean).join(' • ')
    : '';

  return (
    <div ref={containerRef} className={`relative ${className}`} style={style}>
      {/* Trigger */}
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2 overflow-hidden mr-1">
          {value ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-medium text-foreground truncate">{value}</span>
              {selectedSubtitle && (
                <span className="text-xs text-muted-foreground/60 truncate font-normal">
                  ({selectedSubtitle})
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-foreground cursor-pointer rounded transition-colors"
              title="Clear"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-[10000] mt-1.5 max-h-64 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg flex flex-col animate-in fade-in-0 zoom-in-95">
          {/* Search Header */}
          <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 bg-muted/20">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee by name, designation, code..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-52 p-1 space-y-0.5">
            {filteredEmployees.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                No matching employees
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected =
                  value &&
                  (value.toLowerCase() === emp.name?.toLowerCase() || value === emp.id);
                const subtitle = [emp.designation, emp.employee_code]
                  .filter(Boolean)
                  .join(' • ');

                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelect(emp)}
                    className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate font-medium">{emp.name}</span>
                      {subtitle && (
                        <span className="text-[11px] text-muted-foreground/60 font-normal truncate mt-0.5">
                          {subtitle}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="shrink-0 text-primary" />}
                  </div>
                );
              })
            )}

            {/* Free-form option if search doesn't match an employee */}
            {search.trim() &&
              !filteredEmployees.some(
                (e) => e.name?.toLowerCase() === search.trim().toLowerCase()
              ) && (
                <div
                  onClick={handleCustomSelect}
                  className="flex items-center gap-1.5 border-t border-border/40 mt-1 pt-1.5 px-2.5 py-1.5 text-xs text-primary font-semibold cursor-pointer hover:bg-accent rounded"
                >
                  <span>+ Use &ldquo;{search.trim()}&rdquo;</span>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
