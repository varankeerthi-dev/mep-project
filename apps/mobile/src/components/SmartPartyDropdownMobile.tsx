import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { PartySearchResult } from '../types/party';

interface SmartPartyDropdownMobileProps {
  value: string;
  onChange?: (party: PartySearchResult) => void;
  organisationId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SmartPartyDropdownMobile({
  value,
  placeholder = 'Select party...',
  disabled = false,
}: SmartPartyDropdownMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-300 bg-white text-left text-sm"
      >
        <span className={value ? 'text-slate-900 font-medium' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <Search size={16} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-2xl max-h-[85vh] flex flex-col p-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Select Party</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative my-3">
              <input
                type="text"
                placeholder="Search name, GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm border-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px] py-2">
              <div className="p-4 text-center text-slate-500 text-xs">
                Enter name to search unified parties.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl text-center text-sm mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
