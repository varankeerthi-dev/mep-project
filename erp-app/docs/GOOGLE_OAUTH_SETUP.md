# Google OAuth Setup Guide

## For Vercel Deployment

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing project
3. Go to **APIs & Services → Credentials**
4. Click **+ CREATE CREDENTIALS → OAuth 2.0 Client ID**
5. Select **Web application** as application type
6. Add authorized redirect URI:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
7. Save and copy your **Client ID**

### 2. Supabase Dashboard Setup

1. Go to your Supabase project dashboard
2. Navigate to **Authentication → Providers**
3. Enable **Google** provider
4. Add your Google **Client ID** and **Client Secret**
5. Set redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

### 3. Environment Variables

#### Local Development (.env.local)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

#### Vercel Environment Variables
1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add these variables:
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   - `VITE_GOOGLE_CLIENT_ID`: `your-google-client-id`

### 4. Vercel Redirect URL

For Vercel deployment, you also need to add the Vercel domain to Google Console:

1. After deploying to Vercel, get your domain: `https://your-app.vercel.app`
2. Go back to Google Cloud Console → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add additional authorized redirect URI:
   ```
   https://your-app.vercel.app/auth/callback
   ```

### 5. Testing

1. Deploy to Vercel
2. Test Google OAuth flow:
   - Click "Login with Google"
   - Should redirect to Google
   - After authentication, redirect back to your app
   - User should be logged in

## Common Issues

### Issue: "redirect_uri_mismatch"
**Solution:** Make sure the redirect URI in Google Console exactly matches:
- `https://your-project.supabase.co/auth/v1/callback` (for Supabase)
- `https://your-app.vercel.app/auth/callback` (for Vercel)

### Issue: "Invalid client"
**Solution:** Verify `VITE_GOOGLE_CLIENT_ID` is correctly set in environment variables

### Issue: CORS errors
**Solution:** Ensure your Vercel domain is added to Google Console authorized origins

## Production Checklist

- [ ] Google OAuth client created in Google Cloud Console
- [ ] Supabase Google provider enabled
- [ ] Environment variables set in Vercel
- [ ] Vercel domain added to Google Console redirect URIs
- [ ] Test OAuth flow end-to-end
- [ ] Verify user creation/login works correctly
