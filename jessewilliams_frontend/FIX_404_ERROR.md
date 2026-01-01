# 404 Error Fix Guide

## Problem
You're getting a **404 error** on login/signup attempts:
```
Failed to load resource: the server responded with a status of 404 ()
```

The request URL shows: `jessewilliamnew-server.mtscorporate.com/auth/login`
But it should be: `jessewilliamnew-server.mtscorporate.com/api/auth/login`

## Root Cause
The `VITE_API_URL` environment variable in Vercel is missing the `/api` path prefix.

---

## Solution ✅

### Step 1: Update Vercel Environment Variable

Go to **Vercel Dashboard** → **Settings** → **Environment Variables**

**Find:** `VITE_API_URL`

**Change from:**
```
https://jessewilliamnew-server.mtscorporate.com
```

**Change to:**
```
https://jessewilliamnew-server.mtscorporate.com/api
```

**Note:** Include `/api` at the end of the URL!

### Step 2: Redeploy on Vercel

After updating the environment variable:
1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Select **Redeploy**

Or wait for Vercel to auto-redeploy.

### Step 3: Test

1. Visit: https://deal-hunter-delta.vercel.app/signup
2. Try to sign up
3. Open DevTools (F12) → **Network** tab
4. Check the API request URL - should now be:
   ```
   https://jessewilliamnew-server.mtscorporate.com/api/auth/register
   ```
5. Should see **200 response** (not 404)

---

## Frontend Code Change (Automatic)

The frontend code has been automatically updated to handle both cases:
- With `/api`: `https://backend.com/api` ✅
- Without `/api`: `https://backend.com` (automatically adds `/api`) ✅

**No frontend code changes needed** - just update the environment variable!

---

## Correct Environment Variable Format

| Environment | VITE_API_URL | Result |
|-------------|-------------|--------|
| Local Dev | `http://localhost:3000` | `http://localhost:3000/api/auth/login` |
| Production | `https://jessewilliamnew-server.mtscorporate.com/api` | `https://jessewilliamnew-server.mtscorporate.com/api/auth/login` |

---

## Why This Happened

The frontend expects API endpoints at `/auth/login`, `/ai/chat`, etc.
Your backend serves them at `/api/auth/login`, `/api/ai/chat`, etc.

So the full path should be:
- **Base URL:** `https://jessewilliamnew-server.mtscorporate.com/api`
- **Endpoint:** `/auth/login`
- **Full URL:** `https://jessewilliamnew-server.mtscorporate.com/api/auth/login` ✅

---

## Checklist

- [ ] Go to Vercel Dashboard
- [ ] Find `VITE_API_URL` environment variable
- [ ] Add `/api` to the end: `https://jessewilliamnew-server.mtscorporate.com/api`
- [ ] Save changes
- [ ] Redeploy the project
- [ ] Test signup/login on production
- [ ] Verify Network tab shows correct URL (with `/api`)
- [ ] Should see 200/400 responses (not 404)

---

## If Issue Persists

**Check Vercel Logs:**
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Check **Build Logs** and **Runtime Logs** for errors

**Verify Backend:**
1. Test the backend API directly:
   ```
   https://jessewilliamnew-server.mtscorporate.com/api/auth/login
   ```
2. Should show an error (like invalid credentials) not 404
3. If still 404, backend routes may not be configured correctly

**Clear Cache:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear cache in DevTools: Right-click → Clear site data

---

## Summary

**The fix is simple:** Add `/api` to your Vercel `VITE_API_URL` environment variable!

**Old (Broken):**
```
VITE_API_URL=https://jessewilliamnew-server.mtscorporate.com
```

**New (Fixed):**
```
VITE_API_URL=https://jessewilliamnew-server.mtscorporate.com/api
```

This will resolve the 404 errors immediately! 🚀
