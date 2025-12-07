// Token parser utilities - no "use node" needed for pure functions

// ============================================================================
// TOKEN PARSER - Server-side JSON parsing for Figma token files
// ============================================================================

export type TokenType = 
  | "color"
  | "typography"
  | "spacing"
  | "sizing"
  | "radius"
  | "shadow"
  | "blur"
  | "unknown";

export interface ParsedToken {
  name: string;
  value: string; // Default value
  valueByMode?: Record<string, string>; // Mode-specific values
  type: TokenType;
  description?: string;
  modes?: string[]; // Available modes
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean token name (remove special chars, normalize)
 */
function cleanName(name: string): string {
  let cleaned = name.trim();
  // Remove leading/trailing slashes and dots
  cleaned = cleaned.replace(/^[\/\.]+|[\/\.]+$/g, '');
  // Replace multiple slashes/dots with single
  cleaned = cleaned.replace(/[\/\.]+/g, '/');
  return cleaned;
}

/**
 * Get token type from Figma scopes
 */
function getTypeFromScopes(scopes: string[] | undefined): TokenType | null {
  if (!scopes || !Array.isArray(scopes)) return null;
  
  const scopeStr = scopes.join(' ').toLowerCase();
  
  if (scopeStr.includes('color') || scopeStr.includes('fill')) return 'color';
  if (scopeStr.includes('text') || scopeStr.includes('typography') || scopeStr.includes('font')) return 'typography';
  if (scopeStr.includes('spacing') || scopeStr.includes('gap') || scopeStr.includes('padding') || scopeStr.includes('margin')) return 'spacing';
  if (scopeStr.includes('size') || scopeStr.includes('width') || scopeStr.includes('height')) return 'sizing';
  if (scopeStr.includes('radius') || scopeStr.includes('corner')) return 'radius';
  if (scopeStr.includes('shadow') || scopeStr.includes('elevation')) return 'shadow';
  if (scopeStr.includes('blur')) return 'blur';
  
  return null;
}

/**
 * Get token type from name patterns
 */
function getTypeFromName(name: string): TokenType | null {
  const lower = name.toLowerCase();
  
  if (lower.includes('color') || lower.includes('bg') || lower.includes('background') || 
      lower.includes('text') || lower.includes('border') || lower.includes('icon')) {
    return 'color';
  }
  if (lower.includes('font') || lower.includes('text-') || lower.includes('typography') || 
      lower.includes('line-height') || lower.includes('letter-spacing') || lower.includes('font-size')) {
    return 'typography';
  }
  if (lower.includes('space') || lower.includes('spacing') || lower.includes('padding') || 
      lower.includes('gap') || lower.includes('margin')) {
    return 'spacing';
  }
  if (lower.includes('size') || lower.includes('width') || lower.includes('height')) {
    return 'sizing';
  }
  if (lower.includes('radius') || lower.includes('corner') || lower.includes('rounded')) {
    return 'radius';
  }
  if (lower.includes('shadow') || lower.includes('elevation')) {
    return 'shadow';
  }
  if (lower.includes('blur')) {
    return 'blur';
  }
  
  return null;
}

/**
 * Get token type from value patterns
 */
function getTypeFromValue(value: string): TokenType | null {
  // Color patterns
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value)) return 'color';
  if (/^rgba?\(/.test(value)) return 'color';
  if (/^hsla?\(/.test(value)) return 'color';
  
  // Spacing/sizing patterns (numbers with units)
  if (/^\d+(\.\d+)?(px|rem|em|pt)$/.test(value)) {
    // Could be spacing or sizing, default to spacing
    return 'spacing';
  }
  
  // Typography patterns
  if (/^\d+(\.\d+)?(px|rem|em|pt|%)$/.test(value) && value.includes('font')) return 'typography';
  
  return null;
}

/**
 * Format value based on type
 */
function formatValue(value: any, figmaType?: string): string {
  if (value === null || value === undefined) return '';
  
  // Handle color objects
  if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    const a = value.a !== undefined ? value.a : 1;
    
    if (a === 1) {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } else {
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  
  // Handle typography objects
  if (typeof value === 'object' && 'fontFamily' in value) {
    const parts: string[] = [];
    if (value.fontFamily) parts.push(`font-family: ${value.fontFamily}`);
    if (value.fontSize) parts.push(`font-size: ${value.fontSize}`);
    if (value.fontWeight) parts.push(`font-weight: ${value.fontWeight}`);
    if (value.lineHeight) parts.push(`line-height: ${value.lineHeight}`);
    if (value.letterSpacing) parts.push(`letter-spacing: ${value.letterSpacing}`);
    return parts.join('; ');
  }
  
  // Handle string/number
  return String(value);
}

// ============================================================================
// PARSERS
// ============================================================================

/**
 * Parse Figma Variables format (sizing.json, typography.json)
 */
function parseFigmaVariables(json: any): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  
  if (!json.variables || !Array.isArray(json.variables)) return tokens;
  
  // Get the first mode ID
  const modeIds = json.modes ? Object.keys(json.modes) : [];
  const defaultModeId = modeIds[0] || '1:0';
  
  // Map mode IDs to mode names
  const modeNameMap: Record<string, string> = {};
  if (json.modes) {
    for (const [modeId, modeInfo] of Object.entries(json.modes)) {
      if (typeof modeInfo === 'object' && modeInfo !== null && 'name' in modeInfo) {
        modeNameMap[modeId] = (modeInfo as any).name;
      } else {
        // Fallback to mode ID if no name
        modeNameMap[modeId] = modeId;
      }
    }
  }
  
  for (const variable of json.variables) {
    const { name, description, type, scopes, resolvedValuesByMode, valuesByMode } = variable;
    
    // Extract all mode values
    const valueByMode: Record<string, string> = {};
    const availableModes: string[] = [];
    let defaultValue: any = null;
    
    // Process resolvedValuesByMode (preferred - already resolved)
    if (resolvedValuesByMode) {
      for (const [modeId, modeData] of Object.entries(resolvedValuesByMode)) {
        if (modeData && typeof modeData === 'object' && 'resolvedValue' in modeData) {
          const modeName = modeNameMap[modeId] || modeId;
          const formatted = formatValue((modeData as any).resolvedValue, type);
          valueByMode[modeName] = formatted;
          availableModes.push(modeName);
          if (defaultValue === null) {
            defaultValue = (modeData as any).resolvedValue;
          }
        }
      }
    }
    
    // Fall back to valuesByMode if no resolved values
    if (Object.keys(valueByMode).length === 0 && valuesByMode) {
      for (const [modeId, modeValue] of Object.entries(valuesByMode)) {
        // Skip aliases (references to other variables)
        if (typeof modeValue === 'object' && modeValue !== null && 'type' in modeValue && (modeValue as any).type === 'VARIABLE_ALIAS') {
          continue;
        }
        const modeName = modeNameMap[modeId] || modeId;
        const formatted = formatValue(modeValue, type);
        valueByMode[modeName] = formatted;
        availableModes.push(modeName);
        if (defaultValue === null) {
          defaultValue = modeValue;
        }
      }
    }
    
    if (defaultValue === null || defaultValue === undefined) continue;
    
    // Determine token type
    let tokenType: TokenType = 'unknown';
    
    // First try scopes
    const scopeType = getTypeFromScopes(scopes);
    if (scopeType) tokenType = scopeType;
    
    // Then try name
    if (tokenType === 'unknown') {
      const nameType = getTypeFromName(name);
      if (nameType) tokenType = nameType;
    }
    
    // Then try value
    if (tokenType === 'unknown') {
      const valueType = getTypeFromValue(formatValue(defaultValue, type));
      if (valueType) tokenType = valueType;
    }
    
    // Format the default value
    const formattedDefaultValue = formatValue(defaultValue, type);
    
    tokens.push({
      name: cleanName(name),
      value: formattedDefaultValue,
      valueByMode: Object.keys(valueByMode).length > 1 ? valueByMode : undefined,
      type: tokenType,
      description: description || undefined,
      modes: availableModes.length > 0 ? availableModes : undefined,
    });
  }
  
  return tokens;
}

/**
 * Parse flat tokens format (colors.slides.light.json)
 */
function parseFlatTokens(json: any): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  
  if (!json.tokens || typeof json.tokens !== 'object') return tokens;
  
  for (const [key, value] of Object.entries(json.tokens)) {
    if (value === null || value === undefined) continue;
    
    const strValue = String(value);
    
    // Determine token type
    let tokenType: TokenType = 'unknown';
    
    // Try name first
    const nameType = getTypeFromName(key);
    if (nameType) tokenType = nameType;
    
    // Then try value
    if (tokenType === 'unknown') {
      const valueType = getTypeFromValue(strValue);
      if (valueType) tokenType = valueType;
    }
    
    tokens.push({
      name: cleanName(key),
      value: strValue,
      type: tokenType,
    });
  }
  
  return tokens;
}

