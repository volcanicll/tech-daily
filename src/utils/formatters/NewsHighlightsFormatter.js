const {
  sectionHeader,
  linkItem,
} = require("./DingTalkMarkdownUtils");
const { EMOJI } = require("../../config/constants");

/**
 * 格式化新闻亮点
 * @param {Array} highlights - 新闻亮点数组
 * @param {object} [options]
 * @param {Function} [options.isNew] - 判断条目是否为首次出现，命中则打 🆕
 * @returns {string} 格式化的新闻亮点
 */
const formatNewsHighlights = (highlights, options = {}) => {
  if (!highlights || highlights.length === 0) return "";

  const { isNew } = options;

  // 先统一判定，既避免重复调用判定函数，也保证"没有 🆕 就不写图例"
  const freshMarks = highlights.map((highlight) =>
    Boolean(isNew && isNew(highlight))
  );
  const hasFresh = freshMarks.some(Boolean);

  let message = sectionHeader(EMOJI.highlights, "今日头条");
  message += hasFresh
    ? "> _AI 识别的重要市场动态 · 🆕 表示首次出现_\n\n"
    : "> _AI 识别的重要市场动态_\n\n";

  highlights.forEach((highlight, index) => {
    const emoji = (index + 1).toString().padStart(2, "0") + ".";
    const impact = highlight.impact ? ` - ${highlight.impact}` : "";
    const fresh = freshMarks[index] ? " 🆕" : "";

    if (highlight.url) {
      message += linkItem(
        `${emoji} ${highlight.title}${fresh}${impact}`,
        highlight.url,
        highlight.source
      );
    } else {
      message += `> ${emoji} ${highlight.title}${fresh}${impact}\n`;
      if (highlight.source) {
        message += `> _${highlight.source}_\n\n`;
      } else {
        message += "\n";
      }
    }
  });

  return message;
};

module.exports = { formatNewsHighlights };
