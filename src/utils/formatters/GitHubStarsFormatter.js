const {
  sectionHeader,
  cardItem,
  formatRelativeTime,
} = require("./DingTalkMarkdownUtils");
const { EMOJI } = require("../../config/constants");

/**
 * 格式化 GitHub 新热门仓库数据
 * @param {Array} repos
 * @param {object} [options]
 * @param {Function} [options.streakOf] - 返回该仓库连续上榜天数，>=2 时标注
 * @returns {string}
 */
const formatGitHubStars = (repos, options = {}) => {
  if (!repos || repos.length === 0) return "";

  const { streakOf } = options;

  let message = sectionHeader(EMOJI.githubStars, "开源新星");
  message += "> _GitHub 新项目 · 近 7 天热门_\n\n";

  repos.forEach((repo) => {
    const relativeTime = formatRelativeTime(repo.posted_on);

    // 连续上榜比单日上榜信息量大得多：能连着挂三天，说明是真热度
    const streak = streakOf ? streakOf(repo) : 0;
    const source = streak >= 2 ? `${repo.source} · 🔥 连挂 ${streak} 天` : repo.source;

    message += cardItem(
      repo.title,
      repo.url,
      repo.description,
      source,
      relativeTime,
    );
  });

  return message;
};

module.exports = { formatGitHubStars };
