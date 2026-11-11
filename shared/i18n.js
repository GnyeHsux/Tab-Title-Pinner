/*
 * 国际化层：从 _locales 取文案，并把 data-i18n* 标记套到 DOM 上。
 *
 * 与 chrome.i18n 松耦合：没有 chrome.i18n 时（Node 单测、非扩展环境）返回空串，
 * 调用方保留 HTML 里写好的默认文案，不会出现空白界面。
 *
 * 可用的 DOM 标记：
 *   data-i18n="key"                 → 设置 textContent
 *   data-i18n-placeholder="key"     → 设置 placeholder
 *   data-i18n-title="key"           → 设置 title
 *   data-i18n-aria-label="key"      → 设置 aria-label
 *   data-i18n-tpl="key"             → 按模板渲染，data-values 提供替换值（JSON）
 *
 * 模板占位符：{c1}/{c2} 渲染成 <code>，{b1}/{b2} 渲染成 <strong>。
 * 不用 $n 做局部替换，避免与 chrome.i18n 的位置参数语义混在一起。
 */
(function () {
  "use strict";

  const TOKEN = /\{([a-z])(\d+)\}/g;

  function message(key, substitutions) {
    if (!key) return "";
    try {
      if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage) {
        const value = chrome.i18n.getMessage(key, substitutions);
        if (value) return value;
      }
    } catch (error) {
      /* 忽略：退回调用方提供的默认文案 */
    }
    return "";
  }

  /** 取文案；缺键时返回 key 本身，便于在界面上一眼看出漏了哪条。 */
  function t(key, substitutions) {
    return message(key, substitutions) || String(key == null ? "" : key);
  }

  function uiLanguage() {
    try {
      if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) {
        const lang = chrome.i18n.getUILanguage();
        if (lang) return lang;
      }
    } catch (error) {
      /* 忽略 */
    }
    return "";
  }

  function setText(node, key) {
    const value = message(key);
    if (value && node.textContent !== value) node.textContent = value;
  }

  function setAttribute(node, attribute, key) {
    const value = message(key);
    if (value && node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
  }

  function parseValues(node) {
    const raw = node.getAttribute("data-values");
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  /** 按 {c1}/{b1} 模板把文案拆成文本 + <code>/<strong> 节点。 */
  function render(node, key, values) {
    const template = message(key);
    if (!node || !template) return false;
    node.replaceChildren();
    let cursor = 0;
    let match;
    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(template)) !== null) {
      if (match.index > cursor) {
        node.appendChild(document.createTextNode(template.slice(cursor, match.index)));
      }
      const name = match[1] + match[2];
      const value = values && values[name] != null ? String(values[name]) : "";
      const child = document.createElement(match[1] === "b" ? "strong" : "code");
      child.textContent = value;
      node.appendChild(child);
      cursor = match.index + match[0].length;
    }
    if (cursor < template.length) {
      node.appendChild(document.createTextNode(template.slice(cursor)));
    }
    return true;
  }

  /** 把错误码翻成当前语言的提示；带 detail 时附在破折号后面。 */
  function describe(code, detail) {
    const text = message(code) || String(code == null ? "" : code);
    if (!detail) return text;
    return text + " — " + detail;
  }

  function apply(root) {
    const scope = root || (typeof document !== "undefined" ? document : null);
    if (!scope || typeof scope.querySelectorAll !== "function") return;
    const lang = uiLanguage();
    if (lang && typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = lang;
    }
    for (const node of scope.querySelectorAll("[data-i18n]")) setText(node, node.getAttribute("data-i18n"));
    for (const node of scope.querySelectorAll("[data-i18n-placeholder]")) {
      setAttribute(node, "placeholder", node.getAttribute("data-i18n-placeholder"));
    }
    for (const node of scope.querySelectorAll("[data-i18n-title]")) {
      setAttribute(node, "title", node.getAttribute("data-i18n-title"));
    }
    for (const node of scope.querySelectorAll("[data-i18n-aria-label]")) {
      setAttribute(node, "aria-label", node.getAttribute("data-i18n-aria-label"));
    }
    for (const node of scope.querySelectorAll("[data-i18n-tpl]")) {
      render(node, node.getAttribute("data-i18n-tpl"), parseValues(node));
    }
  }

  globalThis.TitleRewriterI18n = {
    message,
    t,
    apply,
    render,
    describe,
    uiLanguage,
  };
})();
