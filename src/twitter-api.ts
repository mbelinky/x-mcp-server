import { TwitterApi } from 'twitter-api-v2';
import { Config, TwitterError, Tweet, TwitterUser, PostedTweet, MediaItem, TweetOptions, TwitterApiResponse, MAX_BASE64_SIZE, MAX_MEDIA_FILE_SIZE, DEBUG } from './types.js';
import { createTwitterClient } from './auth/factory.js';
import { V2MediaUploader } from './media/v2-upload.js';

export class TwitterClient {
  private client: TwitterApi;
  private config: Config;
  private v2MediaUploader: V2MediaUploader | null = null;
  private rateLimitMap = new Map<string, number>();
  private dailyLimits = new Map<string, { count: number; resetAt: Date }>();
  
  // Free tier daily limits
  private readonly DAILY_LIMITS: Record<string, number> = {
    'tweets/create': 17,
    'tweets/delete': 17,
    'media/upload': 17 // Assuming same as tweets
  };
  
  // Per-15-minute limits for free tier
  private readonly RATE_LIMITS_MS: Record<string, number> = {
    'tweets/lookup': 15 * 60 * 1000, // 15 minutes
    'tweets/search': 15 * 60 * 1000, // 15 minutes
    'tweets/create': 60 * 1000, // 1 minute between posts
    'tweets/delete': 60 * 1000, // 1 minute between deletes
    'media/upload': 60 * 1000 // 1 minute between uploads
  };

  constructor(config: Config) {
    this.config = config;
    this.client = createTwitterClient(config);
    
    // Initialize v2 media uploader for OAuth 2.0
    if (config.authType === 'oauth2' && config.oauth2AccessToken) {
      this.v2MediaUploader = new V2MediaUploader(config.oauth2AccessToken);
    }
    
    if (DEBUG) {
      console.error('Twitter API client initialized');
    }
  }

