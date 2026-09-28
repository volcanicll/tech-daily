const { describe, it, expect } = require("bun:test");
const { renderMarkdown } = require("../src/utils/chatMarkdown");

describe("renderMarkdown 块级元素", () => {
  it("标题按层级输出", () => {
    const html = renderMarkdown("# 每日播报\n\n## 加密行情\n\n### 小标题");
    expect(html).toContain("<h1>每日播报</h1>");
    expect(html).toContain("<h2>加密行情</h2>");
    expect(html).toContain("<h3>小标题</h3>");
  });

  it("分隔线渲染成 hr", () => {
    expect(renderMarkdown("a\n\n---\n\nb")).toContain("<hr>");
  });

  it("连续的引用行合并成一个 blockquote", () => {
    const html = renderMarkdown("> 第一行\n> 第二行");
    expect(html.match(/<blockquote>/g)).toHaveLength(1);
    expect(html).toContain("<p>第一行</p>");
    expect(html).toContain("<p>第二行</p>");
  });

  it("列表项渲染成 li，并在遇到其他块时闭合", () => {
    const html = renderMarkdown("- 第一条\n- 第二条\n\n## 标题");
    expect(html.match(/<li>/g)).toHaveLength(2);
    // ul 必须在 h2 之前闭合，否则会嵌套错
    expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf("<h2>"));
  });

  it("空行会闭合引用块", () => {
    const html = renderMarkdown("> 引用\n\n普通段落");
    expect(html.indexOf("</blockquote>")).toBeLessThan(html.indexOf("普通段落"));
  });
});

describe("renderMarkdown 行内元素", () => {
  it("链接转成 a 标签", () => {
    expect(renderMarkdown("[标题](https://a.com)")).toContain(
      '<a href="https://a.com"'
    );
  });

  it("加粗的链接两个都要生效 —— 扫描顺序不能互相吃掉", () => {
    const html = renderMarkdown("- **[标题](https://a.com)**");
    expect(html).toContain("<strong>");
    expect(html).toContain('href="https://a.com"');
  });

  it("URL 里的下划线不会被当成斜体标记", () => {
    const html = renderMarkdown("[题](https://a.com/question_title_slug)");

    expect(html).toContain('href="https://a.com/question_title_slug"');
    expect(html).not.toContain("<em>");
  });

  it("下划线斜体在正文里照常生效", () => {
    const html = renderMarkdown("> _主流币价格 · 恐慌贪婪指数_");
    expect(html).toContain("<em>主流币价格 · 恐慌贪婪指数</em>");
  });

  it("HTML 被转义，避免内容里的尖括号破坏页面", () => {
    const html = renderMarkdown("看 <script>alert(1)</script> 这段");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("行内代码原样保留", () => {
    expect(renderMarkdown("用 `bun run dev` 启动")).toContain(
      "<code>bun run dev</code>"
    );
  });
});
