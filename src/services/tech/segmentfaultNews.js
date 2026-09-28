const HttpClient = require("../../utils/http");
const http = new HttpClient();
const cheerio = require("cheerio");
const { translateBatch } = require("../../utils/translation");
const { filterRecentItems } = require("../../utils/common");

/**
 * SegmentFault 技术问答社区配置
 * 中文技术问答平台，类似StackOverflow
 */
const SEGMENTFAULT_CONFIG = {
  baseUrl: "https://segmentfault.com",
  endpoints: {
    // 热门问题
    hot: "/questions/hot",
    // 最新问题
    recent: "/questions/recent",
    // 热门文章
    articles: "/articles/hot",
    // 技术频道
    channels: "/channels",
  },
  // 订阅源。原先的 /questions/hot/rss 与 /articles/hot/rss 已 404，
  // 页面路径 /questions/hot、/articles/hot 也一并 404；
  // 目前只有 /feeds/questions 可用，且它是 Atom 格式而不是 RSS。
  feeds: {
    questions: "https://segmentfault.com/feeds/questions",
    articles: "", // 文章源已下线，留空则跳过
  },
  topN: 10,
};

/**
 * 解析订阅源 XML，同时兼容 RSS 与 Atom
 *
 * 两者的差别不只是标签名：RSS 的链接是元素文本，Atom 的链接在 href 属性上。
 * 只按 RSS 解析 Atom 源会拿到 0 条 —— 而且不报错，看起来像"源里没内容"。
 *
 * @param {string} xml - 订阅源原文
 * @returns {Array}
 */
function parseFeedXml(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });

  // RSS 用 <item>，Atom 用 <entry>
  const nodes = $("item").length > 0 ? $("item") : $("entry");
  const items = [];

  nodes.each((i, el) => {
    if (i >= 20) return false;

    const $el = $(el);
    const title = $el.find("title").first().text().trim();

    // RSS：<link>https://…</link>；Atom：<link href="https://…" />
    let link = $el.find("link").first().text().trim();
    if (!link) {
      link =
        $el.find("link").first().attr("href") ||
        $el.find("id").first().text().trim();
    }

    // 获取描述（RSS 是 description，Atom 是 summary/content）
    let description =
      $el.find("description").text() ||
      $el.find("summary").text() ||
      $el.find("content").text();

    // 清理HTML
    if (description) {
      description = description.replace(/<[^>]*>?/gm, "").trim();
      description = description.replace(/\s+/g, " ");
      if (description.length > 200) {
        description = description.substring(0, 197) + "...";
      }
    }

    // 获取作者。Atom 是 <author><name>…</name><uri>…</uri></author>，
    // 直接取 author 的文本会把 uri 也拼进来
    const author =
      $el.find("author name").first().text().trim() ||
      $el.find("author").first().text().trim() ||
      "Unknown";

    // 获取发布时间（RSS 是 pubDate，Atom 是 published/updated）
    const pubDate =
      $el.find("pubDate").text().trim() ||
      $el.find("published").text().trim() ||
      $el.find("updated").text().trim();

    if (title && link) {
      items.push({
        title,
        url: link,
        description: description || "",
        author,
        posted_on: pubDate
          ? new Date(pubDate).toISOString()
          : new Date().toISOString(),
      });
    }
  });

  return items;
}

/**
 * SegmentFault 客户端类
 */
class SegmentFaultClient {
  constructor() {
    this.baseUrl = SEGMENTFAULT_CONFIG.baseUrl;
  }

  /**
   * 拉取并解析订阅源
   * @param {string} url - 订阅源地址
   * @returns {Promise<Array>}
   */
  async fetchFeed(url) {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept:
        "application/atom+xml,application/rss+xml,application/xml,text/xml,*/*",
    };