  /**
   * Posts a simple tweet without media
   * @param text - The tweet text content
   * @param replyToTweetId - Optional tweet ID to reply to
   * @returns Promise resolving to the posted tweet
   */
  async postTweet(text: string, replyToTweetId?: string): Promise<PostedTweet> {
    try {
      const endpoint = 'tweets/create';
      await this.checkRateLimit(endpoint);

      const tweetOptions: TweetOptions = { text };
      if (replyToTweetId) {
        tweetOptions.reply = { in_reply_to_tweet_id: replyToTweetId };
      }

      const response: TwitterApiResponse = await this.client.v2.tweet(tweetOptions);
      
      if (DEBUG) {
        console.error(`Tweet posted successfully with ID: ${response.data.id}${replyToTweetId ? ` (reply to ${replyToTweetId})` : ''}`);
      }
      
      return {
        id: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Uploads media to Twitter using the v2 API
   * @param buffer - The media content as a Buffer
   * @param mimeType - The MIME type of the media (e.g., 'image/jpeg', 'image/png', 'image/gif')
   * @returns The media ID string to use in tweets
   */
  /**
   * Uploads media to Twitter
   * @param buffer - The media content as a Buffer
   * @param mimeType - The MIME type of the media
   * @returns Promise resolving to the media ID string
   */
  async uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      // Validate media size
      if (buffer.length > MAX_MEDIA_FILE_SIZE) {
        throw new TwitterError(
          `Media file too large. Maximum size is ${Math.round(MAX_MEDIA_FILE_SIZE / 1024 / 1024)}MB. Your file is ${Math.round(buffer.length / 1024 / 1024)}MB.`,
          'file_too_large',
          400
        );
      }

      const endpoint = 'media/upload';
      await this.checkRateLimit(endpoint);

      // Use v2 media upload for OAuth 2.0
      if (this.config.authType === 'oauth2' && this.v2MediaUploader) {
        if (DEBUG) {
          console.error('Using v2 media upload endpoint for OAuth 2.0');
        }
        const mediaId = await this.v2MediaUploader.uploadMedia(buffer, mimeType);
        if (DEBUG) {
          console.error(`Media uploaded successfully with ID: ${mediaId}`);
        }
        return mediaId;
      }

      // Use v1 media upload endpoint for OAuth 1.0a
      const media = await this.client.v1.uploadMedia(buffer, {
        mimeType,
        target: 'tweet'
      });

      if (DEBUG) {
        console.error(`Media uploaded successfully with ID: ${media}`);
      }
      return media;
    } catch (error) {
      // Provide more helpful error messages for common issues
      if (error instanceof Error && (error.message.includes('scope') || error.message.includes('403'))) {
        throw new TwitterError(
          'Media upload failed: This might be a scope issue (needs media.write) or authentication problem.',
          'media_upload_forbidden',
          403
        );
      }
      this.handleApiError(error);
    }
  }

  /**
   * Posts a tweet with optional media attachments
   * @param text - The tweet text
   * @param replyToTweetId - Optional ID of tweet to reply to
   * @param mediaItems - Optional array of media items to attach
   * @returns The posted tweet with ID and text
   */
  /**
   * Posts a tweet with optional media attachments
   * @param text - The tweet text content
   * @param replyToTweetId - Optional tweet ID to reply to
   * @param mediaItems - Optional array of media items to attach
   * @returns Promise resolving to the posted tweet
   */
  async postTweetWithMedia(
    text: string, 
    replyToTweetId?: string,
    mediaItems?: MediaItem[]
  ): Promise<PostedTweet> {
    try {
      const endpoint = 'tweets/create';
      await this.checkRateLimit(endpoint);

      const tweetOptions: TweetOptions = { text };
      
      // Handle media uploads
      if (mediaItems && mediaItems.length > 0) {
        const mediaIds: string[] = [];
        
        for (const item of mediaItems) {
          // Validate base64 data size before processing
          if (item.data.length > MAX_BASE64_SIZE) {
            throw new TwitterError(
              `Base64 media data too large. Maximum size is ${Math.round(MAX_BASE64_SIZE / 1024 / 1024)}MB encoded.`,
              'base64_too_large',
              400
            );
          }

          if (DEBUG) {
            console.error(`Uploading media with type: ${item.media_type}`);
          }
          
          // Validate and decode base64 data
          let buffer: Buffer;
          try {
            buffer = Buffer.from(item.data, 'base64');
            
            // Validate that decoding was successful by checking if it's valid base64
            if (buffer.toString('base64') !== item.data) {
              throw new Error('Invalid base64 encoding');
            }
          } catch (decodeError) {
            throw new TwitterError(
              `Invalid base64 media data. Please ensure your media is properly base64 encoded.`,
              'invalid_base64',
              400
            );
          }
          
          const mediaId = await this.uploadMedia(buffer, item.media_type);
          mediaIds.push(mediaId);
        }
        
        tweetOptions.media = { 
          media_ids: mediaIds as [string] | [string, string] | [string, string, string] | [string, string, string, string]
        };
        if (DEBUG) {
          console.error(`Attached ${mediaIds.length} media item(s) to tweet`);
        }
      }
      
      if (replyToTweetId) {
        tweetOptions.reply = { in_reply_to_tweet_id: replyToTweetId };
      }
      
      const response: TwitterApiResponse = await this.client.v2.tweet(tweetOptions);
      
      if (DEBUG) {
        console.error(`Tweet posted successfully with ID: ${response.data.id}${replyToTweetId ? ` (reply to ${replyToTweetId})` : ''}${mediaItems?.length ? ` with ${mediaItems.length} media item(s)` : ''}`);
      }
      
      return {
        id: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async searchTweets(query: string, count: number): Promise<{ tweets: Tweet[], users: TwitterUser[] }> {
    try {
      const endpoint = 'tweets/search';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.search(query, {
        max_results: count,
        expansions: ['author_id'],
        'tweet.fields': ['public_metrics', 'created_at'],
        'user.fields': ['username', 'name', 'verified']
      });

      if (DEBUG) {
        console.error(`Fetched ${response.tweets.length} tweets for query: "${query}"`);
      }

      const tweets = response.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id ?? '',
        metrics: {
          likes: tweet.public_metrics?.like_count ?? 0,
          retweets: tweet.public_metrics?.retweet_count ?? 0,
          replies: tweet.public_metrics?.reply_count ?? 0,
          quotes: tweet.public_metrics?.quote_count ?? 0
        },
        createdAt: tweet.created_at ?? ''
      }));

      const users = response.includes.users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        verified: user.verified ?? false
      }));

      return { tweets, users };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Retrieves a single tweet by ID for verification
   * @param tweetId - The ID of the tweet to retrieve
   * @returns Promise resolving to the tweet data
   */
  async getTweet(tweetId: string): Promise<Tweet> {
    try {
      const endpoint = 'tweets/lookup';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
        expansions: ['author_id'],
        'user.fields': ['username']
      });

      if (DEBUG) {
        console.error(`Retrieved tweet with ID: ${tweetId}`);
      }

