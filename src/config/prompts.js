/**
 * LLM Prompt 配置
 * 统一管理所有 AI 相关的 prompt 模板
 */

const { LLM_CONFIG } = require("./constants");

/**
 * 市场评论 Prompt 模板
 */
const COMMENTARY_PROMPTS = {
  /**
   * 幽默风格
   * 轻松诙谐，带点调侃
   */
  humor: {
    system: `你是加密货币市场的风趣评论员。你的风格：
- 轻松诙谐，带点幽默和自嘲
- 善用比喻和拟人化
- 用表情符号增加趣味
- 既有洞察又不失娱乐性
- 控制在 100 字以内`,

    buildPrompt: (data) => {
      const { goldData, cryptoData, sentimentData, macroNews } = data;

      let prompt = "今日加密货币市场速览：\n\n";

      // 金价信息
      if (goldData?.cn_gold || goldData?.ny_gold) {
        prompt += "💰 金价：";
        if (goldData.cn_gold?.price) {
          const cnPrice = typeof goldData.cn_gold === 'object' ? goldData.cn_gold.price : goldData.cn_gold;
          const cnChange = goldData.cn_gold?.change_percent || goldData.cn_change;
          prompt += `上海 ¥${cnPrice} (${cnChange >= 0 ? '+' : ''}${cnChange}%)`;
        }
        if (goldData.ny_gold?.price) {
          const nyPrice = typeof goldData.ny_gold === 'object' ? goldData.ny_gold.price : goldData.ny_gold;
          const nyChange = goldData.ny_gold?.change_percent || goldData.ny_change;
          prompt += ` | 纽约 $${nyPrice} (${nyChange >= 0 ? '+' : ''}${nyChange}%)`;
        }
        prompt += "\n";
      }

      // 加密货币信息
      if (cryptoData?.marketData?.length > 0) {
        prompt += "\n主流币表现：\n";
        let coinCount = 0;
        cryptoData.marketData.slice(0, 5).forEach(coin => {
          // 跳过无效价格数据
          if (!coin.current_price || coin.current_price === "undefined" || isNaN(coin.current_price)) {
            return;
          }
          const price = coin.current_price || coin.price;
          const change = coin.price_change_percentage_24h || coin.change24h || 0;
          const emoji = change >= 0 ? "🟢" : "🔴";
          const symbol = coin.symbol || coin.name || "未知";
          prompt += `${emoji} ${symbol}: $${price} (${change >= 0 ? '+' : ''}${change}%)\n`;
          coinCount++;
        });

        // 如果没有有效币种数据，添加提示
        if (coinCount === 0) {
          prompt += "暂无行情数据\n";
        }
      }

      // 恐惧贪婪指数
      if (sentimentData?.value !== undefined && sentimentData.value !== null) {
        const fg = sentimentData.value;
        let fgEmoji = "😐";
        if (fg <= 25) fgEmoji = "😱";
        else if (fg <= 45) fgEmoji = "😨";
        else if (fg >= 75) fgEmoji = "🤑";
        else if (fg >= 55) fgEmoji = "😊";
        prompt += `\n${fgEmoji} 恐惧贪婪：${fg}\n`;
      }

      // 宏观新闻摘要
      if (macroNews && macroNews.length > 0) {
        prompt += "\n宏观面：\n";
        macroNews.slice(0, 2).forEach(news => {
          prompt += `- ${news.title}\n`;
        });
      }

      prompt += "\n用你的幽默感点评一下今日市场：";

      return prompt;
    },

    temperature: LLM_CONFIG.temperature.commentary,
  },

  /**
   * 专业风格
   * 严肃分析，数据驱动
   */
  professional: {
    system: `你是资深金融市场分析师。你的风格：
- 专业客观，数据驱动
- 分析深入，见解独到
- 语言精炼，逻辑清晰
- 避免情绪化表达
- 控制在 120 字以内`,

    buildPrompt: (data) => {
      const { goldData, cryptoData, sentimentData, macroNews } = data;

      let prompt = "加密货币市场日报分析：\n\n";

      // 市场概况
      if (cryptoData?.marketData) {
        const btc = cryptoData.marketData.find(c => c.symbol === "BTC");
        if (btc) {
          prompt += `BTC $${btc.price} (${btc.change24h}%)`;
        }

        const eth = cryptoData.marketData.find(c => c.symbol === "ETH");
        if (eth) {
          prompt += ` | ETH $${eth.price} (${eth.change24h}%)`;
        }
        prompt += "\n";
      }

      // 恐惧贪婪指数
      if (sentimentData) {
        prompt += `恐惧贪婪指数：${sentimentData.value} - `;
        if (sentimentData.value <= 25) prompt += "极度恐惧";
        else if (sentimentData.value <= 45) prompt += "恐惧";
        else if (sentimentData.value >= 75) prompt += "极度贪婪";
        else prompt += "中性";
        prompt += "\n";
      }

      // 宏观因素
      if (macroNews && macroNews.length > 0) {
        prompt += "\n宏观影响因素：\n";
        macroNews.slice(0, 3).forEach(news => {
          prompt += `- ${news.title}\n`;
        });
      }

      prompt += "\n请提供专业市场分析：";

      return prompt;
    },

    temperature: LLM_CONFIG.temperature.professional,
  },

  /**
   * 简洁风格
   * 一句话总结，直击要害
   */
  concise: {
    system: `你是市场快讯编辑。你的风格：
- 一句话总结今日市场
- 直击要点，不拖泥带水
- 控制在 50 字以内`,

    buildPrompt: (data) => {
      const { cryptoData, sentimentData } = data;

      let trend = "震荡";
      if (cryptoData?.marketData) {
        const avgChange = cryptoData.marketData
          .slice(0, 5)
          .reduce((sum, c) => sum + parseFloat(c.change24h || 0), 0) / 5;

        if (avgChange > 2) trend = "强势上涨";
        else if (avgChange > 0.5) trend = "温和上涨";
        else if (avgChange < -2) trend = "大幅下跌";
        else if (avgChange < -0.5) trend = "温和下跌";
      }

      let prompt = `今日市场${trend}`;

      if (sentimentData) {
        prompt += `，恐惧贪婪指数 ${sentimentData.value}`;
      }

      prompt += "。一句话点评：";

      return prompt;
    },

    temperature: LLM_CONFIG.temperature.professional,
  },
};

