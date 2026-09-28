const fs = require("fs");
const path = require("path");

const { getMarketData } = require("./crypto/market");
const { getCryptoNews } = require("./crypto/news");
const { getGoldPrice } = require("./finance/gold");
const { getAINews } = require("./tech/aiNews");
const { getAgentCodeNews } = require("./tech/agentCodeNews");
const { getXTwitterNews } = require("./tech/xTwitterNews");
const { getV2exNews } = require("./tech/v2exNews");
const { getMacroNews } = require("./tech/macroNews");
const { getRedditNews } = require("./tech/redditNews");
const { getJuejinNews } = require("./tech/juejinNews");
const { getSegmentFaultNews } = require("./tech/segmentfaultNews");
const { getLeetCodeDaily } = require("./tech/leetcodeDaily");
const { getTechHistory } = require("./tech/techHistory");
const { getSecurityRadar } = require("./tech/securityRadar");
const { getFearAndGreedIndex } = require("./crypto/sentiment");
const { getAIModelsNews } = require("./tech/aiModelsTracker");
const { getGitHubNewStars } = require("./tech/githubNewStars");
const { getProductHuntNews } = require("./tech/productHuntNews");
const weatherService = require("./lifestyle/WeatherService");
const quoteService = require("./lifestyle/QuoteService");
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
const { formatAIModels } = require("../utils/formatters/AIModelsFormatter");
const { formatGitHubStars } = require("../utils/formatters/GitHubStarsFormatter");
const { formatProductHunt } = require("../utils/formatters/ProductHuntFormatter");
const { formatReddit } = require("../utils/formatters/RedditFormatter");
const { formatJuejin } = require("../utils/formatters/JuejinFormatter");
const { formatSegmentFault } = require("../utils/formatters/SegmentFaultFormatter");
const { formatLeetCode } = require("../utils/formatters/LeetCodeFormatter");
const { formatTechHistory } = require("../utils/formatters/TechHistoryFormatter");
const { formatSecurityRadar } = require("../utils/formatters/SecurityRadarFormatter");
const { formatWeather } = require("../utils/formatters/WeatherFormatter");
const { formatQuote } = require("../utils/formatters/QuoteFormatter");
const { formatHealth } = require("../utils/formatters/HealthFormatter");
const {
  formatAiRecommendations,
} = require("../utils/formatters/AiRecommendationsFormatter");
const {
  messageHeader,
  divider,
} = require("../utils/formatters/DingTalkMarkdownUtils");
const { contentModules } = require("../config/modules");
const { env } = require("../config/env");
const { STATE_CONFIG } = require("../config/constants");
const { StateStore, itemHash, toDateString } = require("../state/StateStore");
const { RunHealth, appendStepSummary } = require("../utils/health");
const { defaultBatcher } = require("../utils/translation");
const { interleaveBySource } = require("../utils/selection");
const { ArchiveWriter } = require("../utils/archive");
const { SELECTION_CONFIG } = require("../config/constants");

const DIST_DIR = path.resolve(__dirname, "../../dist");

/**
 * 数据源清单：新增一个模块只需要在这里加一行，
 * 拉取、兜底、健康度统计和并行调度都由这张表驱动。
 * @returns {Array<{key: string, load: Function, fallback: *, isOk?: Function}>}
 */
