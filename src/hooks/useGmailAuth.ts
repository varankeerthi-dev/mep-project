import { useState } from 'react';

export function useGmailAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGmailLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Initialize Google OAuth
      const { google } = window;
      if (!google) {
        setError('Google OAuth not available');
        return;
      }

      // Request OAuth token
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        scope: 'email profile openid',
        redirect_uri: `${window.location.origin}/auth/callback`
      });

      const { code } = await new Promise<string>((resolve, reject) => {
        // Show Google popup
        tokenClient.requestCode({
          hint: 'Select your Google account',
          prompt: 'select_account'
        });

        // Listen for response
        google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          redirect_uri: `${window.location.origin}/auth/callback`
        }).then((tokenResponse) => {
          if (tokenResponse.code) {
            resolve(tokenResponse.code);
          } else {
            reject(new Error('Authorization failed'));
          }
        });
      });

      // Exchange code for token
      const code = await code;
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code,
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          grant_type: 'authorization_code',
          redirect_uri: `${window.location.origin}/auth/callback`
        }).toString()
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'OAuth failed');
      }

      // Get user info with token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userInfo = await userInfoResponse.json();
      
      // Send to backend for user creation/login
      const authResponse = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture,
          googleId: userInfo.sub
        })
      });

      if (!authResponse.ok) {
        throw new Error('Backend authentication failed');
      }

      const authData = await authResponse.json();
      
      // Update auth context
      // This would be handled by your existing auth system
      setError('Successfully logged in with Google!');
      
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    handleGmailLogin,
    loading,
    error
  };
}
