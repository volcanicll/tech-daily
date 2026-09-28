/**
 * 把日报的 Markdown 渲染成 HTML
 *
 * 两个用途：离线预览时在浏览器里看聊天端排版；归档时生成可长期访问的页面。
 * 只覆盖本项目实际会产出的语法（标题 / 引用块 / 列表 / 分隔线 / 行内强调），
 * 不追求做成通用 Markdown 实现。
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 行内元素
 * 从左到右单次扫描，已消费的片段（尤其是链接的 URL）不会再被后续规则误伤 ——
 * 否则 URL 里的下划线会被当成斜体标记
 */
function renderInline(text) {
  // 顺序即优先级：链接 > 加粗 > 行内代码 > 斜体
  const pattern =
    /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|_([^_]+)_/;

  const parts = [];
  let rest = escapeHtml(text);
  let match;

  while ((match = pattern.exec(rest))) {
    parts.push(rest.slice(0, match.index));

    if (match[1] !== undefined) {
      parts.push(`<a href="${match[2]}" target="_blank" rel="noreferrer">${match[1]}</a>`);
    } else if (match[3] !== undefined) {
      // 递归以支持 **加粗的链接**
      parts.push(`<strong>${renderInline(match[3])}</strong>`);
    } else if (match[4] !== undefined) {
      parts.push(`<code>${match[4]}</code>`);
    } else {
      parts.push(`<em>${renderInline(match[5])}</em>`);
    }

    rest = rest.slice(match.index + match[0].length);
  }

  parts.push(rest);
  return parts.join("");
}

/**
 * 块级元素
 * @param {string} markdown
 * @returns {string} HTML 片段
 */
function renderMarkdown(markdown) {
  const lines = String(markdown || "").split("\n");
  const html = [];

  let inQuote = false;
  let inList = false;

  const closeBlocks = () => {
    if (inQuote) {
      html.push("</blockquote>");
      inQuote = false;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (!line.trim()) {
      closeBlocks();
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      closeBlocks();
      html.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith(">")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      if (!inQuote) {
        html.push("<blockquote>");
        inQuote = true;
      }
      html.push(`<p>${renderInline(line.replace(/^>\s?/, ""))}</p>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      if (inQuote) {
        html.push("</blockquote>");
        inQuote = false;
      }
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInline(listItem[1])}</li>`);
      continue;
    }

    closeBlocks();
    html.push(`<p>${renderInline(line)}</p>`);
  }

  closeBlocks();
  return html.join("\n");
}

/**
 * 包一层聊天窗口样式的页面
 * @param {string} markdown
 * @param {object} [options]
 * @param {string} [options.title] - 页面标题
 * @param {string} [options.backHref] - 返回链接（归档页用）
 * @param {string} [options.backLabel]
 * @returns {string} 完整 HTML
 */
function renderPage(markdown, options = {}) {
  const {
    title = "日报预览",
    backHref = "",
    backLabel = "返回归档",
  } = options;

  const back = backHref
    ? `<a class="back" href="${escapeHtml(backHref)}">← ${escapeHtml(backLabel)}</a>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 32px 16px;
    background: #eef1f5;
    font: 15px/1.7 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #1f2329;
  }
  .chat {
    max-width: 680px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    padding: 20px 22px 28px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, .08);
  }
  .back { display: inline-block; margin-bottom: 14px; font-size: 14px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 24px 0 10px; }
  h3 { font-size: 15px; margin: 20px 0 8px; }
  hr { border: 0; border-top: 1px solid #e5e6eb; margin: 20px 0; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 6px 0; }
  a { color: #1a6fe0; text-decoration: none; }
  a:hover { text-decoration: underline; }
  blockquote {
    margin: 4px 0;
    padding-left: 12px;
    border-left: 3px solid #d9dce1;
    color: #5c6270;
  }
  blockquote p { margin: 2px 0; }
  code {
    background: #f2f3f5;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: .92em;
  }
  em { font-style: normal; opacity: .85; }
  @media (prefers-color-scheme: dark) {
    body { background: #17181a; color: #e8eaed; }
    .chat { background: #212225; box-shadow: none; }
    hr { border-top-color: #35373b; }
    blockquote { border-left-color: #3d4045; color: #a8adb7; }
    code { background: #2c2e32; }
  }
</style>
</head>
<body>
<div class="chat">
${back}${renderMarkdown(markdown)}
</div>
</body>
</html>
`;
}

module.exports = { renderMarkdown, renderPage };
