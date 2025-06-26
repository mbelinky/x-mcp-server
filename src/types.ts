import { z } from 'zod';

// Configuration schema with validation
export const ConfigSchema = z.object({
    apiKey: z.string().optional(),
    apiSecretKey: z.string().optional(),
    accessToken: z.string().optional(),
    accessTokenSecret: z.string().optional(),
    authType: z.enum(['oauth1', 'oauth2']).optional().default('oauth1'),
    oauth2ClientId: z.string().optional(),
    oauth2ClientSecret: z.string().optional(),
    oauth2AccessToken: z.string().optional(),
    oauth2RefreshToken: z.string().optional(),
    oauth2TokenExpiresAt: z.string().optional()
}).refine(
    (data) => {
        // If using OAuth 2.0, ensure OAuth 2.0 fields are provided
        if (data.authType === 'oauth2') {
            return !!data.oauth2AccessToken;
        }
        // If using OAuth 1.0a, ensure OAuth 1.0a fields are provided
        return !!(data.apiKey && data.apiSecretKey && data.accessToken && data.accessTokenSecret);
    },
    {
        message: 'Missing required OAuth credentials for the selected auth type'
    }
);

export type Config = z.infer<typeof ConfigSchema>;

// Supported media types
export const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;
export type SupportedMediaType = typeof SUPPORTED_MEDIA_TYPES[number];

// Media types
export interface MediaItem {
    data: string;      // Base64 encoded media
    media_type: SupportedMediaType; // MIME type
}

// Tool input schemas
export const PostTweetSchema = z.object({
    text: z.string()
        .min(1, 'Tweet text cannot be empty')
        .max(280, 'Tweet cannot exceed 280 characters'),
    reply_to_tweet_id: z.string().optional(),
    media: z.array(z.object({
        data: z.string(),
        media_type: z.enum(SUPPORTED_MEDIA_TYPES)
    })).max(4, 'Maximum 4 media items allowed per tweet').optional()
});

export const SearchTweetsSchema = z.object({
    query: z.string().min(1, 'Search query cannot be empty'),
    count: z.number()
        .int('Count must be an integer')
        .min(10, 'Minimum count is 10')
        .max(100, 'Maximum count is 100')
});

export type PostTweetArgs = z.infer<typeof PostTweetSchema>;
export type SearchTweetsArgs = z.infer<typeof SearchTweetsSchema>;

// Constants for validation
export const MAX_BASE64_SIZE = 15 * 1024 * 1024; // 15MB for base64 encoded data
export const MAX_MEDIA_FILE_SIZE = 5 * 1024 * 1024; // 5MB for decoded media
export const DEBUG = process.env.DEBUG === 'true';

// API Response types
export interface TweetMetrics {
    likes: number;
    retweets: number;
}

// Twitter API specific types
export interface TweetOptions {
    text: string;
    reply?: {
        in_reply_to_tweet_id: string;
    };
    media?: {
        media_ids: [string] | [string, string] | [string, string, string] | [string, string, string, string];
    };
}

export interface TwitterApiResponse {
    data: {
        id: string;
        text: string;
    };
}

export interface PostedTweet {
    id: string;
    text: string;
}

export interface Tweet {
    id: string;
    text: string;
    authorId: string;
    metrics: TweetMetrics;
    createdAt: string;
}

export interface TwitterUser {
    id: string;
    username: string;
}

// Error types
export class TwitterError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'TwitterError';
    }

    static isRateLimit(error: unknown): error is TwitterError {
        return error instanceof TwitterError && error.code === 'rate_limit_exceeded';
    }
}

// Response formatter types
export interface FormattedTweet {
    position: number;
    author: {
        username: string;
    };
    content: string;
    metrics: TweetMetrics;
    url: string;
}

export interface SearchResponse {
    query: string;
    count: number;
    tweets: FormattedTweet[];
}