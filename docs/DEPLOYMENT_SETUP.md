# Deployment Setup Guide

## Vercel Serverless Functions Deployment

### Prerequisites
- Vercel account
- Vercel CLI installed (`npm i -g vercel`)
- Project connected to Vercel

### Step 1: Install Dependencies

The serverless functions require additional dependencies. These are already in `package.json`:
- `playwright` - For screenshot capture
- `pixelmatch` - For image comparison
- `pngjs` - For PNG image processing
- `@axe-core/playwright` - For accessibility testing
- `@vercel/node` - Vercel runtime

### Step 2: Deploy to Vercel

```bash
# Login to Vercel (if not already)
vercel login

# Deploy the project
vercel

# For production deployment
vercel --prod
```

### Step 3: Configure Environment Variables

In Vercel dashboard, set the following environment variables:

**For Screenshot Service:**
- Not required (uses default URL)

**For Image Diff Service:**
- Not required (uses default URL)

**For Playwright:**
- `PLAYWRIGHT_BROWSERS_PATH` (optional) - Custom browser path

### Step 4: Get Service URLs

After deployment, note the URLs:
- Screenshot service: `https://your-app.vercel.app/api/screenshot`
- Image diff service: `https://your-app.vercel.app/api/image-diff`
- Accessibility service: `https://your-app.vercel.app/api/accessibility`

## Convex Environment Variables Setup

### Step 1: Access Convex Dashboard

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to Settings → Environment Variables

### Step 2: Add Environment Variables

Add the following environment variables:

```
SCREENSHOT_SERVICE_URL=https://your-app.vercel.app/api/screenshot
IMAGE_DIFF_SERVICE_URL=https://your-app.vercel.app/api/image-diff
ACCESSIBILITY_SERVICE_URL=https://your-app.vercel.app/api/accessibility
```

### Step 3: Update Convex Functions

The Convex functions in `convex/visualDiff.ts` and `convex/accessibilityTesting.ts` will automatically use these environment variables.

**Default behavior:**
- If environment variables are not set, functions will use placeholder URLs
- Functions will gracefully fall back to mock results if services are unavailable

## Testing the Setup

### Test Screenshot Service

```bash
curl -X POST https://your-app.vercel.app/api/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "componentCode": "window.Component = () => React.createElement(\"div\", null, \"Hello World\");"
  }'
```

### Test Image Diff Service

```bash
curl -X POST https://your-app.vercel.app/api/image-diff \
  -H "Content-Type: application/json" \
  -d '{
    "image1Url": "data:image/png;base64,...",
    "image2Url": "data:image/png;base64,...",
    "threshold": 0.1
  }'
```

### Test Accessibility Service

```bash
curl -X POST https://your-app.vercel.app/api/accessibility \
  -H "Content-Type: application/json" \
  -d '{
    "componentCode": "window.Component = () => React.createElement(\"button\", null, \"Click me\");",
    "level": "AA"
  }'
```

## Production Considerations

### Image Storage

Currently, screenshots are returned as base64 data URLs, which have size limitations. For production:

1. **Use S3/Cloudinary for storage:**
   - Upload screenshots to S3 or Cloudinary
   - Return URLs instead of base64
   - Update `api/screenshot.ts` to upload images

2. **Example S3 upload:**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });
const upload = await s3.send(new PutObjectCommand({
  Bucket: 'your-bucket',
  Key: `screenshots/${componentId}.png`,
  Body: screenshot,
  ContentType: 'image/png',
}));
const screenshotUrl = `https://your-bucket.s3.amazonaws.com/screenshots/${componentId}.png`;
```

### Performance Optimization

1. **Caching:**
   - Cache screenshots for unchanged components
   - Use Convex to store screenshot URLs

2. **Timeout Configuration:**
   - Set appropriate timeouts for Playwright operations
   - Configure Vercel function timeout (max 60s for Hobby, 300s for Pro)

3. **Concurrent Requests:**
   - Limit concurrent screenshot captures
   - Use queue system for batch operations

## Troubleshooting

### Playwright Installation Issues

If Playwright browsers are not installed in Vercel:

```bash
# Install Playwright browsers locally
npx playwright install chromium

# Or set PLAYWRIGHT_BROWSERS_PATH in Vercel environment variables
```

### Function Timeout

If functions timeout:
- Reduce screenshot wait time
- Optimize component rendering
- Use smaller viewports
- Upgrade Vercel plan for longer timeouts

### Image Size Limits

If base64 images are too large:
- Implement image storage (S3/Cloudinary)
- Compress images before returning
- Use progressive image loading

## Monitoring

### Vercel Logs

Monitor function execution in Vercel dashboard:
- Go to your project → Functions
- View logs for each function
- Check error rates and execution times

### Convex Logs

Monitor Convex actions:
- Go to Convex dashboard → Logs
- Filter by action name (e.g., `visualDiff:captureComponentScreenshot`)
- Check for errors and performance issues

## Next Steps

1. Deploy Vercel functions
2. Set Convex environment variables
3. Test with real Figma components
4. Monitor performance and errors
5. Optimize based on usage patterns

