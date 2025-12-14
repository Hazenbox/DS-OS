# Figma MCP Extraction - Quick Start Guide

## What You Need

1. **Figma Desktop App** - Must be installed and running
2. **Component Selected** - The component you want to extract should be accessible in Figma
3. **Figma URL** - Copy the URL from your browser when viewing the component

## Step-by-Step Process

### Step 1: Open Figma Desktop App
- Make sure Figma desktop app is installed and running
- Open the file containing your component

### Step 2: Get Component URL
1. In Figma, select the component you want to extract
2. Right-click → "Copy link" or use the share button
3. The URL should look like: `https://www.figma.com/file/abc123?node-id=1-2`

### Step 3: Use Component Builder
1. Go to Component Builder in DS-OS
2. Paste the Figma URL in the input field
3. Click the **"MCP"** button (next to "Extract & Build")
4. The AI assistant will automatically extract using MCP tools

### Step 4: Wait for Extraction
- The AI will use Figma MCP tools to extract the component
- Progress will be shown in real-time
- No API keys needed when using MCP!

## What Happens Behind the Scenes

1. **Node ID Extraction**: Converts URL format (`1-2`) to MCP format (`1:2`)
2. **MCP Tool Call**: AI uses `mcp_figma-desktop_get_design_context` to get component data
3. **Variable Extraction**: Optionally gets variables using `mcp_figma-desktop_get_variable_defs`
4. **Component Building**: Processes data through extraction pipeline
5. **Code Generation**: Generates React component with TypeScript, CSS, and Storybook

## Benefits of MCP

✅ **No API Keys Required** - Works directly with desktop app  
✅ **More Detailed Data** - Direct access to design context  
✅ **Real-time Access** - Works with currently open files  
✅ **Better Extraction** - More accurate component structure  

## Troubleshooting

### "No node ID found"
- Make sure you selected a specific component in Figma
- The URL must include `?node-id=...`

### "Figma desktop app not detected"
- Ensure Figma desktop app is running
- Make sure the file is open in the desktop app

### "Component not found"
- Verify the component is accessible
- Check that you have permission to view the file
- Try refreshing the Figma file

## Alternative: REST API Method

If MCP doesn't work, you can use the REST API method:
1. Click "Extract & Build" instead of "MCP"
2. Requires Figma PAT and Claude API Key (configure in Settings)
3. Works without desktop app

## Example

```
1. Open Figma desktop app
2. Select component "Button/Primary"
3. Copy URL: https://figma.com/file/abc123?node-id=1-2
4. Paste in Component Builder
5. Click "MCP" button
6. AI extracts and builds component automatically!
```

