import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Target, FileText, Boxes, Briefcase, Clock, Bot, ShoppingCart, Calculator, ArrowLeft, Lightbulb, Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { supabase, signInWithEmail, signUp, signInWithGoogle, sendVerificationEmail, resetPassword, getCurrentUser, onAuthStateChange } from '../supabase'
import { sendOnboardingSuccessEmail } from '../utils/emailService'

type LoginProps = {
  onLogin: (user: User | null) => void
}

type SignupProps = {
  onSignup: (user: User | null) => void
}

type AuthCallbackProps = {
  onAuth?: (user: User | null) => void
}

type SelectOrganisationProps = {
  organisations: any[]
  onSelect: (orgId: string) => void
  onCreateNew: (name: string) => void
}

const circularModules = [
  { name: 'Procurement', icon: ShoppingCart, angle: -90, color: '#007AFF' },
  { name: 'Quotation', icon: Calculator, angle: -38, color: '#FF2D55' },
  { name: 'Invoice', icon: FileText, angle: 14, color: '#34C759' },
  { name: 'Inventory', icon: Boxes, angle: 66, color: '#FF9500' },
  { name: 'Project', icon: Briefcase, angle: 118, color: '#5856D6' },
  { name: 'Followup', icon: Clock, angle: 170, color: '#AF52DE' },
  { name: 'AI Agents', icon: Bot, angle: 222, color: '#00C7BE' },
]

const isGmailAddress = (emailStr: string) => {
  const clean = emailStr.trim().toLowerCase()
  return clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com')
}

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: 'Email address is required' })
  .email({ message: 'Please enter a valid email address (e.g. name@company.com)' })

const nameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Name must be at least 2 characters' })
  .regex(/^[a-zA-Z\s]+$/, { message: 'Name can only contain letters and spaces (no numbers, dots, hyphens, or special characters)' })

const passwordSchema = z
  .string()
  .min(6, { message: 'Password must be at least 6 characters' })
  .regex(/\d/, { message: 'Password must contain at least one number' })
  .regex(/^[a-zA-Z0-9_@]+$/, { message: 'Password can only use letters, numbers, and allowed special characters (_ and @)' })

const signupSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

