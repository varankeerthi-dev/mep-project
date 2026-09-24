import React from 'react';
import { 
  Clock, 
  Calendar, 
  Users, 
  Factory, 
  ArrowRight, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface DashboardComingSoonProps {
  tabKey: 'followups' | 'crm' | 'upcoming-production';
  onNavigate?: (path: string) => void;
  onGoHome?: () => void;
}

const MODULE_CONFIGS = {
  followups: {
    title: 'Enterprise Follow-ups & Reminders',
    badge: 'Under Active Development',
    description: 'Track client communication cadence, automated payment reminders, inspection alerts, and critical approval deadlines from a unified high-velocity queue.',
    icon: Calendar,
    accentColor: '#3B82F6',
    accentBg: '#EFF6FF',
    primaryPath: '/follow-up',
    features: [
      'Multi-channel WhatsApp & Email automated follow-ups',
      'Configurable SLA escalation matrices',
      'Client response sentiment tracking & activity logs',
      'Direct sync with Receivables & Quotation pipelines',
    ]
  },
  crm: {
    title: 'Customer Relationship Management (CRM)',
    badge: 'Preview Mode',
    description: 'Manage client accounts, architectural firm directories, procurement leads, win/loss conversion metrics, and multi-stakeholder project relationships.',
    icon: Users,
    accentColor: '#8B5CF6',
    accentBg: '#F5F3FF',
    primaryPath: '/crm',
    features: [
      '360° Client portfolio & financial exposure tracking',
      'Lead scoring & tender bid conversion analytics',
      'Architect, consultant & contractor relationship maps',
      'Automated rate-contract renewals & quotation linkage',
    ]
  },
  'upcoming-production': {
    title: 'Upcoming Production & Site Work Orders',
    badge: 'Scheduled for Next Release',
    description: 'Orchestrate shop-floor manufacturing, ducting fabrication queues, MEP equipment dispatch schedules, and site installation work packages in real time.',
    icon: Factory,
    accentColor: '#10B981',
    accentBg: '#ECFDF5',
    primaryPath: '/operations',
    features: [
      'Machine allocation & CNC cutting queue optimization',
      'Fabrication milestone progress & quality clearance logs',
      'Material requisition & delivery challan auto-dispatch',
      'Site readiness sync with milestone completion tracking',
    ]
  }
};

export function DashboardComingSoon({ tabKey, onNavigate, onGoHome }: DashboardComingSoonProps) {
  const config = MODULE_CONFIGS[tabKey] || MODULE_CONFIGS.followups;
  const IconComponent = config.icon;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      width: '100%',
      animation: 'staggerFadeIn 0.35s ease 0ms both'
    }}>
      {/* Hero Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #ECECEC',
        borderRadius: '16px',
        padding: '36px 32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '18px',
          maxWidth: '720px'
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: '999px',
            backgroundColor: config.accentBg,
            border: `1px solid ${config.accentColor}25`
          }}>
            <Sparkles size={13} style={{ color: config.accentColor }} />
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: config.accentColor,
              letterSpacing: '0.01em'
            }}>
              {config.badge}
            </span>
          </div>

          {/* Title & Icon Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: config.accentBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: config.accentColor
            }}>
              <IconComponent size={24} />
            </div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#111827',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              {config.title}
            </h2>
          </div>

          {/* Description */}
          <p style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#4B5563',
            margin: 0
          }}>
            {config.description}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            {onNavigate && (
              <button
                onClick={() => onNavigate(config.primaryPath)}
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#111827',
                  color: '#FFFFFF',
                  border: 'none',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'background-color 150ms ease'
                }}
                className="hover:bg-zinc-800"
              >
                Open Existing Module <ArrowRight size={14} />
              </button>
            )}

            {onGoHome && (
              <button
                onClick={onGoHome}
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  border: '1px solid #E5E7EB',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 150ms ease'
                }}
                className="hover:bg-zinc-50"
              >
                Back to Dashboard Home
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature Breakdown Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {config.features.map((feature, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #ECECEC',
              borderRadius: '12px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              backgroundColor: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1px',
              flexShrink: 0
            }}>
              <ChevronRight size={13} style={{ color: '#6B7280' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                Key Capability {idx + 1}
              </span>
              <span style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.4' }}>
                {feature}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
