/**
 * 数据源健康度页脚
 * 挂在日报最后，让静默降级变得可见
 */

const { divider } = require("./DingTalkMarkdownUtils");

/**
 * 格式化健康度摘要
 * @param {{total: number, ok: number, degraded: Array, elapsedMs: number}} summary
 * @returns {string} 无数据时返回空串
 */
const formatHealth = (summary) => {
  if (!summary || summary.total === 0) return "";

  const healthy = summary.ok === summary.total;
  const icon = healthy ? "✅" : "⚠️";
  const seconds = (summary.elapsedMs / 1000).toFixed(1);

  let message = `${divider()}> ${icon} **数据源 ${summary.ok}/${summary.total} 正常** · 耗时 ${seconds}s\n`;

  if (!healthy) {
    const names = summary.degraded.map((entry) => entry.name).join(", ");
    message += `> 降级：${names}\n`;
  }

  return message;
};

module.exports = { formatHealth };
