const { getMarketData } = require("./crypto/market");
const { getCryptoNews } = require("./crypto/news");
const { getGoldPrice } = require("./finance/gold");
const { getAINews } = require("./tech/aiNews");
const { getAgentCodeNews } = require("./tech/agentCodeNews");
const { getXTwitterNews } = require("./tech/xTwitterNews");
const { getV2exNews } = require("./tech/v2exNews");
const { getMacroNews } = require("./tech/macroNews");
const { getFearAndGreedIndex } = require("./crypto/sentiment");
const horizonService = require("./horizon/HorizonService");
const llmService = require("./llm/LLMService");
const newsHighlightsService = require("./llm/NewsHighlightsService");

const { formatCrypto } = require("../utils/formatters/CryptoFormatter");
const { formatGold } = require("../utils/formatters/GoldFormatter");
const { formatAiNews } = require("../utils/formatters/AiNewsFormatter");
const { formatAgentCode } = require("../utils/formatters/AgentCodeFormatter");
const { formatHorizon } = require("../utils/formatters/HorizonFormatter");
const { formatXTwitter } = require("../utils/formatters/XTwitterFormatter");
const { formatV2ex } = require("../utils/formatters/V2exFormatter");
const { formatMacroNews } = require("../utils/formatters/MacroFormatter");
const { formatNewsHighlights } = require("../utils/formatters/NewsHighlightsFormatter");
const { formatCommentary } = require("../utils/formatters/CommentaryFormatter");
const {
  formatAiRecommendations,
} = require("../utils/formatters/AiRecommendationsFormatter");
const {
  messageHeader,
  divider,
} = require("../utils/formatters/DingTalkMarkdownUtils");
const { contentModules } = require("../config/modules");

class DailyReportGenerator {
  /**
   * Encapsulate Crypto info fetching
   */
  async getCryptoReportSource() {
    try {
      const [marketData, newsData, sentimentData] = await Promise.all([
        getMarketData(),
        getCryptoNews(),
        getFearAndGreedIndex(),
      ]);
      return { marketData, newsData, sentimentData };
    } catch (error) {
      console.error("Error fetching crypto info:", error);
      return { marketData: [], newsData: [], sentimentData: null };
    }
  }

