/**
 * 并行翻译工具
 * 优化翻译性能，支持批量并行翻译
 */

const { translate } = require("google-translate-api-x");
const { TRANSLATION_CONFIG } = require("../config/constants");

/**
 * 翻译缓存类
 */
class TranslationCache {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 生成缓存键
   * 用全文而不是前 100 字符：两条内容前 100 字相同的条目会互相覆盖，
   * 导致把 A 的译文贴到 B 上
   */
  _getKey(text, targetLang = "zh-CN") {
    return `${targetLang}:${text}`;
  }

  /**
   * 获取缓存
   */
  get(text, targetLang = "zh-CN") {
    const key = this._getKey(text, targetLang);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < TRANSLATION_CONFIG.translationTTL) {
      this.hits++;
      return cached.result;
    }

    this.misses++;
    return null;
  }

  /**
   * 设置缓存
   */
  set(text, result, targetLang = "zh-CN") {
    const key = this._getKey(text, targetLang);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + "%" : "0%",
    };
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * 批量翻译器
 */
class TranslationBatcher {
  constructor(options = {}) {
    this.concurrency = options.concurrency || TRANSLATION_CONFIG.batchSize;
    this.delay = options.delay || TRANSLATION_CONFIG.delay;
    this.cache = new TranslationCache();
    this.chineseRegex = TRANSLATION_CONFIG.chineseRegex;
    // 可注入，便于离线测试熔断行为
    this.translateFn = options.translator || translate;

    this.threshold = options.failureThreshold || TRANSLATION_CONFIG.failureThreshold;
    this.consecutiveFailures = 0;
    this.translated = 0;
    this.failures = 0;
    this.skipped = 0;
    this.circuitOpened = false;
    /** 同一批内的重复内容共用的在途请求 */
    this.inflight = new Map();
  }

  /**
   * 检查文本是否包含中文
   */
  _isChinese(text) {
    return this.chineseRegex.test(text);
  }

  /**
   * 单条翻译（内部方法）
   *
   * 失败时返回原文 —— 但连续失败到阈值就熔断，剩余内容不再尝试。
   * 翻译端点被限流时，逐个硬试只会把整轮拖慢，而且降级得无声无息。
   */
  async _translateOne(text, targetLang = "zh-CN") {
    // 检查缓存
    const cached = this.cache.get(text, targetLang);
    if (cached) {
      return cached;
    }

    // 检查是否已经是中文
    if (this._isChinese(text)) {
      this.cache.set(text, text, targetLang);
      return text;
    }

    if (this.circuitOpened) {
      this.skipped++;
      return text;
    }

    // 同一批里可能有重复内容，让它们共用一次请求
    const inflightKey = `${targetLang}:${text}`;
    const inflight = this.inflight.get(inflightKey);
    if (inflight) {
      return inflight;
    }

    const promise = this._requestTranslation(text, targetLang).finally(() => {
      this.inflight.delete(inflightKey);
    });
    this.inflight.set(inflightKey, promise);
    return promise;
  }

  /**
   * 真正发起翻译请求
   * @private
   */
  async _requestTranslation(text, targetLang) {
    try {
      const result = await this.translateFn(text, { to: targetLang });
      const translated = result?.text || text;
      this.cache.set(text, translated, targetLang);

      this.translated++;
      this.consecutiveFailures = 0;
      return translated;
    } catch (error) {
      this.failures++;
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.threshold && !this.circuitOpened) {
        this.circuitOpened = true;
        console.warn(
          `翻译连续失败 ${this.threshold} 次，本次运行剩余内容不再翻译（保留原文）: ${error.message}`
        );
      } else if (!this.circuitOpened) {
        console.warn(`Translation error: ${error.message}`);
      }

      return text; // 失败时返回原文
    }
  }

  /**
   * 本次运行的翻译统计
   * @returns {{translated: number, failures: number, skipped: number, circuitOpened: boolean, attempted: number}}
   */
  getStats() {
    return {
      translated: this.translated,
      failures: this.failures,
      skipped: this.skipped,
      circuitOpened: this.circuitOpened,
      attempted: this.translated + this.failures,
    };
  }

  /**
   * 将数组分批
   */
  _chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 延迟函数
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 批量翻译数组项
   * @param {Array} items - 需要翻译的项目数组
   * @param {string} targetLang - 目标语言，默认 "zh-CN"
   * @param {Function} getTextFn - 从 item 中获取文本的函数，默认 (item) => item
   * @param {Function} setTextFn - 设置翻译后文本的函数，默认 (item, translated) => item
   */
  async translateBatch(items, targetLang = "zh-CN", getTextFn, setTextFn) {
    if (!items || items.length === 0) {
      return items;
    }

    const getText = typeof getTextFn === "function" ? getTextFn : (item) => item;
    // 字符串数组没有字段可写，默认按下标写回 —— 原来的默认实现只是返回，
    // 译文算出来了却被丢掉，等于整批翻译白做
    const setText =
      typeof setTextFn === "function"
        ? setTextFn
        : (item, translated, index) => {
            items[index] = translated;
          };

    // 分批处理（分的是下标，这样默认写回也能定位到原数组）
    const batches = this._chunk(
      Array.from({ length: items.length }, (_, index) => index),
      this.concurrency
    );

    for (let b = 0; b < batches.length; b++) {
      // 批内并行翻译
      await Promise.all(
        batches[b].map(async (index) => {
          const text = getText(items[index]);
          if (!text) return;

          const translated = await this._translateOne(text, targetLang);
          setText(items[index], translated, index);
        })
      );

      // 批次间延迟（避免触发限流）
      if (this.delay > 0 && b < batches.length - 1) {
        await this._sleep(this.delay);
      }
    }

    return items;
  }

  /**
   * 翻译对象数组中的指定字段
   * @param {Array} items - 对象数组
   * @param {string|string[]} fields - 要翻译的字段名或字段名数组
   * @param {string} targetLang - 目标语言
   */
  async translateFields(items, fields, targetLang = "zh-CN") {
    const fieldArray = Array.isArray(fields) ? fields : [fields];

    for (const field of fieldArray) {
      await this.translateBatch(
        items,
        targetLang,
        (item) => item?.[field],
        (item, translated) => {
          if (item) {
            item[field] = translated;
          }
        }
      );
    }

    return items;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * 创建默认翻译器实例
 */
const defaultBatcher = new TranslationBatcher();

/**
 * 快捷函数：翻译文本
 */
async function translateToChinese(text) {
  return defaultBatcher._translateOne(text);
}

/**
 * 快捷函数：批量翻译
 */
async function translateBatch(items, getTextFn, setTextFn) {
  return defaultBatcher.translateBatch(items, "zh-CN", getTextFn, setTextFn);
}

/**
 * 快捷函数：翻译对象字段
 */
async function translateFields(items, fields) {
  return defaultBatcher.translateFields(items, fields, "zh-CN");
}

module.exports = {
  TranslationBatcher,
  TranslationCache,
  translateToChinese,
  translateBatch,
  translateFields,
  defaultBatcher,
};
