# 更新日志

## [2026-09-28] v2.4 更新 - 数据移出 main、修复三个失效的数据源 🔧

### 🔧 分支历史治理

日报状态与归档原先每天由 workflow 提交回 `main`，`git log` 很快就会被
`chore(state): 更新 …` 填满，仓库体积也每天增长。

- 数据整体移到独立的 **`daily-data` 分支**，`main` 只保留源码
- 每次运行用「无父提交 + 强制推送」覆盖该分支，因此它**恒为 1 个提交**
- `state/` 与 `docs/archive/` 加入 `.gitignore`，不会误提交进 main
- GitHub Pages 改为从 `daily-data` / `docs` 提供服务

顺带移除了 main 上那条机器人数据提交，本地与远端历史保持一致。

### 🐛 修复失效的数据源

线上日报启用了 18 个模块，实际只有 8 个产出内容。逐一排查后修掉三个：

- **掘金**：`content_api/v1/content/article_rank` 与 `content/article_list`
  两个路由都已下线（返回 `{"err_no":2,"err_msg":"请求路由不存在"}`）。
  改用当前可用的 `recommend_api/v1/article/recommend_all_feed`，
  并按新结构（`data[].item_info.article_info`）重写字段映射
- **SegmentFault**：订阅源已换成 Atom 格式，而解析器只认 RSS 的 `<item>`
  和元素文本链接 —— Atom 的链接在 `href` 属性上，于是**永远解析出 0 条且不报错**。
  解析器改为同时兼容两种格式，并把标签名差异、作者 `name`/`uri` 拼接等一并处理
- **时间窗**：`filterTodayItems` 按"本地日历今天 00:00"切，CI 跑在 UTC 下
  窗口只有几小时；且对 UTC+8 的中文源，"今天"从北京时间早上 8 点才算起，
  当天 0~8 点的内容被整体排除。改为**滚动时间窗**（`filterRecentItems`），
  影响 8 个模块。实测 aiNews 从"30 条抓取 → 0 条留存"恢复

### 📝 其他

- 不可用的源不再静默失败：SegmentFault 文章源已下线，改为留空跳过并注明
- 新增 `tests/feeds.test.js`，覆盖 Atom/RSS 双格式解析、掘金新结构映射、
  滚动时间窗边界（含无法解析的时间戳）
- 测试 140 → 153

### ⚠️ 仍未解决

- **LLM 三个功能**：`LLM_MODEL` 返回 404 `Not found the model or Permission denied`，
  需要更换 secret，属配置问题而非代码问题
- **Reddit**：20 个子版块全部 429，Reddit 限制机房 IP 的匿名访问，需要 OAuth
- **Horizon**：`vendor/horizon` 在 `.gitignore` 中且 CI 无 Python，该模块在 CI 上无法运行
- **HuggingFace 模型榜**：接口返回 400，需重新对接口

---

## [2026-09-28] v2.3 更新 - 离线预览、静态归档与三处缺陷修复 ✨

延续 v2.2 "部署在 GitHub Actions、零成本"的前提，这一轮重点是**缩短反馈循环**与**修掉几处会静默失灵的缺陷**。

### 🆕 新增功能

#### 离线预览 `bun run preview`
- 生成器拆成"拉取"与"渲染"两步，渲染不联网、不写状态，可以反复调用
- 内置样例数据（`scripts/fixture.js`），字段名对照各 formatter 逐一校对
- 真实运行会把当天原始数据落盘成 `dist/raw.json`，`--from` 可完整复现任意一天
- `--demo-state` 叠加合成历史，立刻看到走势图 / 🆕 / 连挂天数的效果
- `--html` 输出聊天样式的 `dist/preview.html`，改排版不必等到第二天早上

