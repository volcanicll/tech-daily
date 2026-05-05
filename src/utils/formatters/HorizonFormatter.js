const {
  sectionHeader,
  cardItem,
} = require("./DingTalkMarkdownUtils");

/**
 * 格式化Horizon科技新闻数据
 * @param {{en: string, zh: string}} horizonData - Horizon生成的中英文摘要
 * @returns {string} 格式化后的Markdown内容
 */
const formatHorizon = (horizonData) => {
  if (!horizonData) return "";

  // 优先使用中文摘要
  const content = horizonData.zh || horizonData.en;
  if (!content) return "";

  // 提取有价值的段落（去掉元信息）
  const lines = content.split("\n");
  const filteredLines = [];
  let inMetadata = false;

  for (const line of lines) {
    // 跳过front matter
    if (line.startsWith("---")) {
      inMetadata = !inMetadata;
      continue;
    }
    if (inMetadata) continue;

    // 跳过空标题和horizon banner
    if (line.includes("Horizon Daily") || line.includes("AI-Driven")) continue;

    filteredLines.push(line);
  }

  const cleanContent = filteredLines.join("\n").trim();

  if (!cleanContent) return "";

  // 添加section header
  let message = sectionHeader("🔭", "Horizon 科技雷达");
  message += "> _HN · Reddit · RSS · GitHub — AI精选评分_\n\n";

  // 截取前2000字符避免消息过长
  const maxLen = 2000;
  if (cleanContent.length > maxLen) {
    message += cleanContent.slice(0, maxLen) + "\n\n... [查看完整报告]";
  } else {
    message += cleanContent;
  }

  return message;
};

module.exports = { formatHorizon };
