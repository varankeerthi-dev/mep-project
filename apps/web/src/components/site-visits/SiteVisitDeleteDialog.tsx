import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';

export interface SiteVisitDeleteDialogProps {
  visitToDelete: any | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const SiteVisitDeleteDialog: React.FC<SiteVisitDeleteDialogProps> = ({
  visitToDelete,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  return (
    <Dialog open={!!visitToDelete} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Site Visit</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this visit? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
