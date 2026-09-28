/**
 * 宏观金融新闻服务
 * 获取影响加密货币市场的宏观经济新闻
 */

const HttpClient = require("../../utils/http");
const http = new HttpClient();
const cheerio = require("cheerio");
const { NEWS_SOURCES, FILTER_CONFIG } = require("../../config/constants");
const { translateBatch } = require("../../utils/translation");
const { filterRecentItems } = require("../../utils/common");

const MACRO_SOURCES = NEWS_SOURCES.macroRSS;

/**
 * 获取宏观金融新闻
 * @param {number} limit - 每个源最大条数
 * @returns {Promise<Array>} 宏观新闻数组
 */
async function getMacroNews(limit = 5) {
  const allNews = [];

  for (const source of MACRO_SOURCES) {
    try {
      console.log(`Fetching macro news from ${source.name}...`);

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
        if (i >= limit) return false;

        const $el = $(el);

        // Title
        const title = $el.find("title").text().trim();

        // Link
        let link = $el.find("link").text().trim();
        if (!link) {
          link = $el.find("link").attr("href");
        }
        if (!link) {
          link = $el.find("guid").text().trim();
        }

        // Description
        const description = $el.find("description").text().trim() ||
                           $el.find("content").text().trim() ||
                           $el.find("summary").text().trim();

        // PubDate
        const pubDate = $el.find("pubDate").text().trim() ||
                       $el.find("published").text().trim() ||
                       $el.find("updated").text().trim();

        // Author
        const author = $el.find("author").text().trim() ||
                      $el.find("creator").text().trim();

        if (title && link) {
          items.push({
            title,
            link,
            description: description?.substring(0, 200),
            pubDate,
            author,
            source: source.name,
            category: "macro",
          });
        }
      });

      allNews.push(...items);

    } catch (error) {
      console.error(`Error fetching macro news from ${source.name}:`, error.message);
    }
  }

  if (allNews.length === 0) {
    return [];
  }

  // 并行翻译标题和描述
  console.log(`Translating ${allNews.length} macro news items...`);
  await translateBatch(
    allNews,
    (item) => item.title,
    (item, translated) => { item.title = translated; }
  );

  await translateBatch(
    allNews,
    (item) => item.description,
    (item, translated) => { item.description = translated; }
  );

  // 过滤今天的新闻
  const todayNews = filterRecentItems(allNews);

  // 按关键词过滤（只保留与宏观金融相关的新闻）
  const filtered = todayNews.filter(item => {
    const text = (item.title + " " + (item.description || "")).toLowerCase();
    return NEWS_SOURCES.macroKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  });

  console.log(`Got ${filtered.length} macro news items after filtering`);
  return filtered;
}

module.exports = {
  getMacroNews,
};
