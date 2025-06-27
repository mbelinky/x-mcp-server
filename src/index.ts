#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { XClient } from './x-api.js';
import { ResponseFormatter } from './formatter.js';
import {
  Config, ConfigSchema,
  PostTweetSchema, SearchTweetsSchema,
  XError, MediaItem
} from './types.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

export class XServer {
  private server: Server;
  private client: XClient;

  constructor(config: Config) {
    // Validate config
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    this.client = new XClient(config);
    this.server = new Server({
      name: 'x-mcp',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Error handler
    this.server.onerror = (error) => {
      console.error('[MCP Error]:', error);
    };

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });

    // Register tool handlers
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'post_tweet',
          description: 'Post a new tweet to X with optional media attachments',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The content of your tweet',
                maxLength: 280
              },
              reply_to_tweet_id: {
                type: 'string',
                description: 'Optional: ID of the tweet to reply to'
              },
              media: {
                type: 'array',
                description: 'Optional: Array of media items to attach to the tweet',
                items: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'string',
                      description: 'Base64 encoded media data (for programmatic use - Claude cannot extract base64 from pasted images)'
                    },
                    file_path: {
                      type: 'string',
                      description: 'Path to local media file (recommended for Claude users - use this for all image uploads)'
                    },
                    media_type: {
                      type: 'string',
                      description: 'MIME type of the media',
                      enum: ['image/jpeg', 'image/png', 'image/gif']
                    }
                  },
                  required: ['media_type']
                },
                maxItems: 4
              }
            },
            required: ['text']
          }
        } as Tool,
        {
          name: 'search_tweets',
          description: 'Search for tweets on X',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              count: {
                type: 'number',
                description: 'Number of tweets to return (10-100)',
                minimum: 10,
                maximum: 100
              }
            },
            required: ['query', 'count']
          }
        } as Tool,
        {
          name: 'delete_tweet',
          description: 'Delete a tweet by its ID',
          inputSchema: {
            type: 'object',
            properties: {
              tweet_id: {
                type: 'string',
                description: 'The ID of the tweet to delete'
              }
            },
            required: ['tweet_id']
          }
        } as Tool
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`Tool called: ${name}`, args);

      try {
        switch (name) {
          case 'post_tweet':
            return await this.handlePostTweet(args);
          case 'search_tweets':
            return await this.handleSearchTweets(args);
          case 'delete_tweet':
            return await this.handleDeleteTweet(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  private async handlePostTweet(args: unknown) {
    const result = PostTweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    // Convert base64 media to temp files for better performance
    const processedMedia = result.data.media ? 
      await Promise.all(result.data.media.map(async (item) => {
        if (item.data && !item.file_path) {
          // Convert base64 to temp file
          const buffer = Buffer.from(item.data, 'base64');
          const ext = item.media_type.split('/')[1] || 'jpg';
          const tempPath = path.join(os.tmpdir(), 
            `mcp-x-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`
          );
          
          await fs.writeFile(tempPath, buffer);
          console.error(`Created temp file: ${tempPath} (${buffer.length} bytes)`);
          
          // Return with file_path instead of data
          return {
            file_path: tempPath,
            media_type: item.media_type,
            _cleanup: true // Mark for cleanup
          } as MediaItem;
        }
        return item as MediaItem;
      })) : undefined;

    try {
      const tweet = await this.client.postTweetWithMedia(
        result.data.text,
        result.data.reply_to_tweet_id,
        processedMedia
      );
      
      return {
        content: [{
          type: 'text',
          text: `Tweet posted successfully!\nURL: https://x.com/status/${tweet.id}`
        }] as TextContent[]
      };
    } finally {
      // Cleanup temp files
      if (processedMedia) {
        for (const item of processedMedia) {
          if (item._cleanup && item.file_path) {
            try {
              await fs.unlink(item.file_path);
              console.error(`Cleaned up temp file: ${item.file_path}`);
            } catch (err) {
              // Ignore cleanup errors
              console.error(`Failed to clean up temp file ${item.file_path}:`, err);
            }
          }
        }
      }
    }
  }

  private async handleSearchTweets(args: unknown) {
    const result = SearchTweetsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const { tweets, users } = await this.client.searchTweets(
      result.data.query,
      result.data.count
    );

    const formattedResponse = ResponseFormatter.formatSearchResponse(
      result.data.query,
      tweets,
      users
    );

    return {
      content: [{
        type: 'text',
        text: ResponseFormatter.toMcpResponse(formattedResponse)
      }] as TextContent[]
    };
  }

  private async handleDeleteTweet(args: unknown) {
    const result = z.object({
      tweet_id: z.string()
    }).safeParse(args);
    
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const deleteResult = await this.client.deleteTweet(result.data.tweet_id);
    
    return {
      content: [{
        type: 'text',
        text: deleteResult.deleted 
          ? `Tweet ${result.data.tweet_id} deleted successfully!`
          : `Failed to delete tweet ${result.data.tweet_id}`
      }] as TextContent[]
    };
  }

  private handleError(error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }

    if (error instanceof XError) {
      if (XError.isRateLimit(error)) {
        return {
          content: [{
            type: 'text',
            text: 'Rate limit exceeded. Please wait a moment before trying again.',
            isError: true
          }] as TextContent[]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `X API error: ${(error as XError).message}`,
          isError: true
        }] as TextContent[]
      };
    }

    console.error('Unexpected error:', error);
    throw new McpError(
      ErrorCode.InternalError,
      'An unexpected error occurred'
    );
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('X MCP server running on stdio');
  }
}

// Start the server
dotenv.config();

// OAuth configuration - supports both OAuth 1.0a and OAuth 2.0
const AUTH_TYPE = process.env.AUTH_TYPE || 'oauth1';
const OAUTH2_CLIENT_ID = process.env.OAUTH2_CLIENT_ID;
const OAUTH2_CLIENT_SECRET = process.env.OAUTH2_CLIENT_SECRET;
const OAUTH2_ACCESS_TOKEN = process.env.OAUTH2_ACCESS_TOKEN;
const OAUTH2_REFRESH_TOKEN = process.env.OAUTH2_REFRESH_TOKEN;
const OAUTH2_TOKEN_EXPIRES_AT = process.env.OAUTH2_TOKEN_EXPIRES_AT;

const config = {
  apiKey: process.env.API_KEY || '',
  apiSecretKey: process.env.API_SECRET_KEY || '',
  accessToken: process.env.ACCESS_TOKEN || '',
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || '',
  authType: AUTH_TYPE as 'oauth1' | 'oauth2',
  oauth2ClientId: OAUTH2_CLIENT_ID,
  oauth2ClientSecret: OAUTH2_CLIENT_SECRET,
  oauth2AccessToken: OAUTH2_ACCESS_TOKEN,
  oauth2RefreshToken: OAUTH2_REFRESH_TOKEN,
  oauth2TokenExpiresAt: OAUTH2_TOKEN_EXPIRES_AT
};

const server = new XServer(config);
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});