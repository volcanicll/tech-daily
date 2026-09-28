/**
 * LLM 服务 - 使用 OpenAI 兼容格式调用 LLM API
 * 支持 OpenRouter 等兼容 OpenAI 的服务
 */

const { env } = require("../../config/env");
const { getCommentaryPrompt } = require("../../config/prompts");
const { LLM_CONFIG } = require("../../config/constants");

class LLMService {
  constructor() {
    this.apiKey = env.llm.apiKey;
    this.baseUrl = env.llm.baseUrl;
    this.model = env.llm.model;
    this.commentaryStyle = process.env.LLM_COMMENTARY_STYLE || LLM_CONFIG.defaultStyle;
  }

  /**
   * 生成日报锐评
   * @param {object} context - 包含各模块数据的上下文
   * @param {object} context.goldData - 金价数据
   * @param {object} context.cryptoData - 加密货币数据
   * @param {Array} context.aiNews - AI 新闻
   * @param {Array} context.macroNews - 宏观新闻
   * @returns {Promise<string|null>} 锐评内容
   */
  async generateCommentary(context) {
    if (!this.apiKey) {
      console.warn("LLM API Key 未配置，跳过锐评生成");
      return null;
    }

    // 检查是否有足够的数据生成评论
    const hasValidData = this._hasValidData(context);
    if (!hasValidData) {
      console.warn("数据不足，跳过 AI 锐评生成");
      return null;
    }

    try {
      // 获取配置的 prompt 模板
      const promptConfig = getCommentaryPrompt(this.commentaryStyle);
      const userPrompt = promptConfig.buildPrompt(context);

      const response = await this.callAPI(
        userPrompt,
        promptConfig.system,
        LLM_CONFIG.maxTokens.commentary,
        promptConfig.temperature
      );
      return response;
    } catch (error) {
      console.error("LLM 锐评生成失败:", error.message);
      return null;
    }
  }

  /**
   * 检查是否有足够的数据生成评论
   * @private
   */
  _hasValidData(context) {
    const { goldData, cryptoData, aiNews, macroNews } = context;

    // 检查加密货币数据
    if (cryptoData?.marketData?.length > 0) {
      // 检查是否有有效的价格数据（不是 undefined/NaN）
      const hasValidPrices = cryptoData.marketData.some(
        coin => coin.current_price && !isNaN(coin.current_price)
      );
      if (hasValidPrices) return true;
    }

    // 检查金价数据
    if (goldData?.cn_gold?.price || goldData?.ny_gold?.price) {
      return true;
    }

    // 检查是否有新闻（作为后备）
    const newsCount = (aiNews?.length || 0) + (macroNews?.length || 0);
    if (newsCount >= 3) return true;

    return false;
  }

  /**
   * 调用 LLM API
   * @param {string} userPrompt - 用户提示词
   * @param {string} systemPrompt - 系统提示词（可选）
   * @param {number} maxTokens - 最大 token 数（可选）
   * @param {number} temperature - 温度参数（可选）
   * @returns {Promise<string>}
   */
  async callAPI(userPrompt, systemPrompt, maxTokens = 200, temperature = 0.8) {
    // 默认系统提示词（如果未提供）
    const defaultSystemPrompt = `你是一位风趣幽默的财经评论员，擅长用简短有力的语言对市场动态进行锐评。

要求：
1. 语言风格：简洁、犀利、幽默，带有网感
2. 内容长度：控制在 100 字以内
3. 评论角度：可以调侃市场、给出独到观点、或用有趣的比喻
4. 格式：直接输出评论内容，不要加任何标题或前缀
5. 如果数据不足，可以根据现有信息发挥

记住：你的目标是让读者会心一笑的同时，也能获得一点洞察。`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: temperature,
      }),
      signal: AbortSignal.timeout(LLM_CONFIG.requestTimeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 请求失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  /**
   * AI 智能推荐：从资讯列表中筛选最有价值的内容
   * @param {Array} allNews - 所有资讯
   * @param {number} maxRecommendations - 最大推荐数
   * @returns {Promise<Array>} 推荐的资讯（带 AI 理由）
   */
  async generateRecommendations(allNews, maxRecommendations = 6) {
    if (!this.apiKey) {
      console.warn("LLM API Key 未配置，跳过 AI 推荐");
      return [];
    }

    if (!allNews || allNews.length === 0) {
      return [];
    }

    try {
      // 候选列表已由调用方按来源轮转取样并限量，这里不再二次截断 ——
      // 再 slice 一次会把靠后的来源重新切掉
      const newsList = allNews
        .map(
          (news, idx) =>
            `[${idx + 1}] ${news.title} (来源: ${
              news.source || news.author || "Unknown"
            })`
        )
        .join("\n");

      const systemPrompt = `你是一位资深科技编辑，擅长从众多资讯中筛选出最有价值、最值得关注的内容。

评判标准：
1. 重要性：对行业有重大影响的消息优先
2. 新颖性：突破性进展、新产品发布、重大更新
3. 实用性：开发者可以直接受益的工具、教程、开源项目
4. 话题性：引发广泛讨论的热点话题

请从以下资讯中选出最值得推荐的 ${maxRecommendations} 条，并简要说明推荐理由。

输出格式（严格遵守）：
每行一条，格式为: 序号|理由
例如: 3|重大更新，将影响所有开发者
不要输出其他内容。`;

      const content = await this.callAPI(
        `资讯列表：\n${newsList}`,
        systemPrompt,
        LLM_CONFIG.maxTokens.recommendations,
        LLM_CONFIG.temperature.recommendations
      );

      if (!content) {
        return [];
      }

      // 解析 AI 返回的推荐
      const recommendations = [];
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        const match = line.match(/^(\d+)\|(.+)$/);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          const reason = match[2].trim();
          if (idx >= 0 && idx < allNews.length) {
            recommendations.push({
              ...allNews[idx],
              aiReason: reason,
            });
          }
        }
      }

      console.log(
        `AI Recommendations: ${recommendations.length} items selected`
      );
      return recommendations.slice(0, maxRecommendations);
    } catch (error) {
      console.error("AI 推荐生成失败:", error.message);
      return [];
    }
  }
}

module.exports = new LLMService();