      return {
        id: response.data.id,
        text: response.data.text,
        authorId: response.data.author_id ?? '',
        metrics: {
          likes: response.data.public_metrics?.like_count ?? 0,
          retweets: response.data.public_metrics?.retweet_count ?? 0
        },
        createdAt: response.data.created_at ?? ''
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Deletes a tweet by ID
   * @param tweetId - The ID of the tweet to delete
   * @returns Promise resolving to deletion confirmation
   */
  async deleteTweet(tweetId: string): Promise<{ deleted: boolean }> {
    try {
      const endpoint = 'tweets/delete';
      await this.checkRateLimit(endpoint);

      try {
        // Try v2 endpoint first
        const response = await this.client.v2.deleteTweet(tweetId);

        if (DEBUG) {
          console.error(`Tweet deleted with ID: ${tweetId}`);
        }

        return { deleted: response.data.deleted };
      } catch (v2Error: any) {
        // If v2 fails with 500, try fallback based on auth type
        if (v2Error.code === 500) {
          if (DEBUG) {
            console.error(`v2 delete failed with 500 error: ${v2Error.message}`);
          }
          
          // For OAuth 1.0a, fallback to v1.1
          if (this.config.authType === 'oauth1') {
            if (DEBUG) {
              console.error('Using v1.1 endpoint fallback for OAuth 1.0a...');
            }
            
            const v1Response = await this.client.v1.post(`statuses/destroy/${tweetId}.json`);
            
            if (DEBUG) {
              console.error(`Tweet deleted with ID: ${tweetId} (via v1.1)`);
            }
            
            // v1.1 returns the deleted tweet, so if we get a response, it was successful
            return { deleted: !!v1Response.id_str };
          } else {
            // For OAuth 2.0, we can't use v1.1, so provide helpful error
            throw new TwitterError(
              'Tweet deletion failed: Twitter v2 delete endpoint is currently experiencing issues (500 error). ' +
              'Unfortunately, OAuth 2.0 cannot use the v1.1 fallback. Please try again later or use OAuth 1.0a.',
              'delete_unavailable',
              500
            );
          }
        }
        
        // For other errors, throw the original error
        throw v2Error;
      }
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const now = new Date();
    
    // Check per-request rate limits
    const lastRequest = this.rateLimitMap.get(endpoint);
    const rateLimit = this.RATE_LIMITS_MS[endpoint] || 1000;
    
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      if (timeSinceLastRequest < rateLimit) {
        const waitTime = Math.ceil((rateLimit - timeSinceLastRequest) / 1000);
        throw new TwitterError(
          `Rate limit: Please wait ${waitTime} seconds before next ${endpoint} request`,
          'rate_limit_exceeded',
          429
        );
      }
    }
    
    // Check daily limits
    const dailyLimit = this.DAILY_LIMITS[endpoint];
    if (dailyLimit) {
      const dailyTracker = this.dailyLimits.get(endpoint);
      
      // Reset daily counter if past reset time
      if (dailyTracker && dailyTracker.resetAt < now) {
        this.dailyLimits.delete(endpoint);
      }
      
      const current = this.dailyLimits.get(endpoint);
      if (current && current.count >= dailyLimit) {
        const hoursUntilReset = Math.ceil((current.resetAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        throw new TwitterError(
          `Daily limit exceeded (${dailyLimit} per 24h). Resets in ${hoursUntilReset} hours.`,
          'daily_limit_exceeded',
          429
        );
      }
      
      // Update daily counter
      if (current) {
        current.count++;
      } else {
        const resetAt = new Date(now);
        resetAt.setDate(resetAt.getDate() + 1);
        this.dailyLimits.set(endpoint, { count: 1, resetAt });
      }
    }
    
    this.rateLimitMap.set(endpoint, Date.now());
  }

  private handleApiError(error: unknown): never {
    if (error instanceof TwitterError) {
      throw error;
    }

    // Handle twitter-api-v2 errors
    const apiError = error as any;
    
    // Log full error details for debugging
    if (DEBUG) {
      console.error('Full API error:', JSON.stringify(apiError, null, 2));
      if (apiError.data) {
        console.error('API error data:', JSON.stringify(apiError.data, null, 2));
      }
      if (apiError.errors) {
        console.error('API error errors:', JSON.stringify(apiError.errors, null, 2));
      }
    }
    
    if (apiError.code) {
      throw new TwitterError(
        apiError.message || 'Twitter API error',
        apiError.code,
        apiError.status
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in Twitter client:', error);
    throw new TwitterError(
      'An unexpected error occurred',
      'internal_error',
      500
    );
  }
}