function buildSourceTable(generator) {
  return [
    {
      key: "gold",
      load: () => getGoldPrice(),
      fallback: null,
      isOk: (data) => Boolean(data && (data.ny_gold || data.cn_gold)),
    },
    {
      key: "crypto",
      load: () => generator.getCryptoReportSource(),
      fallback: { marketData: [], newsData: [], sentimentData: null },
      isOk: (data) => Boolean(data && data.marketData?.length),
    },
    { key: "aiNews", load: () => getAINews(), fallback: [] },
    { key: "agentCode", load: () => getAgentCodeNews(), fallback: [] },
    { key: "v2ex", load: () => getV2exNews(), fallback: [] },
    { key: "macro", load: () => getMacroNews(), fallback: [] },
    { key: "xTwitter", load: () => getXTwitterNews(), fallback: [] },
    {
      key: "horizon",
      load: () => horizonService.fetchHorizonNews(24),
      fallback: null,
      isOk: (data) => Boolean(data),
    },
    { key: "aiModels", load: () => getAIModelsNews(), fallback: [] },
    { key: "githubStars", load: () => getGitHubNewStars(), fallback: [] },
    { key: "productHunt", load: () => getProductHuntNews(), fallback: [] },
    { key: "reddit", load: () => getRedditNews(), fallback: [] },
    { key: "juejin", load: () => getJuejinNews(), fallback: [] },
    { key: "segmentfault", load: () => getSegmentFaultNews(), fallback: [] },
    { key: "leetcode", load: () => getLeetCodeDaily(), fallback: null },
    { key: "techHistory", load: () => getTechHistory(), fallback: [] },
    { key: "securityRadar", load: () => getSecurityRadar(), fallback: [] },
    {
      key: "weather",
      load: () => weatherService.getWeather(env.lifestyle.weatherCity),
      fallback: null,
      isOk: (data) => Boolean(data?.data),
    },
    {
      key: "quote",
      load: () => quoteService.getDailyQuote(),
      fallback: null,
      isOk: (data) => Boolean(data),
    },
  ];
}

class DailyReportGenerator {
  /**
   * Encapsulate Crypto info fetching
   */
  async getCryptoReportSource() {
    const [marketData, newsData, sentimentData] = await Promise.all([
      getMarketData(),
      getCryptoNews(),
      getFearAndGreedIndex(),
    ]);
    return { marketData, newsData, sentimentData };
  }

  /**
   * 将 Horizon 输出映射为统一新闻条目（供亮点提取与 AI 推荐复用）
   * @private
   */
  _mapHorizonNews(data) {
    if (!data || !data.horizon) return [];
    return horizonService
      .parseHorizonOutput(data.horizon.zh || data.horizon.en)
      .map((item) => ({
        title: item.title,
        description: item.summary,
        url: item.url,
        source: "Horizon",
        author: item.tags.join(", "),
      }));
  }

  /**
   * 汇总用于亮点提取 / AI 推荐 / 去重的新闻池
   * @private
   * @param {object} data
   * @param {boolean} [includeCommunities] - 是否包含技术社区源
   * @returns {Array}
   */
  _newsPool(data, includeCommunities = false) {
    const pool = [
      ...(data.aiNews || []),
      ...(data.agentCode || []),
      ...(data.v2ex || []),
      ...(data.xTwitter || []),
      ...(data.macro || []),
      ...(data.aiModels || []),
      ...(data.githubStars || []),
      ...(data.productHunt || []),
      ...this._mapHorizonNews(data),
    ];

    if (includeCommunities) {
      pool.push(
        ...(data.reddit || []),
        ...(data.juejin || []),
        ...(data.segmentfault || [])
      );
    }

    return pool;
  }

  /**
   * 送给 AI 的候选列表
   *
   * 和 _newsPool 分开：_newsPool 是给去重用的全量列表，
   * 这里要的是"每个来源都有代表"的有限候选 —— 直接截断全量列表会让
   * 排在后面的社区源永远进不了 AI 的视野。
   * @private
   * @param {object} data
   * @param {boolean} [includeCommunities]
   * @returns {Array}
   */
  _aiCandidates(data, includeCommunities = false) {
    const groups = [
      data.aiNews || [],
      data.agentCode || [],
      data.v2ex || [],
      data.xTwitter || [],
      data.macro || [],
      data.aiModels || [],
      data.githubStars || [],
      data.productHunt || [],
      this._mapHorizonNews(data),
    ];

    if (includeCommunities) {
      groups.push(data.reddit || [], data.juejin || [], data.segmentfault || []);
    }

    return interleaveBySource(groups, SELECTION_CONFIG);
  }

