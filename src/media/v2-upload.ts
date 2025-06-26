import { TwitterError } from '../types.js';

const V2_MEDIA_UPLOAD_URL = 'https://api.x.com/2/media/upload';

/**
 * Upload media using Twitter API v2 endpoints
 * This implements the single-request upload for v2
 */
export class V2MediaUploader {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Upload media file using v2 API
   * @param buffer - The media content as a Buffer
   * @param mimeType - The MIME type of the media
   * @returns The media ID string to use in tweets
   */
  async uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      // v2 media upload uses a simple multipart upload
      const formData = new FormData();
      
      // Create a Blob from the buffer with proper MIME type
      const blob = new Blob([buffer], { type: mimeType });
      
      // Determine media category based on MIME type
      const mediaCategory = mimeType.startsWith('image/') ? 'tweet_image' : 'tweet_video';
      
      // Add the media file
      formData.append('media', blob, 'media');
      formData.append('media_category', mediaCategory);

      const response = await fetch(V2_MEDIA_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const result = await response.json();
      
      // v2 returns data.id or data.media_key
      if (result.data) {
        return result.data.id || result.data.media_key;
      }
      
      // Fallback for other response formats
      return result.media_id_string || result.media_id || result.id;
    } catch (error) {
      if (error instanceof Error) {
        throw new TwitterError(
          `V2 media upload failed: ${error.message}`,
          'media_upload_failed',
          500
        );
      }
      throw error;
    }
  }

}