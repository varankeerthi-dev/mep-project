import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getInvitationByToken, acceptInvitation } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [invitation, setInvitation] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setMessage('Invalid invitation link');
      return;
    }

    const loadInvitation = async () => {
      try {
        const { data, error } = await getInvitationByToken(token);
        if (error) throw error;
        setInvitation(data);
      } catch (err: any) {
        setMessage('Failed to load invitation');
      }
    };

    loadInvitation();
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!invitation || !token) return;

    setLoading(true);
    try {
      const { data, error } = await acceptInvitation(token, invitation.user_id || '');
      if (error) throw error;
      
      setMessage('Invitation accepted! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setMessage(err.message || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (message && !invitation) {
    return (
      <div className="min-h-screen bg-slate-50/80 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-slate-600">{message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organization Invitation</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {invitation ? (
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                You're invited to join {invitation.organisation?.name}
              </h2>
              <p className="text-slate-600 mb-4">
                You've been invited as a <span className="font-semibold capitalize">{invitation.role}</span>
              </p>
              <div className="bg-slate-100 p-4 rounded-lg mb-6">
                <p className="text-sm text-slate-600">
                  <strong>Organization:</strong> {invitation.organisation?.name}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Role:</strong> {invitation.role}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Invited by:</strong> {invitation.user?.full_name || 'System'}
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={loading}
                  variant="primary"
                  className="flex-1"
                >
                  {loading ? 'Accepting...' : 'Accept Invitation'}
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  variant="secondary"
                  className="flex-1"
                >
                  Login to Existing Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-200 border-t-slate-800"></div>
              <p className="text-slate-600 mt-4">Loading invitation details...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
