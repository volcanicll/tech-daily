const { translate } = require("google-translate-api-x");

/**
 * Translate text to Chinese if it's likely English
 */
async function translateToChinese(text) {
  try {
    if (!text) return "";
    // Simple check: if text contains Chinese characters, assume it's already Chinese (not perfect but helpful)
    if (/[\u4e00-\u9fa5]/.test(text)) return text;

    const res = await translate(text, {
      to: "zh-CN",
      rejectOnPartialFail: false,
    });
    // Ensure res and res.text exist
    return res && res.text ? res.text : text;
  } catch (error) {
    console.warn("Translation failed, returning original text:", error.message);
    return text;
  }
}

/**
 * Fetch with retry mechanism
 */
async function fetchWithRetry(fetchFn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

/**
 * 按时间窗筛选近期条目
 *
 * 用滚动时间窗，而不是"本地日历的今天 00:00 到现在"。后者有两个坑：
 *   1. 窗口宽度取决于运行时刻 —— CI 在 UTC 06:00 跑，窗口只有 6 小时，
 *      抓到 30 条也可能一条都留不下
 *   2. 以运行机器的时区为准，CI 是 UTC，而中文源是 UTC+8：
 *      "今天"从北京时间早上 8 点才开始算，当天 0~8 点的内容被整体排除
 *
 * 滚动窗口与时区、运行时刻都无关，行为可预期。
 *
 * @param {Array} items - 条目数组
 * @param {string} dateField - 日期字段名
 * @param {number} hoursWindow - 回溯小时数
 * @returns {Array}
 */
function filterRecentItems(items, dateField = "posted_on", hoursWindow = 24) {
  const now = Date.now();
  const cutoff = now - hoursWindow * 60 * 60 * 1000;

  return items.filter((item) => {
    const timestamp = new Date(item?.[dateField]).getTime();
    // 无法解析的时间一律丢弃，避免 NaN 比较恒为 false 造成"静默全丢"
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
  });
}

module.exports = { translateToChinese, fetchWithRetry, filterRecentItems };
