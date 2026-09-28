const { describe, it, expect } = require("bun:test");
const { RunHealth, STATUS } = require("../src/utils/health");

describe("RunHealth.track", () => {
  it("拿到非空数据记为 ok", async () => {
    const health = new RunHealth();
    const result = await health.track("aiNews", async () => [{ title: "x" }], {
      fallback: [],
    });

    expect(result).toHaveLength(1);
    expect(health.summarize().ok).toBe(1);
    expect(health.summarize().degraded).toEqual([]);
  });

  it("抛错时返回兜底值并记为 error", async () => {
    const health = new RunHealth();
    const result = await health.track(
      "reddit",
      async () => {
        throw new Error("boom");
      },
      { fallback: [] }
    );

    expect(result).toEqual([]);

    const { degraded, ok } = health.summarize();
    expect(ok).toBe(0);
    expect(degraded[0].name).toBe("reddit");
    expect(degraded[0].status).toBe(STATUS.ERROR);
    expect(degraded[0].reason).toBe("boom");
  });

  it("没抛错但返回空数组记为 empty —— 这是最容易漏掉的静默降级", async () => {
    const health = new RunHealth();
    await health.track("horizon", async () => [], { fallback: [] });

    const { degraded, ok } = health.summarize();
    expect(ok).toBe(0);
    expect(degraded[0].status).toBe(STATUS.EMPTY);
  });

  it("支持自定义判定，比如金价看的是字段而不是数组长度", async () => {
    const health = new RunHealth();
    await health.track("gold", async () => ({ ny_gold: { price: 2600 } }), {
      fallback: null,
      isOk: (data) => Boolean(data?.ny_gold),
    });

    expect(health.summarize().ok).toBe(1);
  });
});

describe("RunHealth 汇总", () => {
  it("total / ok / degraded 三者自洽", async () => {
    const health = new RunHealth();
    await health.track("a", async () => [1], {});
    await health.track("b", async () => [], {});
    await health.track("c", async () => {
      throw new Error("x");
    }, {});

    const summary = health.summarize();
    expect(summary.total).toBe(3);
    expect(summary.ok).toBe(1);
    expect(summary.degraded.map((entry) => entry.name)).toEqual(["b", "c"]);
  });

  it("recordStep 用于登记 LLM 这类非拉取步骤", () => {
    const health = new RunHealth();
    health.recordStep("llmCommentary", false);

    const summary = health.summarize();
    expect(summary.ok).toBe(0);
    expect(summary.degraded[0].name).toBe("llmCommentary");
  });

  it("toText 输出每一条的明细，便于排查", async () => {
    const health = new RunHealth();
    await health.track("aiNews", async () => [1], {});
    await health.track("reddit", async () => {
      throw new Error("超时");
    }, {});

    const text = health.toText();
    expect(text).toContain("数据源 1/2 正常");
    expect(text).toContain("✓ aiNews: ok");
    expect(text).toContain("✗ reddit: error (超时)");
  });

  it("没有记录任何条目时 total 为 0", () => {
    expect(new RunHealth().summarize().total).toBe(0);
  });
});
