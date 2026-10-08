import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface SiteVisitAddVisitTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  isSaving?: boolean;
}

export const SiteVisitAddVisitTypeModal: React.FC<SiteVisitAddVisitTypeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isSaving,
}) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 font-[Inter] animate-in fade-in duration-200"
      style={{ zIndex: 20000 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25 transition-all duration-200"
        onClick={handleClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative bg-card w-full max-w-md rounded-2xl p-6 border border-border shadow-2xl space-y-4 text-card-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Add New Visit Type Category</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create and save a new category for site visits.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="py-2">
          <Label className="text-xs font-semibold mb-2 block uppercase tracking-wide text-muted-foreground">
            Category Name *
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Quality Audit, Safety Drill, HVAC Commissioning"
            className="w-full text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save Category'}
          </Button>
        </div>
      </div>
    </div>
  );
};
