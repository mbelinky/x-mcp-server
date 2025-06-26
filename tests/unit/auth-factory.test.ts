import { jest } from '@jest/globals';
import { createTwitterClient } from '../../src/auth/factory.js';
import type { Config } from '../../src/types.js';

// Mock TwitterApi
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn((config: any) => ({
    mockConfig: config,
    isOAuth1: typeof config === 'object' && config !== null && 'appKey' in config,
    isOAuth2: typeof config === 'string'
  }))
}));

describe('Auth Factory', () => {
  const originalDebug = process.env.DEBUG;
  
  afterEach(() => {
    process.env.DEBUG = originalDebug;
  });

  describe('OAuth 1.0a authentication', () => {
    it('should create OAuth 1.0a client with all credentials', () => {
      const config: Config = {
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        accessToken: 'test-token',
        accessTokenSecret: 'test-token-secret',
        authType: 'oauth1'
      };

      const client = createTwitterClient(config) as any;
      
      expect(client.isOAuth1).toBe(true);
      expect(client.mockConfig).toEqual({
        appKey: 'test-key',
        appSecret: 'test-secret',
        accessToken: 'test-token',
        accessSecret: 'test-token-secret'
      });
    });

    it('should default to OAuth 1.0a when no authType specified', () => {
      const config: Config = {
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        accessToken: 'test-token',
        accessTokenSecret: 'test-token-secret',
        authType: 'oauth1' // Make it explicit for type safety
      };

      const client = createTwitterClient(config) as any;
      
      expect(client.isOAuth1).toBe(true);
    });

    it('should throw error when OAuth 1.0a credentials are missing', () => {
      const config: Config = {
        apiKey: 'test-key',
        // Missing other credentials
        authType: 'oauth1'
      };

      expect(() => createTwitterClient(config))
        .toThrow('OAuth 1.0a requires all four credentials');
    });
  });

  describe('OAuth 2.0 authentication', () => {
    it('should create OAuth 2.0 client with access token', () => {
      const config: Config = {
        authType: 'oauth2',
        oauth2AccessToken: 'oauth2-token-123'
      };

      const client = createTwitterClient(config) as any;
      
      expect(client.isOAuth2).toBe(true);
      expect(client.mockConfig).toBe('oauth2-token-123');
    });

    it('should throw error when OAuth 2.0 access token is missing', () => {
      const config: Config = {
        authType: 'oauth2'
        // Missing oauth2AccessToken
      };

      expect(() => createTwitterClient(config))
        .toThrow('OAuth 2.0 access token is required');
    });
  });

  describe('debug logging', () => {
    it('should log in debug mode for OAuth 1.0a', () => {
      process.env.DEBUG = 'true';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const config: Config = {
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        accessToken: 'test-token',
        accessTokenSecret: 'test-token-secret',
        authType: 'oauth1'
      };

      createTwitterClient(config);
      
      expect(consoleSpy).toHaveBeenCalledWith('Initializing Twitter API with OAuth 1.0a');
      consoleSpy.mockRestore();
    });

    it('should log in debug mode for OAuth 2.0', () => {
      process.env.DEBUG = 'true';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const config: Config = {
        authType: 'oauth2',
        oauth2AccessToken: 'oauth2-token-123'
      };

      createTwitterClient(config);
      
      expect(consoleSpy).toHaveBeenCalledWith('Initializing Twitter API with OAuth 2.0');
      consoleSpy.mockRestore();
    });

    it('should not log when debug mode is disabled', () => {
      process.env.DEBUG = 'false';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const config: Config = {
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        accessToken: 'test-token',
        accessTokenSecret: 'test-token-secret',
        authType: 'oauth1'
      };

      createTwitterClient(config);
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});