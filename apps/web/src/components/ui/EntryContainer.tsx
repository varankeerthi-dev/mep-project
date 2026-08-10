import React from 'react';

export interface EntryContainerProps {
  label: string;
  htmlFor?: string;
  helperText?: string;
  errorText?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const EntryContainer: React.FC<EntryContainerProps> = ({
  label,
  htmlFor,
  helperText,
  errorText,
  children,
  className = '',
  icon,
  style,
}) => {
  return (
    <div
      className={`p-3 bg-white/15 backdrop-blur-md border border-[hsla(210,10%,85%,0.3)] shadow-[0_4px_12px_hsla(0,0%,0%,0.08)] transition-all duration-200 hover:shadow-[0_6px_14px_hsla(0,0%,0%,0.12)] ${className}`}
      style={{
        padding: '12px',
        borderRadius: '5px', // Entry field container radius 5px
        ...style,
      }}
    >
      <label
        htmlFor={htmlFor}
        className="block text-[14px] font-medium text-[hsla(210,12%,30%,1)] text-left"
        style={{ marginBottom: '8px' }} // Spacing between label and entry field container
      >
        {label}
      </label>
      <div className="relative flex items-center" style={{ gap: '8px' }}>
        {icon && <span className="text-slate-400">{icon}</span>}
        {children}
      </div>
      {errorText ? (
        <p className="mt-1 text-[12px] text-[hsla(10,70%,50%,1)]">{errorText}</p>
      ) : helperText ? (
        <p className="mt-1 text-[12px] text-[hsla(210,12%,50%,1)]">{helperText}</p>
      ) : null}
    </div>
  );
};

export default EntryContainer;
