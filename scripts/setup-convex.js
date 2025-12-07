#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';

const TOKEN = process.env.CONVEX_AUTH_TOKEN || "eyJhbGciOiJSUzI1NiIsImtpZCI6InNzb19vaWRjX2tleV9wYWlyXzAxSzBZVjBTS1dXQkU3NDBKQVJRODY4OU1YIn0.eyJhdWQiOiJjbGllbnRfMDFLMFlWMFNOUFJZSjVBVjRBUzBWRzdUMUoiLCJ3b3Jrb3NfZW1haWwiOiJoYXplbmJveEBnbWFpbC5jb20iLCJjb252ZXhfbWVtYmVyX2lkIjoiMzUxNTcyIiwiaXNzIjoiaHR0cHM6Ly9hcGlhdXRoLmNvbnZleC5kZXYvdXNlcl9tYW5hZ2VtZW50L2NsaWVudF8wMUswWVYwU05QUllKNUFWNEFTMFZHN1QxSiIsInN1YiI6InVzZXJfMDFLOFNOQjJTRlpFREM1TkJYWEsyMFM1MVciLCJzaWQiOiJzZXNzaW9uXzAxS0JNUTdENEMzMDFFWFZFWTk3RTUxNVg1IiwianRpIjoiMDFLQk1RN0UyNzhQQzBBUkU3V05KSjRYUTgiLCJleHAiOjE3NjQ5Mzk2NjYsImlhdCI6MTc2NDg1MzI2Nn0.X5i7hgoAIeLPJ3FlAVaEz0zfNzXo_0A8oIO0vUSMiFkBKhHC8Rq6qR-IBC7kRZFSSpuLLYcjfBexNKPflvEMuQiBZCld8uFHzFaj-DHyE5UwE9T_QyfYOv-TynmYO6fj8WDfu-P0cxYFn4Ve5bnRW1Drmbbot0tFXh07b76RhBvQfsRaCIgrFKwQXveUeLhCr9tKVjDtzmS50W-yymkfONDEx2kL26bmBgOQXzla-tkpXWMcpcbQtMd3sybfeqC3I3qCI6cEAneGqTPvpnXE1o4mU1r-gNJQRRnFc30r8oY2yo8qDv-iRaZiLjjmNvrkVL73hFeV74u5dchwJ3t2LA";

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      // Handle SSL issues
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function setupConvex() {
  try {
    console.log('Fetching Convex deployments...');
    
    // Try to get deployments - try multiple API endpoints
    let deployments = null;
    try {
      deployments = await makeRequest('https://api.convex.dev/v1/list_deployments');
      console.log('Deployments response:', JSON.stringify(deployments, null, 2));
    } catch (e) {
      console.log('First API attempt failed, trying alternative endpoint...');
      try {
        // Try alternative endpoint
        deployments = await makeRequest('https://api.convex.dev/v1/projects');
      } catch (e2) {
        console.log('Alternative endpoint also failed:', e2.message);
      }
    }
    
    // If we have a deployment URL, use it
    if (deployments && deployments.deployments && deployments.deployments.length > 0) {
      const deployment = deployments.deployments[0];
      const url = deployment.url || `https://${deployment.deploymentName}.convex.cloud`;
      
      console.log(`Found deployment: ${url}`);
      
      // Create .env.local file
      const envContent = `VITE_CONVEX_URL=${url}\n`;
      fs.writeFileSync('.env.local', envContent);
      console.log('Created .env.local file with deployment URL');
      return;
    }
    
    // Try to create .convex directory structure manually
    console.log('Setting up local Convex configuration...');
    const convexDir = '.convex';
    if (!fs.existsSync(convexDir)) {
      fs.mkdirSync(convexDir, { recursive: true });
    }
    
    // Create a basic config file
    const config = {
      authInfo: {
        accessToken: TOKEN,
        deploymentName: null
      }
    };
    
    // Fallback: Use local dev server
    console.log('Using local dev server URL');
    const envContent = `VITE_CONVEX_URL=http://localhost:3210\n`;
    fs.writeFileSync('.env.local', envContent);
    console.log('Created .env.local file with local dev server URL');
    console.log('\nTo start Convex dev server, run:');
    console.log('  NODE_TLS_REJECT_UNAUTHORIZED=0 npx convex dev');
    console.log('\nOr if you have an existing deployment URL, update .env.local with:');
    console.log('  VITE_CONVEX_URL=https://your-deployment.convex.cloud');
    
  } catch (error) {
    console.error('Error:', error.message);
    // Fallback: Create .env.local with local URL
    const envContent = `VITE_CONVEX_URL=http://localhost:3210\n`;
    fs.writeFileSync('.env.local', envContent);
    console.log('Created .env.local file with local dev server URL (fallback)');
    console.log('\nTo work around SSL/fetch issues, try:');
    console.log('  NODE_TLS_REJECT_UNAUTHORIZED=0 npx convex dev');
  }
}

setupConvex();

