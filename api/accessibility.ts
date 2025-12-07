import { chromium } from 'playwright';
import { injectAxe, checkA11y } from '@axe-core/playwright';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function for Accessibility Testing
 * 
 * Runs axe-core accessibility tests on React components
 * 
 * POST /api/accessibility
 * Body: {
 *   componentCode: string,  // React component code
 *   level?: 'A' | 'AA' | 'AAA',
 *   tags?: string[],
 * }
 * 
 * Returns: {
 *   passed: boolean,
 *   violations: Array<{ id, impact, description, help, helpUrl, nodes }>,
 *   score: number,  // 0-100
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
    const { componentCode, level = 'AA', tags } = req.body;

    if (!componentCode) {
      return res.status(400).json({ error: 'componentCode is required' });
    }

    // Launch browser
    const browser = await chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();

    // Create HTML wrapper for the component
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
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
      background: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    }
    #root {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
  <script>
    ${componentCode}
    
    // Render component
    const root = ReactDOM.createRoot(document.getElementById('root'));
    const Component = window.Component || (() => React.createElement('div', null, 'Component not found'));
    root.render(React.createElement(Component));
  </script>
</body>
</html>
    `;

    // Set content and wait for render
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500); // Wait for component to render

    // Inject axe-core
    await injectAxe(page);

    // Run accessibility check
    const results = await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      tags: tags || (level === 'A' ? ['wcag2a'] : level === 'AA' ? ['wcag2a', 'wcag2aa'] : ['wcag2a', 'wcag2aa', 'wcag2aaa']),
    });

    await browser.close();

    // Map violations to our format
    const violations = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => n.html),
    }));

    // Calculate score (0-100)
    const score = violations.length === 0 ? 100 : Math.max(0, 100 - (violations.length * 10));

    return res.status(200).json({
      passed: violations.length === 0,
      violations,
      score,
    });
  } catch (error) {
    console.error('Accessibility test error:', error);
    return res.status(500).json({
      error: 'Failed to run accessibility test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

