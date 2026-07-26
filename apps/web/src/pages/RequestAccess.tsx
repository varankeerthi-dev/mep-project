import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Factory, 
  Boxes, 
  Wrench, 
  Briefcase, 
  Pill,
  Smartphone,
  ShoppingCart,
  LayoutGrid,
  Loader2, 
  LogOut, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  LifeBuoy,
  ArrowLeft,
  Users,
  Sparkles,
  Check
} from 'lucide-react';
import { useCreateAccessRequest, useMyAccessRequests, usePublicOrganisations } from '@/rbac';
import { signOut } from '@/supabase';

type Props = {
  user: User;
  onCreateOrganisation: (
    name: string,
    options?: {
      organisationTypes?: string[];
      manufacturingEnabled?: boolean;
      onboardingCompleted?: boolean;
    }
  ) => Promise<void>;
  onRefreshMemberships: () => Promise<void>;
};

export type SectorDef = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  icon: any;
  description: string;
  features: string[];
  manufacturingEnabled: boolean;
  defaultName: string;
};

export const SECTORS: SectorDef[] = [
  {
    id: 'engineering_projects',
    name: 'Engineering & Projects',
    subtitle: '(MEP, Civil, Contracting)',
    category: 'project',
    icon: Building2,
    description: 'BOQ estimates, site visit logs, sub-contractors & milestone claims',
    features: ['BOQ Estimates', 'Site Visit Logs', 'Subcontractors', 'Milestones'],
    manufacturingEnabled: false,
    defaultName: 'Apex Engineering & Contracting'
  },
  {
    id: 'trading',
    name: 'Trading',
    subtitle: '(Billing, Warehouse, Inventory, Quotation, Follow-ups)',
    category: 'trading',
    icon: Boxes,
    description: 'Quotations, purchase orders, warehouse stock, delivery challans & client ledgers',
    features: ['Billing & Invoicing', 'Warehouse Stock', 'Quotations', 'Follow-up Centre'],
    manufacturingEnabled: false,
    defaultName: 'Global Trading & Distribution'
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing & Production',
    subtitle: '(BOM, Assembly, Work Orders)',
    category: 'manufacturing',
    icon: Factory,
    description: 'Raw materials, Bill of Materials (BOM recipes), work orders & production runs',
    features: ['BOM Recipes', 'Work Orders', 'Raw Stock'],
    manufacturingEnabled: true,
    defaultName: 'Precision Manufacturing Corp'
  },
  {
    id: 'service',
    name: 'Service & Field Operations',
    subtitle: '(Tickets, Maintenance, AMC)',
    category: 'service',
    icon: Wrench,
    description: 'Service tickets, AMC contracts, technician dispatch & equipment maintenance',
    features: ['Service Tickets', 'AMC Contracts', 'Technician Dispatch'],
    manufacturingEnabled: false,
    defaultName: 'ProTech Field Service'
  },
  {
    id: 'commercial',
    name: 'Commercial & Sales',
    subtitle: '(CRM, Leads, Billing)',
    category: 'sales',
    icon: Briefcase,
    description: 'CRM lead pipelines, client quotations, invoicing & financial reports',
    features: ['CRM Leads', 'Client Invoices', 'Account Ledgers', 'Reports'],
    manufacturingEnabled: false,
    defaultName: 'Enterprise Sales Suite'
  }
];

