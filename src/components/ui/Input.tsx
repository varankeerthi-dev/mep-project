import React, { forwardRef } from 'react';
import { colors, radii, shadows, transitions } from '../../design-system';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, style, ...props }, ref) => {
    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: colors.gray[700],
              marginBottom: '6px',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          {leftIcon && (
            <div
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.gray[400],
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            style={{
              width: '100%',
              padding: leftIcon ? '10px 12px 10px 40px' : rightIcon ? '10px 40px 10px 12px' : '10px 12px',
              fontSize: '14px',
              lineHeight: '20px',
              color: colors.gray[900],
              background: '#ffffff',
              border: `1px solid ${error ? colors.error.DEFAULT : colors.gray[300]}`,
              borderRadius: radii.md,
              outline: 'none',
              transition: transitions.DEFAULT,
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = error ? colors.error.DEFAULT : colors.primary[500];
              e.currentTarget.style.boxShadow = error 
                ? `0 0 0 3px ${colors.error.light}` 
                : `0 0 0 3px ${colors.primary[100]}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error ? colors.error.DEFAULT : colors.gray[300];
              e.currentTarget.style.boxShadow = 'none';
            }}
            {...props}
          />
          {rightIcon && (
            <div
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.gray[400],
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p style={{ fontSize: '12px', color: colors.error.DEFAULT, margin: '6px 0 0' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p style={{ fontSize: '12px', color: colors.gray[500], margin: '6px 0 0' }}>
            {hint}
          </p>
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
  ({ label, error, options, style, ...props }, ref) => {
    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: colors.gray[700],
              marginBottom: '6px',
            }}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          style={{
            width: '100%',
            padding: '10px 36px 10px 12px',
            fontSize: '14px',
            lineHeight: '20px',
            color: colors.gray[900],
            background: '#ffffff',
            border: `1px solid ${error ? colors.error.DEFAULT : colors.gray[300]}`,
            borderRadius: radii.md,
            outline: 'none',
            transition: transitions.DEFAULT,
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(colors.gray[500])}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            cursor: 'pointer',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? colors.error.DEFAULT : colors.primary[500];
            e.currentTarget.style.boxShadow = error 
              ? `0 0 0 3px ${colors.error.light}` 
              : `0 0 0 3px ${colors.primary[100]}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? colors.error.DEFAULT : colors.gray[300];
            e.currentTarget.style.boxShadow = 'none';
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
          <p style={{ fontSize: '12px', color: colors.error.DEFAULT, margin: '6px 0 0' }}>
            {error}
          </p>
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
  ({ label, error, hint, style, ...props }, ref) => {
    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: colors.gray[700],
              marginBottom: '6px',
            }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            lineHeight: '20px',
            color: colors.gray[900],
            background: '#ffffff',
            border: `1px solid ${error ? colors.error.DEFAULT : colors.gray[300]}`,
            borderRadius: radii.md,
            outline: 'none',
            transition: transitions.DEFAULT,
            resize: 'vertical',
            minHeight: '80px',
            fontFamily: 'inherit',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? colors.error.DEFAULT : colors.primary[500];
            e.currentTarget.style.boxShadow = error 
              ? `0 0 0 3px ${colors.error.light}` 
              : `0 0 0 3px ${colors.primary[100]}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? colors.error.DEFAULT : colors.gray[300];
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
        />
        {error && (
          <p style={{ fontSize: '12px', color: colors.error.DEFAULT, margin: '6px 0 0' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p style={{ fontSize: '12px', color: colors.gray[500], margin: '6px 0 0' }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
