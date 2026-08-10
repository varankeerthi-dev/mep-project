import React from 'react';

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className = '', style }) => {
  return (
    <div
      className={`card-body-left-pad ${className}`}
      style={{
        paddingLeft: '12px',
        paddingRight: '16px',
        paddingTop: '16px',
        paddingBottom: '16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default CardBody;