  /**
   * 并行拉取所有启用的数据源，同时登记健康度
   * @private
   */
  async _fetchAll(health) {
    const sources = buildSourceTable(this).filter(
      (source) => contentModules[source.key]
    );

    const results = await Promise.all(
      sources.map((source) =>
        health.track(source.key, source.load, {
          fallback: source.fallback,
          isOk: source.isOk,
        })
      )
    );

    this._recordTranslationHealth(health);

    return Object.fromEntries(
      sources.map((source, index) => [source.key, results[index]])
    );
  }

  /**
   * 翻译在多个数据源内部发生，拉取结束后统一汇报一次
   * 它是最容易静默失败的一环：端点被限流时内容会悄悄变回英文
   * @private
   */
  _recordTranslationHealth(health) {
    const stats = defaultBatcher.getStats();
    if (stats.attempted === 0 && stats.skipped === 0) return;

    const detail = stats.circuitOpened
      ? `已熔断，${stats.skipped} 条保留原文`
      : "";

    health.recordStep("translation", !stats.circuitOpened, detail);
  }

  /**
   * 读取历史状态、生成"首次出现"快照，并记录今天的数据
   * @private
   * @returns {{isNew: Function, streakOf: Function, series: object}}
   */
  _prepareState(data) {
    const store = new StateStore().load();
    const pool = this._newsPool(data, true);

    // 必须在 remember 之前算好，否则今天记下的条目会把自己标成"旧闻"
    const firstSeenHashes = new Set(
      pool.filter((item) => store.isFirstSeen(item)).map((item) => itemHash(item))
    );

    for (const coin of data.crypto?.marketData || []) {
      store.recordPrice(coin.symbol?.toUpperCase(), coin.current_price);
    }
    if (data.gold?.ny_gold?.price) {
      store.recordPrice("XAU", data.gold.ny_gold.price);
    }
    if (data.gold?.cn_gold?.price) {
      store.recordPrice("AU9999", data.gold.cn_gold.price);
    }
    for (const repo of data.githubStars || []) {
      // 用 URL 而不是标题：标题里带着每天变化的 star 数
      store.recordTrending(repo.url);
    }

    store.remember(pool);
    store.save();

    return this.stateHelpers(store, firstSeenHashes);
  }

  /**
   * 从状态仓库构造渲染时需要的三个查询函数
   * 预览脚本也用它 —— 只读不写，所以可以安全地反复调用
   * @param {StateStore} store
   * @param {Set<string>} [firstSeenHashes] - 省略时按"状态里没见过"实时判断
   * @returns {{isNew: Function, streakOf: Function, series: object}}
   */
  stateHelpers(store, firstSeenHashes = null) {
    const series = {};
    for (const symbol of Object.keys(store.prices)) {
      series[symbol] = store.getSeries(symbol);
    }

    return {
      isNew: (item) =>
        firstSeenHashes
          ? firstSeenHashes.has(itemHash(item))
          : store.isFirstSeen(item),
      streakOf: (repo) => store.getStreak(repo?.url),
      series,
    };
  }

  /**
   * 把当天拉到的原始数据落盘，供 artifact 归档与离线预览使用
   * @private
   * @param {object} data - 各模块原始数据
   * @param {object} [llm] - 本次的 LLM 产出，带上它才能完整复现日报
   */
  _dumpRawData(data, llm = null) {
    try {
      fs.mkdirSync(DIST_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(DIST_DIR, "raw.json"),
        `${JSON.stringify({
          capturedAt: new Date().toISOString(),
          data,
          llm: llm || {},
        })}\n`,
        "utf8"
      );
    } catch (error) {
      console.warn(`原始数据落盘失败（不影响推送）: ${error.message}`);
    }
  }