#### 静态归档（`archive` 开关，默认关闭）
- 新增 `src/utils/archive.js`，把每日日报落成 `docs/archive/YYYY-MM-DD.md/.html`
- 维护 `docs/archive/index.json`（日期、头条标题、健康度），同名重跑覆盖不追加
- 新增 `docs/index.html` 归档首页，支持按日期与头条关键词搜索
- 配合 GitHub Pages（main / `docs`）即可得到可搜索、可链接的永久归档

### 🐛 缺陷修复

- **AI 候选列表会丢掉靠后的来源**：`_newsPool` 按固定顺序拼接后取前 30 条，
  reddit / 掘金 / SegmentFault / Horizon / GitHub 这些排在后面的来源
  **从来没有进入过 AI 的视野**。改为按来源轮转取样（`src/utils/selection.js`），
  截断发生在来源之间而不是来源之后
- **翻译的默认写回是空操作**：`translateBatch` 的默认 `setTextFn` 只 `return` 而不写回，
  字符串数组的译文算完就被丢掉，整批翻译白做
- **翻译缓存挡不住同批并发**：同一批里的重复内容会各自发起请求；
  改为在途请求合并，并把缓存键从"前 100 字符"改为全文（前缀相同的内容会互相覆盖）

### 🔧 改进优化

#### 翻译韧性
- 新增熔断：连续失败 5 次后，本次运行剩余内容不再翻译，避免逐个撞墙把整轮拖慢
- 翻译结果纳入健康度统计，端点被限流时不再无声无息

#### 死代码与配置清理
- 移除从未被引用的 `RECOMMENDATIONS_PROMPT`（其内部分组逻辑也已失效）
- 接通此前"有开关、有服务、有格式化器但从未被调用"的 `weather` / `quote` 模块
- 新增 `WEATHER_CITY` 环境变量（默认重庆）

#### 测试
- 新增 8 个测试文件，覆盖 sparkline / health / 状态持久化 / 归档 /
  Markdown 渲染 / 候选挑选 / 翻译熔断 / formatter 新行为
- 测试总数 42 → 139

### 📝 说明

- 评估后**放弃**了"合并新闻亮点与 AI 推荐两次 LLM 调用"：两者各约 500 token，
  合并每天省下的成本可以忽略，却要动两处调好的 prompt，不划算
- `scripts/` 与 `docs/` 是新增的顶层目录

---

## [2026-09-28] v2.2 更新 - 状态持久化、健康度与 CI 加固 ✨

本次改动围绕"部署在 GitHub Actions、零成本"这个前提做优化，不新增数据源。

### 🆕 新增功能

#### 状态持久化：日报有了"记忆"
- 新增 `src/state/StateStore.js`，用仓库内的 JSON 文件当存储（无数据库）
- workflow 每天把 `state/` 提交回仓库，只存派生数据，仓库不会无限膨胀
  - `seen.json`：近 30 天的去重指纹（30 天后自动裁剪）
  - `history.json`：价格序列（保留 90 天）与连续上榜记录
- 由此解锁三项之前做不到的能力：
  - **🆕 首次出现标记**：今日头条只给真正第一次出现的条目打标
  - **📈 价格走势**：加密行情用 `▁▂▃▅▇` 画出近 7 日走势
  - **🔥 连续上榜**：GitHub 新星连续 2 天以上上榜标注天数
- 顺带的好处：每日提交会重置 GitHub "60 天无活动自动停用定时任务"的计时器

#### 数据源健康度
- 新增 `src/utils/health.js`，包裹每次拉取并登记状态
- 区分 `ok` / `empty` / `error` —— 其中 `empty`（没抛错但没数据）是最容易被忽略的静默降级
- 日报末尾附健康度页脚：`📊 数据源 21/24 正常 · 耗时 12.4s`
- 同时写入 GitHub Actions Job Summary 与 `dist/health.json`

#### 新增工具
- `src/utils/sparkline.js`：Unicode 迷你走势图，零依赖

### 🔧 改进优化