/**
 * 新闻亮点 Prompt 模板
 */
const HIGHLIGHTS_PROMPT = {
  system: `你是加密货币市场的资深编辑。你的任务：
- 从所有新闻中识别 3-5 条对市场影响最大的"头条"
- 判断标准：政策变化、重大事件、技术突破、市场波动
- 每条头条生成简短的"市场影响"说明
- 控制在 80 字以内`,

  buildPrompt: (allNews) => {
    let prompt = "以下是今日收集的所有新闻标题：\n\n";

    allNews.forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}`;
      if (item.source) {
        prompt += ` (${item.source})`;
      }
      prompt += "\n";
    });

    prompt += `\n请分析以上新闻，选出 3-5 条对加密货币市场影响最大的头条，`;
    prompt += `并说明每条对市场的潜在影响（每条 30 字以内）：`;

    return prompt;
  },

  temperature: LLM_CONFIG.temperature.highlights,
};

/**
 * 获取评论 prompt 配置
 * @param {string} style - 评论风格 (humor/professional/concise)
 * @returns {object} prompt 配置
 */
function getCommentaryPrompt(style = LLM_CONFIG.defaultStyle) {
  return COMMENTARY_PROMPTS[style] || COMMENTARY_PROMPTS.humor;
}

/**
 * 获取评论风格列表
 * @returns {string[]} 可用风格列表
 */
function getAvailableStyles() {
  return Object.keys(COMMENTARY_PROMPTS);
}

module.exports = {
  COMMENTARY_PROMPTS,
  HIGHLIGHTS_PROMPT,
  getCommentaryPrompt,
  getAvailableStyles,
};
