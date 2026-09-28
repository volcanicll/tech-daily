const { describe, it, expect } = require("bun:test");
const { TranslationBatcher } = require("../src/utils/translation");

/** 造一个总是失败的翻译器，用来在离线环境验证熔断 */
const failingTranslator = () => {
  throw new Error("429 Too Many Requests");
};

/** 造一个总是成功的翻译器 */
const workingTranslator = async (text) => ({ text: `[译]${text}` });

describe("翻译熔断", () => {
  it("串行时连续失败到阈值就熔断，剩余内容不再发起请求", async () => {
    let calls = 0;
    const batcher = new TranslationBatcher({
      translator: async () => {
        calls++;
        throw new Error("429 Too Many Requests");
      },
      concurrency: 1,
      delay: 0,
      failureThreshold: 3,
    });

    const items = Array.from({ length: 10 }, (_, i) => `item ${i}`);
    await batcher.translateBatch(items);

    // 熔断后直接跳过，不会每个条目都去撞一次墙
    expect(calls).toBe(3);

    const stats = batcher.getStats();
    expect(stats.circuitOpened).toBe(true);
    expect(stats.failures).toBe(3);
    expect(stats.skipped).toBe(7);
  });

  it("并行时已发出的请求拦不住，但超出量不超过一批", async () => {
    let calls = 0;
    const batcher = new TranslationBatcher({
      translator: async () => {
        calls++;
        throw new Error("429");
      },
      concurrency: 5,
      delay: 0,
      failureThreshold: 3,
    });

    await batcher.translateBatch(Array.from({ length: 20 }, (_, i) => `item ${i}`));

    // 第一批 5 个已经在途，无法撤回；后续三批全部跳过
    expect(calls).toBe(5);
    expect(batcher.getStats().skipped).toBe(15);
  });

  it("失败时保留原文，不让内容凭空消失", async () => {
    const batcher = new TranslationBatcher({
      translator: failingTranslator,
      failureThreshold: 2,
    });

    const items = ["hello", "world", "again"];
    await batcher.translateBatch(items);

    expect(items).toEqual(["hello", "world", "again"]);
  });

  it("中途恢复成功会重置计数，不会误熔断", async () => {
    let call = 0;
    const batcher = new TranslationBatcher({
      translator: async (text) => {
        call++;
        if (call % 2 === 1) throw new Error("429");
        return { text: `[译]${text}` };
      },
      failureThreshold: 3,
      concurrency: 1,
      delay: 0,
    });

    await batcher.translateBatch(["a", "b", "c", "d"]);
    expect(batcher.getStats().circuitOpened).toBe(false);
  });

  it("成功时把译文写回原来的数组", async () => {
    const batcher = new TranslationBatcher({ translator: workingTranslator });
    const items = ["hello", "world"];

    await batcher.translateBatch(items);

    expect(items).toEqual(["[译]hello", "[译]world"]);
    expect(batcher.getStats().translated).toBe(2);
    expect(batcher.getStats().circuitOpened).toBe(false);
  });

  it("指定字段的写回方式仍然生效", async () => {
    const batcher = new TranslationBatcher({ translator: workingTranslator });
    const items = [{ title: "hello" }, { title: "world" }];

    await batcher.translateBatch(
      items,
      "zh-CN",
      (item) => item.title,
      (item, translated) => {
        item.title = translated;
      }
    );

    expect(items.map((item) => item.title)).toEqual(["[译]hello", "[译]world"]);
  });

  it("中文内容不会浪费一次请求", async () => {
    let calls = 0;
    const batcher = new TranslationBatcher({
      translator: async (text) => {
        calls++;
        return { text };
      },
    });

    await batcher.translateBatch(["已经是中文了", "这个是第二条"]);

    expect(calls).toBe(0);
    expect(batcher.getStats().attempted).toBe(0);
  });
});

describe("翻译缓存", () => {
  it("同一批里的重复内容只翻译一次", async () => {
    let calls = 0;
    const batcher = new TranslationBatcher({
      translator: async (text) => {
        calls++;
        return { text: `[译]${text}` };
      },
      concurrency: 5,
    });

    const items = ["same", "same", "same"];
    await batcher.translateBatch(items);

    // 三个条目在同一批里并发，靠在途请求合并成一次
    expect(calls).toBe(1);
    expect(items).toEqual(["[译]same", "[译]same", "[译]same"]);
  });

  it("前 100 字相同的不同内容不会被当成同一条", async () => {
    const shared = "A".repeat(120);
    const batcher = new TranslationBatcher({ translator: workingTranslator });

    const items = [`${shared}first`, `${shared}second`];
    await batcher.translateBatch(items);

    expect(items[0]).toBe(`[译]${shared}first`);
    expect(items[1]).toBe(`[译]${shared}second`);
  });
});
