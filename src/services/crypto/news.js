const HttpClient = require("../../utils/http");
const http = new HttpClient();
const {
  translateToChinese,
  fetchWithRetry,
  filterRecentItems,
} = require("../../utils/common");

const CRYPTOCOMPARE_API_URL = "https://min-api.cryptocompare.com/data/v2";
const COINPAPRIKA_API_URL = "https://api.coinpaprika.com/v1";

/**
 * Fetch crypto news from CryptoCompare (Primary)
 */
async function getCryptoCompareNews() {
  const response = await http.get(`${CRYPTOCOMPARE_API_URL}/news/`, {
    params: { lang: "EN" },
  });
  const newsData = Array.isArray(response.Data) ? response.Data : [];
  return newsData.slice(0, 15).map((item) => ({
    title: item.title,
    description: item.body,
    url: item.url,
    author: item.source,
    posted_on: new Date(item.published_on * 1000).toISOString(),
  }));
}

/**
 * Fetch crypto news from Coinpaprika (Backup)
 */
async function getCoinpaprikaNews() {
  const response = await http.get(`${COINPAPRIKA_API_URL}/news/latest`);
  return response.slice(0, 15).map((item) => ({
    title: item.title,
    description: item.intro,
    url: item.url,
    author: item.source,
    posted_on: item.date,
  }));
}

/**
 * Fetch latest crypto news with fallback and translation
 * @returns {Promise<Array>}
 */
async function getCryptoNews() {
  let news = [];
  try {
    console.log("Fetching crypto news from CryptoCompare...");
    news = await fetchWithRetry(() => getCryptoCompareNews(), 3);
  } catch (error) {
    console.error(
      "CryptoCompare failed. Switching to Coinpaprika...",
      error.message
    );
    try {
      news = await fetchWithRetry(() => getCoinpaprikaNews(), 3);
    } catch (backupError) {
      console.error("All crypto news APIs failed:", backupError.message);
      return [];
    }
  }

  // Translate sequentially to avoid rate limits
  const translatedNews = [];
  for (const item of news) {
    translatedNews.push({
      ...item,
      title: await translateToChinese(item.title),
      description: await translateToChinese(item.description),
    });
    // Small delay to be polite to the translation service
    await new Promise((r) => setTimeout(r, 200));
  }
  // 过滤只保留当天的消息
  const todayNews = filterRecentItems(translatedNews);
  console.log(`Crypto News: filtered to ${todayNews.length} items from today`);
  return todayNews;
}

module.exports = {
  getCryptoNews,
};
