const {
  sectionHeader,
  priceItem,
  cardItem,
  infoRow,
  formatRelativeTime,
} = require("./DingTalkMarkdownUtils");
const { sparkline } = require("../sparkline");
const { STATE_CONFIG } = require("../../config/constants");

/**
 * Format crypto market and news data
 * @param {object} data
 * @param {Array} data.marketData
 * @param {Array} data.newsData
 * @param {object} data.sentimentData
 * @param {object} [options]
 * @param {object} [options.series] - 各币种的历史价格序列 { BTC: [..] }，用于画走势
 * @param {number} [options.sparklineDays]
 * @returns {string} Formatted crypto report
 */
const formatCrypto = ({ marketData, newsData, sentimentData }, options = {}) => {
  const sparklineDays = options.sparklineDays ?? STATE_CONFIG.sparklineDays;

  // 币种符号大小写在不同数据源之间不一致，统一后再查历史序列
  const seriesBySymbol = {};
  for (const [symbol, values] of Object.entries(options.series || {})) {
    seriesBySymbol[symbol.toUpperCase()] = values;
  }

  const hasTrend = (marketData || []).some(
    (coin) => (seriesBySymbol[coin.symbol?.toUpperCase()] || []).length >= 2
  );

  let message = sectionHeader("💰", "加密行情");
  message += hasTrend
    ? `> _主流币价格 · 恐慌贪婪指数 · 近${sparklineDays}日走势_\n\n`
    : "> _主流币价格 · 恐慌贪婪指数_\n\n";

  // Sentiment Data (Fear & Greed)
  if (sentimentData) {
    const sentimentIcon =
      sentimentData.value >= 50
        ? sentimentData.value >= 75
          ? "🔥"
          : "😊"
        : sentimentData.value <= 25
          ? "😰"
          : "😐";
    message +=
      infoRow(
        "恐慌贪婪指数",
        `${sentimentIcon} ${sentimentData.value} (${sentimentData.classification})`,
      ) + "\n";
  }

  // Market Data
  if (marketData && marketData.length > 0) {
    marketData.forEach((coin) => {
      const price = coin.current_price.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      const change = coin.price_change_percentage_24h.toFixed(2);
      const icon = change >= 0 ? "📈" : "📉";
      const changeStr = `${change > 0 ? "+" : ""}${change}%`;

      const trend = sparkline(seriesBySymbol[coin.symbol?.toUpperCase()] || []);
      message += priceItem(
        icon,
        coin.symbol.toUpperCase(),
        price,
        trend ? `${changeStr}  ${trend}` : changeStr
      );
    });
  }

  // News Data with Links
  if (newsData && newsData.length > 0) {
    message += "\n**📰 最新资讯**\n\n";
    // Increase limit slightly as layout is more compact, or keep 10.
    // Logic changed: linkItem no longer takes index.
    newsData.slice(0, 10).forEach((news) => {
      const relativeTime = formatRelativeTime(news.posted_on);
      const summary = news.description || "";
      const source = news.author || "CryptoNews";

      message += cardItem(news.title, news.url, summary, source, relativeTime);
    });
  }

  // Fallback if data is missing but expected
  if (
    (!marketData || marketData.length === 0) &&
    (!newsData || newsData.length === 0)
  ) {
    return sectionHeader("💰", "加密行情") + "_数据暂时获取失败..._";
  }

  return message;
};

module.exports = { formatCrypto };