  /**
   * Generate the full daily message based on enabled modules
   * @returns {Promise<string>}
   */
  async generateDailyMessage() {
    try {
      console.log(
        "启用的内容模块:",
        Object.entries(contentModules)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ")
      );

      // 并行获取所有启用模块的数据
      const dataPromises = {};

      if (contentModules.gold) {
        dataPromises.gold = getGoldPrice().catch((e) => {
          console.error("Gold fetch error", e);
          return null;
        });
      }

      if (contentModules.crypto) {
        dataPromises.crypto = this.getCryptoReportSource();
      }

      if (contentModules.aiNews) {
        dataPromises.aiNews = getAINews().catch((e) => {
          console.error("AI News fetch error", e);
          return [];
        });
      }

      if (contentModules.agentCode) {
        dataPromises.agentCode = getAgentCodeNews().catch((e) => {
          console.error("Agent Code News fetch error", e);
          return [];
        });
      }

      if (contentModules.v2ex) {
        dataPromises.v2ex = getV2exNews().catch((e) => {
          console.error("V2EX News fetch error", e);
          return [];
        });
      }

      if (contentModules.macro) {
        dataPromises.macro = getMacroNews().catch((e) => {
          console.error("Macro News fetch error", e);
          return [];
        });
      }

      if (contentModules.xTwitter) {
        dataPromises.xTwitter = getXTwitterNews().catch((e) => {
          console.error("X/Twitter News fetch error", e);
          return [];
        });
      }

      if (contentModules.horizon) {
        dataPromises.horizon = horizonService.fetchHorizonNews(24).catch((e) => {
          console.error("Horizon fetch error", e);
          return null;
        });
      }

      // 等待所有数据获取完成
      const keys = Object.keys(dataPromises);
      const values = await Promise.all(Object.values(dataPromises));
      const data = keys.reduce((acc, key, i) => {
        acc[key] = values[i];
        return acc;
      }, {});

      // 按配置顺序格式化内容
      const formattedParts = [];

      // 市场数据先行
      if (contentModules.gold && data.gold) {
        formattedParts.push(formatGold(data.gold));
      }

      if (contentModules.crypto && data.crypto) {
        formattedParts.push(formatCrypto(data.crypto));
      }

      // 新闻亮点（AI 识别的重要头条）
      let highlights = null;
      if (contentModules.newsHighlights) {
        // Horizon的新闻纳入亮点提取
        let horizonNews = [];
        if (data.horizon) {
          horizonNews = horizonService.parseHorizonOutput(
            data.horizon.zh || data.horizon.en
          ).map(item => ({
            title: item.title,
            description: item.summary,
            url: item.url,
            source: "Horizon",
            author: item.tags.join(", "),
          }));
        }
        const allNews = [
          ...(data.aiNews || []),
          ...(data.agentCode || []),
          ...(data.v2ex || []),
          ...(data.xTwitter || []),
          ...(data.macro || []),
          ...horizonNews,
        ];
        if (allNews.length > 0) {
          console.log("正在生成新闻亮点...");
          highlights = await newsHighlightsService.generateHighlights(allNews, 5);
        }
      }

      if (highlights && highlights.length > 0) {
        formattedParts.push(formatNewsHighlights(highlights));
      }

      // 宏观要闻（影响市场的关键因素）
      if (contentModules.macro && data.macro && data.macro.length > 0) {
        formattedParts.push(formatMacroNews(data.macro));
      }

      // 其他资讯内容
      if (contentModules.aiNews && data.aiNews) {
        formattedParts.push(formatAiNews(data.aiNews));
      }

      // Horizon科技雷达（AI精选HN/Reddit/RSS/GitHub）
      if (contentModules.horizon && data.horizon) {
        formattedParts.push(formatHorizon(data.horizon));
      }

      if (contentModules.agentCode && data.agentCode) {
        formattedParts.push(formatAgentCode(data.agentCode));
      }

      if (contentModules.v2ex && data.v2ex) {
        formattedParts.push(formatV2ex(data.v2ex));
      }

      if (contentModules.xTwitter && data.xTwitter) {
        formattedParts.push(formatXTwitter(data.xTwitter));
      }

      // 并行执行 LLM 调用（commentary 和 recommendations）
      const llmPromises = [];
      let commentary = null;
      let aiRecommendations = null;

      // AI 精选推荐
      if (contentModules.aiRecommendations) {
        // Horizon的新闻纳入AI推荐
        let horizonNews = [];
        if (data.horizon) {
          horizonNews = horizonService.parseHorizonOutput(
            data.horizon.zh || data.horizon.en
          ).map(item => ({
            title: item.title,
            description: item.summary,
            url: item.url,
            source: "Horizon",
            author: item.tags.join(", "),
          }));
        }
        const allNews = [
          ...(data.aiNews || []),
          ...(data.agentCode || []),
          ...(data.v2ex || []),
          ...(data.xTwitter || []),
          ...(data.macro || []),
          ...horizonNews,
        ];
        if (allNews.length > 0) {
          console.log("正在生成 AI 精选推荐...");
          llmPromises.push(
            llmService.generateRecommendations(allNews, 6).then(result => {
              aiRecommendations = result;
            })
          );
        }
      }

      // AI 锐评（与 recommendations 并行）
      if (contentModules.llmCommentary) {
        console.log("正在生成 AI 锐评...");
        llmPromises.push(
          llmService.generateCommentary({
            goldData: data.gold || null,
            cryptoData: data.crypto || {
              marketData: [],
              newsData: [],
              sentimentData: null,
            },
            aiNews: data.aiNews || [],
            macroNews: data.macro || [],
          }).then(result => {
            commentary = result;
          })
        );
      }

      // 等待所有 LLM 调用完成
      await Promise.all(llmPromises);

      // 添加 AI 生成的内容
      if (aiRecommendations && aiRecommendations.length > 0) {
        formattedParts.push(formatAiRecommendations(aiRecommendations));
      }

      if (commentary) {
        formattedParts.push(formatCommentary(commentary));
      }

      // Filter out empty strings
      const validParts = formattedParts.filter(
        (part) => part && part.trim() !== ""
      );

      if (validParts.length === 0) {
        return "暂无内容 📭";
      }

      // 添加消息头和分隔线
      const header = messageHeader();
      const separator = divider();
      const message = header + separator + validParts.join(separator);
      console.log("Generated Message Preview:\n", message);
      return message;
    } catch (error) {
      console.error("Failed to generate daily message:", error);
      return `消息生成失败！💔`;
    }
  }
}

module.exports = new DailyReportGenerator();
