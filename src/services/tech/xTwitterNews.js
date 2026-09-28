/**
 * X/Twitter 热门技术帖子获取服务
 * 使用 RapidAPI twitter-api45
 * API 文档: https://rapidapi.com/alexanderxbx/api/twitter-api45
 */

const HttpClient = require("../../utils/http");
const http = new HttpClient();
const { env } = require("../../config/env");
const { translateToChinese, filterRecentItems } = require("../../utils/common");

// RapidAPI Twitter API45 配置
const TWITTER_API_HOST = "twitter-api45.p.rapidapi.com";
const BASE_URL = `https://${TWITTER_API_HOST}`;

// Agent Code 相关搜索关键词
const SEARCH_QUERIES = [
  "claude code",
  "cursor ai coding",
  "github copilot",
  "vibe coding",
  "llm agents coding",
  "ai code assistant",
];

/**
 * 搜索 Twitter 内容
 * @param {string} query - 搜索关键词
 * @param {string} searchType - 搜索类型 (Top, Latest)
 * @returns {Promise<Array>}
 */
async function searchTwitter(query, searchType = "Top") {
  try {
    if (!env.rapidApi.key) {
      console.warn("RAPID_API_KEY not configured, skipping X/Twitter fetch");
      return [];
    }

    console.log(`Searching X/Twitter for: ${query}...`);

    const response = await http.get(`${BASE_URL}/search.php`, {
      params: {
        query: query,
        search_type: searchType,
      },
      headers: {
        "x-rapidapi-key": env.rapidApi.key,
        "x-rapidapi-host": TWITTER_API_HOST,
      },
      responseType: "json",
    });

    if (!response || !response.timeline) {
      console.warn(`Twitter API Search: No timeline data for "${query}"`);
      return [];
    }

    // 解析推文数据
    return response.timeline.map((tweet) => {
      const screenName = tweet.user_info?.screen_name || "unknown";
      const tweetId = tweet.tweet_id || tweet.rest_id || "";

      return {
        title: tweet.text || "",
        url: tweetId ? `https://x.com/${screenName}/status/${tweetId}` : "",
        source: `X @${screenName}`,
        category: "twitter",
        posted_on: tweet.created_at
          ? new Date(tweet.created_at).toISOString()
          : new Date().toISOString(),
        // 互动数据用于排序
        engagement: {
          views: tweet.views || 0,
          favorites: tweet.favorites || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0,
        },
        // 作者信息
        author: {
          name: tweet.user_info?.name || "",
          screen_name: screenName,
          followers_count: tweet.user_info?.followers_count || 0,
        },
      };
    });
  } catch (error) {
    console.error(`Error searching X/Twitter for "${query}":`, error.message);
    return [];
  }
}

/**
 * 获取用户时间线
 * @param {string} screenname - Twitter 用户名
 * @returns {Promise<Object>}
 */
async function getUserTimeline(screenname) {
  try {
    if (!env.rapidApi.key) {
      return null;
    }

    console.log(`Fetching timeline for @${screenname}...`);

    const response = await http.get(`${BASE_URL}/timeline.php`, {
      params: { screenname },
      headers: {
        "x-rapidapi-key": env.rapidApi.key,
        "x-rapidapi-host": TWITTER_API_HOST,
      },
      responseType: "json",
    });

    if (!response) {
      console.warn(`Twitter API Timeline: No data for @${screenname}`);
      return null;
    }

    const result = {
      user: {
        name: response.user?.name,
        screen_name: screenname,
        verified: response.user?.blue_verified,
        description: response.user?.desc,
        followers_count: response.user?.sub_count,
      },
      tweets: [],
    };

    // 添加置顶推文
    if (response.pinned) {
      result.tweets.push({
        text: response.pinned.text,
        created_at: response.pinned.created_at,
        views: response.pinned.views,
        favorites: response.pinned.favorites,
        retweets: response.pinned.retweets,
        replies: response.pinned.replies,
        isPinned: true,
      });
    }

    // 添加时间线推文
    if (response.timeline && Array.isArray(response.timeline)) {
      response.timeline.forEach((tweet) => {
        result.tweets.push({
          text: tweet.text,
          created_at: tweet.created_at,
          views: tweet.views,
          favorites: tweet.favorites,
          retweets: tweet.retweets,
          replies: tweet.replies,
          isPinned: false,
        });
      });
    }

    return result;
  } catch (error) {
    console.error(`Error fetching timeline for @${screenname}:`, error.message);
    return null;
  }
}

/**
 * 获取 X/Twitter 上的 Agent Code 相关热门帖子
 * @returns {Promise<Array>}
 */
async function getXTwitterNews() {
  if (!env.rapidApi.key) {
    console.warn("RAPID_API_KEY not configured, skipping X/Twitter");
    return [];
  }

  const allTweets = [];

  // 并行搜索所有关键词
  const searchPromises = SEARCH_QUERIES.map((query) => searchTwitter(query));
  const results = await Promise.all(searchPromises);
  results.forEach((items) => allTweets.push(...items));

  // 去重（基于 URL）
  const seen = new Set();
  const uniqueTweets = allTweets.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // 按互动量排序（综合热门指标）
  uniqueTweets.sort((a, b) => {
    const scoreA =
      (a.engagement?.favorites || 0) +
      (a.engagement?.retweets || 0) * 2 +
      (a.engagement?.replies || 0);
    const scoreB =
      (b.engagement?.favorites || 0) +
      (b.engagement?.retweets || 0) * 2 +
      (b.engagement?.replies || 0);
    return scoreB - scoreA;
  });

  // 质量筛选：曝光度 > 1w 并且至少有评论
  const qualityTweets = uniqueTweets.filter((tweet) => {
    const views = tweet.engagement?.views || 0;
    const replies = tweet.engagement?.replies || 0;
    return views >= 10000 && replies > 0;
  });

  console.log(
    `X/Twitter News: ${uniqueTweets.length} total, ${qualityTweets.length} quality (views>10k & has replies)`
  );

  // 过滤保留一周内的消息
  const recentTweets = filterRecentItems(qualityTweets, "posted_on", 168);

  console.log(`X/Twitter News: ${recentTweets.length} from past week`);

  // 翻译热门帖子（限制数量）
  const translatedTweets = [];
  for (const tweet of recentTweets.slice(0, 10)) {
    try {
      // 截取标题长度
      const truncatedTitle =
        tweet.title.length > 100
          ? tweet.title.substring(0, 97) + "..."
          : tweet.title;

      translatedTweets.push({
        title: await translateToChinese(truncatedTitle),
        url: tweet.url,
        source: tweet.source,
        category: tweet.category,
        posted_on: tweet.posted_on,
        engagement: tweet.engagement,
      });
    } catch (transError) {
      console.warn(`Failed to translate tweet: ${transError.message}`);
      translatedTweets.push({
        title: tweet.title,
        url: tweet.url,
        source: tweet.source,
        category: tweet.category,
        posted_on: tweet.posted_on,
        engagement: tweet.engagement,
      });
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return translatedTweets;
}

module.exports = {
  searchTwitter,
  getUserTimeline,
  getXTwitterNews,
};
