const HttpClient = require("../../utils/http");
const http = new HttpClient();
const cheerio = require("cheerio");
const { translateBatch } = require("../../utils/translation");
const { filterRecentItems } = require("../../utils/common");

const AI_SOURCES = [
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    isRss: true,
  },
  {
    name: "Wired AI",
    url: "https://www.wired.com/feed/tag/ai/latest/rss",
    isRss: true,
  },
  {
    name: "MIT Technology Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    isRss: true,
  },
  {
    name: "Google AI Blog",
    url: "https://research.google/blog/rss",
    isRss: true,
  },
  {
    name: "OpenAI Blog",
    url: "https://openai.com/news/rss.xml",
    isRss: true,
  },
  {
    name: "ArXiv CS.AI",
    url: "https://rss.arxiv.org/rss/cs.ai",
    isRss: true,
  },
  {
    name: "TLDR Tech",
    url: "https://tldr.tech/tech.rss",
    isRss: true,
  },
];

/**
 * Fetch AI news from defined sources (RSS/Atom)
 * @returns {Promise<Array>}
 */
async function getAINews() {
  const allNews = [];

  for (const source of AI_SOURCES) {
    try {
      console.log(`Fetching AI news from ${source.name}...`);
      // Use axios directly or http wrapper. Note: Some RSS feeds might need User-Agent.
      // ArXiv sometimes blocks requests without proper User-Agent or if too frequent.

      const xml = await http.get(source.url, {
        responseType: "text",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml,application/xml,text/xml,*/*",
        },
      });

      const $ = cheerio.load(xml, { xmlMode: true });
      const items = [];

      // Handle both RSS (<item>) and Atom (<entry>)
      const entryNodes = $("item, entry");

      entryNodes.each((i, el) => {
        if (i >= 5) return false; // Limit to 5 items per source

        const $el = $(el);

        // Title
        const title = $el.find("title").text().trim();

        // Link: Simple RSS vs Atom <link href="...">
        let link = $el.find("link").text().trim();
        if (!link) {
          link = $el.find("link").attr("href");
        }

        // Description/Summary/Content
        let description = $el.find("description").text();
        if (!description) {
          description = $el.find("summary").text();
        }
        if (!description) {
          description = $el.find("content").text();
        }
        // Strip HTML
        description = description.replace(/<[^>]*>?/gm, "").trim();
        // Decode HTML entities if needed (cheerio handles some)
        // Normalize whitespace
        description = description.replace(/\s+/g, " ");

        // Date
        let pubDate = $el.find("pubDate").text().trim();
        if (!pubDate) {
          pubDate = $el.find("published").text().trim();
        }
        if (!pubDate) {
          pubDate = $el.find("updated").text().trim();
        }

        if (title && link) {
          items.push({
            title,
            description: description.substring(0, 200) + "...", // Truncate description
            url: link,
            author: source.name,
            posted_on: pubDate
              ? new Date(pubDate).toISOString() || new Date().toISOString()
              : new Date().toISOString(),
          });
        }
      });

      allNews.push(...items);
    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error.message);
    }
  }

  const sourceCount = new Set(allNews.map((n) => n.author)).size;
  console.log(
    `AI News: collected ${allNews.length} items from ${sourceCount} sources`
  );

  // 使用并行翻译优化性能
  const itemsToTranslate = allNews.slice(0, 20);
  console.log(`Translating ${itemsToTranslate.length} AI news items...`);

  // 并行翻译标题
  await translateBatch(
    itemsToTranslate,
    (item) => item.title,
    (item, translated) => { item.title = translated; }
  );

  // 并行翻译描述
  await translateBatch(
    itemsToTranslate,
    (item) => item.description,
    (item, translated) => { item.description = translated; }
  );

  const translatedAiNews = itemsToTranslate;

  // 过滤只保留当天的消息
  const todayNews = filterRecentItems(translatedAiNews);
  console.log(`AI News: filtered to ${todayNews.length} items from today`);
  return todayNews;
}

module.exports = {
  getAINews,
};
