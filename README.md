# TechDaily 🚀

**每日科技资讯推送机器人**

一个基于 Bun 运行时的自动化日报推送系统，集成加密货币市场数据、AI 科技资讯、宏观金融新闻、技术社区热点及 LLM 智能分析，支持多渠道消息推送。

---

## ✨ 核心功能

### 💰 市场与金融数据

| 模块             | 说明                                             |
| ---------------- | ------------------------------------------------ |
| **贵金属行情**   | 实时金价、银价 (Au/Ag)                           |
| **加密货币**     | BTC, ETH, BNB, SOL 等主流代币的 24h 价格、涨跌幅 |
| **恐惧贪婪指数** | 市场情绪指标                                     |

**高可用设计**：主接口 Binance API，备用 CoinGecko API，失败自动重试 + 降级切换。

### 📰 资讯聚合

| 模块 | 数据源 |
|------|--------|
| **加密货币新闻** | CryptoCompare / Coinpaprika |
| **AI 行业资讯** | TechCrunch, Wired AI, MIT Tech Review, Google AI Blog, OpenAI Blog, ArXiv CS.AI |
| **Agent Code 前沿** | GitHub Blog, Anthropic, OpenAI, Smol AI, Reddit, Lobste.rs, Hacker News, GitHub Trending |
| **V2EX 精选** | V2EX 热门话题（Hacker News 风格评分算法） |
| **宏观金融新闻** | CNBC Markets, Reuters Business, Bloomberg Markets |
| **X/Twitter 热门** | Claude Code, Cursor AI, GitHub Copilot, Vibe Coding, LLM Agents, AI Code Assistant |
| **Reddit 技术社区** 🆕 | r/programming, r/webdev, r/javascript, r/Python, r/rust, r/golang, r/MachineLearning, r/LocalLLaMA, r/datascience, r/devops, r/docker, r/kubernetes, r/blockchain, r/cybersecurity 等 20+ 子版块 |
| **掘金技术社区** 🆕 | 中文开发者社区热门文章（前端、后端、AI、DevOps 等） |
| **SegmentFault 技术问答** 🆕 | 中文技术问答社区热门问题与技术文章 |
| **安全雷达** ✨ | The Hacker News 网络安全资讯（漏洞、攻防、数据安全，自动翻译） |
| **LeetCode 每日一题** ✨ | 力扣中国每日官方题目，含难度与通过率 |
| **科技史上的今天** ✨ | Wikipedia 历史上的今天，精选科技事件 |
| **自动翻译** | 所有英文内容自动翻译为中文（并行优化）|

### 🤖 AI 智能功能

- **AI 锐评** 🆕：基于 LLM 对当日市场数据和资讯进行智能点评分析（支持多种风格）
- **AI 精选推荐**：从所有资讯中智能筛选最有价值的内容，并给出推荐理由
- **新闻亮点** 🆕：AI 自动识别当日最重要的头条新闻

### 📤 多渠道推送

| 服务             | 默认状态 | 环境变量          |
| ---------------- | -------- | ----------------- |
| Telegram Bot     | ✅ 启用  | `NOTIFY_TELEGRAM` |
| 钉钉群机器人     | ✅ 启用  | `NOTIFY_DINGTALK` |
| 企业微信群机器人 | ❌ 禁用  | `NOTIFY_WX_BOT`   |
| 企业微信应用消息 | ❌ 禁用  | `NOTIFY_WX_APP`   |

### 🧠 状态与记忆 ✨

日报每天会把自己观察到的结果保存下来，因此它不只有"今天"，还有"变化"：

| 能力 | 说明 |
|------|------|
| **🆕 首次出现** | 今日头条里只在真正第一次出现的条目上打标 —— 新，比热更有信息量 |
| **📈 价格走势** | 加密行情用 `▁▂▃▅▇` 画出近 7 日走势，一眼看出趋势而不只是当日涨跌 |
| **🔥 连续上榜** | GitHub 新星连续两天以上上榜会标注天数，连挂三天和单日冲榜不是一回事 |
| **去重窗口** | 30 天内出现过的条目会被记住，为后续的"这条你昨天看过了"留好基础 |

状态只存派生数据（去重指纹、价格序列、上榜记录），不存原始响应，仓库不会无限膨胀。

### 📊 数据源健康度 ✨

每个数据源都是失败软着陆的（挂了就跳过，日报照发），代价是降级不可见。因此日报末尾会附一行：

```
📊 数据源 21/24 正常 · 耗时 12.4s
降级：horizon, reddit
```

同样的内容也会写进 GitHub Actions 的 Job Summary（免费，无需任何基础设施）和 `dist/` 产物，出问题时能往前翻着排查。