/**
 * Parse generic nested JSON
 */
function parseGenericJSON(json: any, parentKey: string = ''): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  
  if (json === null || json === undefined) return tokens;
  
  // Primitive value
  if (typeof json === 'string' || typeof json === 'number' || typeof json === 'boolean') {
    const value = String(json);
    const nameType = getTypeFromName(parentKey);
    const valueType = getTypeFromValue(value);
    
    tokens.push({
      name: cleanName(parentKey || 'token'),
      value: formatValue(json),
      type: nameType || valueType || 'unknown',
    });
    return tokens;
  }
  
  // Object with $value (DTCG format)
  if (typeof json === 'object' && '$value' in json) {
    const value = json.$value;
    const nameType = getTypeFromName(parentKey);
    const valueType = getTypeFromValue(formatValue(value));
    
    tokens.push({
      name: cleanName(parentKey || 'token'),
      value: formatValue(value),
      type: nameType || valueType || 'unknown',
      description: json.$description,
    });
    return tokens;
  }
  
  // Object with value key
  if (typeof json === 'object' && 'value' in json && typeof json.value !== 'object') {
    const value = json.value;
    const nameType = getTypeFromName(parentKey);
    const valueType = getTypeFromValue(formatValue(value));
    
    tokens.push({
      name: cleanName(parentKey || 'token'),
      value: formatValue(value),
      type: nameType || valueType || 'unknown',
      description: json.description,
    });
    return tokens;
  }
  
  // Recurse into object
  if (typeof json === 'object' && !Array.isArray(json)) {
    for (const [key, val] of Object.entries(json)) {
      // Skip metadata keys
      if (key.startsWith('$') || key.startsWith('_')) continue;
      
      const newKey = parentKey ? `${parentKey}/${key}` : key;
      tokens.push(...parseGenericJSON(val, newKey));
    }
  }
  
  // Array
  if (Array.isArray(json)) {
    json.forEach((item, idx) => {
      const newKey = parentKey ? `${parentKey}/${idx}` : String(idx);
      tokens.push(...parseGenericJSON(item, newKey));
    });
  }
  
  return tokens;
}

/**
 * Main parser - auto-detects format
 */
export function parseTokensFromJSON(json: any): ParsedToken[] {
  // Detect format and parse accordingly
  
  // Figma Variables format (has 'variables' array)
  if (json.variables && Array.isArray(json.variables)) {
    console.log('[TOKEN PARSER] Detected Figma Variables format');
    return parseFigmaVariables(json);
  }
  
  // Flat tokens format (has 'tokens' object with string values)
  if (json.tokens && typeof json.tokens === 'object' && !Array.isArray(json.tokens)) {
    const firstValue = Object.values(json.tokens)[0];
    if (typeof firstValue === 'string' || typeof firstValue === 'number') {
      console.log('[TOKEN PARSER] Detected flat tokens format');
      return parseFlatTokens(json);
    }
  }
  
  // Generic nested JSON
  console.log('[TOKEN PARSER] Using generic JSON parser');
  return parseGenericJSON(json);
}

