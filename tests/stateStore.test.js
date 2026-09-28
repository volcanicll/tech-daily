const { describe, it, expect, beforeEach, afterEach } = require("bun:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  StateStore,
  itemHash,
  toDateString,
} = require("../src/state/StateStore");

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "techdaily-state-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const makeStore = (today = "2026-09-28") =>
  new StateStore({ dir: tmpDir, today }).load();

describe("toDateString", () => {
  it("按北京时间归档，CI 在 UTC 1:00 跑时仍是当天", () => {
    expect(toDateString(new Date("2026-09-28T01:00:00Z"))).toBe("2026-09-28");
  });

  it("UTC 傍晚已经跨到北京时间的第二天", () => {
    expect(toDateString(new Date("2026-09-28T17:00:00Z"))).toBe("2026-09-29");
  });
});

describe("itemHash", () => {
  it("优先用 URL，标题变了也不影响判定", () => {
    const a = itemHash({ url: "https://a.com/x", title: "旧标题" });
    const b = itemHash({ url: "https://a.com/x", title: "新标题" });
    expect(a).toBe(b);
  });

  it("大小写和空白归一", () => {
    expect(itemHash({ url: "https://A.com/X" })).toBe(
      itemHash({ url: "  https://a.com/x  " })
    );
  });

  it("没有可用字段时返回 null，不产生垃圾指纹", () => {
    expect(itemHash({})).toBe(null);
    expect(itemHash(null)).toBe(null);
  });
});

describe("首次出现判定", () => {
  it("见过的条目不再算新", () => {
    const store = makeStore();
    const item = { url: "https://a.com/1", title: "x" };

    expect(store.isFirstSeen(item)).toBe(true);
    expect(store.remember([item])).toBe(1);
    expect(store.isFirstSeen(item)).toBe(false);
  });

  it("remember 幂等，重复记不会重复计数", () => {
    const store = makeStore();
    const item = { url: "https://a.com/1" };

    store.remember([item]);
    expect(store.remember([item])).toBe(0);
  });

  it("无指纹的条目被跳过而不是写进状态", () => {
    const store = makeStore();
    expect(store.remember([{}, null])).toBe(0);
    expect(store.isFirstSeen({})).toBe(false);
  });
});

describe("价格序列", () => {
  it("同一天重复运行覆盖当天数据，而不是追加出一个新点", () => {
    const store = makeStore();
    store.recordPrice("BTC", 100);
    store.recordPrice("BTC", 120);

    expect(store.prices.BTC).toEqual([["2026-09-28", 120]]);
  });

  it("跨天追加，形成时间序列", () => {
    const yesterday = makeStore("2026-09-27");
    yesterday.recordPrice("BTC", 100);
    yesterday.save();

    const store = new StateStore({ dir: tmpDir, today: "2026-09-28" });
    store.load().recordPrice("BTC", 120);

    expect(store.getSeries("BTC")).toEqual([100, 120]);
  });

  it("getSeries 只取最近 N 天", () => {
    const store = makeStore();
    store.prices.BTC = [
      ["2026-09-24", 1],
      ["2026-09-25", 2],
      ["2026-09-26", 3],
    ];

    expect(store.getSeries("BTC", 2)).toEqual([2, 3]);
  });

  it("非法价格被忽略，不会污染序列", () => {
    const store = makeStore();
    store.recordPrice("BTC", NaN);
    store.recordPrice("BTC", -1);
    store.recordPrice("", 100);

    expect(store.prices.BTC).toBe(undefined);
  });
});

describe("连续上榜", () => {
  it("从今天往前数连续天数", () => {
    const store = makeStore();
    store.trending["repo-a"] = ["2026-09-26", "2026-09-27", "2026-09-28"];
    expect(store.getStreak("repo-a")).toBe(3);
  });

  it("中间断档只算最近一段", () => {
    const store = makeStore();
    store.trending["repo-b"] = ["2026-09-25", "2026-09-27", "2026-09-28"];
    expect(store.getStreak("repo-b")).toBe(2);
  });

  it("今天没上榜就是 0，哪怕之前连着挂过", () => {
    const store = makeStore();
    store.trending["repo-c"] = ["2026-09-26", "2026-09-27"];
    expect(store.getStreak("repo-c")).toBe(0);
  });

  it("recordTrending 同一天只记一次", () => {
    const store = makeStore();
    store.recordTrending("repo-d");
    store.recordTrending("repo-d");

    expect(store.trending["repo-d"]).toEqual(["2026-09-28"]);
  });
});

describe("落盘与读取", () => {
  it("写入后能原样读回", () => {
    const store = makeStore();
    store.remember([{ url: "https://a.com/1" }]);
    store.recordPrice("BTC", 42);
    store.recordTrending("repo-a");
    expect(store.save()).toBe(true);

    const reloaded = makeStore();
    expect(reloaded.isFirstSeen({ url: "https://a.com/1" })).toBe(false);
    expect(reloaded.getSeries("BTC")).toEqual([42]);
    expect(reloaded.getStreak("repo-a")).toBe(1);
  });

  it("没有变更时不写盘", () => {
    expect(makeStore().save()).toBe(false);
  });

  it("提交进仓库的 JSON 是排序好的，diff 干净", () => {
    const store = makeStore();
    store.remember([
      { url: "https://zebra.com" },
      { url: "https://apple.com" },
    ]);
    store.save();

    const raw = fs.readFileSync(path.join(tmpDir, "seen.json"), "utf8");
    const keys = Object.keys(JSON.parse(raw).items);
    expect(keys).toEqual([...keys].sort());
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("超出保留窗口的指纹被裁掉，仓库不会无限膨胀", () => {
    const store = new StateStore({
      dir: tmpDir,
      today: "2026-09-28",
      seenRetentionDays: 30,
    });
    store.load();
    store.seen["old"] = "2026-08-01";
    store.seen["fresh"] = "2026-09-27";
    store.remember([{ url: "https://new.com" }]);
    store.save();

    const reloaded = makeStore();
    expect(reloaded.seen.old).toBe(undefined);
    expect(reloaded.seen.fresh).toBe("2026-09-27");
  });

  it("状态文件损坏时降级为空状态，而不是把日报带崩", () => {
    fs.writeFileSync(path.join(tmpDir, "seen.json"), "{ 这不是 JSON", "utf8");

    const store = makeStore();
    expect(store.seen).toEqual({});
    expect(store.isFirstSeen({ url: "https://a.com" })).toBe(true);
  });
});
