/**
 * 环境变量集中管理
 * 所有环境变量在这里统一加载和导出，便于管理和维护
 */

// 加载 dotenv（如果项目需要）
require("dotenv").config();

/**
 * 环境变量配置
 * 按功能模块分组，便于查找和管理
 */
const env = {
  // CoinGecko 签到配置
  coinGecko: {
    cookie: process.env.COINGECKO_COOKIE || "",
    token: process.env.COINGECKO_TOKEN || "",
  },

  // CoinMarketCap 签到配置
  coinMarket: {
    cookie: process.env.COINMARKET_COOKIE || "",
    token: process.env.COINMARKET_TOKEN || "",
  },

  // 企业微信应用配置
  wxApp: {
    companyId: process.env.WX_COMPANY_ID || "",
    appId: process.env.WX_APP_ID || "",
    appSecret: process.env.WX_APP_SECRET || "",
  },

  // 企业微信群机器人配置
  wxBot: {
    key: process.env.BOT_KEY || "",
  },

  // Telegram Bot 配置
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },

  // 钉钉群机器人配置（加签方式）
  dingTalk: {
    accessToken: process.env.DINGTALK_ACCESS_TOKEN || "",
    secret: process.env.DINGTALK_SECRET || "",
  },

  // LLM 锐评配置 (OpenRouter / OpenAI 兼容格式)
  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    baseUrl: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    model: process.env.LLM_MODEL || "openai/gpt-4o-mini",
  },

  // RapidAPI 配置 (用于 X/Twitter 数据)
  rapidApi: {
    key: process.env.RAPID_API_KEY || "",
  },

  // Product Hunt API 配置
  productHunt: {
    token: process.env.PRODUCTHUNT_API_TOKEN || "",
  },

  // GitHub API 配置 (可选，提升 rate limit)
  github: {
    token: process.env.GITHUB_TOKEN || "",
  },

  // 生活模块配置
  lifestyle: {
    // 天气模块需要指定城市（MODULE_WEATHER=true 时生效）
    weatherCity: process.env.WEATHER_CITY || "重庆",
  },
};

/**
 * 验证必需的环境变量是否已配置
 * @param {string[]} requiredKeys - 需要验证的环境变量路径，如 ['telegram.botToken', 'wxBot.key']
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateEnv(requiredKeys = []) {
  const missing = [];

  for (const key of requiredKeys) {
    const keys = key.split(".");
    let value = env;
    for (const k of keys) {
      value = value?.[k];
    }
    if (!value) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 获取环境变量值，支持点号路径访问
 * @param {string} path - 环境变量路径，如 'telegram.botToken'
 * @param {*} defaultValue - 默认值
 * @returns {*}
 */
function getEnv(path, defaultValue = "") {
  const keys = path.split(".");
  let value = env;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      return defaultValue;
    }
  }
  return value || defaultValue;
}

module.exports = {
  env,
  validateEnv,
  getEnv,
};
