#!/usr/bin/env bun
/**
 * 离线预览日报排版
 *
 * 拉取与渲染是分开的，渲染不碰网络也不写状态，所以这个脚本可以随便跑、
 * 跑多少次都行 —— 改排版、调顺序、试模块开关，不用等到第二天早上。
 *
 * 用法：
 *   bun run preview                          用内置样例数据
 *   bun run preview -- --from=dist/raw.json  用某次真实运行落盘的原始数据
 *   bun run preview -- --demo-state          叠加合成历史，看走势图 / 🆕 / 连挂
 *   bun run preview -- --html                额外输出聊天样式的 dist/preview.html
 *   bun run preview -- --md                  只输出 Markdown，便于管道处理
 *
 * 预览不会调用 LLM：样例数据自带一份预置结果，`--from` 则会跳过 AI 段落。
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const generator = require("../src/services/DailyReportGenerator");
const { StateStore, toDateString } = require("../src/state/StateStore");
const { RunHealth } = require("../src/utils/health");
const fixture = require("./fixture");
const { renderPage } = require("../src/utils/chatMarkdown");

const DIST_DIR = path.resolve(__dirname, "../dist");

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
  const options = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) options[match[1]] = match[2];
  }
  return { flags, options };
}

/**
 * 合成一份历史状态，用来演示依赖时间累积的效果
 * 全程只读，不落盘
 */
function buildDemoStore() {
  const store = new StateStore({
    // 不调用 save()，这个路径只是占位
    dir: path.join(os.tmpdir(), "techdaily-preview"),
    today: toDateString(),
  });
  const demo = fixture.buildDemoState(store.today);

  store.prices = demo.prices;
  store.trending = demo.trending;
  store.seen = demo.seen;
  return store;
}

function loadPayload(from) {
  if (!from) {
    return {
      data: fixture.data,
      llm: fixture.llm,
      label: "内置样例数据 (scripts/fixture.js)",
    };
  }

  const payload = JSON.parse(fs.readFileSync(from, "utf8"));
  const llm = payload.llm || {};

  return {
    data: payload.data || payload,
    // 空对象同样是"预置结果"，只是没有内容 —— 用于跳过 LLM 调用
    llm,
    label: `${from}${payload.capturedAt ? ` (抓取于 ${payload.capturedAt})` : ""}`,
  };
}

async function main() {
  const { flags, options } = parseArgs(process.argv.slice(2));
  const payload = loadPayload(options.from);

  const useDemoState = flags.has("--demo-state");
  const store = useDemoState ? buildDemoStore() : new StateStore().load();
  const health = new RunHealth();

  const message = await generator.renderDigest(
    payload.data,
    generator.stateHelpers(store),
    health,
    {
      precomputed: payload.llm,
      // 预览没有真实拉取，健康度页脚会显示成"1/1"，反而是误导
      includeHealth: false,
    }
  );

  const bytes = Buffer.byteLength(message, "utf8");

  if (flags.has("--md")) {
    process.stdout.write(`${message}\n`);
    return;
  }

  const rule = "─".repeat(64);
  console.log(rule);
  console.log(`数据来源  ${payload.label}`);
  console.log(
    `历史状态  ${
      useDemoState
        ? "合成历史（--demo-state，含 7 天价格与连挂记录）"
        : `真实 state/ 目录（只读，${Object.keys(store.prices).length} 个品种有历史）`
    }`
  );
  console.log(`篇幅      ${message.length} 字 · ${bytes} 字节`);
  console.log("提示      预览不发送、不写状态、不调用 LLM，末尾健康度页脚已省略");
  console.log(rule);
  console.log(message);
  console.log(rule);

  if (flags.has("--html")) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    const target = path.join(DIST_DIR, "preview.html");
    fs.writeFileSync(target, renderPage(message, { title: "日报预览" }), "utf8");
    console.log(`聊天样式预览已写入 ${path.relative(process.cwd(), target)}`);
  }
}

main().catch((error) => {
  console.error("预览失败:", error);
  process.exitCode = 1;
});
