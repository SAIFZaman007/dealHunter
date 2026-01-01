# Production Deployment Guide - Deal Hunter Frontend

## Overview
This guide explains the fixes applied to resolve the `net::ERR_CONNECTION_REFUSED` errors on the Vercel production environment.

## Root Cause
The frontend was using **hardcoded `http://localhost:3000`** URLs in multiple components. In production (Vercel), the browser has no local server running, causing all API calls to fail.

## Changes Made

### 1. API Configuration Files ✅

#### `src/config/api.js` - Already Configured
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export { API_BASE_URL, AI_SERVICE_URL };
```

#### `src/services/apiClient.js` - Already Configured
Provides centralized axios clients with:
- Automatic baseURL configuration from environment variables
- Automatic Bearer token injection from localStorage
- Request interceptors for authentication

### 2. Updated Components

#### `src/components/Login.jsx` ✅
- Changed: `axios.post('http://localhost:3000/api/auth/login', ...)`
- To: `authClient.post('/auth/login', ...)`

#### `src/components/Signup.jsx` ✅
**Three hardcoded URLs fixed:**
1. `/auth/register` - Now uses `authClient.post('/auth/register', ...)`
2. `/auth/verify-otp` - Already using `authClient.post('/auth/verify-otp', ...)`
3. `/auth/resend-otp` - Changed to `authClient.post('/auth/resend-otp', ...)`

#### `src/components/OnboardingForm.jsx` ✅
- Changed: `axios.post('http://localhost:3000/api/ai/onboarding', ...)`
- To: `authClient.post('/ai/onboarding', ...)`
- Removed redundant Authorization header (authClient handles it)

#### `src/components/DealHunterChat.jsx` ✅
- Changed: `fetch('http://localhost:3000/api/ai/chat', ...)`
- To: `fetch('${API_BASE_URL}/api/ai/chat', ...)`

#### `src/App.jsx` ✅
- Changed: `axios.get('http://localhost:3000/api/profile/check', ...)`
- To: `authClient.get('/profile/check')`

### 3. Environment Variables

#### `.env.example` - Already Configured
Reference file for all environment variables needed.

#### `.env.local` - Created
Development environment file (DO NOT commit to git).

---

## Deployment Instructions

### Step 1: Deploy to GitHub
```bash
cd jessewilliams_frontend
git add .
git commit -m "fix: Replace hardcoded localhost URLs with environment-based API configuration"
git push origin main
```

### Step 2: Configure Vercel Environment Variables

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add the following variables:

```
VITE_API_URL=https://your-backend-domain.com
VITE_AI_SERVICE_URL=https://your-ai-service-domain.com
```

**Replace with your actual backend URLs:**
- `https://your-backend-domain.com` - Your production backend API
- `https://your-ai-service-domain.com` - Your AI service URL (if separate)

### Step 3: Verify Backend CORS Configuration

Ensure your backend (`jessewilliams_backend`) has proper CORS settings:

```javascript
// backend/src/server.js or equivalent
const cors = require('cors');

app.use(cors({
  origin: [
    'https://deal-hunter-delta.vercel.app',
    'http://localhost:3000', // for local development
    process.env.FRONTEND_URL || 'https://deal-hunter-delta.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Step 4: Auto-Deploy
Vercel automatically redeploys when you push to GitHub. The environment variables are applied to the build.

---

## Testing Checklist

### Local Development
```bash
npm run dev
# Verify login/signup works with http://localhost:3000
```

### Production (Vercel)
1. Visit: https://deal-hunter-delta.vercel.app
2. Open Browser DevTools → **Network** tab
3. Try to **Login** or **Sign Up**
4. Verify requests go to your backend domain (NOT localhost)
5. Check for proper responses (200, not 500/ERR_CONNECTION_REFUSED)

---

## API Endpoints Reference

| Function | Old URL | New URL |
|----------|---------|---------|
| Login | `/api/auth/login` | Uses authClient |
| Register | `/api/auth/register` | Uses authClient |
| Verify OTP | `/api/auth/verify-otp` | Uses authClient |
| Resend OTP | `/api/auth/resend-otp` | Uses authClient |
| Onboarding | `/api/ai/onboarding` | Uses authClient |
| Chat | `/api/ai/chat` | Uses API_BASE_URL |
| Check Profile | `/api/profile/check` | Uses authClient |

---

## Security Notes

1. **Never hardcode URLs** - Always use environment variables
2. **Never commit `.env.local`** - Already in `.gitignore`
3. **Use Bearer tokens** - authClient automatically injects them
4. **CORS must allow your frontend domain** - Update backend CORS config
5. **HTTPS in production** - All URLs should use `https://` in production

---

## Troubleshooting

### Issue: Still getting `net::ERR_CONNECTION_REFUSED`

**Solution:**
1. Check Vercel environment variables are set correctly
2. Verify backend domain is accessible (test in browser)
3. Check backend CORS allows your frontend origin
4. Clear browser cache and localStorage

### Issue: CORS errors (different error than before)

**Solution:**
1. Ensure backend has proper CORS configuration
2. Check that origin includes your Vercel URL exactly
3. Backend should include proper Access-Control-Allow headers

### Issue: 401 Unauthorized on protected endpoints

**Solution:**
1. Verify token is being stored in localStorage on login
2. Check authClient interceptor is working
3. Verify backend token validation logic

---

## Summary of Improvements

✅ Removed all hardcoded localhost URLs
✅ Implemented environment-based configuration
✅ Centralized API client with automatic token handling
✅ Production-ready CORS handling
✅ Development/production environment separation
✅ Security best practices applied

The frontend is now **production-grade** and ready for deployment across multiple environments!
