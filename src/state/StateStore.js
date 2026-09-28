/**
 * 日报状态仓库
 *
 * 部署在 GitHub Actions 上，没有数据库。这里用仓库内的两个 JSON 文件做持久化，
 * 每天由 workflow 提交回仓库，日报因此有了"记忆"。
 *
 * 设计取舍：
 * - 只存派生状态（去重哈希、价格序列、上榜记录），不存原始响应，避免仓库无限膨胀
 * - 写入时排序 + 缩进，保证 diff 干净、可 review、可回滚
 * - 任何读写失败都不抛错：状态是增强项，丢了也必须能正常出日报
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { STATE_CONFIG } = require("../config/constants");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCHEMA_VERSION = 1;
const SEEN_FILE = "seen.json";
const HISTORY_FILE = "history.json";

/**
 * 取北京时间的日期（YYYY-MM-DD）
 * 日报按北京时间发布，状态也按同一时区归档，避免跨日边界对不上
 * @param {Date} [date]
 * @returns {string}
 */
function toDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 计算条目的稳定指纹
 * 优先用 URL（标题可能被翻译或带每日变化的数字，不稳定）
 * @param {{url?: string, title?: string}} item
 * @returns {string|null} 12 位十六进制；无有效字段时返回 null
 */
function itemHash(item) {
  const key = String(item?.url || item?.title || "").trim().toLowerCase();
  if (!key) return null;
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 12);
}

/** 日期字符串减去若干天 */
function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

class StateStore {
  constructor(options = {}) {
    this.dir = options.dir
      ? path.resolve(options.dir)
      : path.resolve(REPO_ROOT, STATE_CONFIG.dir);
    this.seenRetentionDays =
      options.seenRetentionDays ?? STATE_CONFIG.seenRetentionDays;
    this.priceRetentionDays =
      options.priceRetentionDays ?? STATE_CONFIG.priceRetentionDays;
    this.today = options.today || toDateString();

    this.seen = {}; // 指纹 -> 首次出现的日期
    this.prices = {}; // 品种 -> [[日期, 数值], ...]
    this.trending = {}; // 条目 -> [日期, ...]
    this.dirty = false;
  }

  /**
   * 从磁盘加载状态，文件缺失或损坏时静默降级为空状态
   * @returns {StateStore} this
   */
  load() {
    const seen = this._read(SEEN_FILE);
    const history = this._read(HISTORY_FILE);

    if (seen && typeof seen.items === "object" && seen.items) {
      this.seen = seen.items;
    }
    if (history) {
      this.prices = history.prices || {};
      this.trending = history.trending || {};
    }
    return this;
  }

  /**
   * 写回磁盘（先裁剪过期数据）
   * @returns {boolean} 是否真的写入了
   */
  save() {
    if (!this.dirty) return false;

    try {
      fs.mkdirSync(this.dir, { recursive: true });
      // 先裁剪再落盘：仓库体积只和保留窗口有关，和运行次数无关
      this._prune();

      const payloads = [
        [
          SEEN_FILE,
          {
            version: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            items: sortObject(this.seen),
          },
        ],
        [
          HISTORY_FILE,
          {
            version: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            prices: sortObject(this.prices),
            trending: sortObject(this.trending),
          },
        ],
      ];

      for (const [file, data] of payloads) {
        fs.writeFileSync(
          path.join(this.dir, file),
          `${JSON.stringify(data, null, 2)}\n`,
          "utf8"
        );
      }
      this.dirty = false;
      return true;
    } catch (error) {
      console.warn(`状态写入失败（不影响日报）: ${error.message}`);
      return false;
    }
  }

  // ---------- 去重 / 首次出现 ----------

  /**
   * 该条目在保留窗口内是否从未出现过
   * @param {{url?: string, title?: string}} item
   * @returns {boolean}
   */
  isFirstSeen(item) {
    const hash = itemHash(item);
    if (!hash) return false;
    return !this.seen[hash];
  }

  /**
   * 记录今天出现过的条目
   * @param {Array} items
   * @returns {number} 新增数量
   */
  remember(items) {
    let added = 0;
    for (const item of items || []) {
      const hash = itemHash(item);
      if (!hash || this.seen[hash]) continue;
      this.seen[hash] = this.today;
      added++;
    }
    if (added > 0) this.dirty = true;
    return added;
  }

  // ---------- 价格序列 ----------

  /**
   * 记录一个价格点。同一天重复运行会覆盖当天数据而不是追加，保证序列是"每天一个点"
   * @param {string} symbol
   * @param {number} value
   */
  recordPrice(symbol, value) {
    if (!symbol || !Number.isFinite(value) || value <= 0) return;

    const series = this.prices[symbol] || (this.prices[symbol] = []);
    const last = series[series.length - 1];

    if (last && last[0] === this.today) {
      if (last[1] === value) return;
      last[1] = value;
    } else {
      series.push([this.today, value]);
    }
    this.dirty = true;
  }

  /**
   * 取某品种最近 N 天的价格序列
   * @param {string} symbol
   * @param {number} [days]
   * @returns {number[]}
   */
  getSeries(symbol, days = STATE_CONFIG.sparklineDays) {
    const series = this.prices[symbol] || [];
    return series.slice(-days).map(([, value]) => value);
  }

  // ---------- 连续上榜 ----------

  /**
   * 记录今天上榜的条目
   * @param {string} name - 稳定标识（用 URL，别用带数字的标题）
   */
  recordTrending(name) {
    if (!name) return;
    const days = this.trending[name] || (this.trending[name] = []);
    if (days[days.length - 1] === this.today) return;
    days.push(this.today);
    this.dirty = true;
  }

  /**
   * 截至今天连续上榜的天数
   * @param {string} name
   * @returns {number}
   */
  getStreak(name) {
    const days = this.trending[name];
    if (!days || days.length === 0) return 0;

    const seenDays = new Set(days);
    let streak = 0;
    let cursor = this.today;

    while (seenDays.has(cursor)) {
      streak++;
      cursor = shiftDate(cursor, -1);
    }
    return streak;
  }

  // ---------- 内部 ----------

  /** @private */
  _read(file) {
    const target = path.join(this.dir, file);
    try {
      return JSON.parse(fs.readFileSync(target, "utf8"));
    } catch (error) {
      // 首次运行没有状态文件是正常的，只有解析失败才值得警告
      if (error.code !== "ENOENT") {
        console.warn(`状态文件 ${file} 读取失败，按空状态处理: ${error.message}`);
      }
      return null;
    }
  }

  /** @private */
  _prune() {
    const seenCutoff = shiftDate(this.today, -this.seenRetentionDays);
    for (const [hash, date] of Object.entries(this.seen)) {
      if (date < seenCutoff) delete this.seen[hash];
    }

    const priceCutoff = shiftDate(this.today, -this.priceRetentionDays);
    for (const [symbol, series] of Object.entries(this.prices)) {
      const kept = series.filter(([date]) => date >= priceCutoff);
      if (kept.length === 0) delete this.prices[symbol];
      else this.prices[symbol] = kept;
    }

    const trendingCutoff = shiftDate(this.today, -this.priceRetentionDays);
    for (const [name, days] of Object.entries(this.trending)) {
      const kept = days.filter((date) => date >= trendingCutoff);
      if (kept.length === 0) delete this.trending[name];
      else this.trending[name] = kept;
    }
  }
}

/** 按键名排序，让 JSON 输出稳定、diff 干净 */
function sortObject(source) {
  return Object.fromEntries(
    Object.entries(source).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

module.exports = { StateStore, itemHash, toDateString, shiftDate };
