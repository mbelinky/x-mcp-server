import { ConfigSchema, PostTweetSchema, SearchTweetsSchema, SUPPORTED_MEDIA_TYPES } from '../../src/types.js';

describe('Type Validation', () => {
  describe('ConfigSchema', () => {
    it('should validate OAuth 1.0a configuration', () => {
      const config = {
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        accessToken: 'test-token',
        accessTokenSecret: 'test-token-secret',
        authType: 'oauth1' as const
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate OAuth 2.0 configuration', () => {
      const config = {
        authType: 'oauth2' as const,
        oauth2AccessToken: 'oauth2-token-123'
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should default to oauth1 when authType not specified', () => {
      const config = {
        apiKey: 'test-key',
        apiSecretKey: 'test-secret',
        accessToken: 'test-token',
        accessTokenSecret: 'test-token-secret'
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authType).toBe('oauth1');
      }
    });

    it('should reject incomplete OAuth 1.0a configuration', () => {
      const config = {
        apiKey: 'test-key',
        // Missing other required fields
        authType: 'oauth1' as const
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject OAuth 2.0 configuration without access token', () => {
      const config = {
        authType: 'oauth2' as const
        // Missing oauth2AccessToken
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('PostTweetSchema', () => {
    it('should validate simple tweet', () => {
      const tweet = {
        text: 'Hello world!'
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(true);
    });

    it('should validate tweet with reply', () => {
      const tweet = {
        text: 'Hello reply!',
        reply_to_tweet_id: '123456789'
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(true);
    });

    it('should validate tweet with media', () => {
      const tweet = {
        text: 'Tweet with image',
        media: [{
          data: 'base64-encoded-image-data',
          media_type: 'image/jpeg' as const
        }]
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(true);
    });

    it('should validate tweet with multiple media items', () => {
      const tweet = {
        text: 'Tweet with multiple images',
        media: [
          { data: 'image1-data', media_type: 'image/jpeg' as const },
          { data: 'image2-data', media_type: 'image/png' as const },
          { data: 'image3-data', media_type: 'image/gif' as const }
        ]
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(true);
    });

    it('should reject empty tweet text', () => {
      const tweet = {
        text: ''
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(false);
    });

    it('should reject tweet text over 280 characters', () => {
      const tweet = {
        text: 'A'.repeat(281)
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(false);
    });

    it('should reject more than 4 media items', () => {
      const tweet = {
        text: 'Too many images',
        media: [
          { data: 'image1', media_type: 'image/jpeg' as const },
          { data: 'image2', media_type: 'image/jpeg' as const },
          { data: 'image3', media_type: 'image/jpeg' as const },
          { data: 'image4', media_type: 'image/jpeg' as const },
          { data: 'image5', media_type: 'image/jpeg' as const }
        ]
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(false);
    });

    it('should reject unsupported media types', () => {
      const tweet = {
        text: 'Unsupported media',
        media: [{
          data: 'video-data',
          media_type: 'video/mp4' as any
        }]
      };

      const result = PostTweetSchema.safeParse(tweet);
      expect(result.success).toBe(false);
    });
  });

  describe('SearchTweetsSchema', () => {
    it('should validate search request', () => {
      const search = {
        query: '#AI',
        count: 20
      };

      const result = SearchTweetsSchema.safeParse(search);
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const search = {
        query: '',
        count: 20
      };

      const result = SearchTweetsSchema.safeParse(search);
      expect(result.success).toBe(false);
    });

    it('should reject count below 10', () => {
      const search = {
        query: '#AI',
        count: 5
      };

      const result = SearchTweetsSchema.safeParse(search);
      expect(result.success).toBe(false);
    });

    it('should reject count above 100', () => {
      const search = {
        query: '#AI',
        count: 150
      };

      const result = SearchTweetsSchema.safeParse(search);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer count', () => {
      const search = {
        query: '#AI',
        count: 20.5
      };

      const result = SearchTweetsSchema.safeParse(search);
      expect(result.success).toBe(false);
    });
  });

  describe('SUPPORTED_MEDIA_TYPES', () => {
    it('should include standard image formats', () => {
      expect(SUPPORTED_MEDIA_TYPES).toContain('image/jpeg');
      expect(SUPPORTED_MEDIA_TYPES).toContain('image/png');
      expect(SUPPORTED_MEDIA_TYPES).toContain('image/gif');
    });

    it('should have exactly 3 supported types', () => {
      expect(SUPPORTED_MEDIA_TYPES).toHaveLength(3);
    });
  });
});