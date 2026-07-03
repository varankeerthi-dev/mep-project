import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (isDemo?: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('demo@billfast.com');
  const [password, setPassword] = useState('demo12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (!pwd) return score;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strengthScore = getPasswordStrength(password);
  
  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-red-500';
    if (score === 2) return 'bg-orange-500';
    if (score === 3) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Demo Mode bypass: if credentials match our demo defaults
    if (email === 'demo@billfast.com' && password === 'demo12345') {
      // Simulate network request delay
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(true);
      }, 800);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        onLoginSuccess(false);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm glass-card rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl">
            BF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">BillFast Mobile</h1>
          <p className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            Enter details or use pre-filled Demo Mode
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 h-11 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 h-11 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              placeholder="••••••••"
              required
            />
            {password && (
              <div className="space-y-1.5">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-full flex-1 rounded-full transition-all ${
                        level <= strengthScore ? getStrengthColor(strengthScore) : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-all hover:bg-primary/95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase">Or continue with</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => alert('OAuth features are available in the web app.')}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-border bg-card font-semibold text-xs text-foreground active:scale-95 transition-all cursor-pointer"
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => alert('OAuth features are available in the web app.')}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-border bg-foreground font-semibold text-xs text-background active:scale-95 transition-all cursor-pointer"
          >
            Apple
          </button>
        </div>
      </div>
    </div>
  );
};
