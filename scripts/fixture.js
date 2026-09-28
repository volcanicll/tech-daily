/**
 * 离线预览用的样例数据
 *
 * 字段名必须和各 formatter 实际读取的一致，否则预览出来的是假的排版
 * （比如宏观新闻读的是 link/pubDate 而不是 url/posted_on）。
 * 这里每个模块的条目形状都对照 formatter 校对过。
 */

const { toDateString, shiftDate, itemHash } = require("../src/state/StateStore");

/** 生成"几小时前"的时间戳，让相对时间显示得自然 */
const hoursAgo = (hours) =>
  new Date(Date.now() - hours * 3600 * 1000).toISOString();

const data = {
  gold: {
    ny_gold: { price: 2648.3, change_percent: 0.42, name: "纽约金 (XAU)", currency: "USD" },
    cn_gold: { price: 618.75, change_percent: -0.18, name: "上海金 (Au99.99)", currency: "CNY" },
    cn_silver: { price: 7850.4, change_percent: 0.91, name: "上海银 (Ag99.99)", currency: "CNY" },
  },

  crypto: {
    marketData: [
      { symbol: "BTC", current_price: 64512.4, price_change_percentage_24h: 2.06 },
      { symbol: "ETH", current_price: 3520.18, price_change_percentage_24h: 1.15 },
      { symbol: "SOL", current_price: 148.62, price_change_percentage_24h: -3.41 },
      { symbol: "BNB", current_price: 592.07, price_change_percentage_24h: 0.28 },
    ],
    sentimentData: { value: 62, classification: "Greed" },
    // CryptoFormatter 读的是 author，不是 source
    newsData: [
      {
        title: "以太坊完成下一次硬分叉预演，Gas 费预期下降",
        url: "https://example.com/eth-fork",
        description: "测试网顺利完成升级演练，主网升级窗口将在两周内确定。",
        author: "CoinTelegraph",
        posted_on: hoursAgo(3),
      },
      {
        title: "现货 ETF 单日净流入创下三个月新高",
        url: "https://example.com/etf-inflow",
        description: "机构资金连续第五个交易日净流入。",
        author: "TheBlock",
        posted_on: hoursAgo(7),
      },
    ],
  },

  // AiNewsFormatter 读 author
  aiNews: [
    {
      title: "某开源模型在代码补全基准上追平闭源旗舰",
      url: "https://example.com/open-model",
      description: "权重完全开放，推理成本约为闭源方案的十分之一。",
      author: "TechCrunch",
      posted_on: hoursAgo(4),
    },
    {
      title: "AI 编码助手开始支持整仓库级别的重构",
      url: "https://example.com/repo-refactor",
      description: "从单文件补全扩展到跨模块改动，并附带自动化回归验证。",
      author: "Wired AI",
      posted_on: hoursAgo(9),
    },
  ],

  agentCode: [
    {
      title: "Agent 框架发布 1.0，重点解决长任务的上下文衰减",
      url: "https://example.com/agent-1-0",
      description: "引入分层记忆与任务检查点，长链路成功率明显提升。",
      source: "Anthropic",
      posted_on: hoursAgo(6),
    },
  ],

  // MacroFormatter 读的是 link / pubDate
  macro: [
    {
      title: "美联储会议纪要显示官员对降息节奏存在分歧",
      link: "https://example.com/fomc-minutes",
      description: "多数官员认为需要更多数据确认通胀回落趋势。",
      source: "Reuters Business",
      pubDate: hoursAgo(5),
    },
  ],

  // Horizon 输出是 Markdown，低于 6 分的条目会被 parseHorizonOutput 丢掉
  horizon: {
    zh: [
      "---",
      "title: Horizon Daily",
      "---",
      "",
      "## 1. Rust 重写的数据库驱动性能提升 4 倍",
      "",
      "评分: 8.5/10",
      "标签: rust, database, performance",
      "[原文链接](https://example.com/rust-driver)",
      "",
      "团队把热路径上的内存分配全部改为零拷贝，基准测试显示吞吐提升约四倍。",
      "",
      "## 2. 一篇讲清楚分布式共识的长文",
      "",
      "评分: 7.2/10",
      "标签: distributed-systems",
      "[原文链接](https://example.com/consensus)",
      "",
      "从 Raft 讲到 Paxos，配了大量可交互示意图。",
      "",
      "## 3. 某编辑器插件把启动时间拖慢了 3 秒",
      "",
      "评分: 4.0/10",
      "标签: tooling",
      "",
      "这条低于 6 分：会被排除在新闻池之外（不参与亮点与 AI 推荐），",
      "但 formatHorizon 是把 Markdown 原样输出，所以它仍会出现在正文里。",
      "",
    ].join("\n"),
    en: "",
  },

  aiModels: [
    {
      title: "deepseek-ai/DeepSeek-V4",
      url: "https://huggingface.co/deepseek-ai/DeepSeek-V4",
      description: "下载量 128k · 本周新增 42k",
      source: "HuggingFace",
      posted_on: hoursAgo(12),
    },
    {
      title: "meta-llama/Llama-4-70B",
      url: "https://huggingface.co/meta-llama/Llama-4-70B",
      description: "下载量 96k · 本周新增 18k",
      source: "HuggingFace",
      posted_on: hoursAgo(20),
    },
  ],

  githubStars: [
    {
      title: "acme/vector-db ⭐ 12.4k",
      url: "https://github.com/acme/vector-db",
      description: "嵌入式向量数据库，单文件零依赖 · Rust",
      source: "GitHub",
      posted_on: hoursAgo(30),
    },
    {
      title: "acme/tiny-agent ⭐ 3.1k",
      url: "https://github.com/acme/tiny-agent",
      description: "200 行实现一个能跑的最小 Agent · TypeScript",
      source: "GitHub",
      posted_on: hoursAgo(50),
    },
  ],

  productHunt: [
    {
      title: "Terminal-first 的笔记工具",
      url: "https://example.com/ph-note",
      description: "全部操作留在终端里，支持本地优先同步。",
      source: "Product Hunt",
      posted_on: hoursAgo(8),
    },
  ],

  // RedditFormatter 按 category 分组取 emoji
  reddit: [
    {
      title: "你们团队是怎么做 code review 的？",
      url: "https://example.com/r-programming",
      description: "小团队没有专职 reviewer，想看看大家的分工方式。",
      category: "programming",
      source: "Reddit r/programming",
    },
    {
      title: "Rust 的借用检查器终于不再劝退我了",
      url: "https://example.com/r-rust",
      description: "从踩坑到上手的一些笔记。",
      category: "rust",
      source: "Reddit r/rust",
    },
  ],

  // JuejinFormatter 按 category 分组，并展示互动数据
  juejin: [
    {
      title: "把 CI 从 12 分钟压到 90 秒的完整记录",
      url: "https://example.com/juejin-ci",
      description: "缓存命中率、并行拆分、镜像分层，逐项拆解。",
      author: "张三",
      category: "DevOps",
      digg_count: 328,
      comment_count: 46,
      view_count: 12000,
    },
  ],

  // SegmentFaultFormatter 按 type 分成"问题"和"文章"
  segmentfault: [
    {
      title: "Bun 和 Node 在生产环境到底怎么选？",
      url: "https://example.com/sf-bun",
      description: "想听听实际跑过 Bun 的同学踩了什么坑。",
      author: "李四",
      type: "question",
    },
    {
      title: "一次线上内存泄漏的排查过程",
      url: "https://example.com/sf-leak",
      description: "从 heap snapshot 到定位到具体依赖。",
      author: "王五",
      type: "article",
    },
  ],

  // V2exFormatter 读 nodeName / nodeTitle / posted_on
  v2ex: [
    {
      title: "大家现在都用什么方案做本地大模型推理？",
      url: "https://example.com/v2ex-llm",
      description: "显卡、量化、推理框架，求个组合推荐。",
      nodeName: "programmer",
      nodeTitle: "程序员",
      posted_on: hoursAgo(13),
    },
  ],

  // SecurityRadarFormatter 读的是 link / pubDate
  securityRadar: [
    {
      title: "某流行构建工具被植入恶意版本，请尽快排查",
      link: "https://example.com/cve-build",
      description: "受影响版本会在安装阶段外连可疑域名。",
      source: "The Hacker News",
      pubDate: hoursAgo(2),
    },
  ],

  xTwitter: [
    {
      title: "我们在生产环境用 Agent 跑了三个月，最大的教训是：不要让它自己决定什么时候结束任务。",
      url: "https://example.com/x-agent",
      source: "X · @somebuilder",
      posted_on: hoursAgo(10),
      engagement: { views: 128000, favorites: 940, retweets: 210, replies: 63 },
    },
  ],

  leetcode: {
    id: "3875",
    title: "构造奇偶一致的数组 I",
    difficulty: "简单",
    acRate: 77.1,
    url: "https://leetcode.cn/problems/construct-uniform-parity-array-i/",
    date: toDateString(),
  },

  // TechHistoryFormatter 读的是 year / text / url
  techHistory: [
    {
      year: "1956",
      text: "IBM 发布第一块硬盘 IBM 350，容量 5MB，重约一吨。",
      url: "https://example.com/ibm-350",
    },
    {
      year: "1998",
      text: "Google 公司成立。",
      url: "https://example.com/google-founded",
    },
  ],

  weather: {
    data: { type: "多云", low: "18", high: "26", fengxiang: "东南风", fengli: "2级" },
    tip: "早晚温差有点大，记得带件外套。",
  },

  quote: "你是我所有美好故事的开始。",
};

