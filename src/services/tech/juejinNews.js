const HttpClient = require("../../utils/http");
const http = new HttpClient();

/**
 * 掘金（Juejin）技术社区配置
 * 中文开发者社区，提供技术文章和讨论
 */
const JUEJIN_CONFIG = {
  baseUrl: "https://api.juejin.cn",
  endpoints: {
    // 旧的 content_api/v1/content/article_rank 与 content/article_list 已下线，
    // 现在都返回 {"err_no":2,"err_msg":"请求路由不存在"}。
    // 推荐流是当前唯一可用的公开接口。
    feed: "/recommend_api/v1/article/recommend_all_feed",
  },
  // 推荐流的请求体参数（与网页端一致）
  feedParams: {
    id_type: 2,
    client_type: 2608,
    sort_type: 200,
    cursor: "0",
    limit: 30,
  },
  topN: 10,
};

/** 推荐流里只有 item_type === 2 是文章，其余是沸点、广告等 */
const ITEM_TYPE_ARTICLE = 2;

/**
 * 掘金 API 客户端类
 */
class JuejinClient {
  constructor() {
    this.baseUrl = JUEJIN_CONFIG.baseUrl;
  }

  /**
   * 发送 API 请求
   * @param {string} endpoint - API 端点
   * @param {object} data - 请求数据
   * @returns {Promise<object>}
   */
  async request(endpoint, data = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": "https://juejin.cn/",
      "Origin": "https://juejin.cn",
    };

    return http.post(url, data, { headers });
  }

  /**
   * 获取推荐流文章
   * @returns {Promise<Array>}
   */
  async fetchFeed() {
    const response = await this.request(JUEJIN_CONFIG.endpoints.feed, {
      ...JUEJIN_CONFIG.feedParams,
    });
    return this.normalize(response);
  }

  /**
   * 标准化文章数据格式
   * 推荐流的结构是 data[].item_info.{article_info, author_user_info, tags}
   * @param {object} response - API 响应
   * @returns {Array}
   */
  normalize(response) {
    const entries = response?.data;
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries
      .filter((entry) => entry?.item_type === ITEM_TYPE_ARTICLE)
      .map((entry) => {
        const info = entry.item_info || {};
        const article = info.article_info || {};
        const author = info.author_user_info || {};
        const tags = (info.tags || []).map((tag) => tag?.tag_name).filter(Boolean);

        return {
          id: article.article_id,
          title: article.title || "",
          url: `https://juejin.cn/post/${article.article_id}`,
          description: this.cleanContent(article.brief_content || "", 150),
          author: author.user_name || "Unknown",
          posted_on: article.ctime
            ? new Date(Number(article.ctime) * 1000).toISOString()
            : new Date().toISOString(),
          // 推荐流给的是具体标签（如"人工智能"），比旧接口的分类名更贴切
          category: tags[0] || info.category?.category_name || "技术",
          tags: tags.slice(0, 3),
          digg_count: article.digg_count || 0,
          comment_count: article.comment_count || 0,
          view_count: article.view_count || 0,
        };
      })
      .filter((item) => item.id && item.title);
  }

  /**
   * 清理内容文本
   * @param {string} content - 原始内容
   * @param {number} maxLength - 最大长度
   * @returns {string}
   */
  cleanContent(content, maxLength = 150) {
    if (!content) return "";

    // 移除HTML标签
    let cleaned = content.replace(/<[^>]*>?/gm, "");
    // 移除Markdown格式
    cleaned = cleaned.replace(/#{1,6}\s+/gm, "");
    cleaned = cleaned.replace(/\*\*/g, "");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
    cleaned = cleaned.replace(/[\r\n]+/g, " ");
    cleaned = cleaned.replace(/\s{2,}/g, " ");

    // 截断
    if (cleaned.length > maxLength) {
      return cleaned.substring(0, maxLength - 3) + "...";
    }
    return cleaned;
  }
}

/**
 * 获取掘金技术热闻
 * @returns {Promise<Array>}
 */
async function getJuejinNews() {
  const client = new JuejinClient();

  try {
    console.log("Fetching Juejin hot articles...");

    const articles = await client.fetchFeed();

    // 去重
    const seen = new Set();
    const uniqueArticles = articles.filter((article) => {
      if (seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });

    // 按热度排序（点赞 + 评论 + 浏览）
    const scoreOf = (a) =>
      (a.digg_count || 0) * 2 +
      (a.comment_count || 0) * 3 +
      (a.view_count || 0) * 0.1;

    const topArticles = uniqueArticles
      .sort((a, b) => scoreOf(b) - scoreOf(a))
      .slice(0, JUEJIN_CONFIG.topN);

    console.log(`Juejin: returning ${topArticles.length} top articles`);
    return topArticles;
  } catch (error) {
    console.error("Error fetching Juejin news:", error.message);
    return [];
  }
}

module.exports = {
  getJuejinNews,
  JuejinClient,
  JUEJIN_CONFIG,
};
