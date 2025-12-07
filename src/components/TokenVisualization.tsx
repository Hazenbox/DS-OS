import React from 'react';
import { TokenType } from '../types';
import { Palette, Type, Box, Maximize2, Circle, Layers } from 'lucide-react';

// ============================================================================
// TOKEN VISUALIZATION COMPONENTS
// ============================================================================

interface TokenVisualizationProps {
  type: TokenType;
  value: string;
  name?: string;
  mode?: 'light' | 'dark' | 'high-contrast';
  modes?: Record<string, string>;
}

/**
 * Enhanced token preview with better visualizations
 */
export const TokenVisualization: React.FC<TokenVisualizationProps> = ({
  type,
  value,
  name,
  mode = 'light',
  modes,
}) => {
  switch (type) {
    case 'color':
      return <ColorSwatch value={value} name={name} mode={mode} modes={modes} />;
    case 'typography':
      return <TypographyPreview value={value} name={name} />;
    case 'spacing':
      return <SpacingVisualization value={value} name={name} />;
    case 'sizing':
      return <SizingVisualization value={value} name={name} />;
    case 'radius':
      return <RadiusVisualization value={value} name={name} />;
    case 'shadow':
      return <ShadowVisualization value={value} name={name} />;
    default:
      return <DefaultPreview value={value} />;
  }
};

/**
 * Enhanced color swatch with contrast ratio
 */
const ColorSwatch: React.FC<{
  value: string;
  name?: string;
  mode?: 'light' | 'dark' | 'high-contrast';
  modes?: Record<string, string>;
}> = ({ value, name, mode, modes }) => {
  const displayValue = modes && mode ? modes[mode] || value : value;
  const color = parseColor(displayValue);
  const contrastRatio = color ? getContrastRatio(color, { r: 255, g: 255, b: 255 }) : null;
  const textColor = contrastRatio && contrastRatio > 4.5 ? '#000000' : '#FFFFFF';
  
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-12 h-12 rounded border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
        style={{ backgroundColor: displayValue }}
        title={displayValue}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-zinc-900 dark:text-white truncate">
          {displayValue}
        </div>
        {contrastRatio && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Contrast: {contrastRatio.toFixed(2)}:1
          </div>
        )}
        {modes && Object.keys(modes).length > 1 && (
          <div className="flex gap-1 mt-1">
            {Object.keys(modes).map(m => (
              <div
                key={m}
                className={`w-3 h-3 rounded border ${
                  m === mode ? 'border-zinc-900 dark:border-white' : 'border-zinc-300 dark:border-zinc-600'
                }`}
                style={{ backgroundColor: modes[m] }}
                title={`${m} mode: ${modes[m]}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Typography preview with live text sample
 */
const TypographyPreview: React.FC<{ value: string; name?: string }> = ({ value, name }) => {
  // Parse typography value (could be JSON or CSS string)
  let fontFamily = 'Inter';
  let fontSize = '16px';
  let fontWeight = '400';
  let lineHeight = '1.5';
  let letterSpacing = '0';
  
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed.fontFamily) fontFamily = parsed.fontFamily;
    if (parsed.fontSize) fontSize = typeof parsed.fontSize === 'number' ? `${parsed.fontSize}px` : parsed.fontSize;
    if (parsed.fontWeight) fontWeight = String(parsed.fontWeight);
    if (parsed.lineHeight) lineHeight = String(parsed.lineHeight);
    if (parsed.letterSpacing) letterSpacing = typeof parsed.letterSpacing === 'number' ? `${parsed.letterSpacing}px` : parsed.letterSpacing;
  } catch {
    // If not JSON, try to extract from CSS string
    const fontSizeMatch = value.match(/font-size:\s*([^;]+)/);
    if (fontSizeMatch) fontSize = fontSizeMatch[1].trim();
  }
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <Type size={16} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-zinc-900 dark:text-white truncate"
          style={{
            fontFamily,
            fontSize,
            fontWeight,
            lineHeight,
            letterSpacing,
          }}
        >
          The quick brown fox jumps over the lazy dog
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {fontFamily} • {fontSize} • {fontWeight}
        </div>
      </div>
    </div>
  );
};

/**
 * Spacing visualization with grid overlay
 */
const SpacingVisualization: React.FC<{ value: string; name?: string }> = ({ value, name }) => {
  const spacing = parseSpacing(value);
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <Box size={16} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
            <div
              className="bg-purple-500 rounded"
              style={{
                width: spacing,
                height: spacing,
                minWidth: spacing,
                minHeight: spacing,
              }}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              {value}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {spacing}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Sizing visualization
 */
const SizingVisualization: React.FC<{ value: string; name?: string }> = ({ value, name }) => {
  const size = parseSize(value);
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <Maximize2 size={16} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
            <div
              className="bg-purple-500 rounded"
              style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
              }}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              {value}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {size}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Radius visualization
 */
const RadiusVisualization: React.FC<{ value: string; name?: string }> = ({ value, name }) => {
  const radius = parseRadius(value);
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <Circle size={16} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
            <div
              className="bg-purple-500"
              style={{
                width: 32,
                height: 32,
                borderRadius: radius,
              }}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">
              {value}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {radius}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Shadow visualization with depth indicator
 */
const ShadowVisualization: React.FC<{ value: string; name?: string }> = ({ value, name }) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <Layers size={16} className="text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
            <div
              className="bg-white dark:bg-zinc-700 rounded w-12 h-12"
              style={{
                boxShadow: value,
              }}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white truncate max-w-[200px]">
              {value}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Default preview
 */
const DefaultPreview: React.FC<{ value: string }> = ({ value }) => {
  return (
    <div className="text-sm text-zinc-600 dark:text-zinc-400 font-mono truncate max-w-[200px]">
      {value}
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseColor(value: string): { r: number; g: number; b: number } | null {
  // Parse hex
  const hexMatch = value.match(/#([0-9a-f]{6})/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1].substring(0, 2), 16),
      g: parseInt(hexMatch[1].substring(2, 4), 16),
      b: parseInt(hexMatch[1].substring(4, 6), 16),
    };
  }
  
  // Parse rgba
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
    };
  }
  
  return null;
}

function getContrastRatio(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(color: { r: number; g: number; b: number }): number {
  const [r, g, b] = [color.r, color.g, color.b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseSpacing(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)\s*px/);
  if (match) return parseFloat(match[1]);
  const numMatch = value.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);
  return 16;
}

function parseSize(value: string): number {
  return parseSpacing(value);
}

function parseRadius(value: string): number {
  return parseSpacing(value);
}

