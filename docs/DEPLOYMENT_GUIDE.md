# Deployment Guide - Complete Setup

**Last Updated**: December 2024  
**Status**: Ready for Production Deployment

---

## 🚀 Quick Start

This guide walks you through deploying DS-OS to Vercel and configuring all required environment variables.

---

## Prerequisites

- ✅ Vercel account
- ✅ Convex account
- ✅ GitHub repository (optional, for CI/CD)
- ✅ Vercel CLI installed (optional): `npm i -g vercel`

---

## Step 1: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "Add New Project"**
3. **Import your Git repository** (or drag & drop your project folder)
4. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. **Click "Deploy"**

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
cd /Users/upen/Desktop/My\ Hazen/Products/ds-os
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? ds-os (or your preferred name)
# - Directory? ./
# - Override settings? No
```

### Verify Deployment

After deployment, you should see:
- ✅ Frontend deployed at: `https://your-project.vercel.app`
- ✅ API functions available at:
  - `https://your-project.vercel.app/api/screenshot`
  - `https://your-project.vercel.app/api/image-diff`
  - `https://your-project.vercel.app/api/accessibility`

---

## Step 2: Set Up Vercel Blob Storage

### 2.1 Create Blob Store

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Select your project**
3. **Go to Storage tab**
4. **Click "Create Database"** → Select **"Blob"**
5. **Name your store** (e.g., `ds-os-blob`)
6. **Copy the `BLOB_READ_WRITE_TOKEN`**

### 2.2 Add Blob Token to Environment Variables

1. **In Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. **Add New Variable**:
   - **Name**: `BLOB_READ_WRITE_TOKEN`
   - **Value**: Your token from step 2.1
   - **Environment**: Production, Preview, Development (select all)
3. **Click "Save"**

---

## Step 3: Configure Convex Environment Variables

### 3.1 Get Your Convex Deployment URL

