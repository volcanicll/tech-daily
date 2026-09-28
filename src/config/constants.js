const BASE_URL = {
  WEIXIN: "https://qyapi.weixin.qq.com",
  DINGTALK: "https://oapi.dingtalk.com",
  COINGECKO: "https://www.coingecko.com",
  COINMARKET: "https://api.coinmarketcap.com",
  // 免费天气API
  WEATHER: "https://api.vvhan.com/api/weather",
  // 免费一言API
  QINGHUA: "https://api.lovelive.tools/api/SweetNothings/1",
  // 备用情话API
  QINGHUA_BACKUP: "https://api.uomg.com/api/rand.qinghua",
  JOKE: "https://api.vvhan.com/api/joke",
  ONE: "https://api.vvhan.com/api/60s",
  POETRY: "https://v1.jinrishici.com/all.json",
  HITOKOTO: "https://v1.hitokoto.cn",
};

const GREETINGS = new Map([
  [0, "崽崽早安！💖"],
  [1, "懒懒起床啦！💕"],
  [2, "宝宝今天也要加油哦！💞"],
  [3, "早安懒崽！今天也要元气满满！❤"],
  [4, "宝崽，新的一天开始啦！💝"],
  [5, "早安小可爱！今天也要开开心心！✨"],
  [6, "早安小懒虫！太阳晒屁股啦！🌞"],
  [7, "亲爱的，该起床啦！🌈"],
  [8, "美好的一天从见到你开始！🌸"],
  [9, "今天也要像小太阳一样闪耀呢！☀️"],
  [10, "早安小天使！愿你今天充满好运！🍀"],
  [11, "早安宝贝！记得吃早餐哦！🥐"],
  [12, "崽崽，想你了！今天也要加油！💪"],
  [13, "早安小可爱！今天也要打起精神！🌟"],
  [14, "亲爱的宝贝，新的一天又是属于你的！💫"],
]);

