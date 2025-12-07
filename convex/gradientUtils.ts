/**
 * Gradient Utilities
 * 
 * Handles complex gradient extraction and CSS generation, including:
 * - Nested gradients
 * - Gradient transforms
 * - Complex gradient stops
 * - Multi-layer gradients
 */

import { IRSFill } from "../src/types/ir";

/**
 * Convert gradient transform matrix to CSS angle/position
 */
export function gradientTransformToCSS(
  transform: number[][],
  gradientType: 'linear' | 'radial' | 'angular' | 'diamond',
  width: number,
  height: number
): string {
  if (!transform || transform.length < 2) {
    return '';
  }

  const [[a, b, c], [d, e, f]] = transform;

  if (gradientType === 'linear') {
    // Calculate angle from transform matrix
    // For linear gradients: angle = atan2(b, a) * (180 / PI) + 90
    const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI) + 90);
    return `${angle}deg`;
  }

  if (gradientType === 'radial') {
    // Calculate center position and size from transform
    // Transform maps from gradient space to element space
    const centerX = (c / width) * 100;
    const centerY = (f / height) * 100;
    const sizeX = Math.sqrt(a * a + d * d) * 100;
    const sizeY = Math.sqrt(b * b + e * e) * 100;
    
    if (sizeX === sizeY) {
      return `circle ${sizeX}% at ${centerX}% ${centerY}%`;
    } else {
      return `ellipse ${sizeX}% ${sizeY}% at ${centerX}% ${centerY}%`;
    }
  }

  if (gradientType === 'angular' || gradientType === 'diamond') {
    // Conic gradients: center position
    const centerX = (c / width) * 100;
    const centerY = (f / height) * 100;
    return `at ${centerX}% ${centerY}%`;
  }

  return '';
}

/**
 * Generate CSS gradient string from IRS fill
 */
export function gradientToCSS(
  fill: IRSFill,
  transform?: number[][],
  dimensions?: { width: number; height: number }
): string {
  if (fill.type !== 'gradient' || !fill.gradientStops || fill.gradientStops.length === 0) {
    return '';
  }

  const gradientType = fill.gradientType || 'linear';
  const stops = fill.gradientStops
    .map(stop => {
      const { r, g, b, a } = stop.color;
      const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
      return `${rgba} ${Math.round(stop.position * 100)}%`;
    })
    .join(', ');

  let position = '';
  if (transform && dimensions) {
    position = gradientTransformToCSS(transform, gradientType, dimensions.width, dimensions.height);
  }

  switch (gradientType) {
    case 'linear':
      return `linear-gradient(${position || '180deg'}, ${stops})`;
    
    case 'radial':
      return `radial-gradient(${position || 'circle'}, ${stops})`;
    
    case 'angular':
      return `conic-gradient(${position || 'from 0deg'}, ${stops})`;
    
    case 'diamond':
      // Diamond gradients are not directly supported in CSS
      // Use a workaround with multiple linear gradients or SVG
      return `linear-gradient(45deg, ${stops})`; // Fallback
    
    default:
      return `linear-gradient(180deg, ${stops})`;
  }
}

/**
 * Handle nested gradients (gradient within gradient)
 * This is a Figma feature that requires special handling
 */
export function handleNestedGradient(
  fill: IRSFill,
  parentFill?: IRSFill
): string {
  // If this is a nested gradient, combine with parent
  if (parentFill && parentFill.type === 'gradient' && fill.type === 'gradient') {
    // Create a multi-stop gradient that approximates the nested effect
    const combinedStops: Array<{ color: { r: number; g: number; b: number; a: number }; position: number }> = [];
    
    // Interpolate stops from both gradients
    if (parentFill.gradientStops && fill.gradientStops) {
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const parentStop = parentFill.gradientStops[Math.floor(t * (parentFill.gradientStops.length - 1))];
        const childStop = fill.gradientStops[Math.floor(t * (fill.gradientStops.length - 1))];
        
        // Blend colors
        const blendedColor = {
          r: parentStop.color.r * (1 - t) + childStop.color.r * t,
          g: parentStop.color.g * (1 - t) + childStop.color.g * t,
          b: parentStop.color.b * (1 - t) + childStop.color.b * t,
          a: parentStop.color.a * (1 - t) + childStop.color.a * t,
        };
        
        combinedStops.push({
          color: blendedColor,
          position: t,
        });
      }
    }
    
    return gradientToCSS({
      ...fill,
      gradientStops: combinedStops,
    });
  }
  
  return gradientToCSS(fill);
}