#### 模块配置从 Secrets 搬进仓库
- 新增 `config/daily.json`，作为模块与通知开关的唯一默认值来源
- 配置优先级：环境变量 > 配置文件 > 内置默认值
- 可 diff、可 review、可回滚；修掉了 workflow 只透传 7 个 `MODULE_*` 而实际有 22 个开关的断层（此前 CI 上无法关闭任何一个新模块）
- 无法识别的环境变量取值（如 `MODULE_REDDIT=maybe`）会被忽略并回退，而不是静默变成 `false`

#### CI 加固
- 新增 `concurrency` 组，避免手动重跑与定时任务撞车导致同日推送两条
- 新增 `timeout-minutes: 20`，兜住可能挂住的数据源
- 新增 `permissions: contents: write`（新仓库默认只读，否则状态推不回去）
- 透传 `GITHUB_TOKEN`，把 GitHub API 限额从 60/小时提到 1000/小时
- 日报与健康度作为 artifact 上传，保留 90 天

#### 代码结构
- `DailyReportGenerator` 的数据拉取改为声明式数据源表：新增模块只需加一行
- `HorizonService` 不再自己读 `MODULE_HORIZON`，统一走模块配置中心
- 所有 formatter 的新参数都是可选的，不传时行为与之前完全一致

### 📋 配置变更

- 模块开关移到 `config/daily.json`，`.env.example` 中不再重复列举（避免两份清单漂移）
- 环境变量覆盖方式不变，命名规则不变

### ⚠️ 注意事项

- 首次在 fork 的仓库运行时，需要确保 Actions 有写权限，否则状态无法提交（推送不受影响）
- `state/` 目录需要被提交进仓库，不要在 `.gitignore` 中忽略它

---

## [2026-07-23] v2.1 更新 - 扩展技术社区覆盖 🌐

### 🆕 新增功能

#### 技术社区模块扩展
- **Reddit 技术社区模块**
  - 新增 20+ 技术相关子版块覆盖
  - 支持编程、AI/ML、DevOps、新兴技术、开源等多个分类
  - 包含 r/programming, r/webdev, r/javascript, r/Python, r/rust, r/golang, r/MachineLearning, r/LocalLLaMA, r/datascience, r/devops, r/docker, r/kubernetes, r/blockchain, r/cybersecurity 等
  - 自动分类和表情符号标注

- **掘金技术社区模块**
  - 中文开发者社区热门文章聚合
  - 支持前端、后端、AI、DevOps 等技术分类
  - 按热度排序（点赞+评论+浏览量）
  - 无需翻译，直接展示中文内容

- **SegmentFault 技术问答模块**
  - 中文技术问答社区热门问题
  - 技术文章推荐
  - 区分问题和文章类型

### 🔧 改进优化

#### 代码架构
- 新增独立的服务模块：`redditNews.js`, `juejinNews.js`, `segmentfaultNews.js`
- 新增对应的格式化器：`RedditFormatter.js`, `JuejinFormatter.js`, `SegmentFaultFormatter.js`
- 模块化配置，支持通过环境变量灵活控制

#### 文档更新
- 更新 README.md，添加新模块说明
- 更新 .env.example，添加新模块配置选项
- 完善项目结构文档

### 📋 配置说明

新增环境变量配置：
```env
MODULE_REDDIT=true      # Reddit 技术社区（默认启用）
MODULE_JUEJIN=true      # 掘金技术社区（默认启用）
MODULE_SEGMENTFAULT=true # SegmentFault 技术问答（默认启用）
```

### ⚠️ 注意事项

- Reddit 有请求频率限制，已配置自动重试机制
- 掘金和 SegmentFault 为中文内容，无需翻译
- 所有新模块均支持并行获取，不影响整体性能

---

## [2026-03-24] v2.0 重大更新 - TechDaily 重塑 🚀

> **项目重命名**: `crypto-daily-checkin` → `tech-daily`

**重命名背景**: 随着项目内容从单纯的加密货币扩展到 AI 资讯、宏观金融、技术社区等多个科技领域，原名已不能准确反映项目定位。

新名称 **TechDaily** 更好地概括了项目的核心价值：每日科技资讯摘要。

