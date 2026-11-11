/*
 * 配置层：默认规则、规则归一化、存储读写。
 * 内容脚本、设置页、弹窗共用（通过 globalThis.TitleRewriterConfig 暴露）。
 */
(function () {
  "use strict";

  const STORAGE_KEY = "rules";

  /** 默认文案跟随界面语言；content script 里也能直接用 chrome.i18n。 */
  function defaultTitle() {
    try {
      if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage) {
        const value = chrome.i18n.getMessage("ruleTitlePlaceholder");
        if (value) return value;
      }
    } catch (error) {
      /* 忽略：退回下面的字面量 */
    }
    return "我的标题我做主";
  }

  const DEFAULT_RULES = [
    {
      id: "default-example",
      enabled: true,
      pattern: "example.com",
      title: defaultTitle(),
    },
  ];

  /** 带错误码的异常：界面层用 TitleRewriterI18n.describe(code, detail) 翻译。 */
  function codedError(code, detail) {
    const error = new Error(detail ? code + ": " + detail : code);
    error.code = code;
    error.detail = detail || "";
    return error;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId() {
    return "rule-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function safeArea(name) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage[name]) {
        return chrome.storage[name];
      }
    } catch (error) {
      /* 存储不可用时退回默认值 */
    }
    return null;
  }

  function readArea(area, key) {
    return new Promise((resolve, reject) => {
      try {
        area.get({ [key]: null }, (data) => {
          const lastError = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.lastError : null;
          if (lastError) reject(codedError("errStorageRead", lastError.message));
          else resolve(data ? data[key] : null);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function writeArea(area, payload) {
    return new Promise((resolve, reject) => {
      try {
        area.set(payload, () => {
          const lastError = typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.lastError : null;
          if (lastError) reject(codedError("errStorageWrite", lastError.message));
          else resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /** 只保留字段合法的规则；空域名或空文案的规则会被丢弃。 */
  function normalizeRules(raw) {
    if (!Array.isArray(raw)) return [];
    const rules = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const pattern = String(item.pattern == null ? "" : item.pattern).trim();
      const title = String(item.title == null ? "" : item.title).trim();
      if (!pattern || !title) continue;
      rules.push({
        id: typeof item.id === "string" && item.id ? item.id : makeId(),
        enabled: item.enabled !== false,
        pattern: pattern,
        title: title,
      });
    }
    return rules;
  }

  async function loadRules() {
    const sync = safeArea("sync");
    let raw = null;
    if (sync) {
      try {
        raw = await readArea(sync, STORAGE_KEY);
      } catch (error) {
        raw = null;
      }
    }
    if (raw === null) {
      const local = safeArea("local");
      if (local) {
        try {
          raw = await readArea(local, STORAGE_KEY);
        } catch (error) {
          raw = null;
        }
      }
    }
    if (raw === null) return clone(DEFAULT_RULES);
    return normalizeRules(raw);
  }

  async function saveRules(rules) {
    const normalized = normalizeRules(rules);
    const payload = { [STORAGE_KEY]: normalized };
    const sync = safeArea("sync");
    if (sync) {
      try {
        await writeArea(sync, payload);
        return { rules: normalized, area: "sync" };
      } catch (error) {
        /* 同步存储不可用时退回本地存储 */
      }
    }
    const local = safeArea("local");
    if (local) {
      await writeArea(local, payload);
      return { rules: normalized, area: "local" };
    }
    throw codedError("errStorageUnavailable");
  }

  function onRulesChanged(callback) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (!changes || !changes[STORAGE_KEY]) return;
          callback(normalizeRules(changes[STORAGE_KEY].newValue), areaName);
        });
        return true;
      }
    } catch (error) {
      /* 忽略：无变化监听时仍可在下一次加载时读取新配置 */
    }
    return false;
  }

  globalThis.TitleRewriterConfig = {
    STORAGE_KEY,
    DEFAULT_RULES,
    clone,
    makeId,
    normalizeRules,
    loadRules,
    saveRules,
    onRulesChanged,
  };
})();
