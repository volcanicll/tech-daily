const { describe, it, expect } = require("bun:test");
const { interleaveBySource } = require("../src/utils/selection");
const generator = require("../src/services/DailyReportGenerator");

const make = (count, prefix) =>
  Array.from({ length: count }, (_, i) => ({ title: `${prefix}-${i}` }));

describe("interleaveBySource", () => {
  it("按来源轮流取，而不是把一个来源取空再取下一个", () => {
    const result = interleaveBySource([make(3, "a"), make(3, "b")], {
      perSourceLimit: 10,
      totalLimit: 10,
    });

    expect(result.map((item) => item.title)).toEqual([
      "a-0", "b-0", "a-1", "b-1", "a-2", "b-2",
    ]);
  });

  it("限制每个来源的贡献条数", () => {
    const result = interleaveBySource([make(50, "a"), make(50, "b")], {
      perSourceLimit: 2,
      totalLimit: 100,
    });

    expect(result).toHaveLength(4);
  });

  it("达到总量上限就停下，不会多吐", () => {
    const result = interleaveBySource([make(50, "a"), make(50, "b")], {
      perSourceLimit: 50,
      totalLimit: 7,
    });

    expect(result).toHaveLength(7);
  });

  it("只有一个来源时保持原有顺序", () => {
    const result = interleaveBySource([make(3, "a")], { totalLimit: 10 });
    expect(result.map((item) => item.title)).toEqual(["a-0", "a-1", "a-2"]);
  });

  it("空输入返回空数组", () => {
    expect(interleaveBySource([])).toEqual([]);
    expect(interleaveBySource(null)).toEqual([]);
    expect(interleaveBySource([[], []])).toEqual([]);
  });
});

describe("AI 候选列表不会丢掉靠后的来源", () => {
  it("前面的来源再多，也挤不掉 reddit / 掘金 / SegmentFault", () => {
    // 这正是修复前的状况：_newsPool 按固定顺序拼接，前两个来源就把
    // 30 条的额度用光了，后加的社区源永远进不了 AI 的视野
    const data = {
      aiNews: make(40, "ai"),
      agentCode: make(40, "agent"),
      reddit: make(5, "reddit"),
      juejin: make(5, "juejin"),
      segmentfault: make(5, "segmentfault"),
    };

    const candidates = generator._aiCandidates(data, true);
    const titles = candidates.map((item) => item.title);

    expect(candidates.length).toBeLessThanOrEqual(30);
    expect(titles.some((t) => t.startsWith("reddit"))).toBe(true);
    expect(titles.some((t) => t.startsWith("juejin"))).toBe(true);
    expect(titles.some((t) => t.startsWith("segmentfault"))).toBe(true);
  });

  it("每个来源都拿到相近的份额，而不是先到先得", () => {
    const data = {
      aiNews: make(40, "ai"),
      reddit: make(40, "reddit"),
    };

    const candidates = generator._aiCandidates(data, true);

    expect(candidates).toHaveLength(16); // perSourceLimit 8 × 2 个来源
    expect(candidates.filter((c) => c.title.startsWith("ai"))).toHaveLength(8);
    expect(candidates.filter((c) => c.title.startsWith("reddit"))).toHaveLength(8);
  });

  it("不传社区开关时保持原有范围（头条不掺社区闲聊）", () => {
    const data = {
      aiNews: make(3, "ai"),
      reddit: make(3, "reddit"),
    };

    const titles = generator._aiCandidates(data).map((item) => item.title);

    expect(titles.some((t) => t.startsWith("ai"))).toBe(true);
    expect(titles.some((t) => t.startsWith("reddit"))).toBe(false);
  });
});
