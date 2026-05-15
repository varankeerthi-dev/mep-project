import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

type InlineDescriptionCellProps = {
  materialName: string;
  description: string | null | undefined;
  onSave: (description: string) => void;
};

export const InlineDescriptionCell: React.FC<InlineDescriptionCellProps> = ({
  materialName,
  description,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(description || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    onSave(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(description || '');
    setIsEditing(false);
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 60) + 'px';
    }
  };

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onInput={handleTextareaInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="Enter description..."
          style={{
            width: '100%',
            padding: '4px 6px',
            border: '1px solid #3b82f6',
            borderRadius: '4px',
            fontSize: '11px',
            lineHeight: '1.4',
            resize: 'none',
            outline: 'none',
            background: '#fff',
            color: '#171717',
            minHeight: '24px',
            maxHeight: '60px',
            overflow: 'auto',
          }}
        />
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 6px',
              border: '1px solid #d4d4d4',
              borderRadius: '3px',
              background: '#fff',
              fontSize: '10px',
              color: '#525252',
              cursor: 'pointer',
            }}
          >
            <X size={10} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 6px',
              border: 'none',
              borderRadius: '3px',
              background: draft.trim() ? '#059669' : '#d4d4d4',
              fontSize: '10px',
              color: '#fff',
              cursor: draft.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={10} /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'relative' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#171717', lineHeight: '1.3' }}>
        {materialName || '—'}
      </div>
      {description ? (
        <div
          onClick={() => setIsEditing(true)}
          style={{
            fontSize: '11px',
            color: '#737373',
            lineHeight: '1.3',
            cursor: 'pointer',
            paddingRight: '16px',
            position: 'relative',
            wordBreak: 'break-word',
          }}
        >
          {description}
          <span
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            style={{
              position: 'absolute',
              right: '0',
              top: '0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              height: '14px',
              borderRadius: '2px',
              color: '#a3a3a3',
              cursor: 'pointer',
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
            className="desc-edit-icon"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
              (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <Pencil size={10} />
          </span>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          style={{
            fontSize: '11px',
            color: '#a3a3a3',
            cursor: 'pointer',
            fontStyle: 'italic',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#a3a3a3'; }}
        >
          Add description...
        </div>
      )}
    </div>
  );
};
