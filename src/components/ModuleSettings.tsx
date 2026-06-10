import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, FolderKanban, Users, FileText, Receipt, FileCheck,
  FileMinus, Truck, ShoppingCart, Package, ClipboardList, ArrowLeftRight,
  ShoppingBag, HardHat, Calendar, MapPin, Clipboard, CheckCircle, Bell,
  Wrench, TableProperties, Factory, BarChart3, BookOpen, Clock,
  Save, RotateCcw, Search, Settings, Power, PowerOff, ChevronDown,
  Sparkles, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrgModules, useSaveOrgModules, type OrgModuleState } from '../hooks/useOrgModules';
import { MODULE_REGISTRY, MODULE_CATEGORIES, type ModuleDefinition } from '../config/module-registry';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, FolderKanban, Users, FileText, Receipt, FileCheck,
  FileMinus, Truck, ShoppingCart, Package, ClipboardList, ArrowLeftRight,
  ShoppingBag, HardHat, Calendar, MapPin, Clipboard, CheckCircle, Bell,
  Wrench, TableProperties, Factory, BarChart3, BookOpen, Clock,
};

const categoryColors: Record<string, { bg: string; border: string; text: string; dot: string; glow: string }> = {
  core: { bg: '#fafafa', border: '#e5e5e5', text: '#171717', dot: '#171717', glow: 'rgba(23,23,23,0.06)' },
  sales: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', dot: '#3b82f6', glow: 'rgba(59,130,246,0.08)' },
  procurement: { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', dot: '#7c3aed', glow: 'rgba(124,58,237,0.08)' },
  inventory: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#059669', glow: 'rgba(5,150,105,0.08)' },
  projects: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#d97706', glow: 'rgba(217,119,6,0.08)' },
  hr: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#dc2626', glow: 'rgba(220,38,38,0.08)' },
  reports: { bg: '#ecfeff', border: '#a5f3fc', text: '#155e75', dot: '#0891b2', glow: 'rgba(8,145,178,0.08)' },
};

function ModuleCard({
  module,
  enabled,
  onToggle,
  index,
}: {
  module: ModuleDefinition;
  enabled: boolean;
  onToggle: (id: string) => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const IconComponent = ICON_MAP[module.icon] || Package;
  const catStyle = categoryColors[module.category] || categoryColors.core;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        background: hovered ? '#ffffff' : '#fafafa',
        border: `1px solid ${hovered ? '#d4d4d4' : '#f0f0f0'}`,
        borderRadius: '10px',
        cursor: 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: hovered
          ? `0 4px 24px ${catStyle.glow}, 0 1px 3px rgba(0,0,0,0.04)`
          : '0 1px 2px rgba(0,0,0,0.02)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Category accent line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          background: enabled ? catStyle.dot : '#d4d4d4',
          borderRadius: '3px 0 0 3px',
          transition: 'background 0.3s',
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: enabled ? catStyle.bg : '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.3s',
          border: `1px solid ${enabled ? catStyle.border : '#e5e5e5'}`,
        }}
      >
        <IconComponent
          size={17}
          style={{
            color: enabled ? catStyle.dot : '#a3a3a3',
            transition: 'color 0.3s',
          }}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: enabled ? '#171717' : '#737373',
            transition: 'color 0.2s',
            lineHeight: '17px',
          }}
        >
          {module.label}
        </div>
        <div
          style={{
            fontSize: '11.5px',
            color: '#737373',
            marginTop: '1px',
            lineHeight: '15px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {module.description}
        </div>
      </div>

      {/* Apple iOS Toggle */}
      <div
        style={{
          position: 'relative',
          width: '51px',
          height: '31px',
          borderRadius: '9999px',
          cursor: 'pointer',
          flexShrink: 0,
          background: enabled ? '#34C759' : '#E9E9EA',
          transition: 'background 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
          boxShadow: enabled
            ? 'inset 0 1px 2px rgba(0,0,0,0.1)'
            : 'inset 0 1px 3px rgba(0,0,0,0.08)',
        }}
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(module.id)}
      >
        <motion.span
          initial={false}
          animate={{
            x: enabled ? 22 : 2,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
            mass: 0.8,
          }}
          style={{
            position: 'absolute',
            top: '2px',
            left: 0,
            width: '27px',
            height: '27px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 2px 5px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </motion.div>
  );
}

export default function ModuleSettings() {
  const { organisation } = useAuth();
  const { data: modules, isLoading } = useOrgModules();
  const saveMutation = useSaveOrgModules();
  const [localStates, setLocalStates] = useState<Map<string, boolean>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Initialize local state from server
  useEffect(() => {
    if (modules && !initialized) {
      const map = new Map<string, boolean>();
      for (const m of modules) {
        map.set(m.moduleId, m.enabled);
      }
      setLocalStates(map);
      setInitialized(true);
      // Expand all categories initially
      setExpandedCategory('all');
    }
  }, [modules, initialized]);

  const handleToggle = (moduleId: string) => {
    setLocalStates((prev) => {
      const next = new Map(prev);
      next.set(moduleId, !next.get(moduleId));
      return next;
    });
  };

  const handleEnableAll = () => {
    const next = new Map<string, boolean>();
    for (const m of MODULE_REGISTRY) {
      next.set(m.id, true);
    }
    setLocalStates(next);
  };

  const handleDisableAll = () => {
    const next = new Map<string, boolean>();
    for (const m of MODULE_REGISTRY) {
      next.set(m.id, false);
    }
    setLocalStates(next);
  };

  const hasChanges = useMemo(() => {
    if (!modules) return false;
    for (const m of modules) {
      if (localStates.get(m.moduleId) !== m.enabled) return true;
    }
    return false;
  }, [modules, localStates]);

  const enabledCount = useMemo(() => {
    let count = 0;
    for (const [, v] of localStates) {
      if (v) count++;
    }
    return count;
  }, [localStates]);

  const handleSave = async () => {
    const states: OrgModuleState[] = MODULE_REGISTRY.map((m) => ({
      moduleId: m.id,
      enabled: localStates.get(m.id) ?? true,
    }));

    try {
      await saveMutation.mutateAsync(states);
      toast.success('Module settings saved', {
        description: `${enabledCount} of ${MODULE_REGISTRY.length} modules enabled for ${organisation?.name || 'organisation'}.`,
      });
    } catch (err: any) {
      toast.error('Failed to save module settings', {
        description: err?.message || 'An unexpected error occurred.',
      });
    }
  };

  const filteredModules = useMemo(() => {
    if (!search) return MODULE_REGISTRY;
    const q = search.toLowerCase();
    return MODULE_REGISTRY.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [search]);

  const groupedModules = useMemo(() => {
    const groups: Record<string, ModuleDefinition[]> = {};
    for (const m of filteredModules) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    return groups;
  }, [filteredModules]);

  const categoryOrder = ['core', 'sales', 'procurement', 'inventory', 'projects', 'reports'];

  if (isLoading || !initialized) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{
          width: '32px', height: '32px', border: '3px solid #e5e5e5',
          borderTopColor: '#171717', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '13px', color: '#737373' }}>Loading modules...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%' }} data-tour-anchor="module-settings">
      {/* Header Section */}
      <div style={{ padding: '24px 40px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Settings size={18} color="#fff" />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0, letterSpacing: '-0.02em' }}>
                Module Settings
              </h2>
            </div>
            <p style={{ fontSize: '12.5px', color: '#525252', margin: 0, lineHeight: '18px', maxWidth: '520px' }}>
              Enable or disable modules for <strong style={{ color: '#171717' }}>{organisation?.name || 'your organisation'}</strong>.
              Disabled modules are hidden from all users. New modules are automatically available here.
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              background: '#f5f5f5', border: '1px solid #e5e5e5',
              fontSize: '12.5px', color: '#525252', fontWeight: 500,
            }}>
              <Power size={13} style={{ color: '#22c55e' }} />
              <span>{enabledCount} active</span>
              <span style={{ color: '#d4d4d4' }}>·</span>
              <span>{MODULE_REGISTRY.length - enabledCount} disabled</span>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '10px',
          background: '#fff', border: '1px solid #e5e5e5',
        }}>
          {/* Search */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0 12px', height: '32px', borderRadius: '8px',
            background: '#fafafa', border: '1px solid #f0f0f0',
          }}>
            <Search size={14} style={{ color: '#a3a3a3', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search modules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: '12.5px', color: '#171717', width: '100%',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />
          </div>

          {/* Quick actions */}
          <button
            onClick={handleEnableAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '0 12px', height: '32px', borderRadius: '8px',
              border: '1px solid #e5e5e5', background: '#fff',
              fontSize: '12px', fontWeight: 500, color: '#171717',
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#d4d4d4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e5e5'; }}
          >
            <Sparkles size={13} />
            Enable All
          </button>
          <button
            onClick={handleDisableAll}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '0 12px', height: '32px', borderRadius: '8px',
              border: '1px solid #e5e5e5', background: '#fff',
              fontSize: '12px', fontWeight: 500, color: '#737373',
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#d4d4d4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e5e5'; }}
          >
            <PowerOff size={13} />
            Disable All
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e5e5e5' }} />

          {/* Save */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0 18px', height: '32px', borderRadius: '8px',
              border: 'none',
              background: hasChanges ? '#171717' : '#e5e5e5',
              color: hasChanges ? '#fff' : '#a3a3a3',
              fontSize: '12.5px', fontWeight: 600,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {saveMutation.isPending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}
              />
            ) : (
              <Save size={14} />
            )}
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </motion.button>
        </div>
      </div>

      {/* Module Grid */}
      <div style={{ padding: '0 40px 24px' }}>
        <AnimatePresence mode="wait">
          {filteredModules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: 'center', padding: '60px 20px',
                color: '#737373', fontSize: '14px',
              }}
            >
              <Search size={32} style={{ color: '#d4d4d4', marginBottom: '12px' }} />
              <p>No modules match "{search}"</p>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {categoryOrder
                .filter((cat) => groupedModules[cat]?.length)
                .map((cat) => {
                  const mods = groupedModules[cat];
                  const catInfo = MODULE_CATEGORIES[cat];
                  const catStyle = categoryColors[cat];
                  const expanded = expandedCategory === 'all' || expandedCategory === cat;
                  const catEnabledCount = mods.filter((m) => localStates.get(m.id)).length;

                  return (
                    <motion.div
                      key={cat}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Category Header */}
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          width: '100%', padding: '8px 14px', marginBottom: '6px',
                          border: 'none', borderRadius: '8px',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: catStyle.dot, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#171717', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {catInfo?.label || cat}
                        </span>
                        <span style={{
                          fontSize: '11.5px', fontWeight: 500, color: '#737373',
                          padding: '2px 8px', borderRadius: '10px',
                          background: '#f5f5f5',
                        }}>
                          {catEnabledCount}/{mods.length}
                        </span>
                        <motion.div
                          animate={{ rotate: expanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ marginLeft: 'auto' }}
                        >
                          <ChevronDown size={14} style={{ color: '#a3a3a3' }} />
                        </motion.div>
                      </button>

                      {/* Module Cards */}
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: '8px',
                            }}>
                              {mods.map((mod, i) => (
                                <ModuleCard
                                  key={mod.id}
                                  module={mod}
                                  enabled={localStates.get(mod.id) ?? true}
                                  onToggle={handleToggle}
                                  index={i}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* RBAC Note */}
      <div style={{
        margin: '0 40px 24px', padding: '14px 18px', borderRadius: '10px',
        background: '#f0f9ff', border: '1px solid #bae6fd',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
      }}>
        <ShieldCheck size={18} style={{ color: '#0284c7', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#0c4a6e', margin: '0 0 2px 0' }}>
            Role-Based Access Control
          </p>
          <p style={{ fontSize: '12.5px', color: '#075985', margin: 0, lineHeight: '18px' }}>
            Enabling a module makes it visible to your organisation. Individual user access is then
            controlled through the <strong>Access Control</strong> settings based on their role and permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
