const HttpClient = require("../../utils/http");
const http = new HttpClient();
const cheerio = require("cheerio");
const { translateBatch } = require("../../utils/translation");
const { filterRecentItems } = require("../../utils/common");

/**
 * Agent Code / Vibe Coding 相关 RSS 源
 */
const RSS_SOURCES = [
  // 官方博客
  {
    name: "GitHub Blog",
    url: "https://github.blog/feed/",
    category: "official",
    keywords: [
      "copilot",
      "ai",
      "agent",
      "code",
      "coding",
      "developer",
      "vibe",
      "assistant",
    ],
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    category: "official",
    keywords: ["claude", "code", "coding", "agent", "developer", "ai", "llm"],
  },
  {
    name: "OpenAI",
    url: "https://openai.com/news/rss.xml",
    category: "official",
    keywords: ["gpt", "codex", "code", "agent", "developer", "api"],
  },
  {
    name: "Smol AI News",
    url: "https://news.smol.ai/rss.xml",
    category: "official",
    keywords: ["ai", "agent", "llm", "code", "coding", "developer", "model"],
  },
  // DeepLearning.AI
  {
    name: "AI News HN",
    url: "https://hnrss.org/newest?q=LLM+OR+GPT+OR+Claude&points=30",
    category: "community",
    keywords: ["agent", "llm", "coding", "developer", "ai"],
  },
  // 社区讨论
  {
    name: "Reddit r/LocalLLaMA",
    url: "https://www.reddit.com/r/LocalLLaMA/.rss",
    category: "community",
    keywords: [
      "agent",
      "coding",
      "code",
      "vibe",
      "cursor",
      "copilot",
      "claude",
    ],
  },
  {
    name: "Reddit r/MachineLearning",
    url: "https://www.reddit.com/r/MachineLearning/.rss",
    category: "community",
    keywords: ["agent", "code", "coding", "llm", "copilot"],
  },
  {
    name: "Lobste.rs AI",
    url: "https://lobste.rs/t/ai.rss",
    category: "community",
    keywords: ["agent", "coding", "code", "copilot", "cursor", "llm"],
  },
  // 开发者工具
  {
    name: "Dev.to AI",
    url: "https://dev.to/feed/tag/ai",
    category: "devtools",
    keywords: [
      "agent",
      "copilot",
      "cursor",
      "claude",
      "vibe",
      "coding",
      "code",
    ],
  },
  {
    name: "Echo JS",
    url: "https://www.echojs.com/rss",
    category: "devtools",
    keywords: ["ai", "agent", "copilot", "cursor", "vibe", "coding"],
  },
  // Hacker News (预过滤的搜索)
  {
    name: "Hacker News",
    url: "https://hnrss.org/newest?q=AI+coding+OR+AI+agent+OR+copilot+OR+cursor+OR+claude+code+OR+vibe+coding&points=50",
    category: "community",
    keywords: [],
  },
];

/**
 * GitHub Trending - 直接抓取页面 (主要方案)
 */

/**
 * 检查标题是否包含相关关键词
 * @param {string} title
 * @param {string[]} keywords
 * @returns {boolean}
 */
const matchesKeywords = (title, keywords) => {
  if (!keywords || keywords.length === 0) return true;
  const lowerTitle = title.toLowerCase();
  return keywords.some((kw) => lowerTitle.includes(kw.toLowerCase()));
};

/**
 * 抓取 RSS 源
 * @param {object} source
 * @returns {Promise<Array>}
 */
