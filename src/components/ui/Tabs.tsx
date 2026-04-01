import React, { useState, createContext, useContext } from 'react';
import { colors, radii, transitions } from '../../design-system';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab components must be used within Tabs');
  return context;
}

interface TabsProps {
  defaultTab: string;
  children: React.ReactNode;
  onChange?: (value: string) => void;
}

export function Tabs({ defaultTab, children, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  const handleSetActiveTab = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function TabList({ children, style }: TabListProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: colors.gray[100],
        borderRadius: radii.md,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Tab({ value, children, icon }: TabProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;
  
  return (
    <button
      onClick={() => setActiveTab(value)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        fontSize: '14px',
        fontWeight: 500,
        color: isActive ? colors.gray[900] : colors.gray[500],
        background: isActive ? '#ffffff' : 'transparent',
        border: 'none',
        borderRadius: radii.DEFAULT,
        cursor: 'pointer',
        transition: transitions.DEFAULT,
        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
}

export function TabPanel({ value, children }: TabPanelProps) {
  const { activeTab } = useTabs();
  
  if (activeTab !== value) return null;
  
  return (
    <div
      style={{
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  );
}