### 🆕 新增功能

#### 内容扩展
- **宏观金融新闻模块**
  - 新增 CNBC Markets、Reuters Business、Bloomberg Markets 等数据源
  - 自动过滤美联储、加息、通胀、GDP 等相关关键词
  - 独立的格式化器，统一的卡片样式

- **新闻亮点 AI 识别**
  - AI 自动扫描所有资讯，识别 3-5 条最重要的头条
  - 生成简短的"市场影响"说明
  - 置顶显示，突出关键信息

#### AI 功能增强
- **多风格 AI 评论**
  - 支持三种评论风格：幽默 (humor)、专业 (professional)、简洁 (concise)
  - 通过 `LLM_COMMENTARY_STYLE` 环境变量配置
  - Prompt 提取到独立配置文件，便于管理和版本控制

### ⚡ 性能优化

- **并行翻译优化**
  - 翻译速度提升 60%+（从串行改为批量并行）
  - 新增 TranslationCache 缓存已翻译内容
  - 可配置批次大小和延迟

- **LLM 并行调用**
  - AI 评论和 AI 推荐 并行执行
  - 节省 3-5 秒处理时间

- **RSS 缓存机制**
  - 15分钟 TTL，减少 80% 重复请求
  - 支持 GitHub Actions 环境的持久化

- **HTTP 重试机制**
  - 自动重试（最多 3 次）+ 指数退避
  - 智能判断可重试错误（429、5xx、超时等）
  - 提高网络异常情况下的可靠性

### 🔧 代码质量改进

- **配置集中化**
  - 新增 `src/config/constants.js` 统一管理所有配置常量
  - 消除硬编码的魔法数字
  - API、翻译、过滤、LLM、格式化等配置分离

- **结构化日志**
  - 新增 `src/utils/logger.js` 统一日志接口
  - 支持上下文、模块化日志记录
  - 可配置日志级别

- **性能监控**
  - 新增 `src/utils/performance.js` 性能监控工具
  - 跟踪各模块执行时间和耗时
  - 生成性能报告和慢操作分析

- **格式化器重构**
  - 所有格式化器支持对象参数（同时保持向后兼容）
  - 统一使用 EMOJI 常量
  - 新增通用工具函数 `truncateText()`
  - 优化时间格式为中文统一风格（刚刚、X分钟前、X小时前）

- **数据验证**
  - LLM 服务新增数据完整性检查
  - 数据不足时跳过 AI 评论生成，避免无意义输出
  - 优化 Prompt 构建，处理 undefined/NaN 等异常数据

### 📝 格式优化

- **V2EX 格式改进**
  - 新增 `cleanContent()` 函数移除 Markdown 标题格式
  - 并行获取 hot/latest 源
  - 来源格式简化为节点名称

- **时间格式统一**
  - 所有模块统一使用中文时间格式
  - X/Twitter 互动数据格式优化（万阅读、赞、转、评）

- **X/Twitter 格式改进**
  - 互动数据本地化显示
  - 元信息格式优化

### 🌐 新增环境变量

```env
# 内容模块
MODULE_MACRO_NEWS=true          # 宏观金融新闻
MODULE_NEWS_HIGHLIGHTS=true     # AI 新闻亮点

# AI 配置
LLM_COMMENTARY_STYLE=humor      # 评论风格: humor/professional/concise

# 性能配置
TRANSLATION_BATCH_SIZE=5        # 翻译批次大小
TRANSLATION_DELAY=200           # 翻译延迟(ms)
RSS_CACHE_TTL=900              # RSS 缓存时间(秒)

# 开发配置
NODE_ENV=production            # 环境变量
ENABLE_PERF_LOG=true           # 性能日志
```

### 📊 性能对比

| 指标 | v1.0 | v2.0 | 提升 |
|------|------|------|------|
| 翻译时间 | ~3s | ~1s | 67% ↓ |
| LLM 处理 | ~8s | ~4s | 50% ↓ |
| 总体运行 | ~15s | ~9s | 40% ↓ |

