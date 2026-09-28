/**
 * Unicode 迷你走势图
 * 把一串数值压成一行 ▁▂▃▄▅▆▇█，零依赖、零成本，
 * 用在聊天消息里比数字更能一眼看出趋势。
 */

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/**
 * 把数值序列渲染成一行走势字符
 * @param {number[]} values - 数值序列（按时间从旧到新）
 * @param {object} [options]
 * @param {number} [options.width] - 只取末尾 N 个点，0 表示全部
 * @returns {string} 走势字符串；数据点少于 2 个时返回空串（单个点画不出趋势）
 */
function sparkline(values, options = {}) {
  const { width = 0 } = options;

  let nums = (values || []).filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
  if (width > 0) {
    nums = nums.slice(-width);
  }
  if (nums.length < 2) return "";

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;

  return nums
    .map((value) => {
      // 全平的序列画一条中线，避免出现"最低点"这种误导
      if (span === 0) return BLOCKS[Math.floor((BLOCKS.length - 1) / 2)];
      const ratio = (value - min) / span;
      return BLOCKS[Math.round(ratio * (BLOCKS.length - 1))];
    })
    .join("");
}

module.exports = { sparkline, SPARKLINE_BLOCKS: BLOCKS };
