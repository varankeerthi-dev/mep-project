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
    <main
      className="flex-1 bg-zinc-50/50 min-h-screen overflow-y-auto pb-24 sv-content"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="max-w-5xl" style={{ maxWidth: '1000px', padding: '10px' }}>
        {(title || description) && (
          <div className="mb-4 border-b border-zinc-200/80 pb-2">
            {title && (
              <h1 className="font-bold text-zinc-900 tracking-tight" style={{ fontSize: '16px' }}>
                {title}
              </h1>
            )}
            {description && (
              <p className="text-xs text-zinc-500 mt-0.5">
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
