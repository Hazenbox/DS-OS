# DS-OS Direct Figma MCP Connection Setup

This guide explains how to connect DS-OS directly to the Figma MCP server so the platform can extract components programmatically.

## How It Works

DS-OS now connects **directly** to the Figma Desktop MCP server running at `http://127.0.0.1:3845/mcp`. This allows DS-OS to:
- ✅ Call Figma MCP tools programmatically
- ✅ Extract components without API keys
- ✅ Work independently of Cursor's MCP configuration
- ✅ Use MCP tools directly from the platform

## Prerequisites

1. **Figma Desktop App** - Must be installed and running
2. **Figma File Open** - The file with your component must be open in desktop app
3. **MCP Server Enabled** - Enable MCP server in Figma Dev Mode

## Step-by-Step Setup

### Step 1: Install Figma Desktop App

1. Download from: https://www.figma.com/downloads/
2. Install and log in to your Figma account
3. **Keep it running** - The desktop app must be open

### Step 2: Enable Figma MCP Server

1. **Open Figma Desktop App**
   - Launch the Figma desktop application
   - Open the file containing your components

2. **Enable Dev Mode**
   - Press `Shift + D` or click the "Dev Mode" toggle in the toolbar
   - Make sure no objects are selected on the canvas

3. **Enable MCP Server**
   - In the right sidebar, find the **MCP server** section
   - Click **"Enable desktop MCP server"**
   - You should see a confirmation message
   - The server URL will be: `http://127.0.0.1:3845/mcp`

4. **Verify Server is Running**
   - The MCP server should show as "Enabled" or "Active"
   - You can copy the server URL if needed

### Step 3: Use DS-OS MCP Builder

1. **Open MCP Builder**
   - Navigate to **"MCP Builder"** in the DS-OS sidebar
   - This is the dedicated builder for MCP extraction

2. **Paste Figma URL**
   - Copy the Figma component URL from your browser
   - Paste it into the input field
   - URL format: `https://www.figma.com/design/abc123?node-id=1-2`

3. **Click "Extract with MCP"**
   - DS-OS will:
     - Connect to Figma MCP server at `http://127.0.0.1:3845/mcp`
     - Call `mcp_figma-desktop_get_design_context` with your node ID
     - Extract component data directly
     - Generate React component code
     - Save the component automatically

## Architecture

```
┌─────────────────┐
│  DS-OS Platform │
│  (MCP Builder)  │
└────────┬────────┘
         │ HTTP POST
         │ /api/figma-mcp (same origin)
         ▼
┌─────────────────┐
│  Vite Dev Server│
│  (Proxy)        │
└────────┬────────┘
         │ HTTP POST
         │ http://127.0.0.1:3845/mcp
         ▼
┌─────────────────┐
│ Figma MCP Server│
│  (Desktop App)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Figma Desktop  │
│      App        │
└─────────────────┘
```

**Note**: The Vite proxy (`/api/figma-mcp` → `http://127.0.0.1:3845/mcp`) avoids CORS issues by keeping browser requests same-origin.

## How DS-OS Connects

1. **MCP Client** (`src/services/figmaMcpClient.ts`)
   - Client-side helper functions
   - Makes requests to `/api/figma-mcp` (proxied by Vite)
   - Checks MCP server availability
   - Calls MCP tools: `mcp_figma-desktop_get_design_context`

2. **Vite Proxy** (`vite.config.ts`)
   - Routes `/api/figma-mcp` → `http://127.0.0.1:3845/mcp`
   - Avoids CORS issues by keeping requests same-origin
   - Only active in development mode

3. **MCP Extraction Action** (`convex/claudeExtraction.ts`)
   - Server-side action that processes MCP data
   - Receives pre-extracted MCP data from client
   - Generates React components with code and CSS

4. **MCP Builder UI** (`src/components/McpBuilder.tsx`)
   - User interface for MCP extraction
   - Calls MCP client to extract data
   - Passes data to extraction action
   - Shows progress and results

## MCP Server Endpoint

- **Direct URL**: `http://127.0.0.1:3845/mcp` (used by Vite proxy)
- **Proxy URL**: `/api/figma-mcp` (used by browser)
- **Method**: POST
- **Content-Type**: application/json
- **Protocol**: JSON-RPC 2.0

