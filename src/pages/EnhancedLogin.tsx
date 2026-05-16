import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';

export default function EnhancedLogin() {
  const navigate = useNavigate();
  const { user, organisations } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For demo purposes, simulate login
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organisationId: selectedOrgId })
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        setError(errorData.message || 'Login failed');
      } else {
        const userData = await loginResponse.json();
        // Simulate setting user and org
        // In real implementation, this would set the auth context
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if user already exists
      const checkResponse = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (checkResponse.ok) {
        const existsData = await checkResponse.json();
        if (existsData.exists) {
          setError('User already exists. Please login or use different email.');
          setLoading(false);
          return;
        }
      }

      // Create new organization first
      const orgResponse = await fetch('/api/auth/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Organization', userId: user?.id })
      });

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json();
        setError(errorData.message || 'Failed to create organization');
        setLoading(false);
        return;
      }

      // Create user account
      const userResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          organisationId: orgResponse.data.id,
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        setError(errorData.message || 'Signup failed');
        setLoading(false);
        return;
      }

      // Auto-login
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organisationId: orgResponse.data.id })
      });

      if (!loginResponse.ok) {
        setError('Auto-login failed');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/80 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Login</CardTitle>
          </CardHeader>
          <CardContent>
            {organisations && organisations.length > 1 && (
              <div className="mb-4">
                <Label htmlFor="organisation">Select Organization</Label>
                <select
                  id="organisation"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full p-2 border border-zinc-300 rounded-md"
                >
                  <option value="">Choose an organization</option>
                  {organisations.map((org) => (
                    <option key={org.organisation_id} value={org.organisation_id}>
                      {org.organisation?.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full p-2 border border-zinc-300 rounded-md"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full p-2 border border-zinc-300 rounded-md"
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  variant="primary"
                  className="flex-1"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
                
                <Button
                  onClick={() => navigate('/signup')}
                  variant="secondary"
                  className="flex-1"
                >
                  Create Organization
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
