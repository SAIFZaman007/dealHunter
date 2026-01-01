# VERCEL_SETUP_INSTRUCTIONS.md

## Quick Setup Guide for Vercel Deployment

### Problem Fixed
✅ `net::ERR_CONNECTION_REFUSED` errors on login/signup
✅ All hardcoded localhost URLs removed
✅ Environment-based API configuration implemented

---

## Step 1: Verify GitHub Push

Ensure all changes are pushed to GitHub:

```bash
cd c:\PROJECT\dealHunter\jessewilliams_frontend
git status
git add .
git commit -m "fix: Replace hardcoded localhost:3000 with environment-based API configuration"
git push origin main
```

---

## Step 2: Configure Vercel Environment Variables

### Access Vercel Dashboard
1. Go to https://vercel.com
2. Select your project: `deal-hunter-delta`
3. Navigate to: **Settings** → **Environment Variables**

### Add Environment Variables

Click **"Add New"** and add the following:

#### Variable 1: Backend API URL
- **Name:** `VITE_API_URL`
- **Value:** `https://your-actual-backend-domain.com`
  - Replace with your actual backend URL
  - Example: `https://dealhunter-api.railway.app` (if using Railway)
- **Environments:** Select all (Production, Preview, Development)
- **Click:** Add

#### Variable 2: AI Service URL (Optional)
- **Name:** `VITE_AI_SERVICE_URL`
- **Value:** `https://your-ai-service-domain.com`
  - Replace with your AI service URL if different from backend
  - Otherwise, use same as VITE_API_URL
- **Environments:** Select all
- **Click:** Add

---

## Step 3: Trigger Vercel Redeploy

After adding environment variables, Vercel automatically triggers a new deployment.

**OR manually trigger:**
1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Select **Redeploy**

---

## Step 4: Verify the Fix

### Test on Production
1. Visit: https://deal-hunter-delta.vercel.app
2. Click **"Sign Up"** or **"Log In"**
3. Open **DevTools** (F12) → **Network** tab
4. Try to submit the form
5. Check the API requests:
   - **Should see:** requests to your backend domain (https://your-backend.com)
   - **Should NOT see:** requests to localhost:3000
   - **Status:** Should be 200, 400, or valid error (not connection refused)

---

## Step 5: Backend CORS Configuration (Important!)

Your backend MUST allow requests from your Vercel URL.

### Update your backend CORS:

```javascript
// backend/src/server.js (Node.js example)
const cors = require('cors');

app.use(cors({
  origin: [
    'https://deal-hunter-delta.vercel.app',  // Your Vercel URL
    'http://localhost:3000',                  // Local development
    process.env.FRONTEND_URL                  // Environment variable fallback
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## Expected URLs After Fix

All these endpoints should now point to your backend domain:

```
Old (Broken):           New (Fixed):
localhost:3000/api/auth/login     → https://backend-domain/api/auth/login
localhost:3000/api/auth/register  → https://backend-domain/api/auth/register
localhost:3000/api/auth/resend-otp → https://backend-domain/api/auth/resend-otp
localhost:3000/api/ai/onboarding  → https://backend-domain/api/ai/onboarding
localhost:3000/api/ai/chat        → https://backend-domain/api/ai/chat
localhost:3000/api/profile/check  → https://backend-domain/api/profile/check
```

---

## What Was Changed in Frontend Code

### Files Modified:
1. ✅ `src/components/Login.jsx` - Uses authClient
2. ✅ `src/components/Signup.jsx` - Uses authClient (3 URLs fixed)
3. ✅ `src/components/OnboardingForm.jsx` - Uses authClient
4. ✅ `src/components/DealHunterChat.jsx` - Uses API_BASE_URL
5. ✅ `src/App.jsx` - Uses authClient
6. ✅ `.env.local` - Created for local development

### Files Already Configured:
- `src/config/api.js` - Reads environment variables
- `src/services/apiClient.js` - Centralized axios client with auth

---

## Local Development (Optional)

If you want to test locally before production:

```bash
cd jessewilliams_frontend
npm install
npm run dev
# Test at http://localhost:5173 with backend at http://localhost:3000
```

The `.env.local` file has development URLs already configured.

---

## Troubleshooting

### Issue: Still getting connection refused errors
- [ ] Check Vercel environment variables are set correctly
- [ ] Verify your backend domain is correct and accessible
- [ ] Clear browser cache: Ctrl+Shift+Delete
- [ ] Check backend CORS configuration

### Issue: Getting CORS errors (different error)
- [ ] Backend CORS must allow your Vercel URL
- [ ] Check exact domain including https://

### Issue: 401 Unauthorized errors
- [ ] Ensure login is working and returning a token
- [ ] Check token is saved in localStorage
- [ ] Verify backend token validation

### Issue: Getting 500 errors from backend
- [ ] Check backend logs/console
- [ ] Verify backend database is connected
- [ ] Ensure backend environment variables are set

---

## FAQ

**Q: Why am I getting these errors?**
A: The frontend had hardcoded localhost URLs. In production, there's no local server, so requests fail.

**Q: What are environment variables?**
A: They're configuration values that change per environment (dev/staging/production).

**Q: Where is my backend URL?**
A: It depends on where you deployed it:
- Railway: `your-project.railway.app`
- Heroku: `your-project.herokuapp.com`
- AWS: Your custom domain
- Other: Check your deployment provider

**Q: Do I need to change anything else?**
A: Just configure the Vercel environment variables and make sure your backend CORS allows your frontend URL.

---

## Deployment Checklist

- [ ] All code changes pushed to GitHub
- [ ] Vercel environment variables configured
- [ ] Vercel deployment triggered (auto or manual)
- [ ] Backend CORS updated (if needed)
- [ ] Tested login on production URL
- [ ] Network tab shows requests to backend domain (not localhost)
- [ ] No connection refused errors

---

**Questions?** Check the full `DEPLOYMENT_GUIDE.md` in the repository.
