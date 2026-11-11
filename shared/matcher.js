/*
 * 匹配层：把用户填写的「网站」规则编译成可测试的匹配函数。
 *
 * 支持的写法：
 *   example.com            域名本身及其所有子域名
 *   *.example.com          同上
 *   example.com/notes*     /notes 开头的路径（* 表示任意字符）
 *   *                     所有网站
 *   /^https:\/\/a\.com\// 以 /.../ 包裹时按正则匹配完整网址
 */
(function () {
  "use strict";

  const compileCache = new Map();
  const CACHE_LIMIT = 200;

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function safeUrl(href) {
    try {
      return new URL(String(href));
    } catch (error) {
      return null;
    }
  }

  function stripScheme(text) {
    return text.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  }

  function stripPort(host) {
    return host.replace(/:\d+$/, "");
  }

  function isRegexPattern(text) {
    return text.length > 2 && text.startsWith("/") && text.indexOf("/", 1) > 0;
  }

  function compileRegex(text) {
    const end = text.lastIndexOf("/");
    const body = text.slice(1, end);
    const flags = text.slice(end + 1);
    try {
      const regex = new RegExp(body, flags);
      return { ok: true, kind: "regex", test: (url) => regex.test(url.href) };
    } catch (error) {
      return {
        ok: false,
        kind: "regex",
        error: "errRegexInvalid",
        errorDetail: error && error.message ? error.message : String(error),
      };
    }
  }

  function compileUrlPattern(text) {
    const rest = stripScheme(text);
    const slashAt = rest.indexOf("/");
    const rawHost = slashAt === -1 ? rest : rest.slice(0, slashAt);
    const rawPath = slashAt === -1 ? "" : rest.slice(slashAt);

    const host = stripPort(rawHost.replace(/^\*\./, "").replace(/^\./, "")).toLowerCase();
    if (!host) return { ok: false, kind: "url", error: "errMissingHost" };
    if (host.includes("*")) return { ok: false, kind: "url", error: "errHostWildcard" };

    const hostTest = (hostname) => {
      const name = String(hostname || "").toLowerCase();
      return name === host || name.endsWith("." + host);
    };

    let pathTest = null;
    if (rawPath) {
      const pieces = rawPath.split("*").map(escapeRegExp);
      const regex = new RegExp("^" + pieces.join("[^?#]*") + "$");
      pathTest = (pathname) => regex.test(pathname);
    }

    return {
      ok: true,
      kind: rawPath ? "url-with-path" : "url",
      host: host,
      path: rawPath,
      test: (url) => hostTest(url.hostname) && (!pathTest || pathTest(url.pathname)),
    };
  }

  /** 编译单条「网站」规则；失败时返回 { ok: false, error }。 */
  function compilePattern(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return { ok: false, kind: "empty", error: "errRuleEmpty" };
    if (text === "*") return { ok: true, kind: "any", test: () => true };
    if (isRegexPattern(text)) return compileRegex(text);
    return compileUrlPattern(text);
  }

  function compiled(pattern) {
    const text = String(pattern == null ? "" : pattern);
    if (compileCache.has(text)) return compileCache.get(text);
    const result = compilePattern(text);
    if (compileCache.size >= CACHE_LIMIT) compileCache.clear();
    compileCache.set(text, result);
    return result;
  }

  /** 找到第一条命中该网址的启用规则；没有命中返回 null。 */
  function findMatchingRule(rules, url) {
    if (!Array.isArray(rules) || !url) return null;
    for (const rule of rules) {
      if (!rule || rule.enabled === false) continue;
      const pattern = String(rule.pattern == null ? "" : rule.pattern).trim();
      const title = String(rule.title == null ? "" : rule.title).trim();
      if (!pattern || !title) continue;
      const result = compiled(pattern);
      if (!result.ok) continue;
      if (result.test(url)) return rule;
    }
    return null;
  }

  /** 由网址生成一条默认规则用的简洁域名（去掉 www.）。 */
  function hostRuleFromUrl(url) {
    if (!url) return "";
    const host = stripPort(String(url.hostname || "").toLowerCase());
    return host.replace(/^www\./, "");
  }

  globalThis.TitleRewriter = {
    compilePattern,
    findMatchingRule,
    hostRuleFromUrl,
    safeUrl,
  };
})();