export function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [activeInput, setActiveInput] = useState<string | null>(null)
  const [resendLoginLoading, setResendLoginLoading] = useState(false)
  const [resendLoginMessage, setResendLoginMessage] = useState('')

  const createUnconfirmedUser = async (userEmail: string): Promise<User> => {
    let profile: any = null
    try {
      const res = await supabase
        .from('user_profiles')
        .select('user_id, full_name, created_at')
        .eq('email', userEmail)
        .maybeSingle()
      profile = res.data
    } catch (e) {
      console.warn('Profile fetch warning (non-fatal):', e)
    }

    return {
      id: profile?.user_id || `unconfirmed_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: userEmail,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: profile?.created_at || new Date().toISOString(),
      email_confirmed_at: undefined,
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: profile?.full_name || userEmail.split('@')[0] }
    } as any
  }

  const handleResendLoginVerification = async () => {
    if (!email) {
      setError('Please enter your email address first.')
      return
    }
    setResendLoginLoading(true)
    await sendVerificationEmail(email).catch(console.error)
    
    // Grant immediate access to application during trial grace period
    const userObj = await createUnconfirmedUser(email)
    localStorage.setItem('mep-unconfirmed-user-session', JSON.stringify(userObj))
    onLogin(userObj)
    navigate('/', { replace: true })
  }

  const getInputStyle = (field: string) => ({
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    background: activeInput === field ? '#ffffff' : '#f8f9fa',
    border: activeInput === field ? '1.5px solid #007AFF' : '1px solid #d0d5dd',
    boxShadow: activeInput === field 
      ? '0 0 0 4px rgba(0, 122, 255, 0.15), 0 1px 2px rgba(16, 24, 40, 0.05)' 
      : '0 1px 2px rgba(16, 24, 40, 0.05)',
    fontSize: '14px',
    color: '#101828',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s ease'
  })

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    
    // Zod validation for email
    const emailValidation = emailSchema.safeParse(email)
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message)
      return
    }

    setLoading(true)
    
    const { data, error: err } = await signInWithEmail(email, password)
    
    if (err) {
      const isUnconfirmedError = 
        (err as any)?.code === 'email_not_confirmed' ||
        (err as any)?.error_code === 'email_not_confirmed' ||
        /email.*not.*confirm|unconfirmed/i.test(err.message || '') ||
        /email.*not.*confirm|unconfirmed/i.test(String((err as any)?.code || ''))

      if (isUnconfirmedError) {
        // Bypasses email confirmation block so existing unconfirmed users enter the app during grace period
        const unconfirmedUser = await createUnconfirmedUser(email)
        localStorage.setItem('mep-unconfirmed-user-session', JSON.stringify(unconfirmedUser))
        onLogin(unconfirmedUser)
        navigate('/', { replace: true })
        return
      }
      setError(err.message)
      setLoading(false)
    } else {
      localStorage.removeItem('mep-unconfirmed-user-session')
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
    setError('')
    
    // Zod validation for email
    const emailValidation = emailSchema.safeParse(email)
    if (!emailValidation.success) {
      setError(emailValidation.error.errors[0].message)
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
    <div className="auth-container" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Ambient background glow orbs */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 122, 255, 0.12) 0%, rgba(255, 255, 255, 0) 70%)',
        top: '-10%',
        left: '-10%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(88, 86, 214, 0.12) 0%, rgba(255, 255, 255, 0) 70%)',
        bottom: '-10%',
        right: '-10%',
        pointerEvents: 'none'
      }} />

      {/* Left Glassy Beveled Banner */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0, y: [0, -10, 0] }}
        transition={{
          opacity: { duration: 0.8 },
          x: { duration: 0.8 },
          y: { duration: 5, repeat: Infinity, ease: 'easeInOut' }
        }}
        className="hidden lg:flex"
        style={{
          position: 'absolute',
          left: '6%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '310px',
          padding: '28px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: `
            inset 2px 2px 4px rgba(255, 255, 255, 0.9),
            inset -2px -2px 6px rgba(0, 0, 0, 0.05),
            0 20px 40px rgba(0, 122, 255, 0.12),
            0 1px 3px rgba(0, 0, 0, 0.05)
          `,
          flexDirection: 'column',
          gap: '14px',
          zIndex: 1
        }}
      >
        {/* Motion Outer Hover Line */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 0 0px rgba(0, 122, 255, 0.25)',
              '0 0 0 10px rgba(0, 122, 255, 0)',
              '0 0 0 0px rgba(0, 122, 255, 0.25)'
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: '26px',
            border: '1.5px solid rgba(0, 122, 255, 0.4)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.2) 0%, rgba(88, 86, 214, 0.2) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#007AFF'
          }}>
            <TrendingUp size={20} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#007AFF' }}>
            Strategic Wisdom
          </span>
        </div>

        <h3 style={{
          fontSize: '22px',
          fontWeight: 800,
          lineHeight: '1.35',
          color: '#1c1c1e',
          letterSpacing: '-0.5px',
          margin: 0
        }}>
          "Profit comes from planning"
        </h3>
        
        <p style={{ fontSize: '13px', color: '#636366', lineHeight: '1.5', margin: 0 }}>
          Organize your engineering workflows, material estimates, and financial margins with foresight.
        </p>
      </motion.div>

      {/* Center Entry Form */}
      <div className="auth-card" style={{ zIndex: 10, position: 'relative' }}>
        {/* Logo with Circular Auto-Popup Badges */}
        <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            position: 'relative',
            width: '180px',
            height: '130px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px'
          }}>
            {/* Center Logo */}
            <div style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              boxShadow: '0 8px 18px rgba(0, 122, 255, 0.3)',
              zIndex: 2
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '24px' }}>P</span>
            </div>

            {/* Circular Orbit Pill Badges */}
            {circularModules.map((mod, idx) => {
              const radiusX = 80
              const radiusY = 50
              const rad = (mod.angle * Math.PI) / 180
              const targetX = Math.cos(rad) * radiusX
              const targetY = Math.sin(rad) * radiusY

              return (
                <motion.div
                  key={mod.name}
                  initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x: targetX, 
                    y: targetY 
                  }}
                  transition={{
                    opacity: { duration: 0.4, delay: idx * 0.18 + 0.3 },
                    scale: { type: 'spring', stiffness: 350, damping: 22, delay: idx * 0.18 + 0.3 },
                    x: { duration: 0.5, delay: idx * 0.18 + 0.3 },
                    y: { duration: 0.5, delay: idx * 0.18 + 0.3 }
                  }}
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.88)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: `1px solid ${mod.color}35`,
                    boxShadow: `0 4px 10px ${mod.color}15, inset 0 1px 1px rgba(255, 255, 255, 0.9)`,
                    zIndex: 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.06, 1], y: [0, -2, 0] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: idx * 0.3 + 1.2
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <mod.icon size={11} color={mod.color} />
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#1c1c1e',
                      letterSpacing: '-0.2px'
                    }}>
                      {mod.name}
                    </span>
                  </motion.div>
                </motion.div>
              )
            })}
          </div>

          <h1>Welcome back</h1>
          <p>Sign in to your Perfect ERP account</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>{error}</span>
            {(/email not confirmed|email address not confirmed|unconfirmed/i.test(error) || error.toLowerCase().includes('confirm')) && (
              <div style={{ marginTop: '4px' }}>
                {resendLoginMessage ? (
                  <span style={{ fontSize: '12px', color: '#12b76a', fontWeight: 600 }}>{resendLoginMessage}</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendLoginVerification}
                    disabled={resendLoginLoading}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #d92d20',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#d92d20',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    {resendLoginLoading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isGmailAddress(email) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(66, 133, 244, 0.08)',
            border: '1px solid rgba(66, 133, 244, 0.25)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#1a73e8'
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Gmail detected! You can log in instantly with <strong>Continue with Google</strong>.</span>
          </div>
        )}

        {showForgot ? (
          <div>
            <p style={{ color: 'var(--gray-600)', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
              Enter your email and we'll send you a reset link.
            </p>
            <button 
              onClick={handleForgotPassword} 
              disabled={loading}
              className="btn btn-primary btn-block"
              style={{ marginBottom: '16px' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button 
              onClick={() => setShowForgot(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f1f3f5 100%)',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                boxShadow: `
                  inset 1.5px 1.5px 3px rgba(255, 255, 255, 1),
                  inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.08),
                  0 4px 8px rgba(0, 0, 0, 0.06)
                `,
                color: '#212529',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back to Login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: activeInput === 'email' ? '#007AFF' : '#344054', marginBottom: '6px', transition: 'color 0.2s' }}>Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setActiveInput('email')}
                  onBlur={() => setActiveInput(null)}
                  required
                  placeholder="you@company.com"
                  style={getInputStyle('email')}
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: activeInput === 'password' ? '#007AFF' : '#344054', marginBottom: '6px', transition: 'color 0.2s' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setActiveInput('password')}
                    onBlur={() => setActiveInput(null)}
                    required
                    placeholder="••••••••"
                    style={{
                      ...getInputStyle('password'),
                      paddingRight: '40px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#667085',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                
                {!showForgot && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button 
                      type="button"
                      onClick={() => setShowForgot(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#007AFF',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary btn-block"
              >
                {loading ? 'Signing in...' : 'Continue'}
              </button>
            </form>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '20px 0'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
              <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--gray-200)' }} />
            </div>
            
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn btn-secondary btn-block"
              style={{
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

            <div className="auth-footer" style={{ marginTop: '20px' }}>
              <p>
                Don't have an account?{' '}
                <a 
                  href="/signup" 
                  onClick={(e) => { e.preventDefault(); navigate('/signup'); }}
                >
                  Sign up
                </a>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Right Glassy Beveled Banner */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0, y: [0, 10, 0] }}
        transition={{
          opacity: { duration: 0.8 },
          x: { duration: 0.8 },
          y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }
        }}
        className="hidden lg:flex"
        style={{
          position: 'absolute',
          right: '6%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '310px',
          padding: '28px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: `
            inset 2px 2px 4px rgba(255, 255, 255, 0.9),
            inset -2px -2px 6px rgba(0, 0, 0, 0.05),
            0 20px 40px rgba(88, 86, 214, 0.12),
            0 1px 3px rgba(0, 0, 0, 0.05)
          `,
          flexDirection: 'column',
          gap: '14px',
          zIndex: 1
        }}
      >
        {/* Motion Outer Hover Line */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 0 0px rgba(88, 86, 214, 0.25)',
              '0 0 0 10px rgba(88, 86, 214, 0)',
              '0 0 0 0px rgba(88, 86, 214, 0.25)'
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: '26px',
            border: '1.5px solid rgba(88, 86, 214, 0.4)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(88, 86, 214, 0.2) 0%, rgba(255, 45, 85, 0.2) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5856D6'
          }}>
            <Target size={20} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#5856D6' }}>
            Precision Standard
          </span>
        </div>

        <h3 style={{
          fontSize: '22px',
          fontWeight: 800,
          lineHeight: '1.35',
          color: '#1c1c1e',
          letterSpacing: '-0.5px',
          margin: 0
        }}>
          "Planning gets you near-perfection"
        </h3>
        
        <p style={{ fontSize: '13px', color: '#636366', lineHeight: '1.5', margin: 0 }}>
          Execute project milestones with zero operational friction and flawless accuracy.
        </p>
      </motion.div>
    </div>
  )
}

export function Signup({ onSignup }: SignupProps) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [activeInput, setActiveInput] = useState<string | null>(null)

  const getInputStyle = (field: string) => ({
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    background: activeInput === field ? '#ffffff' : '#f8f9fa',
    border: activeInput === field ? '1.5px solid #007AFF' : '1px solid #d0d5dd',
    boxShadow: activeInput === field 
      ? '0 0 0 4px rgba(0, 122, 255, 0.15), 0 1px 2px rgba(16, 24, 40, 0.05)' 
      : '0 1px 2px rgba(16, 24, 40, 0.05)',
    fontSize: '14px',
    color: '#101828',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s ease'
  })

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    
    // Zod validation for all signup entry fields
    const signupValidation = signupSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword
    })

    if (!signupValidation.success) {
      setError(signupValidation.error.errors[0].message)
      return
    }
    
    setLoading(true)
    
    const { data, error: err } = await signUp(email, password, fullName)
    
    if (err) {
      setError(err.message)
      setLoading(false)
    } else if (data.user) {
      // Save unconfirmed session for immediate trial grace period access
      if (!data.session || !data.user.email_confirmed_at) {
        localStorage.setItem('mep-unconfirmed-user-session', JSON.stringify(data.user))
        await signInWithEmail(email, password).catch(() => {})
      }
      
      // Send onboarding welcome email in background
      sendOnboardingSuccessEmail({
        to: email,
        fullName: fullName,
        organisationName: 'your organization'
      }).catch(console.error)
      
      onSignup(data.user)
      navigate('/', { replace: true })
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Top Back to Login Button */}
        <button 
          type="button"
          onClick={() => navigate('/login')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f1f3f5 100%)',
            border: '1px solid rgba(0, 0, 0, 0.15)',
            boxShadow: `
              inset 1.5px 1.5px 3px rgba(255, 255, 255, 1),
              inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.08),
              0 4px 8px rgba(0, 0, 0, 0.06)
            `,
            color: '#212529',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={16} /> Back to Login
        </button>

        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Sign up for your account</p>
        </div>
        
        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {isGmailAddress(email) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(66, 133, 244, 0.08)',
            border: '1px solid rgba(66, 133, 244, 0.25)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#1a73e8'
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Gmail detected! You can log in faster using <strong>Google SSO</strong> on the login page.</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: activeInput === 'fullName' ? '#007AFF' : '#344054', marginBottom: '6px', transition: 'color 0.2s' }}>What people would call you?</label>
            <input
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onFocus={() => setActiveInput('fullName')}
              onBlur={() => setActiveInput(null)}
              required
              placeholder="John Doe"
              style={getInputStyle('fullName')}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: activeInput === 'email' ? '#007AFF' : '#344054', marginBottom: '6px', transition: 'color 0.2s' }}>Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setActiveInput('email')}
              onBlur={() => setActiveInput(null)}
              required
              placeholder="you@company.com"
              style={getInputStyle('email')}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: activeInput === 'password' ? '#007AFF' : '#344054', marginBottom: '6px', transition: 'color 0.2s' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setActiveInput('password')}
                onBlur={() => setActiveInput(null)}
                required
                placeholder="At least 6 characters"
                style={{
                  ...getInputStyle('password'),
                  paddingRight: '40px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#667085',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '6px',
              fontSize: '12px',
              color: '#98a2b3'
            }}>
              <span style={{ 
                color: password.length >= 6 ? '#12b76a' : '#98a2b3', 
                fontWeight: password.length >= 6 ? 600 : 400,
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                transition: 'color 0.2s ease'
              }}>
                <span style={{ fontSize: '13px', lineHeight: 1 }}>{password.length >= 6 ? '✓' : '•'}</span> Min 6 characters
              </span>

              <span style={{ 
                color: /\d/.test(password) ? '#12b76a' : '#98a2b3', 
                fontWeight: /\d/.test(password) ? 600 : 400,
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                transition: 'color 0.2s ease'
              }}>
                <span style={{ fontSize: '13px', lineHeight: 1 }}>{/\d/.test(password) ? '✓' : '•'}</span> Use number
              </span>

              <span style={{ 
                color: (password.length > 0 && /^[a-zA-Z0-9_@]+$/.test(password) && /[_@]/.test(password)) ? '#12b76a' : '#98a2b3', 
                fontWeight: (password.length > 0 && /^[a-zA-Z0-9_@]+$/.test(password) && /[_@]/.test(password)) ? 600 : 400,
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                transition: 'color 0.2s ease'
              }}>
                <span style={{ fontSize: '13px', lineHeight: 1 }}>{(password.length > 0 && /^[a-zA-Z0-9_@]+$/.test(password) && /[_@]/.test(password)) ? '✓' : '•'}</span> Use only _ and @
              </span>
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: activeInput === 'confirmPassword' ? '#007AFF' : '#344054', marginBottom: '6px', transition: 'color 0.2s' }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setActiveInput('confirmPassword')}
                onBlur={() => setActiveInput(null)}
                required
                placeholder="Re-enter your password"
                style={{
                  ...getInputStyle('confirmPassword'),
                  paddingRight: '40px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#667085',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {confirmPassword.length > 0 && (
              <div style={{
                marginTop: '6px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: confirmPassword === password ? '#12b76a' : '#f04438',
                transition: 'color 0.2s ease'
              }}>
                <span>{confirmPassword === password ? '✓ Passwords match' : '✕ Passwords do not match'}</span>
              </div>
            )}
          </div>
          
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign In</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export function AuthCallback({ onAuth }: AuthCallbackProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      const userResponse = await getCurrentUser()
      if (userResponse.error) {
        setError(userResponse.error.message)
        setLoading(false)
      } else if (userResponse.data?.user) {
        onAuth?.(userResponse.data.user)
        navigate('/', { replace: true })
        // no setLoading(false) here — we're navigating away, no need to re-render this view
      } else {
        setLoading(false)
      }
    }
    handleCallback()
  }, [onAuth, navigate])

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
          <button onClick={() => navigate('/login')} className="btn btn-primary btn-block">Back to Login</button>
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
