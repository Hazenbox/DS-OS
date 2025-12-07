import opentype from 'opentype.js';

export interface FontMetadata {
    fontFamily: string;
    fontSubfamily?: string;
    fullName?: string;
    isValid: boolean;
    error?: string;
}

/**
 * Extract font metadata from a font file (TTF, OTF)
 * Note: WOFF/WOFF2 need to be decompressed first, which is complex
 * For now, we'll handle TTF/OTF directly and provide fallback for WOFF/WOFF2
 */
export async function extractFontMetadata(file: File): Promise<FontMetadata> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const font = opentype.parse(arrayBuffer);
        
        // Extract font family name from font metadata
        const fontFamily = font.names.fontFamily?.en || 
                          font.names.fullName?.en || 
                          font.names.postScriptName?.en ||
                          '';
        
        const fontSubfamily = font.names.fontSubfamily?.en || '';
        const fullName = font.names.fullName?.en || '';
        
        // Normalize font family name (remove extra spaces, special chars)
        const normalizedFamily = fontFamily
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/['"]/g, '');
        
        return {
            fontFamily: normalizedFamily,
            fontSubfamily,
            fullName,
            isValid: true,
        };
    } catch (error) {
        // For WOFF/WOFF2, opentype.js might not work directly
        // Fallback: try to extract from filename or return error
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const fallbackName = fileName
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
        
        return {
            fontFamily: fallbackName || 'Unknown Font',
            isValid: false,
            error: error instanceof Error ? error.message : 'Unable to parse font metadata. Using filename as fallback.',
        };
    }
}

/**
 * Parse font URL from common hosting services
 */
export interface ParsedFontUrl {
    isValid: boolean;
    fontUrl: string;
    fontFamily?: string;
    format?: 'woff' | 'woff2' | 'ttf' | 'otf';
    error?: string;
}

