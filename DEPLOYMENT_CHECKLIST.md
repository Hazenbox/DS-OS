# Deployment Checklist

Use this checklist to ensure everything is configured correctly before going live.

---

## Pre-Deployment

### Code Ready
- [x] All code committed to Git
- [x] Build passes locally (`npm run build`)
- [x] No TypeScript errors
- [x] No linter errors

### API Functions Ready
- [x] `api/screenshot.ts` - Screenshot service
- [x] `api/image-diff.ts` - Image diff service
- [x] `api/accessibility.ts` - Accessibility service
- [x] All functions tested locally (if possible)

---

## Vercel Deployment

### Initial Deployment
- [ ] Project deployed to Vercel
- [ ] Frontend accessible at Vercel URL
- [ ] Build logs show no errors
- [ ] API functions accessible at `/api/*` endpoints

### Vercel Blob Storage
- [ ] Blob store created in Vercel
- [ ] `BLOB_READ_WRITE_TOKEN` copied
- [ ] Token added to Vercel environment variables
- [ ] Token available in Production, Preview, Development

### Environment Variables (Vercel)
- [ ] `BLOB_READ_WRITE_TOKEN` set
- [ ] (Optional) `SCREENSHOT_SERVICE_URL` set
- [ ] (Optional) `IMAGE_DIFF_SERVICE_URL` set
- [ ] (Optional) `ACCESSIBILITY_SERVICE_URL` set

---

## Convex Configuration

### Environment Variables (Convex)
- [ ] `BLOB_READ_WRITE_TOKEN` set (from Vercel)
- [ ] (Optional) `SCREENSHOT_SERVICE_URL` set
- [ ] (Optional) `IMAGE_DIFF_SERVICE_URL` set
- [ ] (Optional) `ACCESSIBILITY_SERVICE_URL` set

### Convex Functions
- [ ] All functions deployed (`npx convex deploy`)
- [ ] No deployment errors
- [ ] Schema synced correctly

---

## Testing

### API Functions
- [ ] Screenshot service responds correctly
- [ ] Image diff service responds correctly
- [ ] Accessibility service responds correctly
- [ ] Screenshots upload to Blob CDN
- [ ] CDN URLs are accessible

### Token System
- [ ] Can upload token JSON files
- [ ] Tokens parse correctly
- [ ] Bundles compile successfully
- [ ] Bundles upload to CDN
- [ ] CDN URLs work in browser
- [ ] CSS injects correctly

### Component Builder
- [ ] Can extract components from Figma
- [ ] Components generate correctly
- [ ] Preview works
- [ ] Code displays correctly

### Release Workflow
- [ ] Can create releases
- [ ] "Run Tests" button works
- [ ] Tests execute successfully
- [ ] Test results appear in Approval Workflow
- [ ] Visual diff images display
- [ ] Accessibility results display

---

## Production Verification

### Performance
- [ ] Token bundles load from CDN (< 200ms)
- [ ] Screenshots load from CDN (< 500ms)
- [ ] Page load times acceptable (< 2s)
- [ ] API functions respond quickly (< 5s)

### Security
- [ ] Authentication works
- [ ] Tenant isolation enforced
- [ ] Role-based access works
- [ ] No sensitive data exposed

### Monitoring
- [ ] Vercel analytics enabled
- [ ] Convex logs accessible
- [ ] Error tracking set up (optional)

---

## Post-Deployment

### Documentation
- [ ] Deployment guide reviewed
- [ ] Environment variables documented
- [ ] Team notified of deployment

### Monitoring
- [ ] Check error logs daily (first week)
- [ ] Monitor API function usage
- [ ] Monitor CDN bandwidth
- [ ] Check Convex usage/quota

---

## Rollback Plan

If issues occur:

1. **Revert Vercel deployment**: Dashboard → Deployments → Previous → Promote
2. **Revert Convex functions**: `npx convex deploy --prod` (previous version)
3. **Check environment variables**: Verify all are set correctly
4. **Check logs**: Identify specific error

---

**Status**: Ready for deployment ✅

