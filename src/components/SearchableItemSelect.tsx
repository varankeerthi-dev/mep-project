import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

type Material = {
  id: string;
  display_name?: string;
  name?: string;
  item_code?: string;
  [key: string]: any;
};

type SearchableItemSelectProps = {
  value: string;
  materials: Material[];
  onChange: (materialId: string, material: Material) => void;
  placeholder?: string;
};

export const SearchableItemSelect: React.FC<SearchableItemSelectProps> = ({
  value,
  materials,
  onChange,
  placeholder = 'Select Item',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => materials.find((m) => m.id === value),
    [materials, value],
  );

  const filtered = useMemo(
    () =>
      search
        ? materials.filter(
            (m) =>
              (m.display_name || m.name || '')
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              (m.item_code || '').toLowerCase().includes(search.toLowerCase()),
          )
        : materials,
    [materials, search],
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = useCallback((material: Material) => {
    onChange(material.id, material);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      setDropdownStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #d4d4d4',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxHeight: '280px',
        display: 'flex',
        flexDirection: 'column',
      });
    }
    setIsOpen(true);
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        style={{
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          color: selected ? '#1e293b' : '#94a3b8',
          background: '#fff',
          border: '1px solid transparent',
          borderRadius: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '28px',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected ? selected.display_name || selected.name : placeholder}
        </span>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          style={dropdownStyle}
        >
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            style={{
              width: '100%',
              padding: '8px',
              border: 'none',
              borderBottom: '1px solid #e5e7eb',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '230px',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontStyle: 'italic',
                }}
              >
                No items found
              </div>
            ) : (
              filtered.map((m) => (
                <div
                  key={m.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(m);
                  }}
                  style={{
                    padding: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#1e293b',
                    borderBottom: '1px solid #f1f5f9',
                    background: m.id === value ? '#eff6ff' : '#fff',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (m.id !== value)
                      (e.currentTarget as HTMLElement).style.background =
                        '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (m.id !== value)
                      (e.currentTarget as HTMLElement).style.background = '#fff';
                  }}
                >
                  <div
                    style={{ fontWeight: 500, lineHeight: 1.3 }}
                  >
                    {m.display_name || m.name}
                  </div>
                  {m.item_code && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#94a3b8',
                        marginTop: '2px',
                      }}
                    >
                      {m.item_code}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
