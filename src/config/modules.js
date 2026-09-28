/**
 * 模块配置中心
 * 统一管理内容模块和通知服务的开关
 *
 * 配置优先级（从高到低）：
 *   1. 环境变量 MODULE_* / NOTIFY_* —— 临时覆盖，适合单次手动运行
 *   2. config/daily.json             —— 仓库内的默认开关，提交即可生效
 *   3. 本文件的内置默认值             —— 配置文件缺失或损坏时的兜底
 *
 * 之所以把开关从 Secrets 搬进仓库里的 JSON：开关本身不是密钥，而配置文件
 * 能 diff、能 review、能回滚，也不会随模块增加而让 workflow 的 env 列表失控。
 */

const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.resolve(__dirname, "../../config/daily.json");

/** 内置兜底默认值，同时也是合法的模块名清单（未列出的键会被忽略） */
const DEFAULT_CONTENT_MODULES = {
  gold: true,
  crypto: true,
  aiNews: true,
  agentCode: true,
  horizon: true,
  v2ex: true,
  macro: true,
  newsHighlights: true,
  aiRecommendations: true,
  llmCommentary: true,
  aiModels: true,
  githubStars: true,
  reddit: true,
  juejin: true,
  segmentfault: true,
  leetcode: true,
  techHistory: true,
  securityRadar: true,
  xTwitter: false,
  productHunt: false,
  weather: false,
  quote: false,
  // 把每日日报落成静态归档（docs/），配合 GitHub Pages 使用
  archive: false,
};

const DEFAULT_NOTIFICATION_SERVICES = {
  telegram: true,
  dingtalk: true,
  wxBot: false,
  wxApp: false,
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

/**
 * 驼峰转大写下划线：aiNews -> AI_NEWS
 * @param {string} prefix
 * @param {string} name
 * @returns {string}
 */
function envKeyFor(prefix, name) {
  return prefix + name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * 解析布尔环境变量，无法识别时返回 undefined 交由下一层决定
 * @param {string|undefined} raw
 * @returns {boolean|undefined}
 */
function parseBoolean(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;

  const value = String(raw).trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return undefined;
}

/**
 * 读取 config/daily.json，失败时返回空对象（回退到内置默认值）
 * @returns {{modules: object, notifications: object}}
 */
function readConfigFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return {
      modules: parsed.modules || {},
      notifications: parsed.notifications || {},
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`⚠️ 读取 ${CONFIG_FILE} 失败，回退到内置默认值: ${error.message}`);
    }
    return { modules: {}, notifications: {} };
  }
}

/**
 * 按 环境变量 > 配置文件 > 内置默认值 的顺序解析开关
 * @param {object} defaults
 * @param {object} fileValues
 * @param {string} envPrefix
 * @returns {object}
 */
function resolveSwitches(defaults, fileValues, envPrefix) {
  const resolved = {};

  for (const [name, fallback] of Object.entries(defaults)) {
    const fromEnv = parseBoolean(process.env[envKeyFor(envPrefix, name)]);
    const fromFile =
      typeof fileValues[name] === "boolean" ? fileValues[name] : undefined;

    resolved[name] = fromEnv ?? fromFile ?? fallback;
  }

  return resolved;
}

const fileConfig = readConfigFile();

/** 内容模块开关（已解析） */
const contentModules = resolveSwitches(
  DEFAULT_CONTENT_MODULES,
  fileConfig.modules,
  "MODULE_"
);

/** 通知服务开关（已解析） */
const notificationServices = resolveSwitches(
  DEFAULT_NOTIFICATION_SERVICES,
  fileConfig.notifications,
  "NOTIFY_"
);

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
  envKeyFor,
  CONFIG_FILE,
  // 内置默认值：与 config/daily.json 的值是两回事，前者是"没有配置文件时的兜底"，
  // 后者才是本仓库实际生效的配置
  DEFAULT_CONTENT_MODULES,
  DEFAULT_NOTIFICATION_SERVICES,
};
