/*
 * 内容脚本：命中规则时，持续把 document.title 固定成配置的文案。
 * 站点在加载 / 路由切换 / 定时器里改写标题都会被拉回目标文案。
 */
(function () {
  "use strict";

  const Matcher = globalThis.TitleRewriter;
  const Config = globalThis.TitleRewriterConfig;
  if (!Matcher || !Config) return;

  const URL_CHECK_INTERVAL = 1000;

  let rules = [];
  let activeRule = null;
  let observer = null;
  let scheduled = false;
  let lastHref = location.href;
  let timer = null;

  function desiredTitle() {
    return activeRule && activeRule.title ? activeRule.title : "";
  }

  /** 只认 head 里的 HTML <title>，避免写到页面内联 SVG 的 <title> 上。 */
  function headTitleElement() {
    const head = document.head;
    if (!head) return null;
    for (const node of head.children) {
      if (node.tagName === "TITLE") return node;
    }
    return null;
  }

  function applyTitle() {
    scheduled = false;
    const desired = desiredTitle();
    if (!desired) return;
    if (document.title === desired) return;
    const titleElement = headTitleElement();
    if (titleElement) {
      if (titleElement.textContent !== desired) titleElement.textContent = desired;
      return;
    }
    try {
      document.title = desired;
    } catch (error) {
      /* 文档尚未创建设置标题的环境时，下一次 mutation 会重试 */
    }
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(applyTitle);
  }

  function startObserver() {
    if (observer) return;
    const target = document.documentElement || document;
    observer = new MutationObserver(() => {
      const desired = desiredTitle();
      if (!desired) return;
      if (document.title !== desired) scheduleApply();
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  /** 电网址变化（SPA 路由）后重新选择规则。 */
  function refreshRule(reason) {
    lastHref = location.href;
    const url = Matcher.safeUrl(lastHref);
    activeRule = url ? Matcher.findMatchingRule(rules, url) : null;
    if (activeRule) {
      scheduleApply();
    } else if (observer && reason === "rules") {
      /* 规则被删掉后不再改写，但保留站点自己写入的标题 */
      scheduled = false;
    }
  }

  function startUrlWatch() {
    if (timer) return;
    timer = setInterval(() => {
      if (location.href !== lastHref) refreshRule("url");
    }, URL_CHECK_INTERVAL);
  }

  function boot() {
    startObserver();
    startUrlWatch();
    Config.loadRules()
      .then((loaded) => {
        rules = loaded;
        refreshRule("rules");
      })
      .catch(() => {
        /* 读取失败时保持站点原样 */
      });
  }

  Config.onRulesChanged((nextRules) => {
    rules = nextRules;
    refreshRule("rules");
  });

  /* 站点在解析早期写入标题时，observer 已就位；这里再兜底一次 */
  document.addEventListener("DOMContentLoaded", scheduleApply, { once: true });

  boot();
})();
