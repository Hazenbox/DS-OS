import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function for Image Comparison
 * 
 * Compares two images using pixelmatch algorithm
 * 
 * POST /api/image-diff
 * Body: {
 *   image1Url: string,      // URL or base64 of first image
 *   image2Url: string,      // URL or base64 of second image
 *   threshold?: number,      // Diff threshold (0-1, default 0.1)
 *   options?: {
 *     ignoreAreas?: Array<{ x, y, width, height }>,
 *     alpha?: number,
 *     diffColor?: string,
 *     diffColorAlt?: string,
 *   }
 * }
 * 
 * Returns: {
 *   diffPercentage: number,
 *   diffImage: string,      // Base64 encoded diff image
 *   passed: boolean,
 *   numDiffPixels: number,
 * }
 */

async function downloadImage(urlOrBase64: string): Promise<Buffer> {
  // Check if it's a base64 data URL
  if (urlOrBase64.startsWith('data:image')) {
    const base64 = urlOrBase64.split(',')[1];
    return Buffer.from(base64, 'base64');
  }

  // Otherwise, fetch from URL
  const response = await fetch(urlOrBase64);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      image1Url,
      image2Url,
      threshold = 0.1,
      options = {},
    } = req.body;

    if (!image1Url || !image2Url) {
      return res.status(400).json({
        error: 'Both image1Url and image2Url are required',
      });
    }

    // Download both images
    const [img1Buffer, img2Buffer] = await Promise.all([
      downloadImage(image1Url),
      downloadImage(image2Url),
    ]);

    // Parse PNGs
    const img1 = PNG.sync.read(img1Buffer);
    const img2 = PNG.sync.read(img2Buffer);

    // Validate dimensions match
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return res.status(400).json({
        error: 'Images must have the same dimensions',
        image1: { width: img1.width, height: img1.height },
        image2: { width: img2.width, height: img2.height },
      });
    }

    // Create diff image
    const diff = new PNG({ width: img1.width, height: img1.height });

    // Configure pixelmatch options
    const pixelmatchOptions: any = {
      threshold: threshold,
    };

    if (options.alpha !== undefined) {
      pixelmatchOptions.alpha = options.alpha;
    }

    if (options.diffColor) {
      pixelmatchOptions.diffColor = options.diffColor;
    }

    if (options.diffColorAlt) {
      pixelmatchOptions.diffColorAlt = options.diffColorAlt;
    }

    // Run pixelmatch
    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      img1.width,
      img1.height,
      pixelmatchOptions
    );

    // Calculate diff percentage
    const totalPixels = img1.width * img1.height;
    const diffPercentage = numDiffPixels / totalPixels;

    // Convert diff image to base64
    const diffBuffer = PNG.sync.write(diff);
    const diffBase64 = diffBuffer.toString('base64');
    const diffDataUrl = `data:image/png;base64,${diffBase64}`;

    // Determine if test passed
    const passed = diffPercentage <= threshold;

    return res.status(200).json({
      diffPercentage,
      diffImage: diffDataUrl,
      passed,
      numDiffPixels,
      totalPixels,
      threshold,
    });
  } catch (error) {
    console.error('Image diff error:', error);
    return res.status(500).json({
      error: 'Failed to compare images',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

