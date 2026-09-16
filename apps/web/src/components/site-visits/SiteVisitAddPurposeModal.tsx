import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface SiteVisitAddPurposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  isSaving?: boolean;
}

export const SiteVisitAddPurposeModal: React.FC<SiteVisitAddPurposeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isSaving,
}) => {
  const [name, setName] = useState('');

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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Purpose</DialogTitle>
          <DialogDescription>
            Create a new purpose for site visits.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label className="text-xs font-semibold mb-2 block uppercase tracking-wide">Purpose Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Site Audit, Quality Check"
            className="w-full"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="bg-black hover:bg-black/90 text-white"
          >
            {isSaving ? 'Saving...' : 'Save Purpose'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
