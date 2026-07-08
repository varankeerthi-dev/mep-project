import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface BottomSheetPickerProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const BottomSheetPicker: React.FC<BottomSheetPickerProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.name.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-primary transition-all text-left"
      >
        <span className={selectedOption ? 'text-foreground font-medium' : 'text-muted-foreground'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Sheet & Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]"
            />

            {/* Bottom Sheet Container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.8 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) {
                  handleClose();
                }
              }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-card border-t border-border rounded-t-2xl shadow-xl flex flex-col max-w-lg mx-auto pb-safe touch-none"
            >
              {/* Drag handle / Indicator */}
              <div className="flex justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-muted rounded-full opacity-60" />
              </div>

              {/* Header */}
              <div className="px-5 pb-3 flex justify-between items-center border-b border-border/40 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{label}</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Drag down or tap backdrop to close</p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search Box (Always rendered, focuses automatically) */}
              <div className="p-4 border-b border-border/40 shrink-0">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-9 pr-4 h-10 rounded-xl border border-input bg-muted/30 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options List */}
              <div 
                className="flex-1 overflow-y-auto px-3 py-3 min-h-[150px] scrollbar-thin"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(156, 163, 175, 0.4) transparent',
                }}
              >
                {filteredOptions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No options found.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredOptions.map((opt) => {
                      const isSelected = opt.id === value;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelect(opt.id)}
                          className={`w-full px-4 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all active:bg-secondary ${
                            isSelected
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-foreground hover:bg-muted/50 border border-transparent'
                          }`}
                        >
                          <span>{opt.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