### 🖥️ 离线预览 ✨

拉取和渲染是分开的，所以改排版、调模块开关、试顺序都不必等到第二天早上：

```bash
bun run preview                            # 用内置样例数据渲染整份日报
bun run preview -- --demo-state            # 叠加合成历史，看走势图 / 🆕 / 连挂
bun run preview -- --demo-state --html     # 额外输出聊天样式的 dist/preview.html
bun run preview -- --from=dist/raw.json    # 复现某次真实运行（artifact 里能下到）
bun run preview -- --md                    # 只输出 Markdown，便于管道处理
```

预览不联网、不推送、不写状态、不调用 LLM。真实运行时会把当天拉到的原始数据落盘成 `dist/raw.json`，配合 `--from` 就能完整复现那一天。

### 📚 静态归档（可选）✨

把 `config/daily.json` 里的 `archive` 设为 `true`，每天的日报会同时落成静态页面。

归档和状态都放在**独立的 `daily-data` 分支**上，`main` 只保留源码：

```
main 分支                          daily-data 分支（恒为 1 个提交）
├── src/                           ├── state/
├── config/daily.json              │   ├── seen.json       # 去重指纹
└── docs/index.html  ← 归档页外壳   │   └── history.json    # 价格序列与连挂记录
                                   └── docs/
                                       ├── index.html      # 归档首页（外壳来自 main）
                                       └── archive/
                                           ├── index.json
                                           ├── 2026-09-28.md
                                           └── 2026-09-28.html
```

之所以分开放：数据提交每天一次，如果留在 `main` 上，`git log` 很快就会变成一长串 `chore(state)`，仓库也会每天多一份归档副本。`daily-data` 每次都用**无父提交 + 强制推送**覆盖，因此它永远只有 1 个提交 —— 历史不堆积，体积不增长。

启用步骤：

1. `config/daily.json` 里把 `archive` 设为 `true`
2. `Settings → Pages` 把 Source 设为 **`daily-data` 分支 / `docs` 目录**

默认**关闭**。开启后归档站会公开可访问（仓库是 public 的话），不需要就保持 `false`。

---

## 🛠️ 技术栈