**Note**: In development, DS-OS uses the Vite proxy to avoid CORS. The browser makes requests to `/api/figma-mcp`, which Vite forwards to `http://127.0.0.1:3845/mcp`.

## Example MCP Request

```json
{
  "jsonrpc": "2.0",
  "id": 1234567890,
  "method": "tools/call",
  "params": {
    "name": "mcp_figma-desktop_get_design_context",
    "arguments": {
      "nodeId": "2012:35027",
      "clientLanguages": "typescript,html,css",
      "clientFrameworks": "react"
    }
  }
}
```

## Troubleshooting

### Error: "Figma MCP server is not available"

**Cause**: MCP server not enabled or Figma desktop app not running

**Solutions**:
1. ✅ Open Figma desktop app
2. ✅ Enable Dev Mode (`Shift + D`)
3. ✅ Click "Enable desktop MCP server" in right sidebar
4. ✅ Make sure the file is open in desktop app
5. ✅ Verify server shows as "Enabled"

### Error: "Connection refused" or "ECONNREFUSED"

**Cause**: MCP server not running on port 3845 or Vite proxy issue

**Solutions**:
1. Check if MCP server is enabled in Figma
2. Try restarting Figma desktop app
3. **Restart Vite dev server** (proxy config requires restart)
4. Check if another process is using port 3845
5. Verify firewall isn't blocking localhost connections
6. Check browser console for proxy errors

### Error: "No session found for sessionId"

**Cause**: Figma desktop app session not active

**Solutions**:
1. ✅ Make sure Figma desktop app is running
2. ✅ Open the file in desktop app (not just browser)
3. ✅ Ensure you're logged in to Figma
4. ✅ Try selecting the component in Figma

### CORS Error: "Access to fetch blocked by CORS policy"

**Cause**: Browser blocking direct requests to localhost (should not happen with proxy)

**Solutions**:
1. **Restart Vite dev server** - Proxy config requires restart
2. Verify `vite.config.ts` has proxy configuration
3. Check that requests go to `/api/figma-mcp` (not `http://127.0.0.1:3845/mcp`)
4. Clear browser cache and reload

### MCP Server Not Showing in Figma

**Cause**: Dev Mode not enabled or feature not available

**Solutions**:
1. Make sure you're using the latest Figma desktop app
2. Enable Dev Mode (`Shift + D`)
3. Check if MCP server option appears in right sidebar
4. Update Figma desktop app if needed

## Testing the Connection

1. **Check MCP Server Status**
   - In Figma desktop app, verify MCP server is "Enabled"
   - Server URL should be visible: `http://127.0.0.1:3845/mcp`

2. **Test in DS-OS**
   - Go to MCP Builder
   - Paste a Figma component URL
   - Click "Extract with MCP"
   - Should connect and extract successfully

3. **Check Browser Console**
   - Open browser DevTools
   - Look for `[FIGMA MCP]` logs
   - Should see connection and extraction logs

## Benefits

✅ **No API Keys** - Works directly with desktop app  
✅ **Direct Connection** - DS-OS connects to MCP server directly  
✅ **Programmatic** - Works from code, not just AI assistant  
✅ **Real-time** - Accesses currently open files  
✅ **Better Data** - More detailed extraction than REST API  

## Current Implementation

- ✅ MCP client service (`src/services/figmaMcpClient.ts`)
- ✅ Vite proxy configuration (`vite.config.ts`)
- ✅ MCP extraction action (`convex/claudeExtraction.ts`)
- ✅ MCP Builder UI (`src/components/McpBuilder.tsx`)
- ✅ Proxy-based connection (avoids CORS)
- ✅ Automatic component generation

## Next Steps

1. Enable MCP server in Figma desktop app
2. Open your component file in desktop app
3. Use MCP Builder in DS-OS
4. Extract components directly!

---

**Note**: The MCP server runs locally on your machine. DS-OS connects to it via HTTP at `http://127.0.0.1:3845/mcp`. This requires the Figma desktop app to be running with MCP server enabled.