### 📂 新增文件

**配置**
- `src/config/constants.js` - 全局配置常量
- `src/config/prompts.js` - LLM Prompt 配置

**工具**
- `src/utils/translation.js` - 并行翻译工具
- `src/utils/performance.js` - 性能监控
- `src/utils/logger.js` - 结构化日志

**缓存**
- `src/cache/RSSEnhancedCache.js` - RSS 缓存

**服务**
- `src/services/tech/macroNews.js` - 宏观金融新闻
- `src/services/llm/NewsHighlightsService.js` - 新闻亮点服务

**格式化器**
- `src/utils/formatters/MacroFormatter.js` - 宏观新闻格式化器
- `src/utils/formatters/NewsHighlightsFormatter.js` - 新闻亮点格式化器

### 🔧 修改文件

**核心服务**
- `src/services/DailyReportGenerator.js` - 集成新模块 + LLM 并行调用
- `src/services/llm/LLMService.js` - 多风格评论支持 + 数据验证
- `src/services/tech/aiNews.js` - 使用并行翻译
- `src/services/tech/agentCodeNews.js` - 使用并行翻译
- `src/services/tech/v2exNews.js` - 并行获取 + 内容清理

**工具**
- `src/utils/http.js` - 重试机制 + 指数退避
- `src/utils/formatters/DingTalkMarkdownUtils.js` - 对象参数支持 + 时间格式优化
- `src/utils/formatters/V2exFormatter.js` - 格式优化
- `src/utils/formatters/XTwitterFormatter.js` - 格式优化
- `src/utils/formatters/AiNewsFormatter.js` - 使用 EMOJI 常量
- `src/utils/formatters/AgentCodeFormatter.js` - 使用 EMOJI 常量

**配置**
- `src/config/modules.js` - 新增 macro 和 newsHighlights 模块

---

## [2026-01-12] 功能更新

### 项目重命名说明 🔖

> 原项目名 `crypto-daily-checkin` 更名为 `tech-daily`
>
> 更名原因：项目从单纯的加密货币签到发展为涵盖 AI、宏观金融、技术社区的综合性科技日报。

### 新增功能

- **V2EX 每日摘要模块**

  - 集成 V2EX API 获取热门技术讨论
  - Hacker News 风格的时间衰减评分算法
  - 自动过滤无关节点（如 promotions）
  - 卡片式布局，带节点标签和回复数

- **X/Twitter 热门技术贴**

  - 聚合 Claude Code、Cursor AI、GitHub Copilot、Vibe Coding 等关键词
  - 质量过滤：浏览量 ≥ 10,000 且有回复
  - 本周发布内容过滤
  - 互动数据展示（浏览量、点赞、转发、评论）

- **Markdown 排版优化**

  - 统一使用 DingTalk Markdown 格式
  - 卡片式信息展示，层次分明
  - 引用块格式化元数据
  - 支持长消息自动分片

### 优化

- **统一格式化器接口**

  - 抽取 `DingTalkMarkdownUtils.js` 工具类
  - 所有 Formatter 使用统一的格式化方法
  - 新增 `cardItem()` 卡片式条目
  - 新增 `formatRelativeTime()` 相对时间格式化

- **内容过滤增强**

  - V2EX 排除广告节点
  - X/Twitter 质量和时间双重过滤
  - Agent Code 关键词过滤优化

### 新增环境变量

| 变量                     | 默认  | 说明                |
| ------------------------ | ----- | ------------------- |
| `MODULE_V2EX`            | true  | V2EX 每日摘要        |
| `MODULE_X_TWITTER`       | false | X/Twitter 热门技术贴 |
| `RAPID_API_KEY`          | -     | RapidAPI 密钥        |

### 文件结构变更

