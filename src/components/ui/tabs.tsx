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
  defaultValue?: string;
  defaultTab?: string; // Backward compatibility
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: (value: string) => void; // Backward compatibility
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Tabs({ defaultValue, defaultTab, value, onValueChange, onChange, children, className, style }: TabsProps) {
  const initialValue = value || defaultValue || defaultTab || '';
  const [internalValue, setInternalValue] = useState(initialValue);
  
  const activeTab = value !== undefined ? value : internalValue;
  
  const setActiveTab = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    onChange?.(newValue);
  };
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className} style={style}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TabsList({ children, className, style }: TabsListProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.gray[100],
        padding: '4px',
        color: colors.gray[500],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function TabsTrigger({ value, children, className, style, disabled }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        borderRadius: radii.sm,
        padding: '6px 12px',
        fontSize: '14px',
        fontWeight: 500,
        transition: transitions.DEFAULT,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: isActive ? '#ffffff' : 'transparent',
        color: isActive ? colors.gray[900] : colors.gray[500],
        boxShadow: isActive ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
        border: 'none',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TabsContent({ value, children, className, style }: TabsContentProps) {
  const { activeTab } = useTabs();
  
  if (activeTab !== value) return null;
  
  return (
    <div
      role="tabpanel"
      className={className}
      style={{
        marginTop: '8px',
        animation: 'tabs-fade-in 150ms ease-out',
        ...style,
      }}
    >
      <style>{`
        @keyframes tabs-fade-in {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  );
}

// Keep old names for backward compatibility
export const TabList = TabsList;
export const Tab = TabsTrigger;
export const TabPanel = TabsContent;