/** 离线预览时预置的 AI 产出（真实运行时由 LLM 生成） */
const llm = {
  highlights: [
    {
      title: "某开源模型在代码补全基准上追平闭源旗舰",
      url: "https://example.com/open-model",
      source: "TechCrunch",
      impact: "开源与闭源的能力差距进一步收窄",
    },
    {
      title: "某流行构建工具被植入恶意版本",
      url: "https://example.com/cve-build",
      source: "The Hacker News",
      impact: "影响面广，建议今天先排查依赖",
    },
    {
      title: "美联储会议纪要显示官员对降息节奏存在分歧",
      url: "https://example.com/fomc-minutes",
      source: "Reuters Business",
      impact: "风险资产的短期波动可能加大",
    },
    {
      title: "Rust 重写的数据库驱动性能提升 4 倍",
      url: "https://example.com/rust-driver",
      source: "Horizon",
      impact: "零拷贝改造的完整案例",
    },
  ],

  aiRecommendations: [
    {
      title: "把 CI 从 12 分钟压到 90 秒的完整记录",
      url: "https://example.com/juejin-ci",
      source: "掘金",
      aiReason: "步骤拆解具体，可以直接对照自己的流水线抄",
    },
    {
      title: "Agent 框架发布 1.0，重点解决长任务的上下文衰减",
      url: "https://example.com/agent-1-0",
      source: "Anthropic",
      aiReason: "分层记忆的设计对做 Agent 的人有直接参考价值",
    },
    {
      title: "一篇讲清楚分布式共识的长文",
      url: "https://example.com/consensus",
      source: "Horizon",
      aiReason: "把 Raft 和 Paxos 讲明白的材料不多，这篇算一个",
    },
  ],

  commentary:
    "BTC 站上 6.4 万，SOL 独自下跌 3.4% —— 同一个市场，两种心情。金价微跌，恐慌贪婪指数 62，属于「有点兴奋但还没上头」。今天最该看的不是行情，是那条构建工具投毒：先跑一遍依赖审计，再谈收益。",
};