    const xml = await http.get(url, { headers });
    return parseFeedXml(xml);
  }

  /**
   * 获取页面内容（备用方案）
   * @param {string} path - 页面路径
   * @returns {Promise<Array>}
   */
  async fetchPage(path) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };

    const html = await http.get(url, { headers });
    const $ = cheerio.load(html);
    const items = [];

    // 解析问题列表
    $(".news-item, .question-item").each((i, el) => {
      if (i >= 15) return false;

      const $el = $(el);
      const title = $el.find("h2 a, .title a").text().trim();
      let link = $el.find("h2 a, .title a").attr("href");
      if (link && !link.startsWith("http")) {
        link = `${this.baseUrl}${link}`;
      }

      const description = $el.find(".text, .excerpt").text().trim();
      const author = $el.find(".author, .user-name").text().trim() || "Unknown";
      const time = $el.find(".time, .date").text().trim();

      if (title && link) {
        items.push({
          title,
          url: link,
          description: description ? description.substring(0, 200) : "",
          author,
          posted_on: time ? this.parseTime(time) : new Date().toISOString(),
        });
      }
    });

    return items;
  }

  /**
   * 解析相对时间
   * @param {string} timeStr - 时间字符串（如"2小时前"）
   * @returns {string}
   */
  parseTime(timeStr) {
    const now = new Date();
    const match = timeStr.match(/(\d+)\s*(分钟|小时|天|周|月)前/);
    
    if (!match) return now.toISOString();
    
    const amount = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case "分钟":
        now.setMinutes(now.getMinutes() - amount);
        break;
      case "小时":
        now.setHours(now.getHours() - amount);
        break;
      case "天":
        now.setDate(now.getDate() - amount);
        break;
      case "周":
        now.setDate(now.getDate() - amount * 7);
        break;
      case "月":
        now.setMonth(now.getMonth() - amount);
        break;
    }
    
    return now.toISOString();
  }
}

/**
 * 获取 SegmentFault 热门技术问答
 * @returns {Promise<Array>}
 */
async function getSegmentFaultNews() {
  const client = new SegmentFaultClient();

  try {
    console.log("Fetching SegmentFault hot questions...");

    const { questions: questionsFeed, articles: articlesFeed } =
      SEGMENTFAULT_CONFIG.feeds;

    // 并行获取问题和文章（文章源已下线，留空则跳过）
    const [questions, articles] = await Promise.all([
      client.fetchFeed(questionsFeed).catch((e) => {
        console.error("SegmentFault questions fetch error:", e.message);
        return [];
      }),
      articlesFeed
        ? client.fetchFeed(articlesFeed).catch((e) => {
            console.error("SegmentFault articles fetch error:", e.message);
            return [];
          })
        : Promise.resolve([]),
    ]);

    // 合并并分类
    const allItems = [
      ...questions.map(q => ({ ...q, type: "question" })),
      ...articles.map(a => ({ ...a, type: "article" })),
    ];

    // 基本去重（基于URL）
    const seen = new Set();
    const uniqueItems = allItems.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    // 使用并行翻译优化性能
    const itemsToTranslate = uniqueItems.slice(0, 25);
    console.log(`Translating ${itemsToTranslate.length} SegmentFault items...`);

    // 并行翻译标题
    await translateBatch(
      itemsToTranslate,
      (item) => item.title,
      (item, translated) => { item.title = translated; }
    );

    // 过滤近期内容。这里用 7 天而不是默认的 24 小时：
    // /feeds/questions 实际上是按热度排的榜单而非"最新"流，实测最新一条
    // 也有 26 小时、中位数 19 天，套 24 小时窗口会把它整段清空。
    // 问答站本身是低频的，7 天窗口才符合它的更新节奏。
    const recentItems = filterRecentItems(itemsToTranslate, "posted_on", 7 * 24);
    console.log(`SegmentFault: 7 天内 ${recentItems.length} 条`);

    // 取前N条
    return recentItems.slice(0, SEGMENTFAULT_CONFIG.topN);
  } catch (error) {
    console.error("Error fetching SegmentFault news:", error.message);
    return [];
  }
}

module.exports = {
  getSegmentFaultNews,
  SegmentFaultClient,
  SEGMENTFAULT_CONFIG,
  parseFeedXml,
};