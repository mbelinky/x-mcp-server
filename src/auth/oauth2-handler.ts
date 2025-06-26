import { TwitterApi } from 'twitter-api-v2';
import { Config } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

export class OAuth2Handler {
  private config: Config;
  private client: TwitterApi | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: Config) {
    this.config = config;
    
    // Parse token expiration if provided
    if (config.oauth2TokenExpiresAt) {
      this.tokenExpiresAt = new Date(config.oauth2TokenExpiresAt);
    }
  }

  /**
   * Get a valid Twitter API client, refreshing the token if necessary
   */
  async getClient(): Promise<TwitterApi> {
    // Check if we need to refresh the token
    if (this.shouldRefreshToken()) {
      await this.refreshAccessToken();
    }
    
    if (!this.client) {
      if (!this.config.oauth2AccessToken) {
        throw new Error('OAuth 2.0 access token is required. Run scripts/oauth2-setup.js to authenticate.');
      }
      this.client = new TwitterApi(this.config.oauth2AccessToken);
    }
    
    return this.client;
  }

  /**
   * Check if the token needs to be refreshed
   */
  private shouldRefreshToken(): boolean {
    if (!this.tokenExpiresAt || !this.config.oauth2RefreshToken) {
      return false;
    }
    
    // Refresh if token expires in less than 5 minutes
    const now = new Date();
    const expiresIn = this.tokenExpiresAt.getTime() - now.getTime();
    return expiresIn < 5 * 60 * 1000;
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.config.oauth2RefreshToken) {
      throw new Error('No refresh token available. Please re-authenticate using scripts/oauth2-setup.js');
    }
    
    if (!this.config.oauth2ClientId || !this.config.oauth2ClientSecret) {
      throw new Error('Client ID and secret required for token refresh');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.oauth2RefreshToken
    });

    const credentials = Buffer.from(
      `${this.config.oauth2ClientId}:${this.config.oauth2ClientSecret}`
    ).toString('base64');
    
    try {
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
        throw new Error(`Token refresh failed: ${error}`);
      }

      const tokens = await response.json();
      
      // Update config with new tokens
      this.config.oauth2AccessToken = tokens.access_token;
      if (tokens.refresh_token) {
        this.config.oauth2RefreshToken = tokens.refresh_token;
      }
      
      // Update expiration
      this.tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
      this.config.oauth2TokenExpiresAt = this.tokenExpiresAt.toISOString();
      
      // Create new client with refreshed token
      this.client = new TwitterApi(tokens.access_token);
      
      // Update .env file with new tokens
      await this.updateEnvFile(tokens);
      
      if (process.env.DEBUG === 'true') {
        console.error('OAuth 2.0 token refreshed successfully');
      }
    } catch (error) {
      throw new Error(`Failed to refresh OAuth 2.0 token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update the .env file with new tokens
   */
  private async updateEnvFile(tokens: any): Promise<void> {
    const envPath = path.join(__dirname, '../../../.env');
    
    try {
      let envContent = await fs.readFile(envPath, 'utf-8');
      
      // Update tokens
      const updates = {
        'OAUTH2_ACCESS_TOKEN': tokens.access_token,
        'OAUTH2_REFRESH_TOKEN': tokens.refresh_token || this.config.oauth2RefreshToken,
        'OAUTH2_TOKEN_EXPIRES_AT': this.tokenExpiresAt?.toISOString() || ''
      };

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          const regex = new RegExp(`^${key}=.*$`, 'm');
          if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
          } else {
            envContent += `\n${key}=${value}`;
          }
        }
      }

      await fs.writeFile(envPath, envContent.trim() + '\n');
    } catch (error) {
      console.error('Warning: Could not update .env file with refreshed tokens:', error);
    }
  }
}