const HttpClient = require("../../utils/http");
const http = new HttpClient();
const cheerio = require("cheerio");
const { translateBatch } = require("../../utils/translation");
const { filterRecentItems } = require("../../utils/common");

/**
 * Reddit 技术社区 RSS 源配置
 * 扩展覆盖更多技术相关子版块
 */
const REDDIT_SOURCES = [
  // 编程与开发
  {
    name: "Reddit r/programming",
    url: "https://www.reddit.com/r/programming/.rss",
    category: "programming",
    keywords: ["programming", "coding", "developer", "software"],
  },
  {
    name: "Reddit r/webdev",
    url: "https://www.reddit.com/r/webdev/.rss",
    category: "webdev",
    keywords: ["web", "frontend", "backend", "javascript", "react", "vue"],
  },
  {
    name: "Reddit r/javascript",
    url: "https://www.reddit.com/r/javascript/.rss",
    category: "javascript",
    keywords: ["javascript", "node", "react", "vue", "typescript"],
  },
  {
    name: "Reddit r/Python",
    url: "https://www.reddit.com/r/Python/.rss",
    category: "python",
    keywords: ["python", "django", "flask", "data science", "machine learning"],
  },
  {
    name: "Reddit r/rust",
    url: "https://www.reddit.com/r/rust/.rss",
    category: "rust",
    keywords: ["rust", "systems programming", "performance"],
  },
  {
    name: "Reddit r/golang",
    url: "https://www.reddit.com/r/golang/.rss",
    category: "golang",
    keywords: ["go", "golang", "concurrency", "microservices"],
  },
  
  // AI 与机器学习
  {
    name: "Reddit r/MachineLearning",
    url: "https://www.reddit.com/r/MachineLearning/.rss",
    category: "machinelearning",
    keywords: ["machine learning", "deep learning", "neural networks", "AI"],
  },
  {
    name: "Reddit r/LocalLLaMA",
    url: "https://www.reddit.com/r/LocalLLaMA/.rss",
    category: "llm",
    keywords: ["LLM", "GPT", "Claude", "open source", "local AI"],
  },
  {
    name: "Reddit r/datascience",
    url: "https://www.reddit.com/r/datascience/.rss",
    category: "datascience",
    keywords: ["data science", "analytics", "visualization", "statistics"],
  },
  {
    name: "Reddit r/artificial",
    url: "https://www.reddit.com/r/artificial/.rss",
    category: "artificial",
    keywords: ["artificial intelligence", "AI", "automation", "robotics"],
  },
  
  // 开发工具与DevOps
  {
    name: "Reddit r/devops",
    url: "https://www.reddit.com/r/devops/.rss",
    category: "devops",
    keywords: ["devops", "cloud", "AWS", "Docker", "Kubernetes", "CI/CD"],
  },
  {
    name: "Reddit r/sysadmin",
    url: "https://www.reddit.com/r/sysadmin/.rss",
    category: "sysadmin",
    keywords: ["system administration", "Linux", "Windows", "networking"],
  },
  {
    name: "Reddit r/docker",
    url: "https://www.reddit.com/r/docker/.rss",
    category: "docker",
    keywords: ["Docker", "containers", "microservices", "deployment"],
  },
  {
    name: "Reddit r/kubernetes",
    url: "https://www.reddit.com/r/kubernetes/.rss",
    category: "kubernetes",
    keywords: ["Kubernetes", "K8s", "orchestration", "cloud native"],
  },
  
  // 新兴技术
  {
    name: "Reddit r/blockchain",
    url: "https://www.reddit.com/r/blockchain/.rss",
    category: "blockchain",
    keywords: ["blockchain", "crypto", "web3", "smart contracts"],
  },
  {
    name: "Reddit r/quantumcomputing",
    url: "https://www.reddit.com/r/quantumcomputing/.rss",
    category: "quantum",
    keywords: ["quantum computing", "qubits", "quantum algorithms"],
  },
  {
    name: "Reddit r/cybersecurity",
    url: "https://www.reddit.com/r/cybersecurity/.rss",
    category: "cybersecurity",
    keywords: ["cybersecurity", "security", "hacking", "privacy"],
  },
  {
    name: "Reddit r/singularity",
    url: "https://www.reddit.com/r/singularity/.rss",
    category: "singularity",
    keywords: ["singularity", "future tech", "transhumanism", "AI ethics"],
  },
  
  // 开源与社区
  {
    name: "Reddit r/opensource",
    url: "https://www.reddit.com/r/opensource/.rss",
    category: "opensource",
    keywords: ["open source", "FLOSS", "community", "collaboration"],
  },
  {
    name: "Reddit r/github",
    url: "https://www.reddit.com/r/github/.rss",
    category: "github",
    keywords: ["GitHub", "repositories", "code", "collaboration"],
  },
];

