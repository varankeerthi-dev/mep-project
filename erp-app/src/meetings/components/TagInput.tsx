import { useState, useRef, KeyboardEvent, memo } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export const TagInput = memo(function TagInput({
  tags,
  onChange,
  placeholder = 'Add tag...',
  maxTags = 10,
}: TagInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };
  
  const addTag = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
      setInput('');
    }
  };
  
  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };
  
  return (
    <div
      className="flex flex-wrap items-center gap-2 p-3 border border-slate-200 rounded-lg bg-white min-h-[42px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(index);
            }}
            className="hover:bg-blue-200 rounded-full p-0.5"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {tags.length < maxTags && (
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ''}
        />
      )}
    </div>
  );
});

export default TagInput;