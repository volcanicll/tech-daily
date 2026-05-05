/**
 * Horizon Service - AI驱动的科技新闻聚合服务
 * 调用Horizon pipeline获取HN/Reddit/RSS/GitHub的AI评分精选内容
 * 复用tech-daily的LLM API配置（OpenRouter/OpenAI兼容格式）
 */

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { env } = require("../../config/env");

const HORIZON_DIR = path.resolve(__dirname, "../../vendor/horizon");
const HORIZON_PYTHON = path.join(HORIZON_DIR, ".venv/bin/python");
const HORIZON_MODULE = "src.main";
const SUMMARIES_DIR = path.join(HORIZON_DIR, "data/summaries");

class HorizonService {
  constructor() {
    this.enabled = process.env.MODULE_HORIZON !== "false";
  }

  /**
   * 运行Horizon pipeline获取科技新闻
   * @param {number} hours - 时间窗口（默认24小时）
   * @returns {Promise<{en: string, zh: string} | null>}
   */
  async fetchHorizonNews(hours = 24) {
    if (!this.enabled) {
      console.log("Horizon模块已禁用，跳过");
      return null;
    }

    // 检查AI配置
    if (!env.llm.apiKey) {
      console.warn("LLM API Key 未配置，跳过Horizon");
      return null;
    }

    try {
      console.log(`正在运行Horizon pipeline (最近${hours}小时)...`);

      // 设置环境变量，让Horizon使用tech-daily的AI配置
      const horizonEnv = {
        ...process.env,
        LLM_API_KEY: env.llm.apiKey,
        OPENAI_API_KEY: env.llm.apiKey, // Horizon的OpenAI provider用的env名
      };

      await this._runPipeline(hours, horizonEnv);

      // 读取生成的摘要
      const summaries = this._readSummaries();
      if (summaries) {
        console.log(
          `Horizon完成: 中文${summaries.zh ? "✓" : "✗"} 英文${summaries.en ? "✓" : "✗"}`
        );
      }
      return summaries;
    } catch (error) {
      console.error("Horizon pipeline执行失败:", error.message);
      return null;
    }
  }

  /**
   * 运行Horizon pipeline
   * @private
   */
  _runPipeline(hours, envVars) {
    return new Promise((resolve, reject) => {
      const args = ["-m", HORIZON_MODULE, "--hours", String(hours)];

      const child = execFile(HORIZON_PYTHON, args, {
        cwd: HORIZON_DIR,
        env: envVars,
        timeout: 300000, // 5分钟超时
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          // Horizon可能返回非零退出码但仍生成了输出
          console.warn("Horizon stderr:", stderr?.slice(-500));
          // 仍然尝试读取输出
          resolve();
          return;
        }
        if (stdout) {
          console.log("Horizon stdout:", stdout.slice(-500));
        }
        resolve();
      });

      child.on("error", (err) => {
        reject(new Error(`Horizon进程启动失败: ${err.message}`));
      });
    });
  }

  /**
   * 读取Horizon生成的摘要文件
   * @private
   * @returns {{en: string, zh: string} | null}
   */
  _readSummaries() {
    const today = new Date().toISOString().split("T")[0];

    const enFile = path.join(SUMMARIES_DIR, `horizon-${today}-en.md`);
    const zhFile = path.join(SUMMARIES_DIR, `horizon-${today}-zh.md`);

    let en = null;
    let zh = null;

    try {
      if (fs.existsSync(enFile)) {
        en = fs.readFileSync(enFile, "utf-8");
      }
    } catch (e) {
      console.warn("读取Horizon英文摘要失败:", e.message);
    }

    try {
      if (fs.existsSync(zhFile)) {
        zh = fs.readFileSync(zhFile, "utf-8");
      }
    } catch (e) {
      console.warn("读取Horizon中文摘要失败:", e.message);
    }

    if (!en && !zh) return null;
    return { en, zh };
  }

  /**
   * 解析Horizon摘要为结构化新闻列表
   * @param {string} markdown - Horizon生成的Markdown内容
   * @returns {Array<{title: string, summary: string, score: number, tags: string[], url: string}>}
   */
  parseHorizonOutput(markdown) {
    if (!markdown) return [];

    const items = [];
    // Horizon输出格式：按分数排名的items，每个有标题/摘要/标签/来源
    // 使用正则提取结构化数据
    const sections = markdown.split(/(?=##\s+\d+\.|###\s)/);

    for (const section of sections) {
      if (!section.trim()) continue;

      // 提取标题（## 或 ### 开头）
      const titleMatch = section.match(/^#{2,3}\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // 提取分数
      const scoreMatch = section.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

      // 提取标签
      const tagMatch = section.match(/(?:标签|Tags?)[:\s]*(.+)/i);
      const tags = tagMatch
        ? tagMatch[1].split(/[,，\s]+/).filter(Boolean)
        : [];

      // 提取URL
      const urlMatch = section.match(/\[([^\]]*)\]\(([^)]+)\)/);
      const url = urlMatch ? urlMatch[2] : "";

      // 提取摘要文本（去掉标题行后的第一段）
      const lines = section.split("\n").slice(1);
      const summary = lines
        .filter(
          (l) =>
            l.trim() &&
            !l.startsWith("#") &&
            !l.startsWith(">") &&
            !l.startsWith("<")
        )
        .join(" ")
        .trim()
        .slice(0, 200);

      if (title && score >= 6) {
        items.push({ title, summary, score, tags, url });
      }
    }

    return items;
  }
}

module.exports = new HorizonService();
