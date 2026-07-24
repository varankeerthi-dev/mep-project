import React from 'react';

export interface SettingsContentProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({
  children,
  title,
  description,
}) => {
  return (
    <main className="flex-1 bg-zinc-50/50 min-h-screen overflow-y-auto pb-24">
      <div className="max-w-4xl mx-auto px-12 py-8" style={{ maxWidth: '1000px', padding: '32px 48px' }}>
        {(title || description) && (
          <div className="mb-8 border-b border-zinc-200/80 pb-4">
            {title && (
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-xs text-zinc-500 mt-1">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </main>
  );
};