- **Runtime**: [Bun](https://bun.sh/)
- **HTTP Client**: Axios (带重试机制)
- **RSS Parser**: Cheerio
- **Translation**: google-translate-api-x (并行优化)
- **LLM**: OpenAI / OpenRouter 兼容 API
- **CI/CD**: GitHub Actions (每日北京时间 9:00 自动执行)

---

## 🚀 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入必要的配置 (详见下方「推送服务 Token 获取指南」)。

### 3. 运行

```bash
# 开发模式
bun run dev

# 生产模式
bun run start

# 离线预览排版（不联网、不推送、不写状态）
bun run preview -- --demo-state
```

### 4. GitHub Actions 自动运行

Fork 本仓库后，在 `Settings > Secrets and variables > Actions` 中配置相应的 Secrets，即可实现每日自动推送。

两点说明：

- **模块开关不在 Secrets 里**，改 [config/daily.json](config/daily.json) 即可，省掉一堆不会同步更新的 secret
- workflow 已声明 `permissions: contents: write`，用于把数据推送到 `daily-data` 分支。如果 fork 后仓库的 Actions 权限被设为只读，需要在 `Settings > Actions > General > Workflow permissions` 里放开写权限，否则日报的"记忆"不会累积（推送本身不受影响）

每次运行还会把 `dist/digest.md` 和 `dist/health.json` 作为 artifact 上传（保留 90 天），完整日报和健康度也会写进该次运行的 Summary 页面。

---

## 📂 项目结构

```
config/
└── daily.json                  # 模块开关（提交即可生效）✨
docs/
└── index.html                  # 归档首页外壳；归档数据在 daily-data 分支 ✨
scripts/
├── preview.js                  # bun run preview：离线渲染整份日报 ✨
└── fixture.js                  # 离线预览用的样例数据 ✨
src/
├── app.js                      # 程序入口
├── config/
│   ├── env.js                  # 环境变量管理
│   ├── modules.js              # 模块开关解析（环境变量 > 配置文件 > 内置默认值）✨
│   ├── constants.js            # 全局配置常量 🆕
│   └── prompts.js              # LLM Prompt 配置 🆕
├── cache/
│   └── RSSEnhancedCache.js     # RSS 缓存机制 🆕
├── state/
│   └── StateStore.js           # 跨天状态读写与裁剪 ✨
├── services/
│   ├── DailyReportGenerator.js # 日报生成器
│   ├── crypto/                 # 加密货币服务
│   ├── finance/                # 金融服务
│   ├── tech/                   # 科技资讯服务
│   │   ├── aiNews.js          # AI 行业资讯
│   │   ├── agentCodeNews.js   # Agent Code 前沿资讯
│   │   ├── v2exNews.js        # V2EX 精选
│   │   ├── xTwitterNews.js    # X/Twitter 热门
│   │   ├── macroNews.js       # 宏观金融新闻 🆕
│   │   ├── redditNews.js      # Reddit 技术社区 🆕
│   │   ├── juejinNews.js      # 掘金技术社区 🆕
│   │   └── segmentfaultNews.js # SegmentFault 技术问答 🆕
│   ├── llm/
│   │   ├── LLMService.js      # LLM 服务
│   │   └── NewsHighlightsService.js  # 新闻亮点服务 🆕
│   └── notification/          # 通知服务
└── utils/
    ├── http.js                 # HTTP 客户端 (重试优化) 🆕
    ├── translation.js         # 并行翻译工具（含熔断）✨
    ├── performance.js         # 性能监控工具 🆕
    ├── logger.js              # 结构化日志 🆕
    ├── health.js              # 数据源健康度统计 ✨
    ├── sparkline.js           # Unicode 迷你走势图 ✨
    ├── selection.js           # AI 候选内容按来源轮转取样 ✨
    ├── chatMarkdown.js        # Markdown → HTML（预览与归档共用）✨
    ├── archive.js             # 静态归档写入 ✨
    ├── common.js              # 通用工具
    └── formatters/            # 格式化工具
        ├── DingTalkMarkdownUtils.js
        ├── AiNewsFormatter.js
        ├── AgentCodeFormatter.js
        ├── V2exFormatter.js
        ├── XTwitterFormatter.js
        ├── MacroFormatter.js   # 宏观新闻格式化器 🆕
        ├── NewsHighlightsFormatter.js  # 新闻亮点格式化器 🆕
        ├── RedditFormatter.js  # Reddit 格式化器 🆕
        ├── JuejinFormatter.js  # 掘金格式化器 🆕
        ├── SegmentFaultFormatter.js  # SegmentFault 格式化器 🆕
        └── HealthFormatter.js  # 数据源健康度页脚 ✨
```

---

## ⚙️ 模块配置

模块开关在 **[config/daily.json](config/daily.json)** —— 直接改文件、提交，即可生效：

```json
{
  "modules": {
    "gold": true,
    "crypto": true,
    "reddit": true,
    "xTwitter": false,
    "productHunt": false
  },
  "notifications": {
    "telegram": true,
    "dingtalk": true
  }
}
```

放在仓库里而不是 Secrets 里，是因为开关本身不是密钥，而配置文件能 diff、能 review、能回滚，也不会随着模块增加让 workflow 的 env 列表失控。

**环境变量仍可覆盖**（优先级更高），适合单次手动运行：

```bash
MODULE_REDDIT=false bun run dev      # 这一次不跑 Reddit
NOTIFY_TELEGRAM=false bun run dev    # 这一次不推 Telegram
```

命名规则：`MODULE_` + 模块名的大写下划线形式（`aiNews` → `MODULE_AI_NEWS`）。无法识别的取值（如 `MODULE_REDDIT=maybe`）会被忽略并回退到配置文件。

**当前默认启用**：gold, crypto, aiNews, agentCode, horizon, v2ex, macro, newsHighlights, aiRecommendations, llmCommentary, aiModels, githubStars, reddit, juejin, segmentfault, leetcode, techHistory, securityRadar
**默认禁用**：xTwitter, productHunt, weather, quote, archive

其中 `archive` 不是数据源，而是"把日报落成静态归档"的开关，详见上方「静态归档」。

### AI 配置 🆕

| 变量                    | 默认      | 说明                     |
| ---------------------- | --------- | ------------------------ |
| `LLM_API_KEY`          | -         | LLM API 密钥             |
| `LLM_BASE_URL`         | OpenRouter| LLM API 基础 URL       |
| `LLM_MODEL`             | gpt-4o-mini| LLM 模型                |
| `LLM_COMMENTARY_STYLE`  | humor     | 评论风格 (humor/professional/concise) |

### 性能配置 🆕

| 变量                     | 默认  | 说明               |
| ------------------------ | ----- | ------------------ |
| `TRANSLATION_BATCH_SIZE` | 5     | 翻译批次大小       |
| `TRANSLATION_DELAY`      | 200   | 翻译延迟 (ms)      |
| `RSS_CACHE_TTL`          | 900   | RSS 缓存时间 (秒)   |
| `ENABLE_PERF_LOG`        | false | 启用性能日志       |
| `NODE_ENV`               | -     | 环境模式           |

---

## 🔑 推送服务 Token 获取指南

### Telegram Bot

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather) 并发送 `/newbot`
2. 按提示创建机器人，获得 `TELEGRAM_BOT_TOKEN`
3. 获取 Chat ID：
   - 将机器人拉入群组（或私聊机器人）
   - 访问 `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - 发送任意消息后刷新页面，在返回 JSON 中找到 `chat.id`
4. 配置环境变量：
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

### 钉钉群机器人 (加签方式)

1. 进入钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义机器人
2. 设置机器人名称，安全设置选择**加签**方式
3. 复制 Webhook URL 中的 `access_token` 和页面显示的**签名密钥 (Secret)**
4. 配置环境变量：
   ```env
   DINGTALK_ACCESS_TOKEN=your_access_token
   DINGTALK_SECRET=SEC...your_secret
   ```

### 企业微信群机器人

1. 进入企业微信群 → 群设置 → 群机器人 → 添加机器人
2. 复制 Webhook URL 中的 `key` 参数
3. 配置环境变量：
   ```env
   BOT_KEY=your_bot_key
   NOTIFY_WX_BOT=true
   ```

### 企业微信应用消息

1. 登录[企业微信管理后台](https://work.weixin.qq.com/)
2. 获取企业 ID (CorpID)：我的企业 → 企业信息 → 企业 ID
3. 创建自建应用：应用管理 → 自建 → 创建应用
4. 获取应用的 AgentId 和 Secret
5. 配置环境变量：
   ```env
   WX_COMPANY_ID=your_corp_id
   WX_APP_ID=your_agent_id
   WX_APP_SECRET=your_app_secret
   NOTIFY_WX_APP=true
   ```

---

## 📝 示例输出

```
# 每日播报

