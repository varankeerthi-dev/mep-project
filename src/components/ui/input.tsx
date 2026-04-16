import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, style, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full px-3 py-2 text-sm text-slate-900 bg-white border rounded-lg outline-none transition-all duration-200",
              "placeholder:text-slate-400",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
              error 
                ? "border-red-500 focus:border-red-500 focus:ring-red-100" 
                : "border-slate-300 hover:border-slate-400",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            style={style}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-1.5">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-slate-500 mt-1.5">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, style, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-sm text-slate-900 bg-white border rounded-lg outline-none transition-all duration-200",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
            error 
              ? "border-red-500 focus:border-red-500 focus:ring-red-100" 
              : "border-slate-300 hover:border-slate-400",
            "cursor-pointer",
            className
          )}
          style={{ 
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            paddingRight: '36px',
            ...style 
          }}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-red-500 mt-1.5">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className, style, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-3 py-2 text-sm text-slate-900 bg-white border rounded-lg outline-none transition-all duration-200",
            "placeholder:text-slate-400 resize-y min-h-[80px]",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
            error 
              ? "border-red-500 focus:border-red-500 focus:ring-red-100" 
              : "border-slate-300 hover:border-slate-400",
            className
          )}
          style={style}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 mt-1.5">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-slate-500 mt-1.5">{hint}</p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
