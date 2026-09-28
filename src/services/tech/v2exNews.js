const HttpClient = require("../../utils/http");
const http = new HttpClient();
const { filterRecentItems } = require("../../utils/common");

const V2EX_BASE_URL = "https://www.v2ex.com";

// 配置
const V2EX_CONFIG = {
  sources: ["hot", "latest"],  // 获取源：最热 + 最新
  excludeNodes: ["promotions"], // 排除节点
  topN: 10,                     // 输出数量
};

/**
 * V2EX API 客户端类
 */
class V2EXClient {
  constructor(token = "") {
    this.token = token;
  }

  /**
   * 发送 API 请求
   * @param {string} path - API 路径
   * @returns {Promise<Array>}
   */
  async request(path) {
    const headers = {
      "User-Agent": "v2ex-digest/1.0",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const url = `${V2EX_BASE_URL}${path}`;
    const data = await http.get(url, { headers });
    return data || [];
  }

  /**
   * 获取最热话题
   * @returns {Promise<Array>}
   */
  async fetchHot() {
    const topics = await this.request("/api/topics/hot.json");
    return topics.map((t) => this.normalize(t));
  }

  /**
   * 获取最新话题
   * @returns {Promise<Array>}
   */
  async fetchLatest() {
    const topics = await this.request("/api/topics/latest.json");
    return topics.map((t) => this.normalize(t));
  }

  /**
   * 根据源类型获取话题
   * @param {string} source - hot, latest, 或节点名
   * @returns {Promise<Array>}
   */
  async fetchBySource(source) {
    switch (source.toLowerCase()) {
      case "hot":
        return this.fetchHot();
      case "latest":
        return this.fetchLatest();
      default:
        // 按节点获取（暂不使用，保留扩展性）
        const topics = await this.request(
          `/api/topics/show.json?node_name=${encodeURIComponent(source)}`
        );
        return topics.map((t) => this.normalize(t));
    }
  }

  /**
   * 标准化话题数据格式
   * @param {Object} t - V2EX 原始话题数据
   * @returns {Object}
   */
  normalize(t) {
    return {
      id: String(t.id),
      title: t.title,
      url: t.url || `${V2EX_BASE_URL}/t/${t.id}`,
      content: t.content || "",
      nodeName: t.node?.name || "",
      nodeTitle: t.node?.title || "",
      author: t.member?.username || "",
      replies: t.replies || 0,
      created: t.created, // Unix timestamp
    };
  }
}

/**
 * Hacker News 风格的时间衰减评分算法
 * Score = (replies - 1) / (hours + 2) ^ 1.8
 *
 * @param {Object} item - 话题对象
 * @returns {number} - 评分
 */
function computeScore(item) {
  if (item.replies <= 0) return 0;

  const hoursSincePost =
    (Date.now() - item.created * 1000) / (1000 * 60 * 60);
  const hours = Math.max(hoursSincePost, 0);

  const score = (item.replies - 1) / Math.pow(hours + 2, 1.8);
  return isNaN(score) || score < 0 ? 0 : score;
}

/**
 * 评分、过滤、去重并排序话题
 * @param {Array} items - 话题数组
 * @param {number} topN - 返回前 N 条
 * @param {Array} excludeNodes - 排除的节点列表
 * @returns {Array}
 */
function scoreAndRank(items, topN, excludeNodes = []) {
  const excludeSet = new Set(excludeNodes.map((n) => n.toLowerCase()));

  // 去重并过滤排除节点
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (excludeSet.has(item.nodeName.toLowerCase())) continue;

    seen.add(item.id);
    unique.push(item);
  }

  // 评分并过滤零分话题
  const scored = unique
    .map((item) => ({ item, score: computeScore(item) }))
    .filter((s) => s.score > 0);

  // 按评分降序排序
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

/**
 * 清理内容文本（移除 Markdown 标题和格式）
 * @param {string} content - 原始内容
 * @param {number} maxLength - 最大长度
 * @returns {string}
 */
function cleanContent(content, maxLength = 150) {
  if (!content) return "";

  // 移除 Markdown 标题（#、##、### 等）
  let cleaned = content.replace(/^#{1,6}\s+/gm, "");
  // 移除加粗标记
  cleaned = cleaned.replace(/\*\*/g, "");
  // 移除多余空行
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  // 移除所有换行符，用空格代替
  cleaned = cleaned.replace(/[\r\n]+/g, " ");
  // 移除多余空格
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // 截断
  if (cleaned.length > maxLength) {
    return cleaned.substring(0, maxLength - 3) + "...";
  }
  return cleaned;
}

/**
 * 获取 V2EX 日报
 * @returns {Promise<Array>}
 */
async function getV2exNews() {
  const client = new V2EXClient();

  // 并行获取所有配置源
  const sourcePromises = V2EX_CONFIG.sources.map(async (source) => {
    try {
      console.log(`Fetching V2EX topics from ${source}...`);
      const topics = await client.fetchBySource(source);
      return topics;
    } catch (error) {
      console.error(`Error fetching V2EX ${source}:`, error.message);
      return [];
    }
  });

  const sourcesResults = await Promise.all(sourcePromises);
  const allTopics = sourcesResults.flat();

  console.log(`V2EX: collected ${allTopics.length} topics`);

  // 评分排序并过滤
  const rankedTopics = scoreAndRank(
    allTopics,
    V2EX_CONFIG.topN,
    V2EX_CONFIG.excludeNodes
  );

  // 转换为统一格式
  const formattedNews = rankedTopics.map((s) => ({
    id: s.item.id,
    title: s.item.title,
    url: s.item.url,
    description: cleanContent(s.item.content, 150),
    source: s.item.nodeTitle || s.item.nodeName,
    author: s.item.author,
    posted_on: new Date(s.item.created * 1000).toISOString(),
    replies: s.item.replies,
    nodeName: s.item.nodeName,
    nodeTitle: s.item.nodeTitle,
    score: s.score,
  }));

  // V2EX 内容主要为中文，无需翻译
  // 过滤只保留当天内容（可选，根据需求）
  // const todayNews = filterRecentItems(formattedNews);
  // console.log(`V2EX: filtered to ${todayNews.length} items from today`);

  console.log(`V2EX: returning ${formattedNews.length} ranked topics`);
  return formattedNews;
}

module.exports = {
  getV2exNews,
  V2EXClient,
  computeScore,
  scoreAndRank,
};
