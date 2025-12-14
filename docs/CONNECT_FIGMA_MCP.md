# How to Connect DS-OS to Figma MCP

This guide will walk you through connecting DS-OS to Figma MCP (Model Context Protocol) so you can extract components directly from the Figma desktop app.

## What is Figma MCP?

Figma MCP allows AI assistants (like the one in Cursor) to interact directly with the Figma desktop app to extract design data. This provides:
- ✅ No API keys needed (when using desktop app)
- ✅ Direct access to design context
- ✅ More detailed extraction
- ✅ Real-time component access

## Prerequisites

1. **Figma Desktop App** - Must be installed and running
2. **Cursor IDE** - With MCP support enabled
3. **Figma MCP Server** - Must be configured in Cursor

## Step-by-Step Setup

### Step 1: Install Figma Desktop App

1. Download Figma Desktop from: https://www.figma.com/downloads/
2. Install and log in to your Figma account
3. **Important**: Keep the desktop app running while using MCP

### Step 2: Configure MCP in Cursor

MCP is configured in Cursor's settings, not in DS-OS code. Here's how:

#### Option A: Using Cursor Settings UI

1. **Open Cursor Settings**
   - Press `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
   - Or go to: `Cursor` → `Settings` → `Features` → `Model Context Protocol`

2. **Add Figma MCP Server**
   - Click "Add MCP Server" or "Configure MCP"
   - Look for "Figma Desktop" or "Figma MCP" in the list
   - Enable it if available

#### Option B: Using Cursor Configuration File

1. **Locate Cursor Config File**
   - The MCP configuration is typically in:
     - **Mac**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
     - **Windows**: `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
     - **Linux**: `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

2. **Add Figma MCP Configuration**

   If the file doesn't exist, create it. Add this configuration:

   ```json
   {
     "mcpServers": {
       "figma-desktop": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-figma-desktop"
         ]
       }
     }
   }
   ```

   Or if using a different MCP server format:

   ```json
   {
     "mcpServers": {
       "figma": {
         "url": "ws://localhost:8080",
         "transport": "websocket"
       }
     }
   }
   ```

### Step 3: Install Figma MCP Server (if needed)

If the MCP server isn't automatically available, you may need to install it:

```bash
npm install -g @modelcontextprotocol/server-figma-desktop
```

Or use npx (no installation needed):
```bash
npx @modelcontextprotocol/server-figma-desktop
```

### Step 4: Verify Connection

1. **Open Figma Desktop App**
   - Make sure it's running and you're logged in
   - Open a file with components

2. **Test MCP Connection in Cursor**
   - In Cursor, try asking the AI: "Can you access Figma MCP tools?"
   - Or check Cursor's MCP status/connection indicator

3. **Test in DS-OS**
   - Go to **MCP Builder** in DS-OS
   - Paste a Figma component URL
   - Click "Extract with MCP"
   - The AI should be able to use MCP tools

## Troubleshooting

### Error: "No session found for sessionId"

**Cause**: Figma desktop app MCP server isn't connected to Cursor

**Solutions**:
1. ✅ Ensure Figma desktop app is running
2. ✅ Check Cursor MCP settings are configured
3. ✅ Restart Figma desktop app
4. ✅ Restart Cursor IDE
5. ✅ Verify MCP server is running (check Cursor's MCP status)

### MCP Tools Not Available

**Cause**: MCP server not properly configured

**Solutions**:
1. Check Cursor's MCP configuration file exists
2. Verify the Figma MCP server is listed
3. Try reinstalling the MCP server: `npm install -g @modelcontextprotocol/server-figma-desktop`
4. Check Cursor's console/logs for MCP errors

### Figma Desktop App Not Detected

**Cause**: Figma desktop app not running or not accessible

**Solutions**:
1. ✅ Open Figma desktop app
2. ✅ Log in to your Figma account
3. ✅ Open a file in the desktop app (not just browser)
4. ✅ Check that the file is accessible

## Alternative: Using REST API (Current Fallback)

If MCP isn't available, DS-OS automatically falls back to REST API extraction:

1. **Configure API Keys in DS-OS**:
   - Go to **Settings** in DS-OS
   - Add **Figma Personal Access Token**
   - Add **Claude API Key**

2. **Use MCP Button**:
   - The MCP button will automatically use REST API if MCP isn't connected
   - Extraction works either way!

## Verifying MCP is Working

Once configured, you should see:

1. **In Cursor**: MCP tools available (check AI assistant capabilities)
2. **In DS-OS**: When clicking "Extract with MCP", the AI can use Figma MCP tools
3. **No API Keys Needed**: MCP extraction works without Figma PAT

## Current Status

- ✅ **MCP Builder** - Ready to use MCP tools
- ✅ **Automatic Fallback** - Uses REST API if MCP unavailable
- ✅ **Component Extraction** - Works with both methods

## Next Steps

1. Configure MCP in Cursor (follow steps above)
2. Test with a simple component
3. Extract components using MCP Builder
4. Enjoy no-API-key extraction! 🎉

## Need Help?

If you're still having issues:
1. Check Cursor's MCP documentation
2. Verify Figma desktop app is running
3. Check Cursor's console for MCP errors
4. Try the REST API fallback method

---

**Note**: MCP configuration is in Cursor, not DS-OS. DS-OS is ready to use MCP tools once Cursor is configured.

