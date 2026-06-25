import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Smart Quotation Builder',
    description: 'Create professional quotes in seconds with auto-pricing, discounts, and GST calculations.'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'Inventory Management',
    description: 'Track materials across multiple warehouses with real-time stock alerts and transfers.'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Project Tracking',
    description: 'Manage projects from start to finish with daily updates, site visits, and task management.'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Client & Subcontractor Hub',
    description: 'Centralize client communications, subcontractor payments, and attendance in one place.'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Insightful Reports',
    description: 'Generate stock, purchase, and sales reports with a single click for better decisions.'
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Enterprise Security',
    description: 'Bank-grade security with role-based access, approval workflows, and audit trails.'
  }
];

const stats = [
  { value: '50+', label: 'Modules' },
  { value: '10K+', label: 'Users' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support' }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    
    const timer = setTimeout(() => setHeroVisible(true), 100);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="landing-page" style={{ background: '#000', minHeight: '100vh', color: '#fff', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '20px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: scrolled ? 'rgba(0,0,0,0.8)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.1)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '18px'
          }}>P</div>
          <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px' }}>Perfect ERP</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a href="#features" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Features</a>
          <a href="#about" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>About</a>
          <button 
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 20px',
              borderRadius: '980px',
              background: '#fff',
              color: '#000',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.transform = 'scale(1.02)';
              btn.style.boxShadow = '0 0 20px rgba(255,255,255,0.3)';
            }}
            onMouseOut={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.transform = 'scale(1)';
              btn.style.boxShadow = 'none';
            }}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 24px 80px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background gradient */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(0,122,255,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        
        <div style={{
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '980px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            marginBottom: '32px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.8)'
          }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: '#30D158',
              animation: 'pulse 2s infinite'
            }} />
            Now with AI-powered insights
          </div>
          
          <h1 style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            marginBottom: '24px',
            background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Everything you need.
            <br />
            Nothing you don't.
          </h1>
          
          <p style={{
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            color: 'rgba(255,255,255,0.6)',
            maxWidth: '640px',
            margin: '0 auto 48px',
            lineHeight: 1.5,
            fontWeight: 400
          }}>
            Perfect ERP is the all-in-one business management platform built for modern construction & trading companies.
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => navigate('/login')}
              style={{
                padding: '16px 32px',
                borderRadius: '980px',
                background: '#007AFF',
                color: '#fff',
                border: 'none',
                fontSize: '17px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 24px rgba(0,122,255,0.4)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,122,255,0.5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,122,255,0.4)';
              }}
            >
              Get Started Free
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            
            <button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                padding: '16px 32px',
                borderRadius: '980px',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '17px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
            >
              Learn More
            </button>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px'
        }}>
          <span>Scroll to explore</span>
          <div style={{
            width: '28px',
            height: '48px',
            borderRadius: '14px',
            border: '2px solid rgba(255,255,255,0.2)',
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '8px'
          }}>
            <div style={{
              width: '4px',
              height: '8px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.4)',
              animation: 'scroll 2s infinite'
            }} />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{
        padding: '80px 24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '48px'
        }}>
          {stats.map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.02em' }}>{stat.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: '120px 24px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: '16px'
          }}>
            Powerful features.
          </h2>
          <p style={{
            fontSize: '20px',
            color: 'rgba(255,255,255,0.5)',
            maxWidth: '540px',
            margin: '0 auto'
          }}>
            Everything you need to run your business efficiently.
          </p>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {features.map((feature, i) => (
            <div 
              key={i}
              style={{
                padding: '40px',
                borderRadius: '24px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(0,122,255,0.2) 0%, rgba(88,86,214,0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#007AFF',
                marginBottom: '24px'
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>{feature.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontSize: '15px' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '120px 24px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,122,255,0.1) 100%)'
      }}>
        <h2 style={{
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: '16px'
        }}>
          Ready to get started?
        </h2>
        <p style={{
          fontSize: '20px',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '40px'
        }}>
          Join thousands of businesses already using Perfect ERP.
        </p>
        <button 
          onClick={() => navigate('/login')}
          style={{
            padding: '18px 40px',
            borderRadius: '980px',
            background: '#fff',
            color: '#000',
            border: 'none',
            fontSize: '18px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 24px rgba(255,255,255,0.2)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,255,255,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,255,255,0.2)';
          }}
        >
          Start Free Trial
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '60px 48px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '14px'
          }}>P</div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>© 2026 Perfect ERP. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '32px' }}>
          <a href="#" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '13px' }}>Privacy</a>
          <a href="#" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '13px' }}>Terms</a>
          <a href="#" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '13px' }}>Contact</a>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes scroll {
          0% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(10px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
