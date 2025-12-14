import { chromium } from 'playwright';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

/**
 * Vercel Serverless Function for Screenshot Capture
 * 
 * Captures screenshots of React components using Playwright
 * 
 * POST /api/screenshot
 * Body: {
 *   componentCode: string,  // React component code
 *   viewport?: { width: number, height: number },
 *   waitFor?: number,        // Wait time in ms before screenshot
 * }
 * 
 * Returns: {
 *   screenshotUrl: string,   // URL to uploaded screenshot
 *   base64?: string,        // Base64 encoded screenshot (optional)
 * }
 */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { componentCode, css, viewport, waitFor = 100 } = req.body;

    if (!componentCode) {
      return res.status(400).json({ error: 'componentCode is required' });
    }

    // Launch browser
    const browser = await chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();

    // Set viewport if provided
    if (viewport) {
      await page.setViewportSize({
        width: viewport.width || 1280,
        height: viewport.height || 720,
      });
    } else {
      await page.setViewportSize({ width: 1280, height: 720 });
    }

    // The componentCode should be a complete React component
    // We need to wrap it properly for rendering in the browser
    // Extract component name from code (look for export const ComponentName or export function ComponentName)
    const componentNameMatch = componentCode.match(/export\s+(?:const|function)\s+(\w+)/);
    const componentName = componentNameMatch ? componentNameMatch[1] : 'Component';
    
    // Create HTML wrapper for the component
    // We'll use React 19 UMD build and render the component
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    }
    #root {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 20px;
    }
    ${css ? `/* Component Styles */\n    ${css.replace(/\n/g, '\n    ')}` : ''}
  </style>
</head>
<body>
  <div id="root"></div>
  <script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
  <script>
    (function() {
      try {
        // Create a module-like environment
        const module = { exports: {} };
        const exports = module.exports;
        
        // Execute component code
        ${componentCode.replace(/export\s+(const|function|default\s+function)/g, 'const')}
        
        // Get the component (try different export patterns)
        let Component = null;
        if (typeof ${componentName} !== 'undefined') {
          Component = ${componentName};
        } else if (module.exports.default) {
          Component = module.exports.default;
        } else if (module.exports) {
          Component = module.exports;
        } else if (window.Component) {
          Component = window.Component;
        }
        
        if (!Component) {
          throw new Error('Component not found. Expected: ' + ${JSON.stringify(componentName)});
        }
        
        // Render component
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
      } catch (error) {
        console.error('Component rendering error:', error);
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement('div', {
          style: {
            padding: '20px',
            border: '2px solid red',
            borderRadius: '8px',
            color: 'red',
            textAlign: 'center',
            fontFamily: 'monospace'
          }
        }, 'Error: ' + error.message));
      }
    })();
  </script>
</body>
</html>
    `;

    // Set content and wait for render
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // Wait additional time if specified
    if (waitFor > 0) {
      await page.waitForTimeout(waitFor);
    }

    // Wait for component to be visible
    try {
      await page.waitForSelector('#root > *', { timeout: 5000 });
    } catch (e) {
      // Component might not render, continue anyway
    }

    // Capture screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    await browser.close();

    // Upload to Vercel Blob Storage (if available)
    let screenshotUrl: string;
    let base64: string | undefined;
    
    // Check if BLOB_READ_WRITE_TOKEN is available
    const hasBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (hasBlobToken) {
      try {
        const blob = await put(`screenshots/${Date.now()}-${Math.random().toString(36).substring(7)}.png`, screenshot, {
          access: 'public',
          contentType: 'image/png',
          addRandomSuffix: false,
          cacheControlMaxAge: 86400, // 1 day cache
        });
        screenshotUrl = blob.url;
        console.log(`[SCREENSHOT] Uploaded to CDN: ${screenshotUrl}`);
      } catch (error) {
        console.warn('[SCREENSHOT] Failed to upload to Blob, using base64 fallback:', error);
        base64 = screenshot.toString('base64');
        screenshotUrl = `data:image/png;base64,${base64}`;
      }
    } else {
      // Fallback to base64 if Blob storage not configured
      base64 = screenshot.toString('base64');
      screenshotUrl = `data:image/png;base64,${base64}`;
      console.log('[SCREENSHOT] Using base64 (Blob storage not configured)');
    }
    
    return res.status(200).json({
      screenshotUrl,
      ...(base64 && { base64 }), // Include base64 for compatibility
    });
  } catch (error) {
    console.error('Screenshot capture error:', error);
    return res.status(500).json({
      error: 'Failed to capture screenshot',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

