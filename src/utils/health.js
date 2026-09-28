/**
 * 运行健康度统计
 *
 * 项目里每个数据源都是 fail-soft 的 —— 挂了就返回空数组，日报照发。
 * 好处是永远不会因为一个源而开天窗，代价是**降级完全不可见**：
 * 你可能连着几周都在收一份缺了三分之一的日报而不自知。
 *
 * 这一层把每次拉取的结果登记下来，最后汇总成消息页脚 + CI Summary。
 */

const STATUS = {
  OK: "ok",
  EMPTY: "empty", // 没抛错但没拿到数据 —— 最容易被忽略的一类失败
  ERROR: "error",
};

/** 默认的"拿到有效数据"判断：非空数组，或非空对象 */
function defaultIsOk(data) {
  if (Array.isArray(data)) return data.length > 0;
  return Boolean(data);
}

class RunHealth {
  constructor() {
    this.startedAt = Date.now();
    this.entries = [];
  }

  /**
   * 包裹一次数据拉取，自动登记耗时与状态
   * @param {string} name - 模块名
   * @param {Function} loader - 返回 Promise 的加载函数
   * @param {object} [options]
   * @param {*} [options.fallback] - 失败时的兜底返回值
   * @param {Function} [options.isOk] - 自定义"是否拿到有效数据"
   * @returns {Promise<*>} 加载结果或兜底值
   */
  async track(name, loader, options = {}) {
    const { fallback = null, isOk = defaultIsOk } = options;
    const startedAt = Date.now();

    try {
      const data = await loader();
      const durationMs = Date.now() - startedAt;
      this.record(name, isOk(data) ? STATUS.OK : STATUS.EMPTY, durationMs);
      return data;
    } catch (error) {
      this.record(name, STATUS.ERROR, Date.now() - startedAt, error.message);
      return fallback;
    }
  }

  /**
   * 登记一个非拉取类步骤的结果（如 LLM 调用）
   * @param {string} name
   * @param {boolean} ok
   * @param {string} [detail] - 补充说明，会出现在 CI Summary 的明细里
   */
  recordStep(name, ok, detail = "") {
    this.record(name, ok ? STATUS.OK : STATUS.EMPTY, 0, detail || undefined);
  }

  /**
   * @param {string} name
   * @param {string} status
   * @param {number} durationMs
   * @param {string} [reason]
   */
  record(name, status, durationMs, reason) {
    this.entries.push({ name, status, durationMs, reason });
  }

  /**
   * 汇总
   * @returns {{total: number, ok: number, degraded: Array, elapsedMs: number}}
   */
  summarize() {
    const degraded = this.entries.filter((entry) => entry.status !== STATUS.OK);
    return {
      total: this.entries.length,
      ok: this.entries.length - degraded.length,
      degraded,
      elapsedMs: Date.now() - this.startedAt,
    };
  }

  /**
   * 生成纯文本的健康度报告，用于 CI Summary
   * @returns {string}
   */
  toText() {
    const summary = this.summarize();
    const lines = [
      `数据源 ${summary.ok}/${summary.total} 正常，耗时 ${(summary.elapsedMs / 1000).toFixed(1)}s`,
    ];
    for (const entry of this.entries) {
      const mark = entry.status === STATUS.OK ? "✓" : "✗";
      const detail = entry.reason ? ` (${entry.reason})` : "";
      lines.push(`  ${mark} ${entry.name}: ${entry.status}${detail}`);
    }
    return lines.join("\n");
  }
}

/**
 * 追加内容到 GitHub Actions 的 Job Summary
 * 免费、无需任何基础设施，就能在 Actions 页面留下一份可回看的历史
 * @param {string} markdown
 * @returns {boolean} 是否写入（本地运行时为 false）
 */
function appendStepSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return false;

  try {
    require("fs").appendFileSync(summaryPath, `${markdown}\n`, "utf8");
    return true;
  } catch (error) {
    console.warn(`写入 Step Summary 失败: ${error.message}`);
    return false;
  }
}

module.exports = { RunHealth, appendStepSummary, STATUS };
