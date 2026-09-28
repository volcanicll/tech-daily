/**
 * 每日安全雷达服务
 * 数据源：The Hacker News RSS（免密钥，英文源，标题自动翻译为中文）
 * 注：FreeBuf 等国内安全社区对服务端请求有 TLS 指纹风控，无法稳定抓取
 */

const HttpClient = require("../../utils/http");
const http = new HttpClient();
const cheerio = require("cheerio");
const { filterRecentItems } = require("../../utils/common");
const { translateBatch } = require("../../utils/translation");

const SECURITY_SOURCES = [
  {
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
  },
];

/**
 * 解析 RSS/Atom XML 为条目数组
 * @param {string} xml - RSS 内容
 * @param {object} source - 源信息
 * @param {number} limit - 最大条数
 * @returns {Array}
 */
function parseFeedItems(xml, source, limit) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  // 同时兼容 RSS (<item>) 与 Atom (<entry>)
  $("item, entry").each((i, el) => {
    if (i >= limit) return false;

    const $el = $(el);
    const title = $el.find("title").text().trim();

    let link = $el.find("link").text().trim();
    if (!link) link = $el.find("link").attr("href");
    if (!link) link = $el.find("guid").text().trim();

    const description = $el.find("description").text().trim() ||
      $el.find("content").text().trim() ||
      $el.find("summary").text().trim();

    const pubDate = $el.find("pubDate").text().trim() ||
      $el.find("published").text().trim() ||
      $el.find("updated").text().trim();

    if (title && link) {
      items.push({
        title,
        link,
        description: description?.substring(0, 200),
        pubDate,
        source: source.name,
        category: "security",
      });
    }
  });

  return items;
}

/**
 * 获取安全资讯
 * @param {number} limit - 每个源最大条数
 * @returns {Promise<Array>} 安全资讯数组，失败返回空数组
 */
async function getSecurityRadar(limit = 8) {
  const allNews = [];

  for (const source of SECURITY_SOURCES) {
    try {
      console.log(`Fetching security news from ${source.name}...`);

      const xml = await http.get(source.url, {
        responseType: "text",
        headers: {
          Accept: "application/rss+xml,application/xml,text/xml,*/*",
        },
      });

      allNews.push(...parseFeedItems(xml, source, limit));
    } catch (error) {
      console.error(`Error fetching security news from ${source.name}:`, error.message);
    }
  }

  if (allNews.length === 0) {
    return [];
  }

  // 英文源，标题与描述翻译为中文
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

  // 优先保留近两天发布的内容；源更新慢时回退为最新若干条
  const recent = filterRecentItems(allNews, "pubDate", 48);
  const result = (recent.length > 0 ? recent : allNews).slice(0, limit);

  console.log(`Got ${result.length} security news items`);
  return result;
}

module.exports = { getSecurityRadar, parseFeedItems };
