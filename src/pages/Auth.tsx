import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { signInWithEmail, signUp, signInWithGoogle, sendVerificationEmail, resetPassword, getCurrentUser, onAuthStateChange } from '../supabase'
import { sendOnboardingSuccessEmail } from '../utils/emailService'

type LoginProps = {
  onLogin: (user: User | null) => void
}

type SignupProps = {
  onSignup: (user: User | null) => void
}

type AuthCallbackProps = {
  onAuth: (user: User | null) => void
}

type SelectOrganisationProps = {
  organisations: any[]
  onSelect: (orgId: string) => void
  onCreateNew: (name: string) => void
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { data, error: err } = await signInWithEmail(email, password)
    
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      onLogin(data.user)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error: err } = await signInWithGoogle()
    if (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email')
      return
    }
    setLoading(true)
    const { error: err } = await resetPassword(email)
    if (err) {
      setError(err.message)
    } else {
      setError('Password reset email sent! Check your inbox.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      padding: '24px',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            marginBottom: '20px'
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '24px' }}>P</span>
          </div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 600, 
            color: '#fff',
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>Welcome back</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px' }}>
            Sign in to your Perfect ERP account
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '32px'
        }}>
          {error && (
            <div style={{
              background: 'rgba(255,59,48,0.1)',
              border: '1px solid rgba(255,59,48,0.2)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '24px',
              color: '#ff453a',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {showForgot ? (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '24px' }}>
                Enter your email and we'll send you a reset link.
              </p>
              <button 
                onClick={handleForgotPassword} 
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginBottom: '16px'
                }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button 
                onClick={() => setShowForgot(false)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ← Back to login
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '13px', 
                    fontWeight: 500,
                    marginBottom: '8px'
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '15px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#007AFF'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    color: 'rgba(255,255,255,0.7)', 
                    fontSize: '13px', 
                    fontWeight: 500,
                    marginBottom: '8px'
                  }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '15px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#007AFF'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#007AFF',
                    color: '#fff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  {loading ? 'Signing in...' : 'Continue'}
                </button>
              </form>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                margin: '24px 0'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              </div>
              
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        {!showForgot && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button 
              onClick={() => setShowForgot(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              Forgot password?
            </button>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
              Don't have an account?{' '}
              <a 
                href="#signup" 
                onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }}
                style={{ color: '#007AFF', textDecoration: 'none', fontWeight: 500 }}
              >
                Sign up
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function Signup({ onSignup }: SignupProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setLoading(true)
    
    const { data, error: err } = await signUp(email, password, fullName)
    
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      // Send onboarding success email
      await sendOnboardingSuccessEmail({
        to: email,
        fullName: fullName,
        organisationName: 'your organization'
      })
      
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Check Your Email</h1>
            <p>We've sent a verification link to <strong>{email}</strong></p>
          </div>
          <div className="alert alert-success">
            Click the link in the email to verify your account, then sign in.
          </div>
          <div className="auth-footer">
            <a href="#login" onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }}>Back to Login</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Sign up for your account</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Already have an account? <a href="#login" onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }}>Sign In</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export function AuthCallback({ onAuth }: AuthCallbackProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      const userResponse = await getCurrentUser()
      if (userResponse.error) {
        setError(userResponse.error.message)
      } else if (userResponse.data?.user) {
        onAuth(userResponse.data.user)
      }
      setLoading(false)
    }
    handleCallback()
  }, [onAuth])

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Verifying...</h1>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Authentication Failed</h1>
            <p>{error}</p>
          </div>
          <a href="#login" className="btn btn-primary btn-block">Back to Login</a>
        </div>
      </div>
    )
  }

  return null
}

export function SelectOrganisation({ organisations, onSelect, onCreateNew }: SelectOrganisationProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    // Get current user email for sending welcome email
    const getUserEmail = async () => {
      const userResponse = await getCurrentUser()
      if (userResponse.data?.user?.email) {
        setUserEmail(userResponse.data.user.email)
      }
    }
    getUserEmail()
  }, [])

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError('Organisation name is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onCreateNew(orgName)
      
      // Send onboarding success email after organization creation
      if (userEmail) {
        await sendOnboardingSuccessEmail({
          to: userEmail,
          fullName: 'User',
          organisationName: orgName
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create organisation')
    }
    setLoading(false)
  }

  if (showCreate) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Create Organisation</h1>
            <p>Set up your company or team</p>
          </div>
          
          {error && <div className="alert alert-error">{error}</div>}
          
          <div className="form-group">
            <label className="form-label">Organisation Name</label>
            <input
              type="text"
              className="form-input"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your Company Name"
              required
            />
          </div>
          
          <button 
            onClick={handleCreate} 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Organisation'}
          </button>
          
          <div className="auth-footer">
            <button onClick={() => setShowCreate(false)} className="btn btn-link">
              Back to organisations
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Select Organisation</h1>
          <p>Choose an organisation to continue</p>
        </div>
        
        {organisations.length === 0 ? (
          <div>
            <p>You don't have any organisations yet.</p>
            <button 
              onClick={() => setShowCreate(true)} 
              className="btn btn-primary btn-block"
            >
              Create New Organisation
            </button>
          </div>
        ) : (
          <div className="org-list">
            {organisations.map(org => (
              <button
                key={org.organisation.id}
                onClick={() => onSelect(org.organisation)}
                className="org-item"
              >
                <div className="org-avatar">
                  {org.organisation.name.charAt(0).toUpperCase()}
                </div>
                <div className="org-info">
                  <h3>{org.organisation.name}</h3>
                  <span className="org-role">{org.role}</span>
                </div>
              </button>
            ))}
            
            <button 
              onClick={() => setShowCreate(true)} 
              className="btn btn-secondary btn-block"
            >
              + Create New Organisation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