export default function RequestAccessPage({ user, onCreateOrganisation, onRefreshMemberships }: Props) {
  const [currentStep, setCurrentStep] = useState<number>(2);
  const [selectedSectorId, setSelectedSectorId] = useState<string>('trading');
  const [companyName, setCompanyName] = useState<string>(SECTORS[1].defaultName);
  const [loadSampleData, setLoadSampleData] = useState<boolean>(true);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [showRequestAccess, setShowRequestAccess] = useState<boolean>(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Step 3 Configuration State
  const [companyType, setCompanyType] = useState<string>('Contractor');
  const [employeeCountValue, setEmployeeCountValue] = useState<number>(10);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [optionalModules, setOptionalModules] = useState<Record<string, boolean>>({
    subcontractors: true,
    site_reports: true,
    tools: false,
    meetings: true,
    approvals: true,
    reports: true
  });

  const handleStep3Continue = () => {
    if (!companyName.trim()) return;
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
      setCurrentStep(4);
    }, 450);
  };

  const getEmployeeRangeText = (val: number) => {
    if (val <= 5) return '1-5 people';
    if (val >= 100) return '1-100+ people';
    return `1-${val} people`;
  };

  const COMPANY_TYPES = [
    'Private Limited',
    'Partnership / LLP',
    'Proprietorship',
    'Contractor',
    'Distributor',
    'Agency',
    'Enterprise'
  ];

  const EMPLOYEE_RANGES = [
    '1-10 people',
    '11-50 people',
    '51-200 people',
    '201-500 people',
    '500+ people'
  ];

  const OPTIONAL_MODULE_LIST = [
    { id: 'subcontractors', name: 'Sub-Contractors' },
    { id: 'site_reports', name: 'Daily Site Reports' },
    { id: 'tools', name: 'Tools & Equipment' },
    { id: 'meetings', name: 'Minutes of Meeting' },
    { id: 'approvals', name: 'Workflows & Approvals' },
    { id: 'reports', name: 'Advanced Reports' }
  ];

  const selectedSector = useMemo(
    () => SECTORS.find((s) => s.id === selectedSectorId) || SECTORS[0],
    [selectedSectorId]
  );

  const handleSelectSector = (sector: SectorDef) => {
    setSelectedSectorId(sector.id);
    setCompanyName(sector.defaultName);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    localStorage.removeItem('mep-unconfirmed-user-session');
    window.location.href = '/login';
  };

  const publicOrgs = usePublicOrganisations();
  const myRequests = useMyAccessRequests(user.id);
  const createReq = useCreateAccessRequest();

  const handleLaunchDemo = async () => {
    if (!companyName.trim() || isLaunching) return;
    setIsLaunching(true);

    try {
      localStorage.setItem('mep-selected-sector', JSON.stringify({
        sectorId: selectedSector.id,
        sectorName: selectedSector.name,
        category: selectedSector.category,
        loadSampleData
      }));

      // Show celebration screen
      setShowCelebration(true);

      // Wait 1200ms for the celebration moment, then create org
      await new Promise(resolve => setTimeout(resolve, 1200));

      await onCreateOrganisation(companyName.trim(), {
        organisationTypes: [selectedSector.category, selectedSector.id],
        manufacturingEnabled: selectedSector.manufacturingEnabled,
        onboardingCompleted: true,
      });
    } finally {
      setIsLaunching(false);
      setShowCelebration(false);
    }
  };

  const submitRequest = async () => {
    if (!selectedOrgId) return;
    if (!user.email) throw new Error('Your user is missing an email address.');

    await createReq.mutateAsync({
      organisation_id: selectedOrgId,
      user_id: user.id,
      email: user.email,
      status: 'pending',
    });
    await myRequests.refetch();
  };

  const STEPS = [
    {
      num: 1,
      title: 'Account Authentication',
      description: user.email || 'User Authenticated',
      status: 'completed'
    },
    {
      num: 2,
      title: 'Select Industry Sector',
      description: 'Choose your operating model',
      status: currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : 'upcoming'
    },
    {
      num: 3,
      title: 'About your company',
      description: 'Workspace name & team size',
      status: currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : 'upcoming'
    },
    {
      num: 4,
      title: 'Modules & Preferences',
      description: 'Configure modules & launch',
      status: currentStep === 4 ? 'active' : 'upcoming'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #FCFCFD 0%, #F8FAFC 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* Subtle radial highlight behind card */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.03) 0%, transparent 70%)',
        filter: 'blur(120px)',
        pointerEvents: 'none'
      }} />
      {/* Success Toast Overlay */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [.22, 1, .36, 1] }}
            style={{
              position: 'fixed',
              top: '32px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#166534',
              boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Check size={16} color="#16a34a" strokeWidth={3} />
            Company details saved
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outer Card Wrapper */}
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        maxHeight: 'calc(100vh - 32px)',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.04)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 290px',
        overflow: 'hidden',
        border: '1px solid #ECEEF2',
        position: 'relative',
        zIndex: 1
      }}>

        {/* Celebration Screen Overlay */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [.22, 1, .36, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 50,
                background: '#ffffff',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px'
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, ease: [.22, 1, .36, 1], delay: 0.1 }}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#F0FDF4',
                  border: '2px solid #BBF7D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Check size={28} color="#16a34a" strokeWidth={3} />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2, ease: [.22, 1, .36, 1] }}
                style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.4px' }}
              >
                Your workspace is ready.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.35, ease: [.22, 1, .36, 1] }}
                style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}
              >
                Perfect ERP has been configured for your business.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
              >
                <Loader2 className="animate-spin" size={16} color="#6b7280" />
                <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>Loading your dashboard...</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LEFT / CENTER CANVAS: Main Step Content */}
        <div style={{
          flex: 1,
          padding: '36px 44px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          overflowY: 'auto'
        }}>

          {/* Top Canvas Header Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                <Building2 size={18} />
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' }}>
                Perfect ERP
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                <LogOut size={13} />
                {loggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>

          {!showRequestAccess ? (
            <AnimatePresence mode="wait">
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: [.22, 1, .36, 1] }}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                    <h1 style={{
                      fontSize: '24px',
                      fontWeight: 700,
                      color: '#111827',
                      letterSpacing: '-0.5px',
                      margin: '0 0 4px 0'
                    }}>
                      Select your industry
                    </h1>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                      This helps us give you more relevant recommendations
                    </p>
                  </div>

                  {/* Sector Cards Stacked List with Compact Padding */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginBottom: '20px'
                  }}>
                    {SECTORS.map((sector) => {
                      const isSelected = selectedSectorId === sector.id;

                      return (
                        <div
                          key={sector.id}
                          onClick={() => handleSelectSector(sector)}
                          style={{
                            padding: '12px 18px',
                            borderRadius: '16px',
                            border: isSelected ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                            background: isSelected ? '#f8fafc' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Guaranteed Circular SVG Radio Button */}
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                            {isSelected ? (
                              <>
                                <circle cx="10" cy="10" r="8.5" stroke="#2563eb" strokeWidth="2" fill="#ffffff" />
                                <circle cx="10" cy="10" r="4.5" fill="#2563eb" />
                              </>
                            ) : (
                              <circle cx="10" cy="10" r="8.5" stroke="#d1d5db" strokeWidth="1.8" fill="#ffffff" />
                            )}
                          </svg>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '13.5px',
                                fontWeight: 700,
                                color: isSelected ? '#111827' : '#1f2937',
                                letterSpacing: '-0.2px'
                              }}>
                                {sector.name}
                              </span>
                              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#6b7280' }}>
                                {sector.subtitle}
                              </span>
                            </div>

                            <p style={{
                              fontSize: '11.5px',
                              color: '#6b7280',
                              margin: 0,
                              lineHeight: 1.35
                            }}>
                              {sector.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Centered Action Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: 'auto' }}>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="onboarding-primary-btn"
                      style={{
                        width: '240px',
                        height: '44px',
                        borderRadius: '12px',
                        background: '#09090b',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(9, 9, 11, 0.18)'
                      }}
                    >
                      Continue
                      <ArrowRight size={16} className="cta-arrow-icon" />
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => setShowRequestAccess(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '12px',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Want to join an existing company instead?
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: [.22, 1, .36, 1] }}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                        About your company
                      </h1>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                        Tell us a bit about your business to personalize your workspace.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Company Name & Sector Badge */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                            Company name
                          </label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="e.g. Acme Contracting Co"
                            className="onboarding-input-field"
                            style={{
                              height: '44px',
                              width: '100%',
                              padding: '0 16px',
                              borderRadius: '10px',
                              border: '1.5px solid #d1d5db',
                              background: '#ffffff',
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#111827',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                            Selected sector
                          </label>
                          <div
                            className="selected-sector-card"
                            style={{
                            height: '48px',
                            padding: '0 16px',
                            borderRadius: '12px',
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#047857',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <selectedSector.icon size={16} color="#059669" />
                              <span>{selectedSector.name} Workspace</span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#166534', background: '#DCFCE7', padding: '2px 8px', borderRadius: '8px' }}>
                                Workspace Ready ✓
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCurrentStep(2)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#047857',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 1. What kind of company are you? (Pill Tags) */}
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 700, color: '#111827', display: 'block', marginBottom: '10px' }}>
                          What kind of company are you?
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {COMPANY_TYPES.map((type) => {
                            const isSelected = companyType === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setCompanyType(type)}
                                className={`company-pill-btn ${isSelected ? 'is-selected' : ''}`}
                                style={{
                                  padding: '8px 18px',
                                  borderRadius: '9999px',
                                  border: isSelected ? '1.5px solid #09090b' : '1px solid #e5e7eb',
                                  background: isSelected ? '#09090b' : '#ffffff',
                                  color: isSelected ? '#ffffff' : '#6b7280',
                                  fontSize: '13px',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                                  outline: 'none'
                                }}
                              >
                                {type}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Employee Size Draggable Range Slider */}
                      <div style={{
                        padding: '18px 24px',
                        borderRadius: '14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <label style={{ fontSize: '14px', fontWeight: 700, color: '#111827', display: 'block' }}>
                              How large is your company?
                            </label>
                          </div>

                          <motion.div
                            key={employeeCountValue}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, ease: [.22, 1, .36, 1] }}
                            style={{
                              background: '#EFF6FF',
                              color: '#1d4ed8',
                              padding: '6px 16px',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: 700,
                              letterSpacing: '-0.2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: '1px solid #DBEAFE',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}
                          >
                            <Users size={14} color="#3b82f6" />
                            {getEmployeeRangeText(employeeCountValue)}
                          </motion.div>
                        </div>

                        {/* Premium Slider with Milestone Ticks */}
                        <div style={{ padding: '6px 0 0 0' }}>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            step="5"
                            value={employeeCountValue}
                            onChange={(e) => setEmployeeCountValue(Number(e.target.value))}
                            className="onboarding-slider"
                            style={{
                              width: '100%',
                              height: '6px',
                              borderRadius: '9999px',
                              accentColor: '#2563eb',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          />
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingTop: '8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#94a3b8',
                            userSelect: 'none'
                          }}>
                            <span>1–5</span>
                            <span>6–20</span>
                            <span>21–50</span>
                            <span>51–100</span>
                            <span>100+</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '20px',
                    paddingTop: '14px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="onboarding-back-btn"
                      style={{
                        height: '42px',
                        padding: '0 20px',
                        borderRadius: '12px',
                        background: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#09090b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ChevronLeft size={16} />
                      Go back
                    </button>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleStep3Continue}
                      disabled={!companyName.trim()}
                      className="onboarding-primary-btn"
                      style={{
                        height: '42px',
                        padding: '0 28px',
                        borderRadius: '12px',
                        background: '#09090b',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: !companyName.trim() ? 'not-allowed' : 'pointer',
                        opacity: !companyName.trim() ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(9, 9, 11, 0.18)'
                      }}
                    >
                      Continue to Modules
                      <ArrowRight size={16} className="cta-arrow-icon" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: [.22, 1, .36, 1] }}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                        Modules & Preferences
                      </h1>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                        Review active ERP modules and sample data options for <strong>{companyName}</strong>.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                      {/* 1. Modules Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
                            Modules:
                          </label>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            Pre-selected core modules for {selectedSector.name}
                          </span>
                        </div>

                        {/* Active Modules Single-Row Container */}
                        <div style={{
                          minHeight: '48px',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          background: '#ffffff',
                          border: '1.5px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                        }}>
                          {/* Default Core Green Badges */}
                          {selectedSector.features.map((feat) => (
                            <span
                              key={feat}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 14px',
                                borderRadius: '20px',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                color: '#047857',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                            >
                              <CheckCircle2 size={14} color="#059669" />
                              {feat}
                            </span>
                          ))}

                          {/* Added Optional Blue Badges (Clicking removes) */}
                          {OPTIONAL_MODULE_LIST.filter(mod => optionalModules[mod.id]).map((mod) => (
                            <span
                              key={mod.id}
                              onClick={() => setOptionalModules({ ...optionalModules, [mod.id]: false })}
                              title="Click to remove module"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 14px',
                                borderRadius: '20px',
                                background: '#eff6ff',
                                border: '1.5px solid #2563eb',
                                color: '#1d4ed8',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <CheckCircle2 size={14} color="#2563eb" />
                              {mod.name}
                              <span style={{ fontSize: '13px', marginLeft: '2px', opacity: 0.8 }}>×</span>
                            </span>
                          ))}
                        </div>

                        {/* Clickable Additional Optional Modules Below */}
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '8px' }}>
                            + Click to add additional optional modules:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {OPTIONAL_MODULE_LIST.filter(mod => !optionalModules[mod.id]).map((mod) => (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => setOptionalModules({ ...optionalModules, [mod.id]: true })}
                                className="company-pill-btn"
                                style={{
                                  padding: '6px 16px',
                                  borderRadius: '20px',
                                  border: '1px solid #e5e7eb',
                                  background: '#ffffff',
                                  color: '#4b5563',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  cursor: 'pointer'
                                }}
                              >
                                + {mod.name}
                              </button>
                            ))}
                            {OPTIONAL_MODULE_LIST.every(mod => optionalModules[mod.id]) && (
                              <span style={{ fontSize: '12px', color: '#059669', fontStyle: 'italic' }}>
                                ✓ All available optional modules added
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2. Pre-load Sample Data Toggle Card */}
                      <div style={{
                        padding: '16px 20px',
                        borderRadius: '14px',
                        background: '#fafbfc',
                        border: '1px solid #f0f0f3'
                      }}>
                        <label
                          onClick={() => setLoadSampleData(!loadSampleData)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            userSelect: 'none'
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {loadSampleData ? (
                              <>
                                <rect width="18" height="18" rx="4" fill="#000000" />
                                <path d="M5 9L8 12L13 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </>
                            ) : (
                              <rect x="1" y="1" width="16" height="16" rx="3" stroke="#d1d5db" strokeWidth="2" fill="white" />
                            )}
                          </svg>
                          Pre-load sector sample data (Quotes, Stock Items, Invoices)
                        </label>
                      </div>

                    </div>
                  </div>

                  {/* Navigation Buttons (< Go back on left, Launch Demo on right) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '28px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="onboarding-back-btn"
                      style={{
                        height: '42px',
                        padding: '0 20px',
                        borderRadius: '12px',
                        background: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#09090b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ChevronLeft size={16} />
                      Go back
                    </button>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => void handleLaunchDemo()}
                      disabled={isLaunching}
                      className="onboarding-primary-btn"
                      style={{
                        height: '44px',
                        padding: '0 32px',
                        borderRadius: '12px',
                        background: '#09090b',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: isLaunching ? 'not-allowed' : 'pointer',
                        opacity: isLaunching ? 0.7 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 16px rgba(9, 9, 11, 0.22)'
                      }}
                    >
                      {isLaunching ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} color="#38bdf8" />}
                      {isLaunching ? 'Creating workspace...' : 'Launch Interactive Demo'}
                      {!isLaunching && <ArrowRight size={16} className="cta-arrow-icon" />}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            /* Request Access to Existing Org Form */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
                      Request Access to Existing Company
                    </h2>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                      Select an organization and request membership from its administrator.
                    </p>
                  </div>
                </div>

                <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Select Organisation
                    </label>
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      disabled={publicOrgs.isLoading || createReq.isPending}
                      style={{
                        height: '44px',
                        width: '100%',
                        padding: '0 16px',
                        borderRadius: '10px',
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        fontSize: '14px',
                        color: '#111827',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">Choose an existing company...</option>
                      {(publicOrgs.data ?? []).map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => void submitRequest()}
                    disabled={!selectedOrgId || createReq.isPending}
                    style={{
                      height: '44px',
                      width: '100%',
                      borderRadius: '10px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: (!selectedOrgId || createReq.isPending) ? 'not-allowed' : 'pointer',
                      opacity: (!selectedOrgId || createReq.isPending) ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {createReq.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Submit Access Request
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowRequestAccess(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '13px',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  ← Back to Onboarding
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANEL: Stepper Navigation Sidebar */}
        <div style={{
          width: '100%',
          background: '#fafbfd',
          borderLeft: '1px solid rgba(241,243,245,0.4)',
          padding: '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}>
          <div>
            {/* Overall Progress Indicator Header */}
            <div style={{
              marginBottom: '28px',
              paddingBottom: '16px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                  Setup Progress
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                  {Math.round((currentStep / 4) * 100)}%
                </span>
              </div>
              {/* Progress Bar */}
              <div style={{ width: '100%', height: '4px', borderRadius: '9999px', background: '#E5E7EB' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((currentStep / 4) * 100)}%` }}
                  transition={{ duration: 0.5, ease: [.22, 1, .36, 1] }}
                  style={{ height: '100%', borderRadius: '9999px', background: '#2563eb' }}
                />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', marginTop: '6px', display: 'block' }}>
                Step {currentStep} of 4
              </span>
            </div>

            {/* Stepper List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
              {STEPS.map((s, index) => {
                const isDone = s.status === 'completed';
                const isActive = s.status === 'active';

                return (
                  <div key={s.num} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                    {/* Vertical Connector Line */}
                    {index < STEPS.length - 1 && (
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.35, ease: [0, 0, .2, 1], delay: index * 0.08 }}
                        style={{
                          position: 'absolute',
                          left: '14px',
                          top: '30px',
                          width: '2px',
                          height: '24px',
                          background: isDone ? '#10b981' : '#e2e8f0',
                          transformOrigin: 'top',
                          transition: 'background 0.2s ease'
                        }}
                      />
                    )}

                    {/* Circle Indicator */}
                    <motion.div
                      initial={isDone ? { scale: 0.8 } : isActive ? { scale: 1 } : {}}
                      animate={isDone ? { scale: 1 } : isActive ? { scale: [1, 1.08, 1] } : {}}
                      transition={isDone ? { duration: 0.22, ease: [.22, 1, .36, 1] } : isActive ? { duration: 0.3, ease: [.22, 1, .36, 1] } : {}}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isDone ? '#10b981' : isActive ? '#09090b' : '#ffffff',
                        border: isDone ? 'none' : isActive ? '2px solid #09090b' : '2px solid #cbd5e1',
                        color: isDone ? '#ffffff' : isActive ? '#ffffff' : '#94a3b8',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        flexShrink: 0,
                        boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                        transition: 'all 0.2s cubic-bezier(.22, 1, .36, 1)'
                      }}
                    >
                      {isDone ? <Check size={16} color="#ffffff" strokeWidth={3} /> : s.num}
                    </motion.div>

                    <div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: isActive || isDone ? 700 : 500,
                        color: isActive ? '#09090b' : isDone ? '#0f172a' : '#94a3b8',
                        lineHeight: 1.3
                      }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '12px', color: isDone || isActive ? '#64748b' : '#cbd5e1', marginTop: '2px', lineHeight: 1.3 }}>
                        {s.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Help Text (Minimal) */}
          <div style={{
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#9CA3AF' }}>
              Need help?{' '}
              <button
                type="button"
                onClick={() => alert('Support line: support@perfecterp.com')}
                className="onboarding-help-link"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'none'
                }}
              >
                Contact Support →
              </button>
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
