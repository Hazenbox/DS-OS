# Environment Variables Reference

Complete reference for all environment variables used in DS-OS.

---

## Vercel Environment Variables

### Required

#### `BLOB_READ_WRITE_TOKEN`
- **Description**: Vercel Blob Storage read/write token
- **Where to get**: Vercel Dashboard → Storage → Blob → Create Store → Copy Token
- **Required for**: 
  - Token bundle CDN storage
  - Screenshot CDN storage
- **Environment**: Production, Preview, Development
- **Example**: `vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Optional

#### `SCREENSHOT_SERVICE_URL`
- **Description**: Full URL to screenshot service endpoint
- **Default**: `/api/screenshot` (relative path, works on same domain)
- **When to set**: If using custom domain or separate service
- **Example**: `https://your-project.vercel.app/api/screenshot`

#### `IMAGE_DIFF_SERVICE_URL`
- **Description**: Full URL to image diff service endpoint
- **Default**: `/api/image-diff` (relative path)
- **When to set**: If using custom domain or separate service
- **Example**: `https://your-project.vercel.app/api/image-diff`

#### `ACCESSIBILITY_SERVICE_URL`
- **Description**: Full URL to accessibility service endpoint
- **Default**: `/api/accessibility` (relative path)
- **When to set**: If using custom domain or separate service
- **Example**: `https://your-project.vercel.app/api/accessibility`

---

## Convex Environment Variables

### Required

#### `BLOB_READ_WRITE_TOKEN`
- **Description**: Same as Vercel (for Convex actions to upload bundles)
- **Where to get**: Copy from Vercel (same token)
- **Required for**: Token bundle CDN uploads from Convex
- **How to set**: Convex Dashboard → Settings → Environment Variables
- **Example**: `vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Optional

#### `SCREENSHOT_SERVICE_URL`
- **Description**: Full URL to screenshot service (for Convex actions)
- **Default**: `https://your-app.vercel.app/api/screenshot` (hardcoded fallback)
- **When to set**: If using custom domain
- **Example**: `https://your-project.vercel.app/api/screenshot`

#### `IMAGE_DIFF_SERVICE_URL`
- **Description**: Full URL to image diff service (for Convex actions)
- **Default**: `https://your-app.vercel.app/api/image-diff` (hardcoded fallback)
- **When to set**: If using custom domain
- **Example**: `https://your-project.vercel.app/api/image-diff`

#### `ACCESSIBILITY_SERVICE_URL`
- **Description**: Full URL to accessibility service (for Convex actions)
- **Default**: `https://your-app.vercel.app/api/accessibility` (hardcoded fallback)
- **When to set**: If using custom domain
- **Example**: `https://your-project.vercel.app/api/accessibility`

---

## Frontend Environment Variables

### Required (Set in Vite)

These are typically set in `.env` files or Vercel environment variables:

#### `VITE_CONVEX_URL`
- **Description**: Convex deployment URL
- **Where to get**: Convex Dashboard → Settings → Deployment URL
- **Format**: `https://your-project.convex.cloud`
- **Example**: `https://kindred-kudu-490.convex.cloud`

---

## Environment-Specific Configuration

### Development

Create `.env.local`:
```bash
VITE_CONVEX_URL=https://your-dev-project.convex.cloud
```

### Production

Set in Vercel Dashboard:
```bash
VITE_CONVEX_URL=https://your-prod-project.convex.cloud
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx...
```

---

## Verification

### Check Vercel Variables

```bash
# Via Vercel CLI
vercel env ls

# Or check in Dashboard
# Dashboard → Your Project → Settings → Environment Variables
```

### Check Convex Variables

```bash
# Via Convex CLI
npx convex env

# Or check in Dashboard
# Dashboard → Your Project → Settings → Environment Variables
```

### Test Variables

```bash
# Test screenshot service
curl -X POST $SCREENSHOT_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{"componentCode": "..."}'

# Test Blob storage (from Convex)
# Check Convex logs for upload success
```

---

## Security Notes

### ⚠️ Never Commit Secrets

- ✅ Add `.env.local` to `.gitignore`
- ✅ Never commit `BLOB_READ_WRITE_TOKEN`
- ✅ Use Vercel/Convex dashboards for production secrets
- ✅ Use `.env.example` for documentation (without values)

### Best Practices

1. **Use different tokens for dev/prod** (if possible)
2. **Rotate tokens periodically**
3. **Limit token permissions** (read/write only where needed)
4. **Monitor token usage** in Vercel dashboard

---

## Troubleshooting

### Variable Not Found

**Symptom**: Functions fail with "undefined" errors

**Solution**:
1. Check variable name (case-sensitive)
2. Verify environment (Production vs Preview)
3. Redeploy after adding variables
4. Check function logs for specific error

### Token Invalid

**Symptom**: Blob uploads fail with 401/403

**Solution**:
1. Verify token is correct (no extra spaces)
2. Check token hasn't expired
3. Regenerate token in Vercel if needed
4. Update in both Vercel and Convex

### Service URL Not Working

**Symptom**: Tests fail to connect to services

**Solution**:
1. Verify URL is correct (no trailing slash)
2. Check CORS headers (should be set in `vercel.json`)
3. Test URL directly in browser/curl
4. Use relative paths if on same domain

---

## Quick Reference

| Variable | Required | Where | Purpose |
|----------|----------|-------|---------|
| `BLOB_READ_WRITE_TOKEN` | ✅ Yes | Vercel + Convex | CDN storage |
| `SCREENSHOT_SERVICE_URL` | ⚠️ Optional | Vercel + Convex | Screenshot API |
| `IMAGE_DIFF_SERVICE_URL` | ⚠️ Optional | Vercel + Convex | Image diff API |
| `ACCESSIBILITY_SERVICE_URL` | ⚠️ Optional | Vercel + Convex | Accessibility API |
| `VITE_CONVEX_URL` | ✅ Yes | Vercel | Convex connection |

---

**Last Updated**: December 2024