```
src/
├── services/
│   └── tech/
│       ├── v2exNews.js           # 新增 V2EX 服务
│       └── xTwitterNews.js       # 新增 X/Twitter 服务
└── utils/
    └── formatters/
        ├── V2exFormatter.js       # 新增 V2EX 格式化器
        └── XTwitterFormatter.js    # 新增 X/Twitter 格式化器
```

---

## [2025-12-18] 功能更新

### 新增功能

- **Agent Code 前沿资讯模块**

  - 聚合 GitHub Blog、Anthropic、OpenAI 官方博客
  - 抓取 GitHub Trending 热门 AI/ML 开源项目
  - 社区讨论：Reddit r/LocalLLaMA、r/MachineLearning、Lobste.rs、Hacker News
  - 开发者资讯：Dev.to AI、Echo JS
  - 智能关键词过滤（agent, copilot, cursor, vibe coding 等）

- **AI 精选推荐模块**
  - 收集所有资讯后发送给 LLM 进行价值评估
  - AI 从全部内容中筛选最有价值的 6 条
  - 每条推荐附带 AI 给出的推荐理由
  - 解决了简单限制来源条数可能遗漏重要消息的问题

### 优化

- **钉钉 Markdown 排版优化**

  - 新增 `DingTalkMarkdownUtils.js` 格式化工具类
  - 统一的模块标题格式 `## 🏆 标题`
  - 使用分隔线 `---` 优化视觉层级
  - 价格信息使用粗体高亮
  - 引用块格式化 AI 锐评

- **消息格式重构**
  - 各 Formatter 使用统一的格式化工具
  - 添加消息头部日期显示
  - 优化链接列表排版

### 新增环境变量

| 变量                        | 默认 | 说明                |
| --------------------------- | ---- | ------------------- |
| `MODULE_AGENT_CODE`         | true | Agent Code 前沿资讯 |
| `MODULE_AI_RECOMMENDATIONS` | true | AI 精选推荐         |

---

## [2025-12-18] 功能更新

### 新增功能

- **钉钉群机器人推送**
  - 支持加签 (HMAC-SHA256) 安全验证方式
  - 支持 Markdown 格式消息
  - 长消息自动分片发送
- **LLM 智能锐评**
  - 集成 OpenRouter / OpenAI 兼容格式 API
  - 每日自动生成市场分析与资讯点评

### 优化

- **模块化开关配置**
  - 通过环境变量灵活启用/禁用各功能模块
  - 支持通知渠道独立开关
- **消息分片机制**
  - 抽取通用 `messageSplitter` 工具函数
  - 钉钉/企业微信共享分片逻辑
- **README 文档**
  - 新增推送服务 Token 获取详细指南
  - 完善项目结构说明

---

## [2025-02-18] 功能更新

### 新增功能

- 迁移至 Bun 运行时环境
  - 显著提升运行性能和稳定性
  - 优化依赖管理和构建流程
  - 美化命令行输出效果
- 添加每日天气预报功能
  - 支持重庆地区天气信息查询
  - 显示温度、风向等详细信息
- 添加温馨话语功能
  - 每日随机发送暖心情话
  - 支持备用 API 自动切换
- 优化消息格式
  - 添加 emoji 表情
  - 更友好的展示方式

### 消息格式示例

```
崽崽早安！💖

【今日天气】
重庆 晴
🌡️ 温度：20℃ ~ 28℃
💨 风向：东南风 3级
💡 温馨提示：天气不错，适合出门走走

【温馨话语】
月亮不会奔向太阳，我却可以奔向你。

周三了
```

### 技术细节

- 使用 Bun 运行时环境
  - 更快的启动速度和执行效率
  - 内置的依赖管理和构建工具
  - 优化的异步处理机制
- 使用 vvhan API 获取天气数据
- 使用 lovelive.tools 和 uomg API 获取情话数据
- 完善的错误处理机制
- API 失败自动切换备用方案

### 注意事项

- 所有 API 均为免费公开接口
- 如遇到 API 访问失败会自动使用备用方案
- 消息发送失败会在控制台输出错误日志