  /**
   * 渲染日报正文
   *
   * 只做渲染，不碰网络也不写状态 —— 因此可以离线反复调用（预览、测试）。
   * 拉取与渲染分离之后，改排版不必等到第二天早上才知道效果。
   *
   * @param {object} data - 各模块数据
   * @param {object} state - 由 _stateHelpers 提供的查询函数
   * @param {RunHealth} health
   * @param {object} [options]
   * @param {object} [options.precomputed] - 预置的 LLM 结果，提供后不再调用 LLM
   * @param {object} [options.collect] - 传入一个对象，用于回传本次的 LLM 产出
   * @param {boolean} [options.includeHealth] - 是否附上健康度页脚，默认 true
   * @returns {Promise<string>}
   */
  async renderDigest(data, state, health, options = {}) {
    const { precomputed, collect, includeHealth = true } = options;
    const formattedParts = [];

    // 市场数据先行
    if (contentModules.gold && data.gold) {
      formattedParts.push(formatGold(data.gold));
    }

    if (contentModules.crypto && data.crypto) {
      formattedParts.push(formatCrypto(data.crypto, { series: state.series }));
    }

    // 生活模块（默认关闭）
    if (contentModules.weather && data.weather) {
      formattedParts.push(formatWeather(data.weather, env.lifestyle.weatherCity));
    }

    let highlights = null;
    let commentary = null;
    let aiRecommendations = null;

    if (precomputed) {
      highlights = precomputed.highlights || null;
      commentary = precomputed.commentary || null;
      aiRecommendations = precomputed.aiRecommendations || null;
      health.recordStep("llm(预置)", true);
    } else {
      // 新闻亮点（AI 识别的重要头条）
      if (contentModules.newsHighlights) {
        const candidates = this._aiCandidates(data);
        if (candidates.length > 0) {
          console.log("正在生成新闻亮点...");
          highlights = await newsHighlightsService.generateHighlights(candidates, 5);
          health.recordStep("newsHighlights", highlights.length > 0);
        }
      }
    }

    if (highlights && highlights.length > 0) {
      formattedParts.push(formatNewsHighlights(highlights, { isNew: state.isNew }));
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

    // AI 模型排行（HuggingFace Trending）
    if (contentModules.aiModels && data.aiModels) {
      formattedParts.push(formatAIModels(data.aiModels));
    }

    // 开源新星（GitHub 新热门仓库）
    if (contentModules.githubStars && data.githubStars) {
      formattedParts.push(
        formatGitHubStars(data.githubStars, { streakOf: state.streakOf })
      );
    }

    // 科技新品（Product Hunt）
    if (contentModules.productHunt && data.productHunt) {
      formattedParts.push(formatProductHunt(data.productHunt));
    }

    // Reddit 技术社区
    if (contentModules.reddit && data.reddit) {
      formattedParts.push(formatReddit(data.reddit));
    }

    // 掘金技术社区
    if (contentModules.juejin && data.juejin) {
      formattedParts.push(formatJuejin(data.juejin));
    }

    // SegmentFault 技术问答
    if (contentModules.segmentfault && data.segmentfault) {
      formattedParts.push(formatSegmentFault(data.segmentfault));
    }

    // 安全雷达
    if (contentModules.securityRadar && data.securityRadar) {
      formattedParts.push(formatSecurityRadar(data.securityRadar));
    }

    if (contentModules.v2ex && data.v2ex) {
      formattedParts.push(formatV2ex(data.v2ex));
    }

    if (contentModules.xTwitter && data.xTwitter) {
      formattedParts.push(formatXTwitter(data.xTwitter));
    }

    // LeetCode 每日一题
    if (contentModules.leetcode && data.leetcode) {
      formattedParts.push(formatLeetCode(data.leetcode));
    }

    // 科技史上的今天
    if (contentModules.techHistory && data.techHistory) {
      formattedParts.push(formatTechHistory(data.techHistory));
    }

    // 每日一言（默认关闭）
    if (contentModules.quote && data.quote) {
      formattedParts.push(formatQuote(data.quote));
    }

    if (!precomputed) {
      // 并行执行 LLM 调用（commentary 和 recommendations）
      const llmPromises = [];

      // AI 精选推荐
      if (contentModules.aiRecommendations) {
        const candidates = this._aiCandidates(data, true);
        if (candidates.length > 0) {
          console.log("正在生成 AI 精选推荐...");
          llmPromises.push(
            llmService.generateRecommendations(candidates, 6).then((result) => {
              aiRecommendations = result;
              health.recordStep("aiRecommendations", result.length > 0);
            })
          );
        }
      }

      // AI 锐评（与 recommendations 并行）
      if (contentModules.llmCommentary) {
        console.log("正在生成 AI 锐评...");
        llmPromises.push(
          llmService
            .generateCommentary({
              goldData: data.gold || null,
              cryptoData: data.crypto || {
                marketData: [],
                newsData: [],
                sentimentData: null,
              },
              aiNews: data.aiNews || [],
              macroNews: data.macro || [],
            })
            .then((result) => {
              commentary = result;
              health.recordStep("llmCommentary", Boolean(result));
            })
        );
      }

      // 等待所有 LLM 调用完成
      await Promise.all(llmPromises);

      if (collect) {
        Object.assign(collect, { highlights, aiRecommendations, commentary });
      }
    }

    // 添加 AI 生成的内容
    if (aiRecommendations && aiRecommendations.length > 0) {
      formattedParts.push(formatAiRecommendations(aiRecommendations));
    }

    if (commentary) {
      formattedParts.push(formatCommentary(commentary));
    }

    // Filter out empty strings
    const validParts = formattedParts.filter((part) => part && part.trim() !== "");

    if (validParts.length === 0) {
      return "暂无内容 📭";
    }

    // 添加消息头、分隔线和健康度页脚
    const separator = divider();
    return (
      messageHeader() +
      separator +
      validParts.join(separator) +
      (includeHealth ? formatHealth(health.summarize()) : "")
    );
  }

  /**
   * 把日报和健康度落盘，并写进 Actions 的 Job Summary
   * @private
   */
  _writeOutputs(message, health) {
    const summary = health.summarize();

    appendStepSummary(
      [
        "### 数据源健康度",
        "",
        "```",
        health.toText(),
        "```",
        "",
        "---",
        "",
        message,
      ].join("\n")
    );

    try {
      fs.mkdirSync(DIST_DIR, { recursive: true });
      fs.writeFileSync(path.join(DIST_DIR, "digest.md"), message, "utf8");
      fs.writeFileSync(
        path.join(DIST_DIR, "health.json"),
        `${JSON.stringify(
          {
            ...summary,
            sparklineDays: STATE_CONFIG.sparklineDays,
            entries: health.entries,
          },
          null,
          2
        )}\n`,
        "utf8"
      );
    } catch (error) {
      console.warn(`产物写入失败（不影响推送）: ${error.message}`);
    }
  }

  /**
   * 把当天日报落进静态归档
   * 归档只写文件，托管交给 GitHub Pages（一次性在仓库设置里开启）
   * @private
   */
  _writeArchive(message, health, highlights = []) {
    const summary = health.summarize();
    const written = new ArchiveWriter().writeDaily({
      date: toDateString(),
      markdown: message,
      highlights,
      health: { ok: summary.ok, total: summary.total },
    });

    if (written.md && written.index) {
      console.log("已归档到 docs/archive/");
    }
  }

  /**
   * Generate the full daily message based on enabled modules
   * @returns {Promise<string>}
   */
  async generateDailyMessage() {
    const health = new RunHealth();

    try {
      console.log(
        "启用的内容模块:",
        Object.entries(contentModules)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ")
      );

      // 拉取数据 -> 更新状态 -> 渲染 -> 落盘
      const data = await this._fetchAll(health);
      const state = this._prepareState(data);

      const llmResults = {};
      const message = await this.renderDigest(data, state, health, {
        collect: llmResults,
      });

      this._dumpRawData(data, llmResults);

      console.log("Generated Message Preview:\n", message);
      this._writeOutputs(message, health);
      if (contentModules.archive) {
        this._writeArchive(message, health, llmResults.highlights);
      }
      return message;
    } catch (error) {
      console.error("Failed to generate daily message:", error);
      this._writeOutputs(`消息生成失败 💔\n\n${health.toText()}`, health);
      return `消息生成失败！💔`;
    }
  }
}

module.exports = new DailyReportGenerator();
