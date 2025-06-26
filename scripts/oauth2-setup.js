#!/usr/bin/env node
import { createServer } from 'http';
import { parse } from 'url';
import { randomBytes, createHash } from 'crypto';
import open from 'open';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load existing .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

// Required scopes for full functionality
const SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'media.write',
  'tweet.moderate.write', // for deleting tweets
  'offline.access' // for refresh tokens
].join(' ');

// Generate PKCE parameters
function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Generate random state
function generateState() {
  return randomBytes(16).toString('hex');
}

// Build authorization URL
function buildAuthUrl(clientId, state, codeChallenge) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  return `${AUTH_URL}?${params.toString()}`;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code, codeVerifier, clientId, clientSecret) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

// Update .env file
async function updateEnvFile(tokens) {
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch (error) {
    // File doesn't exist, create new content
  }

  // Update or add OAuth 2.0 tokens
  const updates = {
    'OAUTH2_ACCESS_TOKEN': tokens.access_token,
    'OAUTH2_REFRESH_TOKEN': tokens.refresh_token || '',
    'OAUTH2_TOKEN_EXPIRES_AT': new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  await fs.writeFile(envPath, envContent.trim() + '\n');
}

// Main setup flow
async function main() {
  console.log('Twitter OAuth 2.0 Setup');
  console.log('======================\n');

  // Check for required credentials
  const clientId = process.env.OAUTH2_CLIENT_ID;
  const clientSecret = process.env.OAUTH2_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: OAUTH2_CLIENT_ID and OAUTH2_CLIENT_SECRET must be set in .env file');
    process.exit(1);
  }

  console.log('Client ID:', clientId);
  console.log('Client Secret:', '***' + clientSecret.slice(-4));
  console.log('Redirect URI:', REDIRECT_URI);
  console.log('Scopes:', SCOPES.split(' ').join(', '));
  console.log();
  
  console.log('\n⚠️  IMPORTANT: Make sure your Twitter app has this EXACT callback URL:');
  console.log(`   ${REDIRECT_URI}`);
  console.log('\nTo add it:');
  console.log('1. Go to https://developer.twitter.com/en/portal/dashboard');
  console.log('2. Select your app → User authentication settings → Edit');
  console.log('3. Add the callback URL above (no trailing slash!)');
  console.log('4. Save and try again\n');

  // Generate PKCE and state
  const { verifier, challenge } = generatePKCE();
  const state = generateState();
  
  // Create authorization URL
  const authUrl = buildAuthUrl(clientId, state, challenge);
  
  // Create server to handle callback
  const server = createServer(async (req, res) => {
    const { pathname, query } = parse(req.url, true);
    
    if (pathname === '/callback') {
      const receivedState = query.state;
      const code = query.code;
      const error = query.error;
      
      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization Failed</h1><p>' + error + '</p>');
        server.close();
        console.error('Authorization failed:', error);
        process.exit(1);
      }
      
      if (receivedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Invalid State</h1><p>State mismatch - possible CSRF attack</p>');
        server.close();
        console.error('State mismatch!');
        process.exit(1);
      }
      
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization Successful!</h1><p>You can close this window and return to the terminal.</p>');
        
        try {
          console.log('\nExchanging authorization code for tokens...');
          const tokens = await exchangeCodeForTokens(code, verifier, clientId, clientSecret);
          
          console.log('\nTokens received successfully!');
          console.log('Access Token:', tokens.access_token.substring(0, 20) + '...');
          if (tokens.refresh_token) {
            console.log('Refresh Token:', tokens.refresh_token.substring(0, 20) + '...');
          }
          console.log('Expires in:', tokens.expires_in, 'seconds');
          
          // Save to .env
          await updateEnvFile(tokens);
          console.log('\n✓ Tokens saved to .env file');
          console.log('\nYou can now use OAuth 2.0 authentication in your Twitter MCP server!');
          
        } catch (error) {
          console.error('Failed to exchange code for tokens:', error);
        }
        
        server.close();
        process.exit(0);
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`\nCallback server listening on http://localhost:${PORT}`);
    console.log('\nOpening authorization URL in your browser...');
    console.log('If the browser doesn\'t open, visit this URL manually:');
    console.log(authUrl);
    console.log();
    
    // Debug: Show the parsed URL components
    if (process.env.DEBUG === 'true') {
      console.log('\nDebug - Authorization URL components:');
      const urlParts = new URL(authUrl);
      urlParts.searchParams.forEach((value, key) => {
        if (key === 'code_challenge') {
          console.log(`  ${key}: ${value.substring(0, 20)}...`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      });
    }
    
    // Open browser
    open(authUrl).catch(() => {
      console.log('Failed to open browser automatically. Please open the URL manually.');
    });
  });
}

// Run the setup
main().catch(console.error);