1. **Go to [Convex Dashboard](https://dashboard.convex.dev)**
2. **Select your project**
3. **Go to Settings** → **Environment Variables**
4. **Note your deployment URL** (e.g., `https://your-project.convex.cloud`)

### 3.2 Add Service URLs to Convex (Optional)

These are optional - the system will use relative paths if not set.

1. **In Convex Dashboard** → Settings → **Environment Variables**
2. **Add Variables** (replace with your actual Vercel URL):

```bash
# Screenshot Service
SCREENSHOT_SERVICE_URL=https://your-project.vercel.app/api/screenshot

# Image Diff Service
IMAGE_DIFF_SERVICE_URL=https://your-project.vercel.app/api/image-diff

# Accessibility Service
ACCESSIBILITY_SERVICE_URL=https://your-project.vercel.app/api/accessibility
```

**Note**: If you don't set these, the system will use relative paths (`/api/screenshot`) which work when deployed on the same domain.

---

## Step 4: Verify API Functions

### 4.1 Test Screenshot Service

```bash
curl -X POST https://your-project.vercel.app/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "componentCode": "window.Component = () => React.createElement(\"div\", { style: { padding: \"20px\", background: \"#f0f0f0\" } }, \"Hello World\");"
  }'
```

**Expected Response**:
```json
{
  "screenshotUrl": "https://...blob.vercel-storage.com/...",
  "base64": "..." // Only if Blob unavailable
}
```

### 4.2 Test Image Diff Service

```bash
# First, get two screenshot URLs from step 4.1
curl -X POST https://your-project.vercel.app/api/image-diff \
  -H "Content-Type: application/json" \
  -d '{
    "image1Url": "data:image/png;base64,iVBORw0KGgo...",
    "image2Url": "data:image/png;base64,iVBORw0KGgo...",
    "threshold": 0.1
  }'
```

**Expected Response**:
```json
{
  "diffPercentage": 0.05,
  "diffImage": "data:image/png;base64,...",
  "passed": true,
  "numDiffPixels": 1234,
  "totalPixels": 921600
}
```

### 4.3 Test Accessibility Service

```bash
curl -X POST https://your-project.vercel.app/api/accessibility \
  -H "Content-Type: application/json" \
  -d '{
    "componentCode": "window.Component = () => React.createElement(\"button\", { \"aria-label\": \"Click me\" }, \"Click\");",
    "level": "AA"
  }'
```

**Expected Response**:
```json
{
  "passed": true,
  "violations": [],
  "score": 100
}
```

---

## Step 5: Test Token Bundle CDN

### 5.1 Compile a Token Bundle

1. **Login to your app**
2. **Go to Tokens tab**
3. **Upload a token JSON file** (if you haven't already)
4. **The system should automatically compile and upload to CDN**

### 5.2 Verify CDN Upload

1. **Check Convex Dashboard** → Data → `tokenBundles` table
2. **Look for a bundle with**:
   - `cssUrl` populated (should start with `https://...blob.vercel-storage.com`)
   - `jsonUrl` populated
3. **Click on the URL** → Should load CSS/JSON from CDN

---

## Step 6: Test Release Workflow

### 6.1 Create a Test Release

1. **Login to your app**
2. **Go to Release tab**
3. **Click "Trigger Release"**
4. **Release should be created with status `draft`**

### 6.2 Run Tests

1. **In Release History**, find your draft release
2. **Click "Run Tests" button**
3. **Wait for tests to complete** (10-30 seconds per component)
4. **Check test results**:
   - Visual diff results should appear
   - Accessibility results should appear

### 6.3 Review in Approval Workflow

1. **Click "Review" button** on the release
2. **Approval Workflow should show**:
   - Visual diff results with images
   - Accessibility score and violations
   - Component comparison views

---

## Step 7: Verify Everything Works

### Checklist

- [ ] Frontend loads at Vercel URL
- [ ] Can login/signup
- [ ] Can create projects
- [ ] Can upload token files
- [ ] Token bundles compile and upload to CDN
- [ ] Can extract components from Figma
- [ ] Can create releases
- [ ] "Run Tests" button works
- [ ] Test results appear in Approval Workflow
- [ ] Screenshots upload to Blob CDN
- [ ] Visual diff comparison works
- [ ] Accessibility tests run successfully

---

## Troubleshooting

### Issue: API Functions Return 500 Errors

**Solution**:
1. Check Vercel function logs: Dashboard → Your Project → Functions → View Logs
2. Verify environment variables are set
3. Check that Playwright dependencies are installed (should be automatic)

### Issue: Screenshots Not Uploading to CDN

**Solution**:
1. Verify `BLOB_READ_WRITE_TOKEN` is set in Vercel
2. Check Vercel function logs for Blob upload errors
3. System will fallback to base64 if Blob unavailable

### Issue: Tests Not Running

**Solution**:
1. Check Convex logs: Dashboard → Your Project → Logs
2. Verify service URLs are correct (or use relative paths)
3. Check that components have valid code
4. Verify tenant/project access

### Issue: Token Bundles Not Loading from CDN

**Solution**:
1. Verify `BLOB_READ_WRITE_TOKEN` is set in Convex
2. Check Convex logs for upload errors
3. System will fallback to DB storage if CDN unavailable
4. Recompile bundles to trigger CDN upload

---

## Environment Variables Summary

### Vercel Environment Variables

```bash
# Required
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx...

# Optional (for custom domains)
SCREENSHOT_SERVICE_URL=https://your-project.vercel.app/api/screenshot
IMAGE_DIFF_SERVICE_URL=https://your-project.vercel.app/api/image-diff
ACCESSIBILITY_SERVICE_URL=https://your-project.vercel.app/api/accessibility
```

### Convex Environment Variables

```bash
# Required (from Convex dashboard)
CONVEX_DEPLOYMENT=your-deployment-url

# Optional (for custom service URLs)
SCREENSHOT_SERVICE_URL=https://your-project.vercel.app/api/screenshot
IMAGE_DIFF_SERVICE_URL=https://your-project.vercel.app/api/image-diff
ACCESSIBILITY_SERVICE_URL=https://your-project.vercel.app/api/accessibility

# Required for Blob storage (from Vercel)
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx...
```

---

## Production Considerations

### Performance

- ✅ CDN delivery for token bundles (Vercel Blob)
- ✅ CDN delivery for screenshots (Vercel Blob)
- ✅ HTTP caching (1 year for bundles, 1 day for screenshots)
- ✅ Automatic compression (gzip/brotli)

### Security

- ✅ Tenant isolation enforced
- ✅ Role-based access control
- ✅ Input validation on all endpoints
- ✅ Secure token storage

### Monitoring

- **Vercel**: Dashboard → Your Project → Analytics
- **Convex**: Dashboard → Your Project → Logs
- **API Functions**: Dashboard → Your Project → Functions → Logs

---

## Next Steps After Deployment

1. ✅ **Test with real Figma components**
2. ✅ **Test with real token files**
3. ✅ **Create a real release and run tests**
4. ✅ **Verify CDN performance**
5. ✅ **Monitor error logs**
6. ✅ **Set up custom domain** (optional)
7. ✅ **Configure CI/CD** (optional)

---

## Support

If you encounter issues:

1. **Check logs**: Vercel Functions logs and Convex logs
2. **Verify environment variables**: All required variables set
3. **Test API endpoints**: Use curl commands above
4. **Check documentation**: `docs/` folder for detailed guides

---

**Status**: ✅ **Ready for Deployment**

