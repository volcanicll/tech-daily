const { describe, it, expect } = require("bun:test");

// 清除环境变量，确保测试验证的是配置的默认行为而非 CI 环境中的 secret 值
// 必须在 require modules 之前执行 —— 开关是在模块加载时解析的
const _envKeys = [
  "NOTIFY_TELEGRAM",
  "NOTIFY_DINGTALK",
  "NOTIFY_WX_BOT",
  "NOTIFY_WX_APP",
  "MODULE_GOLD",
  "MODULE_CRYPTO",
  "MODULE_AI_NEWS",
  "MODULE_HORIZON",
  "MODULE_V2EX",
  "MODULE_MACRO_NEWS",
  "MODULE_NEWS_HIGHLIGHTS",
  "MODULE_X_TWITTER",
  "MODULE_AI_RECOMMENDATIONS",
  "MODULE_LLM_COMMENTARY",
  "MODULE_WEATHER",
  "MODULE_QUOTE",
  "MODULE_AI_MODELS",
  "MODULE_GITHUB_STARS",
  "MODULE_PRODUCT_HUNT",
  "MODULE_REDDIT",
  "MODULE_JUEJIN",
  "MODULE_SEGMENTFAULT",
  "MODULE_AGENT_CODE",
  "MODULE_LEETCODE",
  "MODULE_TECH_HISTORY",
  "MODULE_SECURITY_RADAR",
  "MODULE_ARCHIVE",
];
_envKeys.forEach((k) => delete process.env[k]);

const fs = require("fs");
const {
  contentModules,
  notificationServices,
  isContentModuleEnabled,
  getEnabledContentModules,
  getEnabledNotifications,
  envKeyFor,
  CONFIG_FILE,
  DEFAULT_NOTIFICATION_SERVICES,
} = require("../src/config/modules");
const { env, getEnv, validateEnv } = require("../src/config/env");

describe("contentModules 默认开关", () => {
  it("默认启用的模块为 true", () => {
    expect(contentModules.gold).toBe(true);
    expect(contentModules.crypto).toBe(true);
    expect(contentModules.aiNews).toBe(true);
    expect(contentModules.horizon).toBe(true);
    expect(contentModules.reddit).toBe(true);
  });

  it("需要显式开启的模块默认为 false", () => {
    expect(contentModules.xTwitter).toBe(false);
    expect(contentModules.weather).toBe(false);
    expect(contentModules.quote).toBe(false);
    expect(contentModules.productHunt).toBe(false);
  });
});

describe("notificationServices 开关", () => {
  it("内置默认对 fork 友好：Telegram 与钉钉都启用", () => {
    // 这是"config/daily.json 缺失时"的兜底，不是本仓库的实际取值
    expect(DEFAULT_NOTIFICATION_SERVICES.telegram).toBe(true);
    expect(DEFAULT_NOTIFICATION_SERVICES.dingtalk).toBe(true);
  });

  it("本仓库实际生效的渠道以 config/daily.json 为准", () => {
    const file = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));

    expect(notificationServices.telegram).toBe(file.notifications.telegram);
    expect(notificationServices.dingtalk).toBe(file.notifications.dingtalk);
    // 线上只推钉钉，这条防止改配置时误开其它渠道
    expect(notificationServices.telegram).toBe(false);
  });

  it("企业微信渠道默认禁用", () => {
    expect(notificationServices.wxBot).toBe(false);
    expect(notificationServices.wxApp).toBe(false);
  });

  it("getEnabledNotifications 只返回启用的渠道", () => {
    const enabled = getEnabledNotifications();
    expect(enabled).toContain("dingtalk");
    expect(enabled).not.toContain("wxBot");
    expect(enabled).not.toContain("telegram");
  });
});

describe("isContentModuleEnabled / getEnabledContentModules", () => {
  it("已启用模块返回 true", () => {
    expect(isContentModuleEnabled("gold")).toBe(true);
  });

  it("未启用模块返回 false", () => {
    expect(isContentModuleEnabled("weather")).toBe(false);
  });

  it("未知模块返回 false 而不是抛错", () => {
    expect(isContentModuleEnabled("nonexistent")).toBe(false);
  });

  it("getEnabledContentModules 返回非空列表", () => {
    expect(getEnabledContentModules().length).toBeGreaterThan(0);
  });
});

describe("模块开关的配置来源", () => {
  it("模块名到环境变量名的映射符合既有约定", () => {
    // 这些名字曾经写死在 workflow 里，改动会让已有的覆盖方式失效
    expect(envKeyFor("MODULE_", "aiNews")).toBe("MODULE_AI_NEWS");
    expect(envKeyFor("MODULE_", "githubStars")).toBe("MODULE_GITHUB_STARS");
    expect(envKeyFor("MODULE_", "productHunt")).toBe("MODULE_PRODUCT_HUNT");
    expect(envKeyFor("MODULE_", "llmCommentary")).toBe("MODULE_LLM_COMMENTARY");
    expect(envKeyFor("NOTIFY_", "wxBot")).toBe("NOTIFY_WX_BOT");
    expect(envKeyFor("NOTIFY_", "wxApp")).toBe("NOTIFY_WX_APP");
  });

  it("config/daily.json 覆盖了每一个模块开关，不留没有配置文件的模块", () => {
    const file = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));

    expect(Object.keys(file.modules).sort()).toEqual(
      Object.keys(contentModules).sort()
    );
    expect(Object.keys(file.notifications).sort()).toEqual(
      Object.keys(notificationServices).sort()
    );
  });

  it("配置文件里只有布尔值，避免出现字符串 'false' 这种坑", () => {
    const file = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));

    for (const value of [
      ...Object.values(file.modules),
      ...Object.values(file.notifications),
    ]) {
      expect(typeof value).toBe("boolean");
    }
  });
});

describe("env 工具函数", () => {
  it("getEnv 支持点号路径", () => {
    expect(getEnv("llm.baseUrl")).toBe(env.llm.baseUrl);
  });

  it("getEnv 路径不存在时返回默认值", () => {
    expect(getEnv("no.such.key", "fallback")).toBe("fallback");
  });

  it("validateEnv 检出缺失的必填项", () => {
    const result = validateEnv(["no.such.key"]);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["no.such.key"]);
  });

  it("validateEnv 对已有默认值的配置项通过", () => {
    const result = validateEnv(["llm.baseUrl"]);
    expect(result.valid).toBe(true);
  });
});
