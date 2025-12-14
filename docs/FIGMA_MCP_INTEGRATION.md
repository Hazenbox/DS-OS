# Figma MCP Integration Guide

This document explains how to use Figma MCP (Model Context Protocol) tools to extract and build components in DS-OS.

## Overview

The extraction pipeline now supports two methods:
1. **REST API** (default): Uses Figma REST API with Personal Access Token
2. **MCP Tools**: Uses Figma MCP tools for direct extraction from Figma desktop app

## MCP-Based Extraction

### What is MCP?

MCP (Model Context Protocol) allows AI assistants to interact directly with Figma desktop app to extract design data. This provides:
- Direct access to design context
- Better extraction of component structure
- Access to variables and design tokens
- No need for REST API tokens (when using desktop app)

### How It Works

1. **Extract Node ID**: Parse the node ID from the Figma URL
2. **Call MCP Tools**: Use `mcp_figma-desktop_get_design_context` to get component data
3. **Process Data**: Pass MCP results to `extractAndBuildComponentFromMCP` action
4. **Build Component**: The pipeline processes the data and generates the component

### Usage

#### Option 1: Using the AI Assistant

Ask the AI assistant to extract a component using MCP:

```
"Extract this Figma component using MCP: [Figma URL]"
```

The AI will:
1. Extract the node ID from the URL
2. Call Figma MCP tools to get design context
3. Process and build the component

#### Option 2: Programmatic Usage

```typescript
import { extractNodeIdFromFigmaUrl } from '../services/figmaMcpClient';
import { useAction } from 'convex/react';
import { api } from '../convex/_generated/api';

// In your component
const extractFromMCP = useAction(api.claudeExtraction.extractAndBuildComponentFromMCP);

// Extract node ID
const nodeId = extractNodeIdFromFigmaUrl(figmaUrl); // e.g., "1:2"

// Call MCP tools (this must be done by AI assistant)
// Then pass results to extraction action
const result = await extractFromMCP({
  projectId,
  tenantId,
  userId,
  figmaUrl,
  mcpDesignContext: mcpDesignContext, // From MCP tool
  mcpVariables: mcpVariables, // Optional, from MCP tool
  progressId,
});
```

### MCP Tools Available

1. **`mcp_figma-desktop_get_design_context`**
   - Gets complete design context for a node
   - Returns component structure, styles, layout, etc.
   - Required for extraction

2. **`mcp_figma-desktop_get_variable_defs`**
   - Gets variable definitions for a node
   - Returns design tokens and variables
   - Optional but recommended

3. **`mcp_figma-desktop_get_screenshot`**
   - Gets a screenshot of the component
   - Useful for preview/validation
   - Optional

### Node ID Format

Figma URLs use format: `node-id=1-2`
MCP tools require format: `1:2` (replace `-` with `:`)

The `extractNodeIdFromFigmaUrl` helper handles this conversion automatically.

### Example Flow

```typescript
// 1. User provides Figma URL
const figmaUrl = "https://figma.com/file/abc123?node-id=1-2";

// 2. Extract node ID
const nodeId = extractNodeIdFromFigmaUrl(figmaUrl); // "1:2"

// 3. AI Assistant calls MCP tools
const designContext = await mcp_figma-desktop_get_design_context({
  nodeId: "1:2",
  clientLanguages: "typescript,html,css",
  clientFrameworks: "react"
});

const variables = await mcp_figma-desktop_get_variable_defs({
  nodeId: "1:2"
});

// 4. Pass to extraction action
const result = await extractFromMCP({
  projectId,
  tenantId,
  userId,
  figmaUrl,
  mcpDesignContext: designContext,
  mcpVariables: variables,
  progressId,
});
```

## REST API vs MCP

### REST API (Default)
- ✅ Works without Figma desktop app
- ✅ Can be automated
- ❌ Requires Personal Access Token
- ❌ May have rate limits
- ❌ Less detailed extraction

### MCP Tools
- ✅ Direct access to design data
- ✅ More detailed extraction
- ✅ No API tokens needed (when using desktop app)
- ❌ Requires Figma desktop app to be open
- ❌ Must be called by AI assistant (not directly from code)

## Migration

The existing REST API extraction continues to work. To use MCP:

1. Ensure Figma desktop app is open
2. Ask AI assistant to extract using MCP
3. Or use `extractAndBuildComponentFromMCP` action with MCP data

## Troubleshooting

### "MCP design context is required"
- Ensure MCP tools were called successfully
- Check that node ID is correct format

### "Invalid MCP design context format"
- MCP response structure may vary
- The action handles multiple formats automatically
- If error persists, check MCP tool response structure

### "Node not found"
- Verify the node ID is correct
- Ensure the component is selected in Figma desktop app
- Check that Figma desktop app is running

## Files

- `convex/claudeExtraction.ts`: Extraction actions (REST API + MCP)
- `src/services/figmaMcpExtractor.ts`: MCP data processing utilities
- `src/services/figmaMcpClient.ts`: Client-side MCP helpers

