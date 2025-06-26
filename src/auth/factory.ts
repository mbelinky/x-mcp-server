import { TwitterApi } from 'twitter-api-v2';
import { Config } from '../types.js';

/**
 * Creates a TwitterApi client based on the provided configuration.
 * Supports both OAuth 1.0a and OAuth 2.0 authentication methods.
 * 
 * @param config - The configuration object containing authentication credentials
 * @returns A configured TwitterApi client instance
 */
export function createTwitterClient(config: Config): TwitterApi {
  if (config.authType === 'oauth2') {
    // OAuth 2.0 authentication
    // Using the access token directly for OAuth 2.0
    // Note: The token must have the required scopes (tweet.read, tweet.write, users.read, media.write)
    if (!config.oauth2AccessToken) {
      throw new Error('OAuth 2.0 access token is required when using OAuth 2.0 authentication. Please check your OAUTH2_ACCESS_TOKEN environment variable.');
    }
    
    if (process.env.DEBUG === 'true') {
      console.error('Initializing Twitter API with OAuth 2.0');
    }
    
    // Create client with OAuth 2.0 bearer token
    return new TwitterApi(config.oauth2AccessToken);
  } else {
    // OAuth 1.0a authentication (default)
    if (!config.apiKey || !config.apiSecretKey || !config.accessToken || !config.accessTokenSecret) {
      throw new Error('OAuth 1.0a requires all four credentials: API_KEY, API_SECRET_KEY, ACCESS_TOKEN, and ACCESS_TOKEN_SECRET. Please check your environment variables.');
    }
    
    if (process.env.DEBUG === 'true') {
      console.error('Initializing Twitter API with OAuth 1.0a');
    }
    
    return new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecretKey,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret
    });
  }
}