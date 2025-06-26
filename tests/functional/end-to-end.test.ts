/**
 * End-to-End Functional Tests for Twitter MCP Server
 * 
 * These tests verify the complete workflow of:
 * 1. Posting tweets (text-only and with media)
 * 2. Verifying tweets exist
 * 3. Deleting tweets
 * 
 * Tests run for both OAuth 1.0a and OAuth 2.0
 * 
 * IMPORTANT: These tests make real API calls to Twitter
 * Make sure you have valid credentials and rate limit awareness
 * 
 * FREE TIER LIMITS (as of 2024):
 * - Post tweets: 17 per 24 hours
 * - Delete tweets: 17 per 24 hours  
 * - Retrieve tweets: 1 per 15 minutes
 * 
 * These tests use 60-second delays to avoid rate limits but may still
 * exceed daily quotas if run multiple times. Use sparingly!
 */

import { TwitterClient } from '../../src/twitter-api.js';
import type { Config } from '../../src/types.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Test configuration
const TEST_TIMEOUT = 180000; // 180 seconds per test (3 minutes)
const RATE_LIMIT_DELAY = 60000; // 60 seconds between API calls for free tier (1 request per 15 min for lookups)

// Helper to create test image
function createTestImage(): string {
  // Read the actual test image
  const imagePath = path.join(__dirname, 'image.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

// Helper to wait between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('End-to-End Twitter API Tests', () => {
  // Track posted tweets for cleanup
  const postedTweetIds: string[] = [];
  
  let oauth1Client: TwitterClient | null = null;
  let oauth2Client: TwitterClient | null = null;

  beforeAll(() => {
    // Initialize OAuth 1.0a client if credentials are available
    if (process.env.API_KEY && process.env.API_SECRET_KEY && 
        process.env.ACCESS_TOKEN && process.env.ACCESS_TOKEN_SECRET) {
      const oauth1Config: Config = {
        apiKey: process.env.API_KEY,
        apiSecretKey: process.env.API_SECRET_KEY,
        accessToken: process.env.ACCESS_TOKEN,
        accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
        authType: 'oauth1'
      };
      oauth1Client = new TwitterClient(oauth1Config);
    }

    // Initialize OAuth 2.0 client if credentials are available
    if (process.env.OAUTH2_ACCESS_TOKEN) {
      const oauth2Config: Config = {
        authType: 'oauth2',
        oauth2AccessToken: process.env.OAUTH2_ACCESS_TOKEN
      };
      oauth2Client = new TwitterClient(oauth2Config);
    }
  });

  afterAll(async () => {
    // Clean up any remaining tweets
    if (postedTweetIds.length > 0) {
      console.log(`Cleaning up ${postedTweetIds.length} test tweets...`);
      
      for (const tweetId of postedTweetIds) {
        try {
          if (oauth1Client) {
            await oauth1Client.deleteTweet(tweetId);
          } else if (oauth2Client) {
            await oauth2Client.deleteTweet(tweetId);
          }
          await delay(RATE_LIMIT_DELAY);
        } catch (error) {
          console.error(`Failed to delete tweet ${tweetId}:`, error);
        }
      }
    }
  });

  describe('OAuth 1.0a Tests', () => {
    beforeEach(() => {
      if (!oauth1Client) {
        console.log('Skipping OAuth 1.0a tests - credentials not provided');
      }
    });

    test('should post, verify, and delete text-only tweet', async () => {
      if (!oauth1Client) {
        console.log('Skipping test - OAuth 1.0a credentials not available');
        return;
      }
      
      const testText = `Test tweet from OAuth 1.0a - ${Date.now()}`;
      
      // Post tweet
      const postedTweet = await oauth1Client!.postTweet(testText);
      expect(postedTweet.id).toBeTruthy();
      expect(postedTweet.text).toBe(testText);
      
      postedTweetIds.push(postedTweet.id);
      await delay(RATE_LIMIT_DELAY);
      
      // Verify tweet exists
      const retrievedTweet = await oauth1Client!.getTweet(postedTweet.id);
      expect(retrievedTweet.id).toBe(postedTweet.id);
      // Twitter appends media URLs to tweets, so check if text starts with our content
      expect(retrievedTweet.text).toContain(testText);
      
      await delay(RATE_LIMIT_DELAY);
      
      // Delete tweet
      const deleteResult = await oauth1Client!.deleteTweet(postedTweet.id);
      expect(deleteResult.deleted).toBe(true);
      
      // Remove from cleanup list since it's deleted
      const index = postedTweetIds.indexOf(postedTweet.id);
      if (index > -1) {
        postedTweetIds.splice(index, 1);
      }
    }, TEST_TIMEOUT);

    test('should post, verify, and delete tweet with media', async () => {
      if (!oauth1Client) {
        console.log('Skipping test - OAuth 1.0a credentials not available');
        return;
      }
      
      const testText = `Test tweet with media from OAuth 1.0a - ${Date.now()}`;
      const testImage = createTestImage();
      
      const mediaItems = [{
        data: testImage,
        media_type: 'image/jpeg' as const
      }];
      
      // Post tweet with media
      const postedTweet = await oauth1Client!.postTweetWithMedia(testText, undefined, mediaItems);
      expect(postedTweet.id).toBeTruthy();
      // Twitter appends media URL to the text
      expect(postedTweet.text).toContain(testText);
      
      postedTweetIds.push(postedTweet.id);
      await delay(RATE_LIMIT_DELAY);
      
      // Verify tweet exists
      const retrievedTweet = await oauth1Client!.getTweet(postedTweet.id);
      expect(retrievedTweet.id).toBe(postedTweet.id);
      // Twitter appends media URLs to tweets, so check if text starts with our content
      expect(retrievedTweet.text).toContain(testText);
      
      await delay(RATE_LIMIT_DELAY);
      
      // Delete tweet
      const deleteResult = await oauth1Client!.deleteTweet(postedTweet.id);
      expect(deleteResult.deleted).toBe(true);
      
      // Remove from cleanup list since it's deleted
      const index = postedTweetIds.indexOf(postedTweet.id);
      if (index > -1) {
        postedTweetIds.splice(index, 1);
      }
    }, TEST_TIMEOUT);
  });

  describe('OAuth 2.0 Tests', () => {
    beforeEach(() => {
      if (!oauth2Client) {
        console.log('Skipping OAuth 2.0 tests - credentials not provided');
      }
    });

    test('should post, verify, and delete text-only tweet', async () => {
      const testText = `Test tweet from OAuth 2.0 - ${Date.now()}`;
      
      // Post tweet
      const postedTweet = await oauth2Client!.postTweet(testText);
      expect(postedTweet.id).toBeTruthy();
      expect(postedTweet.text).toBe(testText);
      
      postedTweetIds.push(postedTweet.id);
      await delay(RATE_LIMIT_DELAY);
      
      // Verify tweet exists
      const retrievedTweet = await oauth2Client!.getTweet(postedTweet.id);
      expect(retrievedTweet.id).toBe(postedTweet.id);
      expect(retrievedTweet.text).toBe(testText);
      
      await delay(RATE_LIMIT_DELAY);
      
      // Delete tweet
      const deleteResult = await oauth2Client!.deleteTweet(postedTweet.id);
      expect(deleteResult.deleted).toBe(true);
      
      // Remove from cleanup list since it's deleted
      const index = postedTweetIds.indexOf(postedTweet.id);
      if (index > -1) {
        postedTweetIds.splice(index, 1);
      }
    }, TEST_TIMEOUT);

    test('should post, verify, and delete tweet with media', async () => {
      const testText = `Test tweet with media from OAuth 2.0 - ${Date.now()}`;
      const testImage = createTestImage();
      
      const mediaItems = [{
        data: testImage,
        media_type: 'image/jpeg' as const
      }];
      
      // Post tweet with media
      const postedTweet = await oauth2Client!.postTweetWithMedia(testText, undefined, mediaItems);
      expect(postedTweet.id).toBeTruthy();
      // Twitter appends media URLs to tweets, so check if text starts with our content
      expect(postedTweet.text).toContain(testText);
      
      postedTweetIds.push(postedTweet.id);
      await delay(RATE_LIMIT_DELAY);
      
      // Verify tweet exists
      const retrievedTweet = await oauth2Client!.getTweet(postedTweet.id);
      expect(retrievedTweet.id).toBe(postedTweet.id);
      // Twitter appends media URLs to tweets, so check if text starts with our content
      expect(retrievedTweet.text).toContain(testText);
      
      await delay(RATE_LIMIT_DELAY);
      
      // Delete tweet
      const deleteResult = await oauth2Client!.deleteTweet(postedTweet.id);
      expect(deleteResult.deleted).toBe(true);
      
      // Remove from cleanup list since it's deleted
      const index = postedTweetIds.indexOf(postedTweet.id);
      if (index > -1) {
        postedTweetIds.splice(index, 1);
      }
    }, TEST_TIMEOUT);
  });

  describe('Cross-Authentication Compatibility', () => {
    beforeEach(() => {
      if (!oauth1Client || !oauth2Client) {
        console.log('Skipping cross-auth tests - both OAuth sets required');
      }
    });

    test('should post with OAuth 1.0a and verify/delete with OAuth 2.0', async () => {
      const testText = `Cross-auth test (OAuth 1.0a→2.0) - ${Date.now()}`;
      
      // Post with OAuth 1.0a
      const postedTweet = await oauth1Client!.postTweet(testText);
      expect(postedTweet.id).toBeTruthy();
      
      postedTweetIds.push(postedTweet.id);
      await delay(RATE_LIMIT_DELAY);
      
      // Verify with OAuth 2.0
      const retrievedTweet = await oauth2Client!.getTweet(postedTweet.id);
      expect(retrievedTweet.id).toBe(postedTweet.id);
      expect(retrievedTweet.text).toBe(testText);
      
      await delay(RATE_LIMIT_DELAY);
      
      // Delete with OAuth 2.0
      const deleteResult = await oauth2Client!.deleteTweet(postedTweet.id);
      expect(deleteResult.deleted).toBe(true);
      
      // Remove from cleanup list since it's deleted
      const index = postedTweetIds.indexOf(postedTweet.id);
      if (index > -1) {
        postedTweetIds.splice(index, 1);
      }
    }, TEST_TIMEOUT);

    test('should post with OAuth 2.0 and verify/delete with OAuth 1.0a', async () => {
      const testText = `Cross-auth test (OAuth 2.0→1.0a) - ${Date.now()}`;
      
      // Post with OAuth 2.0
      const postedTweet = await oauth2Client!.postTweet(testText);
      expect(postedTweet.id).toBeTruthy();
      
      postedTweetIds.push(postedTweet.id);
      await delay(RATE_LIMIT_DELAY);
      
      // Verify with OAuth 1.0a
      const retrievedTweet = await oauth1Client!.getTweet(postedTweet.id);
      expect(retrievedTweet.id).toBe(postedTweet.id);
      expect(retrievedTweet.text).toBe(testText);
      
      await delay(RATE_LIMIT_DELAY);
      
      // Delete with OAuth 1.0a
      const deleteResult = await oauth1Client!.deleteTweet(postedTweet.id);
      expect(deleteResult.deleted).toBe(true);
      
      // Remove from cleanup list since it's deleted
      const index = postedTweetIds.indexOf(postedTweet.id);
      if (index > -1) {
        postedTweetIds.splice(index, 1);
      }
    }, TEST_TIMEOUT);
  });

  describe('Error Handling Tests', () => {
    beforeEach(() => {
      if (!oauth1Client && !oauth2Client) {
        console.log('Skipping error handling tests - at least one OAuth set required');
      }
    });

    test('should handle invalid tweet ID gracefully', async () => {
      const client = oauth1Client || oauth2Client!;
      
      await expect(client.getTweet('invalid-tweet-id'))
        .rejects
        .toThrow();
    });

    test('should handle deleting non-existent tweet gracefully', async () => {
      const client = oauth1Client || oauth2Client!;
      
      await expect(client.deleteTweet('999999999999999999'))
        .rejects
        .toThrow();
    });

    test('should validate media size limits', async () => {
      const client = oauth1Client || oauth2Client!;
      
      // Create oversized base64 data (16MB)
      const oversizedData = 'A'.repeat(16 * 1024 * 1024);
      const mediaItems = [{
        data: oversizedData,
        media_type: 'image/jpeg' as const
      }];
      
      await expect(client.postTweetWithMedia('Test', undefined, mediaItems))
        .rejects
        .toThrow('Base64 media data too large');
    });

    test('should validate invalid base64 data', async () => {
      const client = oauth1Client || oauth2Client!;
      
      const mediaItems = [{
        data: 'invalid-base64-data!!!',
        media_type: 'image/jpeg' as const
      }];
      
      await expect(client.postTweetWithMedia('Test', undefined, mediaItems))
        .rejects
        .toThrow('Invalid base64 media data');
    });
  });
});