async function fetchRSSSource(source) {
  const items = [];

  try {
    console.log(`Fetching Agent Code news from ${source.name}...`);

    const xml = await http.get(source.url, {
      responseType: "text",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/rss+xml,application/xml,text/xml,*/*",
      },
    });

    const $ = cheerio.load(xml, { xmlMode: true });
    const entryNodes = $("item, entry");

    entryNodes.each((i, el) => {
      if (i >= 15) return false;

      const $el = $(el);
      const title = $el.find("title").text().trim();

      if (!matchesKeywords(title, source.keywords)) {
        return;
      }

      let link = $el.find("link").text().trim();
      if (!link) {
        link = $el.find("link").attr("href");
      }

      // Capture description/summary
      let description = $el.find("description").text();
      if (!description) description = $el.find("summary").text();
      if (!description) description = $el.find("content").text();
      if (!description) description = $el.find("content\\:encoded").text();

      // Clean HTML from description
      if (description) {
        description = description.replace(/<[^>]*>?/gm, "").trim();
        description = description.replace(/\s+/g, " ");
        // Limit length for summary
        if (description.length > 150) {
          description = description.substring(0, 147) + "...";
        }
      }

      let pubDate = $el.find("pubDate").text().trim();
      if (!pubDate) pubDate = $el.find("published").text().trim();
      if (!pubDate) pubDate = $el.find("updated").text().trim();

      if (title && link) {
        items.push({
          title,
          description: description || "", // Add description
          url: link,
          source: source.name,
          category: source.category,
          posted_on: pubDate
            ? new Date(pubDate).toISOString()
            : new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    console.error(`Error fetching ${source.name}:`, error.message);
  }

  return items.slice(0, 3);
}

/**
 * 直接抓取 GitHub Trending 页面
 * @returns {Promise<Array>}
 */
async function scrapeGitHubTrendingPage() {
  const items = [];

  try {
    console.log("Scraping GitHub Trending page...");

    const html = await http.get(
      "https://github.com/trending?since=daily&spoken_language_code=",
      {
        responseType: "text",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      },
    );

    const $ = cheerio.load(html);
    const aiKeywords = [
      "ai",
      "agent",
      "llm",
      "gpt",
      "copilot",
      "code",
      "assistant",
      "chat",
      "mcp",
    ];

    $("article.Box-row").each((i, el) => {
      if (i >= 20) return false;

      const $el = $(el);
      const repoLink = $el.find("h2 a").attr("href");
      const repoName = $el.find("h2 a").text().trim().replace(/\s+/g, "");
      const description = $el.find("p").text().trim();

      const combined = `${repoName} ${description}`.toLowerCase();

      if (aiKeywords.some((kw) => combined.includes(kw))) {
        items.push({
          title: `⭐ ${repoName}: ${description || "No description"}`,
          url: `https://github.com${repoLink}`,
          source: "GitHub Trending",
          category: "opensource",
          posted_on: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    console.error("Error scraping GitHub Trending:", error.message);
  }

  return items.slice(0, 3);
}

/**
 * Fetch Agent Code related news from all sources
 * @returns {Promise<Array>}
 */
async function getAgentCodeNews() {
  const allNews = [];

  // 并行获取所有 RSS 源
  const rssPromises = RSS_SOURCES.map((source) => fetchRSSSource(source));
  const rssResults = await Promise.all(rssPromises);
  rssResults.forEach((items) => allNews.push(...items));

  // 获取 GitHub Trending (直接抓取页面)
  const trendingItems = await scrapeGitHubTrendingPage().catch((e) => {
    console.error("GitHub Trending scrape error:", e.message);
    return [];
  });
  allNews.push(...trendingItems);

  // 按时间排序（最新优先）
  allNews.sort((a, b) => new Date(b.posted_on) - new Date(a.posted_on));

  // 基本去重（基于 URL）
  const seen = new Set();
  const uniqueNews = allNews.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  const sourceCount = new Set(uniqueNews.map((n) => n.source)).size;
  console.log(
    `Agent Code News: collected ${uniqueNews.length} items from ${sourceCount} sources`,
  );

  // 使用并行翻译优化性能
  const itemsToTranslate = uniqueNews.slice(0, 25);
  console.log(`Translating ${itemsToTranslate.length} Agent Code news items...`);

  // 并行翻译标题
  await translateBatch(
    itemsToTranslate,
    (item) => item.title,
    (item, translated) => { item.title = translated; }
  );

  const translatedNews = itemsToTranslate;

  // 过滤只保留当天的消息
  const todayNews = filterRecentItems(translatedNews);
  console.log(
    `Agent Code News: filtered to ${todayNews.length} items from today`,
  );
  return todayNews;
}

module.exports = {
  getAgentCodeNews,
};
