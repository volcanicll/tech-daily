/**
 * 模块配置中心
 * 统一管理内容模块和通知服务的开关
 */

/**
 * 内容模块配置
 * 控制日报中各内容块的启用/禁用
 */
const contentModules = {
  // 金价模块 (默认启用)
  gold: process.env.MODULE_GOLD !== "false",

  // 加密货币行情模块 (默认启用)
  crypto: process.env.MODULE_CRYPTO !== "false",

  // AI 资讯模块 (默认启用)
  aiNews: process.env.MODULE_AI_NEWS !== "false",

  // Agent Code 资讯模块 (默认启用)
  agentCode: process.env.MODULE_AGENT_CODE !== "false",

  // Horizon 科技雷达模块 (默认启用，AI精选HN/Reddit/RSS/GitHub)
  horizon: process.env.MODULE_HORIZON !== "false",

  // V2EX 日报模块 (默认启用)
  v2ex: process.env.MODULE_V2EX !== "false",

  // 宏观金融新闻模块 (默认启用)
  macro: process.env.MODULE_MACRO_NEWS !== "false",

  // 新闻亮点模块 (默认启用)
  newsHighlights: process.env.MODULE_NEWS_HIGHLIGHTS !== "false",

  // X/Twitter 热门技术贴模块 (默认禁用，需配置 RAPID_API_KEY)
  xTwitter: process.env.MODULE_X_TWITTER === "true",

  // AI 精选推荐模块 (默认启用)
  aiRecommendations: process.env.MODULE_AI_RECOMMENDATIONS !== "false",

  // LLM 锐评模块 (默认启用)
  llmCommentary: process.env.MODULE_LLM_COMMENTARY !== "false",

  // 天气模块 (默认禁用)
  weather: process.env.MODULE_WEATHER === "true",

  // 情话/一言模块 (默认禁用)
  quote: process.env.MODULE_QUOTE === "true",
};

/**
 * 通知服务配置
 * 控制各推送渠道的启用/禁用
 */
const notificationServices = {
  // Telegram (默认启用)
  telegram: process.env.NOTIFY_TELEGRAM !== "false",

  // 钉钉群机器人 (默认启用)
  dingtalk: process.env.NOTIFY_DINGTALK !== "false",

  // 企业微信群机器人 (默认禁用)
  wxBot: process.env.NOTIFY_WX_BOT === "true",

  // 企业微信应用消息 (默认禁用)
  wxApp: process.env.NOTIFY_WX_APP === "true",
};

/**
 * 检查模块是否启用
 * @param {string} moduleName - 模块名称
 * @returns {boolean}
 */
function isContentModuleEnabled(moduleName) {
  return contentModules[moduleName] === true;
}

/**
 * 检查通知服务是否启用
 * @param {string} serviceName - 服务名称
 * @returns {boolean}
 */
function isNotificationEnabled(serviceName) {
  return notificationServices[serviceName] === true;
}

/**
 * 获取所有启用的内容模块名称
 * @returns {string[]}
 */
function getEnabledContentModules() {
  return Object.entries(contentModules)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}

/**
 * 获取所有启用的通知服务名称
 * @returns {string[]}
 */
function getEnabledNotifications() {
  return Object.entries(notificationServices)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}

module.exports = {
  contentModules,
  notificationServices,
  isContentModuleEnabled,
  isNotificationEnabled,
  getEnabledContentModules,
  getEnabledNotifications,
};