_3月24日 周一_

---

## 📌 今日头条
> _AI 识别的重要市场动态_

1. **[美联储暗示降息时间表提前](https://...)** - 加息周期可能结束
2. **[OpenAI 发布 GPT-5 预览版](https://...)** - 多模态能力大幅提升

---

## 🏆 今日金价

---

## 💰 加密行情

---

## 🏛️ 宏观要闻
> _美联储 · 加息 · 通胀 · GDP_

- **[美联储纪要：通胀正在放缓](https://cnbc.com/...)**
> 央行官员表示...
> *CNBC Markets · 2小时前*

---

## 🤖 AI 前沿资讯
> _大模型动态 · 研究前沿 · 行业新闻_

---

## 👨‍💻 Agent Code 前沿
> _AI编程助手 · Vibe Coding · 热门项目_

---

## 🇻🇳 V2EX 精选
> _技术社区热点 · 开发者话题_

---

## ⭐ AI 精选推荐

1. **[Claude 3.5 Sonnet 发布](https://...)**
   _Anthropic_ · 💡 编码能力大幅提升，原生支持 Agent 模式

---

## 🎯 AI 锐评
> _基于今日数据的市场洞察与建议_
> 今日市场情绪偏向贪婪，但宏观面传来降息信号...
```

---

## 🚀 版本特性 (v2.0)

### 🆕 新增功能

- **宏观金融新闻模块** - 追踪美联储、加息、通胀等影响市场的宏观因素
- **新闻亮点 AI 识别** - 自动筛选当日最重要的头条新闻
- **多风格 AI 评论** - 支持幽默、专业、简洁三种评论风格
- **并行翻译优化** - 翻译速度提升 60%+
- **HTTP 重试机制** - 自动重试 + 指数退避，提高可靠性
- **RSS 缓存机制** - 减少 80% 重复请求
- **性能监控工具** - 可视化各模块耗时

### 📊 内容覆盖

- **加密货币市场** - BTC、ETH、SOL 等主流代币实时行情
- **AI 行业动态** - 大模型、Agent Code、开发者工具前沿
- **宏观金融** - 美联储政策、加息、通胀、GDP 等
- **技术社区** - V2EX、Hacker News、GitHub Trending
- **社交媒体** - X/Twitter 技术圈热门讨论
- **智能分析** - AI 锐评 + 精选推荐 + 新闻亮点

### ⚡ 性能提升

| 优化项 | 提升幅度 |
|--------|----------|
| 并行翻译 | ~60% |
| LLM 并行调用 | ~50% |
| RSS 缓存 | ~80% (后续运行) |
| **总体** | **~40%** |

### 🔧 代码质量改进

- 配置集中化（所有魔法数字提取到配置文件）
- 结构化日志（统一的日志接口）
- 格式化器重构（支持对象参数，向后兼容）
- 数据验证（LLM 在数据不足时跳过生成）

---

## 📜 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本更新历史。

---

## 📄 License

MIT