export async function parseFontUrl(url: string): Promise<ParsedFontUrl> {
    try {
        // Validate URL format
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname.toLowerCase();
        
        // Extract format from URL
        let format: 'woff' | 'woff2' | 'ttf' | 'otf' = 'woff2';
        if (pathname.includes('.woff2')) format = 'woff2';
        else if (pathname.includes('.woff')) format = 'woff';
        else if (pathname.includes('.ttf')) format = 'ttf';
        else if (pathname.includes('.otf')) format = 'otf';
        
        // Google Fonts Specimen Page
        if (hostname.includes('fonts.google.com') && pathname.includes('/specimen/')) {
            // Extract font name from specimen URL: https://fonts.google.com/specimen/Roboto
            const fontNameMatch = pathname.match(/\/specimen\/([^/?]+)/);
            if (fontNameMatch) {
                const fontName = fontNameMatch[1];
                const fontFamily = fontName
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .trim();
                
                // Return special marker to fetch from Google Fonts API
                return {
                    isValid: true,
                    fontUrl: `GOOGLE_FONTS_SPECIMEN:${fontName}`, // Special marker
                    fontFamily,
                    format: 'woff2', // Google Fonts typically uses woff2
                };
            }
        }
        
        // Google Fonts API
        if (hostname.includes('fonts.googleapis.com') || hostname.includes('fonts.gstatic.com')) {
            // Google Fonts URLs are typically: https://fonts.gstatic.com/s/fontname/v1/fontfile.woff2
            // Extract font name from path
            const pathParts = pathname.split('/');
            const fontNameMatch = pathname.match(/\/s\/([^/]+)\//);
            const fontFamily = fontNameMatch 
                ? fontNameMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                : undefined;
            
            return {
                isValid: true,
                fontUrl: url,
                fontFamily,
                format,
            };
        }
        
        // GitHub raw content
        if (hostname.includes('github.com') || hostname.includes('githubusercontent.com')) {
            // GitHub URLs: https://raw.githubusercontent.com/user/repo/branch/path/font.woff2
            // Try to extract font name from path
            const pathParts = pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const fontFamily = fileName
                .replace(/\.[^/.]+$/, '') // Remove extension
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim();
            
            return {
                isValid: true,
                fontUrl: url,
                fontFamily: fontFamily || undefined,
                format,
            };
        }
        
        // DaFont, Font Squirrel, etc. - direct font file links
        if (format !== 'woff2') {
            // Extract font name from filename
            const fileName = pathname.split('/').pop() || '';
            const fontFamily = fileName
                .replace(/\.[^/.]+$/, '')
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim();
            
            return {
                isValid: true,
                fontUrl: url,
                fontFamily: fontFamily || undefined,
                format,
            };
        }
        
        // Generic URL - validate it's a font file
        if (!['woff', 'woff2', 'ttf', 'otf'].some(ext => pathname.endsWith(`.${ext}`))) {
            return {
                isValid: false,
                fontUrl: url,
                error: 'URL does not appear to be a font file (.woff, .woff2, .ttf, or .otf)',
            };
        }
        
        // Extract font name from filename as fallback
        const fileName = pathname.split('/').pop() || '';
        const fontFamily = fileName
            .replace(/\.[^/.]+$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
        
        return {
            isValid: true,
            fontUrl: url,
            fontFamily: fontFamily || undefined,
            format,
        };
    } catch (error) {
        return {
            isValid: false,
            fontUrl: url,
            error: 'Invalid URL format',
        };
    }
}

/**
 * Get Google Fonts API URL for a font family
 */
async function getGoogleFontsUrl(fontName: string): Promise<string | null> {
    try {
        // Use Google Fonts API to get font files
        // API: https://fonts.googleapis.com/css2?family=FontName:wght@400
        const apiUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        
        if (!response.ok) {
            return null;
        }
        
        const css = await response.text();
        
        // Extract font URL from CSS @font-face rule
        // Format: url(https://fonts.gstatic.com/s/fontname/v18/fontfile.woff2)
        const urlMatch = css.match(/url\(([^)]+)\)/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1].replace(/['"]/g, '');
        }
        
        return null;
    } catch (error) {
        console.error('[FontUtils] Failed to fetch Google Fonts URL:', error);
        return null;
    }
}

/**
 * Fetch font file from URL and extract metadata
 */
export async function fetchAndExtractFontMetadata(url: string): Promise<FontMetadata> {
    try {
        // Handle Google Fonts specimen URLs
        if (url.startsWith('GOOGLE_FONTS_SPECIMEN:')) {
            const fontName = url.replace('GOOGLE_FONTS_SPECIMEN:', '');
            const fontUrl = await getGoogleFontsUrl(fontName);
            
            if (!fontUrl) {
                return {
                    fontFamily: fontName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    isValid: false,
                    error: 'Failed to fetch font URL from Google Fonts API',
                };
            }
            
            // Recursively fetch the actual font file
            return fetchAndExtractFontMetadata(fontUrl);
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'font/woff2,font/woff,application/font-woff2,application/font-woff,font/ttf,font/otf,*/*',
            },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Try to parse with opentype.js (works for TTF/OTF)
        try {
            const font = opentype.parse(arrayBuffer);
            const fontFamily = font.names.fontFamily?.en || 
                              font.names.fullName?.en || 
                              font.names.postScriptName?.en ||
                              '';
            
            const normalizedFamily = fontFamily
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/['"]/g, '');
            
            return {
                fontFamily: normalizedFamily,
                fontSubfamily: font.names.fontSubfamily?.en,
                fullName: font.names.fullName?.en,
                isValid: true,
            };
        } catch (parseError) {
            // If parsing fails (e.g., WOFF/WOFF2), extract from URL
            const urlObj = new URL(url);
            const fileName = urlObj.pathname.split('/').pop() || '';
            const fallbackName = fileName
                .replace(/\.[^/.]+$/, '')
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim();
            
            return {
                fontFamily: fallbackName || 'Unknown Font',
                isValid: false,
                error: 'Unable to parse font metadata from URL. Using filename as fallback.',
            };
        }
    } catch (error) {
        return {
            fontFamily: 'Unknown Font',
            isValid: false,
            error: error instanceof Error ? error.message : 'Failed to fetch font from URL',
        };
    }
}

/**
 * Normalize font family names for comparison
 */
export function normalizeFontFamily(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/['"]/g, '')
        .replace(/[-_]/g, ' ');
}

/**
 * Check if two font family names match (fuzzy matching)
 */
export function fontFamilyMatches(expected: string, actual: string): boolean {
    const normalizedExpected = normalizeFontFamily(expected);
    const normalizedActual = normalizeFontFamily(actual);
    
    // Exact match
    if (normalizedExpected === normalizedActual) return true;
    
    // Check if one contains the other (e.g., "Inter" matches "Inter Regular")
    if (normalizedExpected.includes(normalizedActual) || normalizedActual.includes(normalizedExpected)) {
        return true;
    }
    
    // Check word-by-word match (e.g., "Inter" matches "Inter Display")
    const expectedWords = normalizedExpected.split(' ');
    const actualWords = normalizedActual.split(' ');
    
    // If all words in expected are in actual, consider it a match
    if (expectedWords.every(word => actualWords.includes(word))) {
        return true;
    }
    
    return false;
}

