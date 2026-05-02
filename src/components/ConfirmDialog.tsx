import { ReactNode } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  options: string[];
  onConfirm: (selectedOption: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  options,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={onCancel}
      style={{ zIndex: 9999 }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '450px' }}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{message}</p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '20px'
            }}
          >
            {options.map((option) => (
              <button
                key={option}
                onClick={() => onConfirm(option)}
                className="btn btn-secondary"
                style={{
                  textAlign: 'left',
                  padding: '10px 16px',
                  justifyContent: 'flex-start'
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple confirm dialog with Yes/No options
 */
export function showConfirmDialog({
  title,
  message,
  onYes,
  onNo,
  onCancel
}: {
  title: string;
  message: string | ReactNode;
  onYes: () => void;
  onNo?: () => void;
  onCancel?: () => void;
}) {
  // This is a utility function to be used with state
  // Usage pattern:
  // const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, ... })
  // setConfirmDialog({ isOpen: true, title, message, onYes, onNo })
  
  return {
    isOpen: true,
    title,
    message,
    options: ['Yes', 'No'],
    onConfirm: (selected: string) => {
      if (selected === 'Yes') {
        onYes();
      } else if (selected === 'No' && onNo) {
        onNo();
      } else if (onCancel) {
        onCancel();
      }
    }
  };
}
