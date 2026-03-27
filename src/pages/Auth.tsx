import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { signInWithEmail, signUp, signInWithGoogle, sendVerificationEmail, resetPassword, getCurrentUser, onAuthStateChange } from '../supabase'

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
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>MEP Project</h1>
          <p>Sign in to your account</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
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
            />
          </div>
          
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-divider">
          <span>or</span>
        </div>
        
        <button 
          onClick={handleGoogleLogin} 
          className="btn btn-google btn-block"
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        
        <div className="auth-footer">
          {showForgot ? (
            <div>
              <button onClick={handleForgotPassword} className="btn btn-link" disabled={loading}>
                Send Reset Email
              </button>
              <button onClick={() => setShowForgot(false)} className="btn btn-link">
                Back to Login
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setShowForgot(true)} className="btn btn-link">
                Forgot Password?
              </button>
              <p>
                Don't have an account? <a href="#signup" onClick={(e) => { e.preventDefault(); window.location.hash = 'signup'; }}>Sign Up</a>
              </p>
            </>
          )}
        </div>
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
      const { user, error: err } = await getCurrentUser()
      if (err) {
        setError(err.message)
      } else if (user) {
        onAuth(user)
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

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError('Organisation name is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onCreateNew(orgName)
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


