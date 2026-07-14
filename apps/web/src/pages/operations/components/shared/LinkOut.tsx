import React from 'react';
import { Link } from 'react-router-dom';

interface LinkOutProps {
  to: string;
  label: string;
  className?: string;
}

export const LinkOut: React.FC<LinkOutProps> = ({ to, label, className = '' }) => {
  return (
    <Link 
      to={to} 
      className={`text-[11.5px] text-[var(--brand)] font-medium no-underline hover:underline ${className}`}
    >
      {label}
    </Link>
  );
};
