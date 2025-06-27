import { jest } from '@jest/globals';
import { TwitterClient } from '../../src/twitter-api.js';
import { TwitterError } from '../../src/types.js';
import type { Config } from '../../src/types.js';

// Mock the auth factory
jest.mock('../../src/auth/factory.js', () => ({
  createTwitterClient: jest.fn(() => ({
    v1: {
      uploadMedia: jest.fn(),
    },
    v2: {
      tweet: jest.fn(),
      search: jest.fn(),
    },
  })),
}));

describe('TwitterClient', () => {
  const mockConfig: Config = {
    apiKey: 'test-key',
    apiSecretKey: 'test-secret',
    accessToken: 'test-token',
    accessTokenSecret: 'test-token-secret',
    authType: 'oauth1' as const,
  };

  let twitterClient: TwitterClient;
  let mockTwitterApi: any;

  beforeEach(() => {
    jest.clearAllMocks();
    twitterClient = new TwitterClient(mockConfig);
    mockTwitterApi = (twitterClient as any).client;
  });

  describe('postTweet', () => {
    it('should post a simple tweet successfully', async () => {
      const mockResponse = {
        data: { id: '123', text: 'Hello world' }
      };
      mockTwitterApi.v2.tweet.mockResolvedValue(mockResponse);

      const result = await twitterClient.postTweet('Hello world');

      expect(result).toEqual({
        id: '123',
        text: 'Hello world'
      });
      expect(mockTwitterApi.v2.tweet).toHaveBeenCalledWith({
        text: 'Hello world'
      });
    });

    it('should post a reply tweet successfully', async () => {
      const mockResponse = {
        data: { id: '124', text: 'Hello reply' }
      };
      mockTwitterApi.v2.tweet.mockResolvedValue(mockResponse);

      const result = await twitterClient.postTweet('Hello reply', '123');

      expect(result).toEqual({
        id: '124',
        text: 'Hello reply'
      });
      expect(mockTwitterApi.v2.tweet).toHaveBeenCalledWith({
        text: 'Hello reply',
        reply: { in_reply_to_tweet_id: '123' }
      });
    });
  });

  describe('uploadMedia', () => {
    it('should upload media successfully', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      mockTwitterApi.v1.uploadMedia.mockResolvedValue('media-123');

      const result = await twitterClient.uploadMedia(mockBuffer, 'image/jpeg');

      expect(result).toBe('media-123');
      expect(mockTwitterApi.v1.uploadMedia).toHaveBeenCalledWith(mockBuffer, {
        mimeType: 'image/jpeg',
        target: 'tweet'
      });
    });

    it('should throw error for oversized media', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      await expect(twitterClient.uploadMedia(largeBuffer, 'image/jpeg'))
        .rejects
        .toThrow(TwitterError);
    });

    it('should provide helpful error for scope issues', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const scopeError = new Error('insufficient scope');
      mockTwitterApi.v1.uploadMedia.mockRejectedValue(scopeError);

      await expect(twitterClient.uploadMedia(mockBuffer, 'image/jpeg'))
        .rejects
        .toThrow('media.write');
    });
  });

  describe('postTweetWithMedia', () => {
    it('should post tweet without media (backward compatibility)', async () => {
      const mockResponse = {
        data: { id: '123', text: 'Hello world' }
      };
      mockTwitterApi.v2.tweet.mockResolvedValue(mockResponse);

      const result = await twitterClient.postTweetWithMedia('Hello world');

      expect(result).toEqual({
        id: '123',
        text: 'Hello world'
      });
      expect(mockTwitterApi.v2.tweet).toHaveBeenCalledWith({
        text: 'Hello world'
      });
    });

    it('should post tweet with media successfully', async () => {
      const mockResponse = {
        data: { id: '125', text: 'Tweet with image' }
      };
      mockTwitterApi.v1.uploadMedia.mockResolvedValue('media-123');
      mockTwitterApi.v2.tweet.mockResolvedValue(mockResponse);

      const mediaItems = [{
        data: Buffer.from('fake-image').toString('base64'),
        media_type: 'image/jpeg' as const
      }];

      const result = await twitterClient.postTweetWithMedia(
        'Tweet with image',
        undefined,
        mediaItems
      );

      expect(result).toEqual({
        id: '125',
        text: 'Tweet with image'
      });
      expect(mockTwitterApi.v1.uploadMedia).toHaveBeenCalled();
      expect(mockTwitterApi.v2.tweet).toHaveBeenCalledWith({
        text: 'Tweet with image',
        media: { media_ids: ['media-123'] }
      });
    });

    it('should reject invalid base64 data', async () => {
      const invalidMediaItems = [{
        data: 'invalid-base64-data!!!',
        media_type: 'image/jpeg' as const
      }];

      await expect(twitterClient.postTweetWithMedia(
        'Tweet with invalid media',
        undefined,
        invalidMediaItems
      )).rejects.toThrow('Invalid base64 media data');
    });

    it('should reject oversized base64 data', async () => {
      const largeBase64 = 'A'.repeat(16 * 1024 * 1024); // 16MB of base64
      const oversizedMediaItems = [{
        data: largeBase64,
        media_type: 'image/jpeg' as const
      }];

      await expect(twitterClient.postTweetWithMedia(
        'Tweet with large media',
        undefined,
        oversizedMediaItems
      )).rejects.toThrow('Base64 media data too large');
    });

    it('should handle multiple media items', async () => {
      const mockResponse = {
        data: { id: '126', text: 'Multiple images' }
      };
      mockTwitterApi.v1.uploadMedia
        .mockResolvedValueOnce('media-1')
        .mockResolvedValueOnce('media-2');
      mockTwitterApi.v2.tweet.mockResolvedValue(mockResponse);

      const mediaItems = [
        {
          data: Buffer.from('image1').toString('base64'),
          media_type: 'image/jpeg' as const
        },
        {
          data: Buffer.from('image2').toString('base64'),
          media_type: 'image/png' as const
        }
      ];

      const result = await twitterClient.postTweetWithMedia(
        'Multiple images',
        undefined,
        mediaItems
      );

      expect(result).toEqual({
        id: '126',
        text: 'Multiple images'
      });
      expect(mockTwitterApi.v1.uploadMedia).toHaveBeenCalledTimes(2);
      expect(mockTwitterApi.v2.tweet).toHaveBeenCalledWith({
        text: 'Multiple images',
        media: { media_ids: ['media-1', 'media-2'] }
      });
    });
  });

  describe('rate limiting', () => {
    it('should enforce basic rate limiting', async () => {
      const mockResponse = {
        data: { id: '123', text: 'First tweet' }
      };
      mockTwitterApi.v2.tweet.mockResolvedValue(mockResponse);

      // First tweet should succeed
      await twitterClient.postTweet('First tweet');

      // Second tweet immediately should fail
      await expect(twitterClient.postTweet('Second tweet'))
        .rejects
        .toThrow('Rate limit exceeded');
    });
  });
});