const DAYS_OF_WEEK = ["星期天", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * API 配置
 */
const API_CONFIG = {
  timeout: 10000,           // 请求超时时间 (ms)
  retryAttempts: 3,         // 最大重试次数
  retryInitialDelay: 1000,  // 初始重试延迟 (ms)
  retryMultiplier: 2,       // 退避乘数
};

/**
 * 翻译配置
 */
const TRANSLATION_CONFIG = {
  batchSize: 5,             // 每批翻译数量
  delay: 200,               // 批次间延迟 (ms)
  maxLength: 5000,          // 单次翻译最大长度
  // 连续失败多少次后熔断：免费翻译端点从机房 IP 出去容易被限流，
  // 逐个失败会白白拖慢整轮，还让降级无声无息
  failureThreshold: 5,
  // 中文正则，用于检测是否需要翻译
  chineseRegex: /[\u4e00-\u9fa5]/,
};

/**
 * 内容过滤配置
 */
const FILTER_CONFIG = {
  // X/Twitter 过滤
  minViews: 10000,          // 最小浏览量
  minReplies: 0,            // 最小回复数

  // 通用配置
  maxItemsPerSource: 20,    // 每个源最大条数
  daysToKeep: 7,            // 保留天数

  // V2EX 评分配置
  v2exGravity: 1.8,         // 时间衰减指数
};

/**
 * LLM 配置
 */
const LLM_CONFIG = {
  // Token 限制
  maxTokens: {
    commentary: 200,        // 市场评论最大 token
    recommendations: 300,   // AI 推荐最大 token
    highlights: 400,        // 新闻亮点最大 token
  },

  // Temperature 配置
  temperature: {
    commentary: 0.8,        // 市场评论 (更有创意)
    recommendations: 0.7,   // AI 推荐 (平衡)
    highlights: 0.6,        // 新闻亮点 (更准确)
    professional: 0.5,      // 专业风格 (更严肃)
  },

  // 评论风格
  styles: {
    humor: "humor",         // 幽默风格
    professional: "professional",  // 专业风格
    concise: "concise",     // 简洁风格
  },

  // 默认风格
  defaultStyle: "humor",

  // API 请求超时（毫秒）
  requestTimeout: 60000,
};

/**
 * AI 候选内容挑选
 * 各来源轮流取样，避免靠后的来源被整体截断掉
 */
const SELECTION_CONFIG = {
  perSourceLimit: 8,   // 每个来源最多贡献多少条给 AI 筛选
  candidateLimit: 30,  // 送给 AI 的候选总量上限
};

/**
 * 格式化限制
 */
const FORMAT_LIMITS = {
  titleLength: 50,          // 标题最大长度
  summaryLength: 100,       // 摘要最大长度
  descriptionLength: 200,   // 描述最大长度
  urlDisplayLength: 40,     // URL 显示长度

  // 截断后缀
  ellipsis: "...",
};

/**
 * 缓存配置
 */
const CACHE_CONFIG = {
  rssTTL: 15 * 60 * 1000,   // RSS 缓存时间 (15分钟)
  translationTTL: 60 * 60 * 1000,  // 翻译缓存时间 (1小时)
};

/**
 * 状态持久化配置
 * 部署在 GitHub Actions 上没有数据库，用仓库内的 JSON 文件当存储
 */
const STATE_CONFIG = {
  dir: "state",             // 相对仓库根目录
  seenRetentionDays: 30,    // 去重窗口：超过这个天数的指纹会被清理
  priceRetentionDays: 90,   // 价格序列保留天数
  sparklineDays: 7,         // 消息里展示的走势天数
};

/**
 * 新闻源配置
 */
const NEWS_SOURCES = {
  // 宏观金融新闻关键词
  macroKeywords: [
    "Fed", "Federal Reserve", "interest rate", "inflation",
    "GDP", "unemployment", "recession", "treasury",
    "yield curve", "CPI", "PPI", "FOMC", "rate hike",
    "rate cut", "monetary policy", "economic data"
  ],

  // 宏观金融新闻 RSS 源
  macroRSS: [
    {
      name: "CNBC Markets",
      url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    },
    {
      name: "Reuters Business",
      url: "https://www.reutersagency.com/feed/",
    },
    {
      name: "Bloomberg Markets",
      url: "https://feeds.bloomberg.com/markets/news.rss",
    },
  ],

  // 扩展的加密货币新闻源
  cryptoRSS: [
    {
      name: "CoinTelegraph",
      url: "https://cointelegraph.com/rss",
    },
    {
      name: "BeInCrypto",
      url: "https://beincrypto.com/feed/",
    },
    {
      name: "TheBlock",
      url: "https://www.theblockcrypto.com/rss.xml",
    },
    {
      name: "Decrypt",
      url: "https://decrypt.co/feed",
    },
  ],

  // AI/VC 机构博客
  vcBlogs: [
    {
      name: "a16z",
      url: "https://a16z.com/feed/",
    },
    {
      name: "Paradigm",
      url: "https://paradigm.xyz/feed.xml",
    },
    {
      name: "Pantera",
      url: "https://panteracapital.com/blog/feed/",
    },
  ],
};

/**
 * 表情符号配置
 */
const EMOJI = {
  // 分类图标
  macro: "🏛️",
  crypto: "💰",
  ai: "🤖",
  agentCode: "👨‍💻",
  v2ex: "🇻🇳",
  twitter: "🐦",
  highlights: "📌",
  market: "📊",
  gold: "🪙",
  aiModels: "🧪",
  githubStars: "🔥",
  productHunt: "🚀",
  reddit: "🤖",
  juejin: "📝",
  segmentfault: "❓",
  leetcode: "🧩",
  techHistory: "📜",
  security: "🛡️",

  // 情绪图标
  fearGreed: {
    extremeFear: "😱",
    fear: "😨",
    neutral: "😐",
    greed: "😊",
    extremeGreed: "🤑",
  },

  // 涨跌图标
  up: "📈",
  down: "📉",
  flat: "➡️",
};

module.exports = {
  BASE_URL,
  GREETINGS,
  DAYS_OF_WEEK,
  API_CONFIG,
  TRANSLATION_CONFIG,
  FILTER_CONFIG,
  LLM_CONFIG,
  FORMAT_LIMITS,
  CACHE_CONFIG,
  STATE_CONFIG,
  SELECTION_CONFIG,
  NEWS_SOURCES,
  EMOJI,
};