/**
 * Reddit API 客户端类
 */
class RedditClient {
  /**
   * 获取 Reddit RSS 内容
   * @param {string} url - RSS 源地址
   * @returns {Promise<Array>}
   */
  async fetchRSS(url) {
    const headers = {
      "User-Agent": "tech-daily/1.0 (Reddit RSS Reader)",
      Accept: "application/rss+xml,application/xml,text/xml,*/*",
    };

    const xml = await http.get(url, { headers });
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];

    $("entry").each((i, el) => {
      if (i >= 15) return false; // 限制每个源最多15条

      const $el = $(el);
      const title = $el.find("title").text().trim();
      let link = $el.find("link").attr("href");
      if (!link) link = $el.find("link").text().trim();

      // 获取内容/摘要
      let content = $el.find("content").text();
      if (!content) content = $el.find("summary").text();
      if (!content) content = $el.find("content\\:encoded").text();

      // 清理HTML
      if (content) {
        content = content.replace(/<[^>]*>?/gm, "").trim();
        content = content.replace(/\s+/g, " ");
        if (content.length > 200) {
          content = content.substring(0, 197) + "...";
        }
      }

      // 获取作者
      const author = $el.find("author name").text().trim() || "Unknown";

      // 获取发布时间
      let pubDate = $el.find("published").text().trim();
      if (!pubDate) pubDate = $el.find("updated").text().trim();

      if (title && link) {
        items.push({
          title,
          url: link,
          description: content || "",
          author,
          posted_on: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        });
      }
    });

    return items;
  }
}

/**
 * 检查标题是否包含相关关键词
 * @param {string} title - 标题
 * @param {string[]} keywords - 关键词列表
 * @returns {boolean}
 */
const matchesKeywords = (title, keywords) => {
  if (!keywords || keywords.length === 0) return true;
  const lowerTitle = title.toLowerCase();
  return keywords.some((kw) => lowerTitle.includes(kw.toLowerCase()));
};

/**
 * 获取 Reddit 热门技术讨论
 * @returns {Promise<Array>}
 */
async function getRedditNews() {
  const client = new RedditClient();
  const allNews = [];

  // 并行获取所有 Reddit 源
  const sourcePromises = REDDIT_SOURCES.map(async (source) => {
    try {
      console.log(`Fetching Reddit news from ${source.name}...`);
      const items = await client.fetchRSS(source.url);
      
      // 关键词过滤
      const filteredItems = items.filter(item => 
        matchesKeywords(item.title, source.keywords)
      ).map(item => ({
        ...item,
        source: source.name,
        category: source.category,
      }));
      
      return filteredItems;
    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error.message);
      return [];
    }
  });

  const sourceResults = await Promise.all(sourcePromises);
  sourceResults.forEach(items => allNews.push(...items));

  console.log(`Reddit: collected ${allNews.length} items from ${REDDIT_SOURCES.length} sources`);

  // 基本去重（基于URL）
  const seen = new Set();
  const uniqueNews = allNews.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // 使用并行翻译优化性能（仅翻译英文内容）
  const itemsToTranslate = uniqueNews.slice(0, 30);
  console.log(`Translating ${itemsToTranslate.length} Reddit news items...`);

  // 并行翻译标题
  await translateBatch(
    itemsToTranslate,
    (item) => item.title,
    (item, translated) => { item.title = translated; }
  );

  // 过滤只保留当天的内容
  const todayNews = filterRecentItems(itemsToTranslate);
  console.log(`Reddit: filtered to ${todayNews.length} items from today`);

  return todayNews;
}

module.exports = {
  getRedditNews,
  RedditClient,
  REDDIT_SOURCES,
};