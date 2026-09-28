const { describe, it, expect } = require("bun:test");
const { sparkline } = require("../src/utils/sparkline");

describe("sparkline", () => {
  it("把序列映射到 8 档字符，最低点最短、最高点最高", () => {
    expect(sparkline([1, 2, 3])).toBe("▁▅█");
  });

  it("全平序列画中线，不谎报涨跌", () => {
    expect(sparkline([5, 5, 5])).toBe("▄▄▄");
  });

  it("少于两个点画不出趋势，返回空串", () => {
    expect(sparkline([1])).toBe("");
    expect(sparkline([])).toBe("");
    expect(sparkline(null)).toBe("");
  });

  it("忽略非数值，不让脏数据把图拉歪", () => {
    expect(sparkline([1, "x", null, undefined, NaN, 3])).toBe("▁█");
  });

  it("width 只取末尾若干个点", () => {
    expect(sparkline([1, 2, 3, 4, 5], { width: 3 })).toBe("▁▅█");
  });

  it("数值序列长度决定输出长度", () => {
    const line = sparkline([3, 1, 4, 1, 5, 9, 2, 6]);
    expect(line).toHaveLength(8);
  });
});
