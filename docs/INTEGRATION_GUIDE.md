# Integration Guide for Foundation Features

This guide explains how to complete the integration of foundation features that require external services.

---

## 1. Visual Diff Testing (Playwright + pixelmatch)

### Current Status
- ✅ Infrastructure created (`convex/visualDiff.ts`)
- ✅ Packages installed (`playwright`, `pixelmatch`, `@axe-core/playwright`)
- ⚠️ **Needs**: External service setup (Playwright requires Node.js environment)

### Integration Options

#### Option A: Vercel Serverless Function (Recommended)
Create a Vercel serverless function for screenshot capture:

**File**: `api/screenshot.ts`
```typescript
import { chromium } from 'playwright';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { componentCode, viewport } = req.body;
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  if (viewport) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
  }
  
  // Render component
  await page.setContent(componentCode);
  
  // Capture screenshot
  const screenshot = await page.screenshot({ type: 'png' });
  
  await browser.close();
  
  // Upload to storage (S3, Cloudinary, etc.)
  const screenshotUrl = await uploadToStorage(screenshot);
  
  return res.status(200).json({ screenshotUrl });
}
```

**Update `convex/visualDiff.ts`**:
```typescript
const response = await fetch('https://your-app.vercel.app/api/screenshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    componentCode: component.code,
    viewport: args.viewport,
  }),
});
const { screenshotUrl } = await response.json();
return screenshotUrl;
```

#### Option B: Browserless.io (SaaS)
Use Browserless.io for managed Playwright:

```typescript
const response = await fetch('https://chrome.browserless.io/screenshot', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.BROWSERLESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: `data:text/html,${encodeURIComponent(componentCode)}`,
    viewport: args.viewport,
  }),
});
```

#### Option C: Docker Container
Run Playwright in a Docker container accessible via HTTP.

---

## 2. Image Comparison (pixelmatch)

### Integration

**File**: `api/image-diff.ts` (Vercel serverless function)
```typescript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { image1Url, image2Url, threshold } = req.body;
  
  // Download images
  const img1 = await downloadImage(image1Url);
  const img2 = await downloadImage(image2Url);
  
  // Parse PNGs
  const img1Png = PNG.sync.read(img1);
  const img2Png = PNG.sync.read(img2);
  
  // Create diff image
  const diff = new PNG({ width: img1Png.width, height: img1Png.height });
  
  // Run pixelmatch
  const numDiffPixels = pixelmatch(
    img1Png.data,
    img2Png.data,
    diff.data,
    img1Png.width,
    img1Png.height,
    { threshold: threshold || 0.1 }
  );
  
  const diffPercentage = numDiffPixels / (img1Png.width * img1Png.height);
  const diffImageBase64 = PNG.sync.write(diff).toString('base64');
  
  return res.status(200).json({
    diffPercentage,
    diffImage: `data:image/png;base64,${diffImageBase64}`,
    passed: diffPercentage <= threshold,
  });
}
```

**Update `convex/visualDiff.ts`**:
```typescript
const comparison = await fetch('https://your-app.vercel.app/api/image-diff', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image1Url: screenshotUrl,
    image2Url: figmaImageUrl,
    threshold,
  }),
}).then(res => res.json());
```

---

## 3. Accessibility Testing (axe-core)

### Integration

**File**: `api/accessibility.ts` (Vercel serverless function)
```typescript
import { chromium } from 'playwright';
import { injectAxe, checkA11y } from '@axe-core/playwright';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { componentCode, level, tags } = req.body;
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(componentCode);
  await injectAxe(page);
  
  const results = await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
    tags: tags || ['wcag2a', 'wcag2aa'],
  });
  
  await browser.close();
  
  const violations = results.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map(n => n.html),
  }));
  
  return res.status(200).json({
    passed: violations.length === 0,
    violations,
    score: violations.length === 0 ? 100 : Math.max(0, 100 - (violations.length * 10)),
  });
}
```

**Update `convex/accessibilityTesting.ts`**:
```typescript
const response = await fetch('https://your-app.vercel.app/api/accessibility', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    componentCode: component.code,
    level: args.rules?.level || 'AA',
    tags: args.rules?.tags,
  }),
});
const result = await response.json();
return result;
```

---

## 4. Storybook Deployment

### Option A: Vercel Deployment

1. **Create Storybook config** (`storybook-static/` directory)
2. **Deploy to Vercel**:
   ```bash
   vercel --prod storybook-static
   ```

3. **Update release pipeline** to generate and deploy Storybook after release approval.

### Option B: GitHub Pages

1. **Generate Storybook**:
   ```bash
   npm run build-storybook
   ```

2. **Deploy to GitHub Pages**:
   ```bash
   gh-pages -d storybook-static
   ```

### Integration in Release Pipeline

Add to `convex/releases.ts`:
```typescript
// After release approval
const storybookUrl = await deployStorybook(release);
await ctx.db.patch(releaseId, { storybookUrl });
```

---

## 5. MDX Documentation (Docusaurus)

### Setup Docusaurus

1. **Initialize Docusaurus**:
   ```bash
   npx create-docusaurus@latest docs-site classic
   ```

2. **Create MDX generator script**:
   ```typescript
   // scripts/generate-docs.ts
   import { generateMDX } from '../convex/mdxGenerator';
   
   async function generateDocs(componentId: string) {
     const mdx = await generateMDX(componentId);
     await fs.writeFile(`docs/components/${componentId}.mdx`, mdx);
   }
   ```

3. **Deploy to Vercel/Netlify**:
   ```bash
   npm run build
   vercel --prod
   ```

### Integration

Add to release pipeline:
```typescript
// After release approval
const docsUrl = await deployDocs(release);
await ctx.db.patch(releaseId, { docsUrl });
```

---

## Environment Variables

Add to `.env`:
```bash
# Screenshot Service
SCREENSHOT_SERVICE_URL=https://your-app.vercel.app/api/screenshot

# Image Diff Service
IMAGE_DIFF_SERVICE_URL=https://your-app.vercel.app/api/image-diff

# Accessibility Service
ACCESSIBILITY_SERVICE_URL=https://your-app.vercel.app/api/accessibility

# Browserless (if using)
BROWSERLESS_TOKEN=your-token

# Storage (S3, Cloudinary, etc.)
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=your-bucket
```

---

## Next Steps

1. **Set up Vercel serverless functions** for screenshot, image-diff, and accessibility
2. **Configure storage** (S3, Cloudinary, etc.) for image uploads
3. **Deploy Storybook** to Vercel/GitHub Pages
4. **Set up Docusaurus** for documentation
5. **Update Convex actions** to call external services
6. **Test end-to-end** workflow

---

## Testing

After integration, test:
1. Component screenshot capture
2. Visual diff comparison
3. Accessibility testing
4. Storybook generation and deployment
5. MDX documentation generation

---

**Status**: Infrastructure ready, awaiting external service setup

