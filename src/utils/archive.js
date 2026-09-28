/**
 * 日报归档
 *
 * 把每天的日报落成静态文件，配合 GitHub Pages 就得到一个可搜索、可链接、
 * 永久的归档 —— 聊天消息推完就沉了，归档是能回看的资产。
 *
 * 只写文件，不管部署：是否开启由 config/daily.json 里的 `archive` 开关决定，
 * 页面托管需要在仓库设置里一次性打开 Pages（main 分支 /docs 目录）。
 */

const fs = require("fs");
const path = require("path");
const { renderPage } = require("./chatMarkdown");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCHEMA_VERSION = 1;

class ArchiveWriter {
  /**
   * @param {object} [options]
   * @param {string} [options.dir] - 归档根目录，默认 <repo>/docs
   * @param {number} [options.maxEntries] - index.json 保留的条目数
   */
  constructor(options = {}) {
    this.dir = options.dir ? path.resolve(options.dir) : path.resolve(REPO_ROOT, "docs");
    this.archiveDir = path.join(this.dir, "archive");
    this.maxEntries = options.maxEntries ?? 400;
  }

  /**
   * 归档一天的日报
   * @param {object} entry
   * @param {string} entry.date - YYYY-MM-DD
   * @param {string} entry.markdown - 日报正文
   * @param {Array} [entry.highlights] - 用于归档检索的头条
   * @param {object} [entry.health] - { ok, total }
   * @returns {{md: boolean, html: boolean, index: boolean}} 各项是否写入成功
   */
  writeDaily({ date, markdown, highlights = [], health = null }) {
    const result = { md: false, html: false, index: false };
    if (!date || !markdown) return result;

    try {
      fs.mkdirSync(this.archiveDir, { recursive: true });

      fs.writeFileSync(
        path.join(this.archiveDir, `${date}.md`),
        markdown.endsWith("\n") ? markdown : `${markdown}\n`,
        "utf8"
      );
      result.md = true;

      fs.writeFileSync(
        path.join(this.archiveDir, `${date}.html`),
        renderPage(markdown, {
          title: `日报 ${date}`,
          backHref: "../index.html",
          backLabel: "返回归档",
        }),
        "utf8"
      );
      result.html = true;

      result.index = this._updateIndex({
        date,
        // 只留标题：归档页靠它做检索，存全文会让索引膨胀
        highlights: highlights.map((item) => item.title).filter(Boolean),
        ok: health?.ok ?? null,
        total: health?.total ?? null,
      });
    } catch (error) {
      console.warn(`归档写入失败（不影响推送）: ${error.message}`);
    }

    return result;
  }

  /**
   * 读取归档索引
   * @returns {{version: number, entries: Array}}
   */
  readIndex() {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(this.archiveDir, "index.json"), "utf8")
      );
      return {
        version: parsed.version || SCHEMA_VERSION,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn(`归档索引读取失败，按空索引处理: ${error.message}`);
      }
      return { version: SCHEMA_VERSION, entries: [] };
    }
  }

  /**
   * 把当天条目并入索引，同日重跑覆盖而不是追加
   * @private
   * @returns {boolean}
   */
  _updateIndex(entry) {
    const index = this.readIndex();
    const entries = [entry, ...index.entries.filter((item) => item.date !== entry.date)]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, this.maxEntries);

    fs.writeFileSync(
      path.join(this.archiveDir, "index.json"),
      `${JSON.stringify({ version: SCHEMA_VERSION, entries }, null, 2)}\n`,
      "utf8"
    );
    return true;
  }
}

module.exports = { ArchiveWriter };
