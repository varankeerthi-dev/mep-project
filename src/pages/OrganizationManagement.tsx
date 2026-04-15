import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getUserOrganisations, createOrganization, createInvitation } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OrganizationManagement() {
  const navigate = useNavigate();
  const { user, organisations, selectedOrganisation, switchOrganisation } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      setMessage('Please enter organization name');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await createOrganization(newOrgName, user?.id || '');
      if (error) throw error;
      
      if (data) {
        setMessage('Organization created successfully!');
        setNewOrgName('');
        setShowCreateForm(false);
        
        // Switch to new organization
        if (switchOrganisation && data.id) {
          await switchOrganisation(data.id);
        }
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !selectedOrganisation) {
      setMessage('Please enter email and select organization');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await createInvitation(
        selectedOrganisation.id,
        inviteEmail,
        inviteRole,
        user?.id || ''
      );
      
      if (error) throw error;
      
      setMessage(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: any) {
      setMessage(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchOrg = async (orgId: string) => {
    if (switchOrganisation) {
      await switchOrganisation(orgId);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800">Organization Management</h1>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant="primary"
            >
              {showCreateForm ? 'Cancel' : 'Create Organization'}
            </Button>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700">{message}</p>
            </div>
          )}

          {/* Current Organizations */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {organisations?.map((org) => (
              <Card key={org.organisation?.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-800">{org.organisation?.name}</h3>
                      <p className="text-sm text-slate-600">Role: {org.role}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={selectedOrganisation?.id === org.organisation?.id ? "secondary" : "primary"}
                        onClick={() => handleSwitchOrg(org.organisation?.id)}
                      >
                        {selectedOrganisation?.id === org.organisation?.id ? 'Current' : 'Switch'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Create Organization Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateOrg}
                      disabled={loading}
                      variant="primary"
                    >
                      {loading ? 'Creating...' : 'Create Organization'}
                    </Button>
                    <Button
                      onClick={() => setShowCreateForm(false)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invite Users Form */}
          {selectedOrganisation && !showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle>Invite Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="inviteEmail">Email Address</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="inviteRole">Role</Label>
                    <select
                      id="inviteRole"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md"
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleInviteUser}
                      disabled={loading}
                      variant="primary"
                    >
                      {loading ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