/**
 * 用于 `--demo-state` 的合成历史
 * 让走势图、🆕、连挂天数的效果不必等一周才能看到。
 * 日期按"今天"倒推，所以无论哪天跑，连挂天数都刚好是 7。
 * @param {string} [today] - YYYY-MM-DD
 */
function buildDemoState(today = toDateString()) {
  const day = (offset) => shiftDate(today, offset);
  const series = (values) =>
    values.map((value, i) => [day(i - (values.length - 1)), value]);

  return {
    prices: {
      BTC: series([61000, 59800, 60500, 62000, 61800, 63200, 64512]),
      ETH: series([3400, 3450, 3390, 3350, 3420, 3480, 3520]),
      SOL: series([162, 158, 155, 151, 149, 153, 148]),
    },
    // 连续 7 天上榜 → 会显示 🔥 连挂 7 天
    trending: {
      "https://github.com/acme/vector-db": Array.from({ length: 7 }, (_, i) =>
        day(i - 6)
      ),
    },
    // 其中两条昨天已经推过 → 今日头条里只有另外两条会打 🆕
    seen: {
      [itemHash({ url: "https://example.com/fomc-minutes" })]: day(-1),
      [itemHash({ url: "https://example.com/rust-driver" })]: day(-1),
    },
  };
}

module.exports = { data, llm, buildDemoState };
