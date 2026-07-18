import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';

interface ExcelEditorDialogProps {
  open: boolean;
  onClose: () => void;
  // Props will be added during component extraction
}

/**
 * Excel Editor Dialog - inline editing of materials in a spreadsheet-like view.
 * Currently a shell. Full implementation uses ExcelEditor from components/ExcelEditor.
 */
export function ExcelEditorDialog({ open, onClose }: ExcelEditorDialogProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Excel Editor"
      size="full"
      footer={
        <Button variant="secondary" onClick={onClose} className="text-xs">Close</Button>
      }
    >
      <div className="p-4 text-sm text-zinc-400">
        Excel editor component will be rendered here.
      </div>
    </Modal>
  );
}
