const { describe, it, expect, beforeEach, afterEach } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ArchiveWriter } = require("../src/utils/archive");

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "techdaily-archive-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const readIndex = (writer) => writer.readIndex();

describe("写入单日归档", () => {
  it("同时落 Markdown、HTML 和索引", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });
    const written = writer.writeDaily({
      date: "2026-09-28",
      markdown: "# 每日播报\n\n## 加密行情\n\n> BTC 上涨\n",
      highlights: [{ title: "某开源模型追平闭源旗舰" }],
      health: { ok: 21, total: 24 },
    });

    expect(written).toEqual({ md: true, html: true, index: true });
    expect(fs.existsSync(path.join(tmpDir, "archive/2026-09-28.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "archive/2026-09-28.html"))).toBe(true);
  });

  it("HTML 里是渲染后的正文，并且能返回归档首页", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });
    writer.writeDaily({
      date: "2026-09-28",
      markdown: "## 加密行情\n\n> _主流币价格_\n",
    });

    const html = fs.readFileSync(
      path.join(tmpDir, "archive/2026-09-28.html"),
      "utf8"
    );

    expect(html).toContain("<h2>加密行情</h2>");
    expect(html).toContain("<em>主流币价格</em>");
    expect(html).toContain('href="../index.html"');
  });

  it("索引里存头条标题与健康度，供归档页检索", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });
    writer.writeDaily({
      date: "2026-09-28",
      markdown: "# 日报",
      highlights: [{ title: "头条一" }, { title: "头条二" }],
      health: { ok: 21, total: 24 },
    });

    const [entry] = readIndex(writer).entries;
    expect(entry.date).toBe("2026-09-28");
    expect(entry.highlights).toEqual(["头条一", "头条二"]);
    expect(entry.ok).toBe(21);
    expect(entry.total).toBe(24);
  });

  it("缺少日期或正文时不写任何文件", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });

    expect(writer.writeDaily({ date: "2026-09-28" })).toEqual({
      md: false,
      html: false,
      index: false,
    });
    expect(writer.writeDaily({ markdown: "# 日报" })).toEqual({
      md: false,
      html: false,
      index: false,
    });
  });
});

describe("索引维护", () => {
  it("同一天重跑覆盖而不是追加", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });
    writer.writeDaily({ date: "2026-09-28", markdown: "# 第一次" });
    writer.writeDaily({ date: "2026-09-28", markdown: "# 第二次" });

    const entries = readIndex(writer).entries;
    expect(entries).toHaveLength(1);

    const md = fs.readFileSync(path.join(tmpDir, "archive/2026-09-28.md"), "utf8");
    expect(md).toContain("第二次");
  });

  it("按日期倒序排列，最新的在最前", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });
    ["2026-09-26", "2026-09-28", "2026-09-27"].forEach((date) =>
      writer.writeDaily({ date, markdown: `# ${date}` })
    );

    expect(readIndex(writer).entries.map((e) => e.date)).toEqual([
      "2026-09-28",
      "2026-09-27",
      "2026-09-26",
    ]);
  });

  it("超过上限后丢弃最旧的条目", () => {
    const writer = new ArchiveWriter({ dir: tmpDir, maxEntries: 3 });
    ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].forEach((date) =>
      writer.writeDaily({ date, markdown: `# ${date}` })
    );

    const dates = readIndex(writer).entries.map((e) => e.date);
    expect(dates).toEqual(["2026-09-27", "2026-09-26", "2026-09-25"]);
  });

  it("索引损坏时从空索引重建，而不是把归档带崩", () => {
    fs.mkdirSync(path.join(tmpDir, "archive"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "archive/index.json"),
      "{ 这不是 JSON",
      "utf8"
    );

    const writer = new ArchiveWriter({ dir: tmpDir });
    const written = writer.writeDaily({ date: "2026-09-28", markdown: "# 日报" });

    expect(written.index).toBe(true);
    expect(readIndex(writer).entries).toHaveLength(1);
  });

  it("索引文件是可读的格式化 JSON，diff 干净", () => {
    const writer = new ArchiveWriter({ dir: tmpDir });
    writer.writeDaily({ date: "2026-09-28", markdown: "# 日报" });

    const raw = fs.readFileSync(path.join(tmpDir, "archive/index.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("\n  ");
  });
});
