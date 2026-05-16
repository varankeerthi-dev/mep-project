import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function UserProfileManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    avatar_url: '',
    bio: ''
  });

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err: any) {
        console.error('Error loading profile:', err);
        setMessage('Failed to load profile');
      }
    };

    loadProfile();
  }, [user?.id]);

  const handleUpdateProfile = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          avatar_url: formData.avatar_url,
          bio: formData.bio
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      setProfile(data);
      setMessage('Profile updated successfully!');
      setFormData({
        full_name: '',
        phone: '',
        avatar_url: '',
        bio: ''
      });
    } catch (err: any) {
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setMessage('File size must be less than 5MB');
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    if (!allowedTypes.includes(fileExt)) {
      setMessage('Only image files are allowed (jpg, jpeg, png, gif, webp)');
      return;
    }

    setLoading(true);
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (error) throw error;

      // Update user profile with avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          avatar_url: data.path
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({
        ...prev,
        avatar_url: data.path
      }));

      setMessage('Avatar uploaded successfully!');
    } catch (err: any) {
      setMessage(err.message || 'Failed to upload avatar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/80 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-800">User Profile Management</h1>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Form */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  variant="primary"
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Avatar Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profile?.avatar_url && (
                  <div className="mb-4">
                    <img
                      src={profile.avatar_url}
                      alt="Profile avatar"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  </div>
                )}
                
                <div>
                  <Label htmlFor="avatar">Upload New Avatar</Label>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
