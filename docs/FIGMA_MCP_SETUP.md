# Figma MCP Setup Guide

## Current Status

The MCP button in ComponentBuilder will automatically fall back to REST API extraction if MCP isn't available. This ensures extraction always works.

## Setting Up Figma MCP (Optional)

To use Figma MCP tools directly (no API keys needed), you need to:

### Prerequisites

1. **Figma Desktop App** - Must be installed
2. **Cursor with MCP Support** - Your Cursor IDE must have MCP configured
3. **Figma MCP Server** - Must be running and connected

### Setup Steps

1. **Install Figma Desktop App**
   - Download from: https://www.figma.com/downloads/
   - Install and log in

2. **Configure MCP in Cursor**
   - Open Cursor settings
   - Navigate to MCP/Extensions settings
   - Ensure Figma MCP server is configured
   - The server should connect to Figma desktop app

3. **Verify Connection**
   - Open Figma desktop app
   - Open a file with components
   - The MCP server should detect the active session

### Troubleshooting MCP Connection

**Error: "No session found for sessionId"**

This means:
- Figma desktop app MCP server isn't connected to Cursor
- Or the MCP server isn't running

**Solutions:**
1. Check Cursor MCP settings
2. Restart Figma desktop app
3. Restart Cursor
4. Verify MCP server is configured correctly

### Current Behavior

When you click the **MCP** button:
1. System attempts to use MCP tools
2. If MCP isn't available, automatically falls back to REST API
3. Extraction works either way!

### Benefits of MCP (When Available)

✅ No API keys needed  
✅ Direct access to design data  
✅ More detailed extraction  
✅ Real-time component access  

### Using REST API (Current Fallback)

The REST API method requires:
- Figma Personal Access Token (in Settings)
- Claude API Key (in Settings)

But it works reliably without desktop app setup.

## Recommendation

For now, use the **MCP** button - it will automatically use REST API if MCP isn't available. This gives you:
- Best of both worlds
- Automatic fallback
- Always works

When MCP is properly configured, it will automatically use MCP tools instead!

