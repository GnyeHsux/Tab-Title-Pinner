/*
 * 弹窗：给当前网站快速套用一条标题规则。
 * 所有面向用户的文案都来自 _locales，通过 TitleRewriterI18n 取。
 */
(function () {
  "use strict";

  const Config = globalThis.TitleRewriterConfig;
  const Matcher = globalThis.TitleRewriter;
  const I18n = globalThis.TitleRewriterI18n;

  const el = {};
  const state = { rules: [], url: null, rule: null };

  function setStatus(text, tone) {
    el.status.textContent = text;
    applyTone(tone);
  }

  /** 带 {c1} 占位的状态文案（需要把规则名渲染成 <code>）。 */
  function renderStatus(key, values, tone) {
    I18n.render(el.status, key, values);
    applyTone(tone);
  }

  function applyTone(tone) {
    if (tone) el.status.dataset.tone = tone;
    else delete el.status.dataset.tone;
  }

  function errorText(error, fallbackKey) {
    if (error && error.code) return I18n.describe(error.code, error.detail);
    return I18n.describe(fallbackKey, error && error.message ? error.message : "");
  }

  function showHint(text) {
    setHint(text);
  }

  function renderHint(key, values) {
    setHint("");
    I18n.render(el.hint, key, values);
    el.hint.hidden = false;
  }

  function setHint(text) {
    if (!text) {
      el.hint.hidden = true;
      el.hint.textContent = "";
      return;
    }
    el.hint.textContent = text;
    el.hint.hidden = false;
  }

  async function getActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs.length ? tabs[0] : null;
    } catch (error) {
      return null;
    }
  }

  function describeSite(url) {
    if (!url) return I18n.message("popupNoUrl");
    return url.hostname + (url.pathname && url.pathname !== "/" ? url.pathname : "");
  }

  function renderRuleState() {
    if (state.rule) {
      el.titleInput.value = state.rule.title;
      el.enableRow.hidden = false;
      el.enableToggle.checked = state.rule.enabled !== false;
      renderStatus("popupHasRule", { c1: state.rule.pattern });
    } else {
      el.titleInput.value = "";
      el.enableRow.hidden = true;
      el.enableToggle.checked = true;
      setStatus(I18n.message("popupNoRule"));
    }
  }

  async function init() {
    I18n.apply();

    el.site = document.getElementById("site");
    el.titleInput = document.getElementById("title-input");
    el.enableRow = document.getElementById("enable-row");
    el.enableToggle = document.getElementById("enable-toggle");
    el.apply = document.getElementById("apply");
    el.openOptions = document.getElementById("open-options");
    el.status = document.getElementById("status");
    el.hint = document.getElementById("hint");

    el.apply.addEventListener("click", apply);
    el.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
    el.titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") apply();
    });

    const tab = await getActiveTab();
    state.url = Matcher.safeUrl(tab && tab.url ? tab.url : "");

    if (!state.url || !/^https?:$/.test(state.url.protocol)) {
      el.site.textContent = I18n.message("popupNotWeb");
      el.apply.disabled = true;
      el.titleInput.disabled = true;
      showHint(I18n.message("popupOnlyHttp"));
      return;
    }

    el.site.textContent = describeSite(state.url);

    try {
      state.rules = await Config.loadRules();
    } catch (error) {
      setStatus(errorText(error, "statusReadFailed"), "error");
      return;
    }
    state.rule = Matcher.findMatchingRule(state.rules, state.url);
    renderRuleState();
    el.titleInput.focus();
  }

  async function apply() {
    if (!state.url) return;
    const title = String(el.titleInput.value || "").trim();
    if (!title) {
      setStatus(I18n.message("popupNeedTitle"), "error");
      el.titleInput.focus();
      return;
    }

    let nextRules;
    if (state.rule) {
      nextRules = state.rules.map((rule) =>
        rule.id === state.rule.id ? { ...rule, title: title, enabled: el.enableToggle.checked } : rule,
      );
    } else {
      const pattern = Matcher.hostRuleFromUrl(state.url);
      if (!pattern) {
        setStatus(I18n.message("popupBadSite"), "error");
        return;
      }
      const rule = { id: Config.makeId(), enabled: true, pattern: pattern, title: title };
      nextRules = state.rules.concat(rule);
      renderHint("popupNewRuleHint", { c1: pattern });
    }

    el.apply.disabled = true;
    try {
      const saved = await Config.saveRules(nextRules);
      state.rules = saved.rules;
      state.rule = Matcher.findMatchingRule(state.rules, state.url);
      renderRuleState();
      setStatus(I18n.message("popupApplied"), "ok");
    } catch (error) {
      setStatus(errorText(error, "statusSaveFailed"), "error");
    } finally {
      el.apply.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
