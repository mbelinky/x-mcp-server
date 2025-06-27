import { FormattedTweet, Tweet, XUser, SearchResponse } from './types.js';

export class ResponseFormatter {
  static formatTweet(tweet: Tweet, user: XUser, position: number): FormattedTweet {
    return {
      position,
      author: {
        username: user.username
      },
      content: tweet.text,
      metrics: tweet.metrics,
      url: `https://x.com/${user.username}/status/${tweet.id}`
    };
  }

  static formatSearchResponse(
    query: string,
    tweets: Tweet[],
    users: XUser[]
  ): SearchResponse {
    const userMap = new Map(users.map(user => [user.id, user]));
    
    const formattedTweets = tweets
      .map((tweet, index) => {
        const user = userMap.get(tweet.authorId);
        if (!user) return null;
        
        return this.formatTweet(tweet, user, index + 1);
      })
      .filter((tweet): tweet is FormattedTweet => tweet !== null);

    return {
      query,
      count: formattedTweets.length,
      tweets: formattedTweets
    };
  }

  static toMcpResponse(response: SearchResponse): string {
    const header = [
      'X SEARCH RESULTS',
      `Query: "${response.query}"`,
      `Found ${response.count} tweets`,
      '='
    ].join('\n');

    if (response.count === 0) {
      return header + '\nNo tweets found matching your query.';
    }

    const tweetBlocks = response.tweets.map(tweet => [
      `Tweet #${tweet.position}`,
      `From: @${tweet.author.username}`,
      `Content: ${tweet.content}`,
      `Metrics: ${tweet.metrics.likes} likes, ${tweet.metrics.retweets} retweets`,
      `URL: ${tweet.url}`,
      '='
    ].join('\n'));

    return [header, ...tweetBlocks].join('\n\n');
  }
}