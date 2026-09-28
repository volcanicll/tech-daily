const { describe, it, expect } = require("bun:test");
const { parseFeedXml } = require("../src/services/tech/segmentfaultNews");
const { JuejinClient } = require("../src/services/tech/juejinNews");
const { filterRecentItems } = require("../src/utils/common");

describe("parseFeedXml 兼容 RSS 与 Atom", () => {
  // SegmentFault 现在给的是 Atom，而旧实现只认 RSS 的 <item> 和元素文本链接，
  // 结果是静默返回 0 条 —— 看起来像"源里没内容"
  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SegmentFault 最新的问题</title>
  <entry>
    <title>怎么加密打包 python 程序？</title>
    <link rel="alternate" href="https://segmentfault.com/q/1010000048320497" />
    <summary>&lt;p&gt;想问问各位技术大师&lt;/p&gt;</summary>
    <published>2026-09-27T19:49:41+08:00</published>
    <author><name>梦鸢</name><uri>https://segmentfault.com/u/x</uri></author>
    <id>https://segmentfault.com/q/1010000048320497</id>
  </entry>
</feed>`;

  const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>某个 RSS 条目</title>
    <link>https://example.com/a</link>
    <description>描述文本</description>
    <author>某人</author>
    <pubDate>Mon, 28 Sep 2026 06:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

  it("解析 Atom：链接取自 href 属性", () => {
    const items = parseFeedXml(atom);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("怎么加密打包 python 程序？");
    expect(items[0].url).toBe("https://segmentfault.com/q/1010000048320497");
  });

  it("Atom 的作者只取 name，不把 uri 拼进去", () => {
    expect(parseFeedXml(atom)[0].author).toBe("梦鸢");
  });

  it("Atom 的摘要清掉 HTML 标签", () => {
    expect(parseFeedXml(atom)[0].description).toBe("想问问各位技术大师");
  });

  it("仍然兼容 RSS", () => {
    const items = parseFeedXml(rss);

    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/a");
    expect(items[0].author).toBe("某人");
  });

  it("缺少链接的条目被丢弃，而不是产生半成品", () => {
    const broken = `<feed><entry><title>没有链接</title></entry></feed>`;
    expect(parseFeedXml(broken)).toHaveLength(0);
  });
});

describe("JuejinClient.normalize", () => {
  const client = new JuejinClient();

  // 旧接口 article_rank 已下线，推荐流的结构是 data[].item_info.*
  const feed = {
    err_no: 0,
    data: [
      {
        item_type: 2,
        item_info: {
          article_id: "7637856870833635343",
          article_info: {
            article_id: "7637856870833635343",
            title: "Cursor 转 Codex 大半个月",
            brief_content: "聊聊我的真实感受",
            ctime: "1789000000",
            digg_count: 494,
            comment_count: 213,
            view_count: 121962,
          },
          author_user_info: { user_name: "深小乐" },
          tags: [{ tag_name: "人工智能" }, { tag_name: "前端" }],
        },
      },
      // 沸点/广告没有 article_info，应当被跳过
      { item_type: 4, item_info: { article_id: "x" } },
    ],
  };

  it("映射推荐流的嵌套结构", () => {
    const items = client.normalize(feed);

    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.title).toBe("Cursor 转 Codex 大半个月");
    expect(item.url).toBe("https://juejin.cn/post/7637856870833635343");
    expect(item.author).toBe("深小乐");
    expect(item.category).toBe("人工智能");
    expect(item.digg_count).toBe(494);
    expect(item.view_count).toBe(121962);
  });

  it("非文章类型（沸点等）被过滤掉", () => {
    expect(client.normalize(feed).every((item) => item.title)).toBe(true);
  });

  it("响应结构异常时返回空数组而不是抛错", () => {
    expect(client.normalize(null)).toEqual([]);
    expect(client.normalize({ err_no: 2, err_msg: "请求路由不存在" })).toEqual([]);
  });
});

describe("filterRecentItems 滚动时间窗", () => {
  const hoursAgo = (h) =>
    new Date(Date.now() - h * 3600 * 1000).toISOString();

  it("只保留窗口内的条目", () => {
    const items = [
      { posted_on: hoursAgo(1) },
      { posted_on: hoursAgo(20) },
      { posted_on: hoursAgo(30) },
    ];

    expect(filterRecentItems(items, "posted_on", 24)).toHaveLength(2);
  });

  it("窗口与运行时刻无关 —— 这正是旧实现的问题", () => {
    // 旧实现按"本地日历今天 00:00"切，CI 在 UTC 06:00 跑时窗口只有 6 小时
    const items = [{ posted_on: hoursAgo(7) }];
    expect(filterRecentItems(items, "posted_on", 24)).toHaveLength(1);
  });

  it("未来的时间戳被排除，避免脏数据占位", () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    expect(filterRecentItems([{ posted_on: future }], "posted_on", 24)).toHaveLength(0);
  });

  it("无法解析的时间被丢弃，而不是让整批静默归零", () => {
    const items = [
      { posted_on: "not a date" },
      { posted_on: undefined },
      { posted_on: hoursAgo(2) },
    ];

    expect(filterRecentItems(items, "posted_on", 24)).toHaveLength(1);
  });

  it("支持自定义字段名", () => {
    const items = [{ pubDate: hoursAgo(1) }, { pubDate: hoursAgo(100) }];
    expect(filterRecentItems(items, "pubDate", 48)).toHaveLength(1);
  });
});
