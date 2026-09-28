/**
 * 候选内容挑选
 *
 * 数据源多起来之后，"把所有来源首尾相接再截断 N 条"会有一个隐蔽后果：
 * 排在后面的来源永远进不了候选。reddit / 掘金 / SegmentFault 这些后加的
 * 社区源就会系统性地被 AI 忽略 —— 看起来一切正常，实际上它们从没被看过。
 *
 * 按来源轮转取样可以保证每个来源都有代表，截断发生在"来源之间"而不是
 * "来源之后"。
 */

/**
 * 轮流从各个来源取样
 * @param {Array<Array>} groups - 各来源的条目数组，顺序即取样优先级
 * @param {object} [options]
 * @param {number} [options.perSourceLimit] - 每个来源最多贡献多少条
 * @param {number} [options.totalLimit] - 结果总量上限
 * @returns {Array} 交错后的候选列表
 */
function interleaveBySource(groups, options = {}) {
  const { perSourceLimit = 8, totalLimit = 30 } = options;

  const queues = (groups || [])
    .filter((group) => Array.isArray(group) && group.length > 0)
    .map((group) => group.slice(0, perSourceLimit));

  if (queues.length === 0) return [];

  const depth = Math.max(...queues.map((queue) => queue.length));
  const result = [];

  // 每一轮从每个来源各取一条
  for (let i = 0; i < depth; i++) {
    for (const queue of queues) {
      if (i >= queue.length) continue;
      result.push(queue[i]);
      if (result.length >= totalLimit) return result;
    }
  }

  return result;
}

module.exports = { interleaveBySource };
