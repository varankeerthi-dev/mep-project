import { useState } from 'react';
import { LeadCaptureModal } from '@/components/leads/lead-capture-modal';

interface LeadCreateFormProps {
  onClose: () => void;
  onCreated: () => void;
}

export const LeadCreateForm: React.FC<LeadCreateFormProps> = ({ onClose, onCreated }) => {
  const [open, setOpen] = useState(true);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) onClose();
  };

  return (
    <LeadCaptureModal
      open={open}
      onOpenChange={handleOpenChange}
      mode="full"
    />
  );
};

export default LeadCreateForm;
