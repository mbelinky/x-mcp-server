import { jest } from '@jest/globals';
import { TwitterServer } from '../../src/index.js';
import { TwitterError } from '../../src/types.js';
import type { Config } from '../../src/types.js';

// Mock the Twitter API
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

// Mock the MCP SDK
const mockServer = {
  setRequestHandler: jest.fn(),
  onerror: null,
  close: jest.fn(),
  connect: jest.fn()
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

describe('MCP Handlers Integration', () => {
  const mockConfig: Config = {
    apiKey: 'test-key',
    apiSecretKey: 'test-secret',
    accessToken: 'test-token',
    accessTokenSecret: 'test-token-secret',
    authType: 'oauth1'
  };

  let twitterServer: TwitterServer;
  let postTweetHandler: any;
  let searchTweetsHandler: any;
  let listToolsHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    twitterServer = new TwitterServer(mockConfig);
    
    // Extract handlers from the mock calls
    const setRequestHandlerCalls = mockServer.setRequestHandler.mock.calls;
    
    // Find the handlers
    for (const call of setRequestHandlerCalls) {
      const [schema, handler] = call;
      if (schema.properties?.name?.const === 'list_tools') {
        listToolsHandler = handler;
      } else if (schema.properties?.name?.const === 'call_tool') {
        // This will be the call tool handler
        postTweetHandler = handler;
        searchTweetsHandler = handler;
      }
    }
  });

  describe('Tool Listing', () => {
    it('should list available tools', async () => {
      const response = await listToolsHandler();
      
      expect(response.tools).toHaveLength(2);
      expect(response.tools[0].name).toBe('post_tweet');
      expect(response.tools[1].name).toBe('search_tweets');
      
      // Check that post_tweet supports media
      const postTweetTool = response.tools[0];
      expect(postTweetTool.inputSchema.properties.media).toBeDefined();
      expect(postTweetTool.inputSchema.properties.media.items.properties.media_type.enum)
        .toEqual(['image/jpeg', 'image/png', 'image/gif']);
    });
  });

  describe('Post Tweet Handler', () => {
    beforeEach(() => {
      // Mock the underlying Twitter client
      const mockTwitterClient = (twitterServer as any).client;
      mockTwitterClient.postTweetWithMedia = jest.fn();
    });

    it('should handle simple tweet posting', async () => {
      const mockTwitterClient = (twitterServer as any).client;
      mockTwitterClient.postTweetWithMedia.mockResolvedValue({
        id: '123',
        text: 'Hello world'
      });

      const request = {
        params: {
          name: 'post_tweet',
          arguments: {
            text: 'Hello world'
          }
        }
      };

      const response = await postTweetHandler(request);
      
      expect(response.content[0].text).toContain('Tweet posted successfully');
      expect(response.content[0].text).toContain('123');
      expect(mockTwitterClient.postTweetWithMedia).toHaveBeenCalledWith(
        'Hello world',
        undefined,
        undefined
      );
    });

    it('should handle tweet with reply', async () => {
      const mockTwitterClient = (twitterServer as any).client;
      mockTwitterClient.postTweetWithMedia.mockResolvedValue({
        id: '124',
        text: 'Reply tweet'
      });

      const request = {
        params: {
          name: 'post_tweet',
          arguments: {
            text: 'Reply tweet',
            reply_to_tweet_id: '123'
          }
        }
      };

      await postTweetHandler(request);
      
      expect(mockTwitterClient.postTweetWithMedia).toHaveBeenCalledWith(
        'Reply tweet',
        '123',
        undefined
      );
    });

    it('should handle tweet with media', async () => {
      const mockTwitterClient = (twitterServer as any).client;
      mockTwitterClient.postTweetWithMedia.mockResolvedValue({
        id: '125',
        text: 'Tweet with media'
      });

      const request = {
        params: {
          name: 'post_tweet',
          arguments: {
            text: 'Tweet with media',
            media: [{
              data: Buffer.from('fake-image').toString('base64'),
              media_type: 'image/jpeg'
            }]
          }
        }
      };

      await postTweetHandler(request);
      
      expect(mockTwitterClient.postTweetWithMedia).toHaveBeenCalledWith(
        'Tweet with media',
        undefined,
        [{
          data: Buffer.from('fake-image').toString('base64'),
          media_type: 'image/jpeg'
        }]
      );
    });

    it('should handle validation errors', async () => {
      const request = {
        params: {
          name: 'post_tweet',
          arguments: {
            text: '' // Empty text should fail validation
          }
        }
      };

      await expect(postTweetHandler(request))
        .rejects
        .toThrow('Invalid parameters');
    });

    it('should handle Twitter API errors', async () => {
      const mockTwitterClient = (twitterServer as any).client;
      mockTwitterClient.postTweetWithMedia.mockRejectedValue(
        new TwitterError('Rate limit exceeded', 'rate_limit_exceeded', 429)
      );

      const request = {
        params: {
          name: 'post_tweet',
          arguments: {
            text: 'This will fail'
          }
        }
      };

      const response = await postTweetHandler(request);
      
      expect(response.content[0].text).toContain('Rate limit exceeded');
      expect(response.content[0].isError).toBe(true);
    });
  });

  describe('Search Tweets Handler', () => {
    beforeEach(() => {
      // Mock the underlying Twitter client
      const mockTwitterClient = (twitterServer as any).client;
      mockTwitterClient.searchTweets = jest.fn();
    });

    it('should handle tweet search', async () => {
      const mockTwitterClient = (twitterServer as any).client;
      const mockTweets = [
        {
          id: '1',
          text: 'Tweet about AI',
          authorId: 'user1',
          metrics: { likes: 10, retweets: 5 },
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];
      const mockUsers = [
        {
          id: 'user1',
          username: 'testuser',
          name: 'Test User',
          verified: false
        }
      ];

      mockTwitterClient.searchTweets.mockResolvedValue({
        tweets: mockTweets,
        users: mockUsers
      });

      const request = {
        params: {
          name: 'search_tweets',
          arguments: {
            query: '#AI',
            count: 15
          }
        }
      };

      const response = await searchTweetsHandler(request);
      
      expect(response.content[0].text).toContain('#AI');
      expect(response.content[0].text).toContain('Tweet about AI');
      expect(mockTwitterClient.searchTweets).toHaveBeenCalledWith('#AI', 15);
    });

    it('should handle search validation errors', async () => {
      const request = {
        params: {
          name: 'search_tweets',
          arguments: {
            query: '#AI',
            count: 5 // Below minimum of 10
          }
        }
      };

      await expect(searchTweetsHandler(request))
        .rejects
        .toThrow('Invalid parameters');
    });
  });

  describe('Unknown Tool Handler', () => {
    it('should handle unknown tool requests', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      await expect(postTweetHandler(request))
        .rejects
        .toThrow('Unknown tool');
    });
  });
});