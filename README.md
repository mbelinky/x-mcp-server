[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/enescinr-twitter-mcp-badge.png)](https://mseep.ai/app/enescinr-twitter-mcp)

# Twitter MCP Server - Extended Edition

[![smithery badge](https://smithery.ai/badge/@enescinar/twitter-mcp)](https://smithery.ai/server/@enescinar/twitter-mcp)

A Model Context Protocol (MCP) server that enables Claude to interact with Twitter/X, supporting posting tweets (with or without media), searching tweets, and managing your Twitter presence.

<a href="https://glama.ai/mcp/servers/dhsudtc7cd">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/dhsudtc7cd/badge" alt="Twitter Server MCP server" />
</a>

## ✨ Features

- **Post Tweets**: Create text tweets with optional media attachments (images, GIFs)
- **Search Tweets**: Search Twitter with customizable result count
- **Delete Tweets**: Remove your tweets programmatically
- **Dual Authentication**: Support for both OAuth 1.0a and OAuth 2.0
- **Media Upload**: Post images using the appropriate API version for each auth method
- **Rate Limiting**: Built-in protection for Twitter's API limits
- **Type Safety**: Full TypeScript implementation with Zod validation

## 📋 Prerequisites

Before you begin, you'll need:

1. A Twitter/X Developer Account (sign up at [developer.twitter.com](https://developer.twitter.com))
2. A Twitter App created in the Developer Portal
3. API credentials (detailed setup below)
4. Node.js 18+ installed

## 🔐 Authentication Setup

This server supports two authentication methods. Choose based on your needs:

- **OAuth 1.0a**: Simpler setup, works with all features including v1.1 fallbacks
- **OAuth 2.0**: Modern authentication, required for some newer features

### Setting Up Your Twitter App

1. **Create a Developer Account**:
   - Go to [developer.twitter.com](https://developer.twitter.com)
   - Sign in with your Twitter account
   - Apply for developer access if you haven't already

2. **Create a New App**:
   - Navigate to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Click "Projects & Apps" → "New Project"
   - Give your project a name
   - Select your use case
   - Create a new App within the project

3. **Configure App Permissions**:
   - In your app settings, go to "User authentication settings"
   - Click "Set up"
   - Enable OAuth 1.0a and/or OAuth 2.0
   - Set App permissions to "Read and write"
   - Add Callback URLs:
     - For OAuth 1.0a: `http://localhost:3000/callback`
     - For OAuth 2.0: `http://localhost:3000/callback`
   - Set Website URL (can be your GitHub repo)

### OAuth 1.0a Setup

1. **Get Your Credentials**:
   - In your app's "Keys and tokens" tab
   - Copy your API Key and API Key Secret
   - Generate Access Token and Secret (click "Generate")
   - Make sure the access token has "Read and Write" permissions

2. **Required Credentials**:
   ```
   API_KEY=your_api_key_here
   API_SECRET_KEY=your_api_secret_key_here
   ACCESS_TOKEN=your_access_token_here
   ACCESS_TOKEN_SECRET=your_access_token_secret_here
   ```

### OAuth 2.0 Setup

1. **Get Your Client Credentials**:
   - In your app's "Keys and tokens" tab
   - Find OAuth 2.0 Client ID and Client Secret
   - Save these for the next step

2. **Generate User Tokens**:
   
   Option A - Use our helper script:
   ```bash
   # Clone this repository first
   git clone https://github.com/mbelinky/x-mcp-server.git
   cd x-mcp-server/twitter-mcp
   npm install
   
   # Run the OAuth2 setup script
   node scripts/oauth2-setup.js
   ```
   
   Option B - Manual setup:
   - Use the OAuth 2.0 flow with PKCE
   - Required scopes: `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`
   - Exchange authorization code for access token

3. **Required Credentials**:
   ```
   AUTH_TYPE=oauth2
   OAUTH2_CLIENT_ID=your_client_id_here
   OAUTH2_CLIENT_SECRET=your_client_secret_here
   OAUTH2_ACCESS_TOKEN=your_access_token_here
   OAUTH2_REFRESH_TOKEN=your_refresh_token_here
   ```

## 🚀 Installation

### For Claude Desktop

1. **Install via NPM** (Recommended):

   Edit your Claude Desktop configuration file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

   Add this configuration:
   ```json
   {
     "mcpServers": {
       "twitter-mcp": {
         "command": "npx",
         "args": ["-y", "@mbelinky/x-mcp-server"],
         "env": {
           "API_KEY": "your_api_key_here",
           "API_SECRET_KEY": "your_api_secret_key_here",
           "ACCESS_TOKEN": "your_access_token_here",
           "ACCESS_TOKEN_SECRET": "your_access_token_secret_here"
         }
       }
     }
   }
   ```

   For OAuth 2.0:
   ```json
   {
     "mcpServers": {
       "twitter-mcp": {
         "command": "npx",
         "args": ["-y", "@mbelinky/x-mcp-server"],
         "env": {
           "AUTH_TYPE": "oauth2",
           "OAUTH2_CLIENT_ID": "your_client_id",
           "OAUTH2_CLIENT_SECRET": "your_client_secret",
           "OAUTH2_ACCESS_TOKEN": "your_access_token",
           "OAUTH2_REFRESH_TOKEN": "your_refresh_token"
         }
       }
     }
   }
   ```

2. **Install from Source**:
   ```bash
   git clone https://github.com/mbelinky/x-mcp-server.git
   cd x-mcp-server/twitter-mcp
   npm install
   npm run build
   ```

   Then update your config to point to the local installation:
   ```json
   {
     "mcpServers": {
       "twitter-mcp": {
         "command": "node",
         "args": ["/path/to/twitter-mcp/build/index.js"],
         "env": {
           // ... your credentials
         }
       }
     }
   }
   ```

3. Restart Claude Desktop

### For Claude Code (CLI)

Install the server globally and add it to Claude:

```bash
# For OAuth 1.0a
claude mcp add twitter-mcp "npx" "-y" "@mbelinky/x-mcp-server" --scope user \
  --env "API_KEY=your_api_key" \
  --env "API_SECRET_KEY=your_secret_key" \
  --env "ACCESS_TOKEN=your_access_token" \
  --env "ACCESS_TOKEN_SECRET=your_access_token_secret"

# For OAuth 2.0
claude mcp add twitter-mcp "npx" "-y" "@mbelinky/x-mcp-server" --scope user \
  --env "AUTH_TYPE=oauth2" \
  --env "OAUTH2_CLIENT_ID=your_client_id" \
  --env "OAUTH2_CLIENT_SECRET=your_client_secret" \
  --env "OAUTH2_ACCESS_TOKEN=your_access_token" \
  --env "OAUTH2_REFRESH_TOKEN=your_refresh_token"
```

## 🛠️ Available Tools

Once installed, Claude can use these tools:

### `post_tweet`
Post a new tweet with optional media attachments and replies.

Example prompts:
- "Post a tweet saying 'Hello from Claude!'"
- "Tweet this image with the caption 'Check out this view!'" (attach image)
- "Reply to tweet ID 123456789 with 'Great point!'"

### `search_tweets`
Search for tweets with customizable result count (10-100).

Example prompts:
- "Search for tweets about #MachineLearning"
- "Find 50 recent tweets mentioning @ClaudeAI"
- "Search for tweets about TypeScript tutorials"

## 🧪 Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="OAuth"
npm test -- --testPathPattern="unit"
```

## 🔧 Development

### Setup
```bash
git clone https://github.com/mbelinky/x-mcp-server.git
cd x-mcp-server/twitter-mcp
npm install
```

### Commands
```bash
npm run build    # Build TypeScript
npm run dev      # Run in development mode
npm test         # Run tests
npm run lint     # Lint code
npm run format   # Format code
```

### Environment Variables
Create a `.env` file for local development:
```env
# OAuth 1.0a
API_KEY=your_api_key
API_SECRET_KEY=your_api_secret_key
ACCESS_TOKEN=your_access_token
ACCESS_TOKEN_SECRET=your_access_token_secret

# OAuth 2.0 (if using)
AUTH_TYPE=oauth2
OAUTH2_CLIENT_ID=your_client_id
OAUTH2_CLIENT_SECRET=your_client_secret
OAUTH2_ACCESS_TOKEN=your_access_token
OAUTH2_REFRESH_TOKEN=your_refresh_token

# Optional
DEBUG=true  # Enable debug logging
```

## ✅ OAuth 2.0 Media Upload Support

**Media uploads now work with both OAuth 1.0a and OAuth 2.0!**
- OAuth 1.0a uses the v1.1 media upload endpoint ✓
- OAuth 2.0 uses the v2 media upload endpoint ✓
- Both authentication methods support posting tweets with images (JPEG, PNG, GIF)

Note: OAuth 2.0 requires the `media.write` scope for media uploads.

## ⚠️ Known Issues

### Tweet Deletion (Temporary)
Twitter's v2 delete endpoint is currently experiencing issues (returning 500 errors). The MCP server handles this gracefully:
- **OAuth 1.0a**: Automatically falls back to v1.1 delete endpoint ✅
- **OAuth 2.0**: Cannot use v1.1 endpoint, will show helpful error message ⚠️

This is a temporary Twitter API issue. Once resolved, both auth methods will use v2 deletion.

## 🐛 Troubleshooting

### Common Issues

**"Could not authenticate you"**
- Verify all credentials are correct
- Check that your app has "Read and Write" permissions
- For OAuth 1.0a, regenerate your access tokens
- For OAuth 2.0, ensure tokens have required scopes

**"Rate limit exceeded"**
- Twitter has strict rate limits (especially on free tier)
- Wait 15 minutes and try again
- Consider upgrading your Twitter API access level

**"Media upload failed"**
- Check file size (max 5MB for images)
- Verify file format (JPEG, PNG, GIF only)
- For OAuth 2.0, ensure `media.write` scope is included

**"403 Forbidden"**
- Your app may lack required permissions
- Check your Twitter Developer Portal settings
- Ensure your access level supports the operation

### Debug Mode
Enable detailed logging by setting the `DEBUG` environment variable:
```json
{
  "env": {
    "DEBUG": "true",
    // ... other credentials
  }
}
```

### Log Locations
- Windows: `%APPDATA%\Claude\logs\mcp-server-twitter.log`
- macOS: `~/Library/Logs/Claude/mcp-server-twitter.log`

## 📚 Resources

- [Twitter API Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [MCP Documentation](https://modelcontextprotocol.io)
- [OAuth 2.0 Setup Guide](https://developer.twitter.com/en/docs/authentication/oauth-2-0)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT

## 🙏 Acknowledgments

- Original implementation by [@enescinar](https://github.com/EnesCinr/twitter-mcp)
- Extended with OAuth 2.0 and media upload support