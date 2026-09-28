const { describe, it, expect } = require("bun:test");
const { formatCrypto } = require("../src/utils/formatters/CryptoFormatter");
const {
  formatNewsHighlights,
} = require("../src/utils/formatters/NewsHighlightsFormatter");
const {
  formatGitHubStars,
} = require("../src/utils/formatters/GitHubStarsFormatter");
const { formatHealth } = require("../src/utils/formatters/HealthFormatter");

const marketData = [
  { symbol: "BTC", current_price: 64500, price_change_percentage_24h: 2.06 },
];

describe("formatCrypto 走势图", () => {
  it("没有历史数据时保持原样，不显示走势提示", () => {
    const message = formatCrypto({ marketData, newsData: [], sentimentData: null });

    expect(message).not.toContain("走势");
    expect(message).toContain("$64,500.00");
  });

  it("够两个点才画走势，一个点画不出趋势", () => {
    const single = formatCrypto(
      { marketData, newsData: [], sentimentData: null },
      { series: { BTC: [64000] } }
    );
    expect(single).not.toContain("走势");

    const plotted = formatCrypto(
      { marketData, newsData: [], sentimentData: null },
      { series: { BTC: [61000, 64500] } }
    );
    expect(plotted).toContain("近7日走势");
    expect(plotted).toContain("▁█");
  });

  it("数据源的币种大小写不一致也能对上历史序列", () => {
    const message = formatCrypto(
      {
        marketData: [{ ...marketData[0], symbol: "btc" }],
        newsData: [],
        sentimentData: null,
      },
      { series: { BTC: [61000, 64500] } }
    );

    expect(message).toContain("▁█");
  });
});

describe("formatNewsHighlights 🆕 标记", () => {
  const highlights = [
    { title: "新出现的事", url: "https://new.example.com", source: "TC" },
    { title: "旧闻", url: "https://old.example.com", source: "Reuters" },
  ];

  it("默认不打标记，保持向后兼容", () => {
    expect(formatNewsHighlights(highlights)).not.toContain("🆕");
  });

  it("只给首次出现的条目打标记", () => {
    const message = formatNewsHighlights(highlights, {
      isNew: (item) => item.url === "https://new.example.com",
    });

    expect(message).toContain("新出现的事 🆕");
    expect(message).not.toContain("旧闻 🆕");
  });
});

describe("formatGitHubStars 连续上榜", () => {
  const repos = [
    { title: "acme/hot ⭐ 1k", url: "https://github.com/acme/hot", source: "GitHub" },
    { title: "acme/new ⭐ 100", url: "https://github.com/acme/new", source: "GitHub" },
  ];

  it("只上榜一天不标注 —— 单日热度不算信号", () => {
    const message = formatGitHubStars(repos, { streakOf: () => 1 });
    expect(message).not.toContain("连挂");
  });

  it("连续两天以上才标注", () => {
    const message = formatGitHubStars(repos, {
      streakOf: (repo) => (repo.url.endsWith("/hot") ? 3 : 1),
    });

    expect(message).toContain("🔥 连挂 3 天");
    expect(message.match(/连挂/g)).toHaveLength(1);
  });
});

describe("formatHealth 页脚", () => {
  it("全部正常时不列降级项", () => {
    const message = formatHealth({ total: 20, ok: 20, degraded: [], elapsedMs: 3200 });

    expect(message).toContain("✅");
    expect(message).toContain("数据源 20/20 正常");
    expect(message).toContain("3.2s");
    expect(message).not.toContain("降级");
  });

  it("有降级时点出具体是哪些源", () => {
    const message = formatHealth({
      total: 20,
      ok: 18,
      degraded: [
        { name: "horizon", status: "empty" },
        { name: "reddit", status: "error" },
      ],
      elapsedMs: 4100,
    });

    expect(message).toContain("⚠️");
    expect(message).toContain("降级：horizon, reddit");
  });

  it("没有任何数据源时不产生空页脚", () => {
    expect(formatHealth({ total: 0, ok: 0, degraded: [], elapsedMs: 0 })).toBe("");
    expect(formatHealth(null)).toBe("");
  });
});
