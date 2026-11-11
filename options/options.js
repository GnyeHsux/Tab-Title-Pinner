/*
 * 设置页：编辑改写规则、测试规则命中情况。
 * 所有面向用户的文案都来自 _locales，通过 TitleRewriterI18n 取。
 */
(function () {
  "use strict";

  const Config = globalThis.TitleRewriterConfig;
  const Matcher = globalThis.TitleRewriter;
  const I18n = globalThis.TitleRewriterI18n;

  const state = {
    rules: [],
    dirty: false,
  };

  const el = {};

  function init() {
    I18n.apply();

    el.rules = document.getElementById("rules");
    el.count = document.getElementById("rule-count");
    el.add = document.getElementById("add-rule");
    el.save = document.getElementById("save");
    el.status = document.getElementById("status");
    el.testUrl = document.getElementById("test-url");
    el.testRun = document.getElementById("test-run");
    el.testResult = document.getElementById("test-result");

    el.add.addEventListener("click", addRule);
    el.save.addEventListener("click", save);
    el.testRun.addEventListener("click", runTest);
    el.testUrl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runTest();
    });
    window.addEventListener("focus", reloadWhenClean);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reloadWhenClean();
    });

    Config.loadRules()
      .then((rules) => {
        state.rules = rules;
        render();
        setStatus("");
      })
      .catch((error) => {
        setStatus(errorText(error, "statusReadFailed"), "error");
      });
  }

  function reloadWhenClean() {
    if (state.dirty) return;
    Config.loadRules().then((rules) => {
      state.rules = rules;
      render();
    });
  }

  /** 错误码翻成当前语言；没有错误码时退回调用方给的兜底键。 */
  function errorText(error, fallbackKey) {
    if (error && error.code) return I18n.describe(error.code, error.detail);
    return I18n.describe(fallbackKey, error && error.message ? error.message : "");
  }

  function countText(count) {
    return I18n.message(count === 1 ? "countOne" : "countMany", [String(count)]) || String(count) + " 条";
  }

  function setStatus(text, tone) {
    el.status.textContent = text;
    if (tone) el.status.dataset.tone = tone;
    else delete el.status.dataset.tone;
  }

  function markDirty() {
    state.dirty = true;
    setStatus(I18n.message("statusDirty"), "dirty");
    el.save.disabled = false;
  }

  function render() {
    el.rules.replaceChildren();
    el.count.textContent = countText(state.rules.length);
    state.rules.forEach((rule, index) => {
      el.rules.appendChild(renderRule(rule, index));
    });
    el.save.disabled = !state.dirty;
  }

  function renderRule(rule, index) {
    const position = String(index + 1);

    const wrapper = document.createElement("div");
    wrapper.className = "rule";
    wrapper.dataset.id = rule.id;

    const main = document.createElement("div");
    main.className = "rule__main";

    const switchLabel = document.createElement("label");
    switchLabel.className = "switch";
    switchLabel.title = I18n.message("ruleSwitchTitle");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = rule.enabled !== false;
    checkbox.dataset.field = "enabled";
    checkbox.setAttribute("aria-label", I18n.message("ruleSwitchAria", [position]));
    checkbox.addEventListener("change", () => {
      rule.enabled = checkbox.checked;
      markDirty();
    });
    const track = document.createElement("span");
    track.className = "switch__track";
    switchLabel.append(checkbox, track);

    const patternInput = document.createElement("input");
    patternInput.className = "input input--mono";
    patternInput.type = "text";
    patternInput.spellcheck = false;
    patternInput.placeholder = I18n.message("rulePatternPlaceholder") || "example.com";
    patternInput.value = rule.pattern;
    patternInput.dataset.field = "pattern";
    patternInput.setAttribute("aria-label", I18n.message("rulePatternAria", [position]));
    patternInput.addEventListener("input", () => {
      rule.pattern = patternInput.value;
      clearRowError(wrapper);
      markDirty();
    });

    const titleInput = document.createElement("input");
    titleInput.className = "input";
    titleInput.type = "text";
    titleInput.spellcheck = false;
    titleInput.placeholder = I18n.message("ruleTitlePlaceholder") || "我的标题我做主";
    titleInput.value = rule.title;
    titleInput.dataset.field = "title";
    titleInput.setAttribute("aria-label", I18n.message("ruleTitleAria", [position]));
    titleInput.addEventListener("input", () => {
      rule.title = titleInput.value;
      clearRowError(wrapper);
      markDirty();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.title = I18n.message("ruleRemoveTitle");
    remove.setAttribute("aria-label", I18n.message("ruleRemoveAria", [position]));
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.rules = state.rules.filter((item) => item.id !== rule.id);
      markDirty();
      render();
    });

    main.append(switchLabel, patternInput, titleInput, remove);

    const error = document.createElement("p");
    error.className = "rule__error";
    error.hidden = true;

    wrapper.append(main, error);
    return wrapper;
  }

  function showRowError(wrapper, message) {
    wrapper.classList.add("rule--invalid");
    const error = wrapper.querySelector(".rule__error");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearRowError(wrapper) {
    wrapper.classList.remove("rule--invalid");
    const error = wrapper.querySelector(".rule__error");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  }

  function clearAllErrors() {
    for (const wrapper of el.rules.querySelectorAll(".rule")) clearRowError(wrapper);
  }

  function addRule() {
    state.rules.push({ id: Config.makeId(), enabled: true, pattern: "", title: "" });
    markDirty();
    render();
    const inputs = el.rules.querySelectorAll('[data-field="pattern"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function validate() {
    clearAllErrors();
    const seen = new Map();
    let valid = true;
    let firstInvalid = null;

    // 完全空白的新行视为放弃填写，直接移除
    state.rules = state.rules.filter((rule) => {
      const empty = !String(rule.pattern || "").trim() && !String(rule.title || "").trim();
      if (empty) {
        const node = el.rules.querySelector('.rule[data-id="' + rule.id + '"]');
        if (node) node.remove();
      }
      return !empty;
    });

    for (const rule of state.rules) {
      const wrapper = el.rules.querySelector('.rule[data-id="' + rule.id + '"]');
      const pattern = String(rule.pattern || "").trim();
      const title = String(rule.title || "").trim();

      if (!wrapper) continue;

      if (!pattern) {
        showRowError(wrapper, I18n.message("errNeedSite"));
        valid = false;
        firstInvalid = firstInvalid || wrapper.querySelector('[data-field="pattern"]');
        continue;
      }
      if (!title) {
        showRowError(wrapper, I18n.message("errNeedTitle"));
        valid = false;
        firstInvalid = firstInvalid || wrapper.querySelector('[data-field="title"]');
        continue;
      }

      const compiled = Matcher.compilePattern(pattern);
      if (!compiled.ok) {
        showRowError(wrapper, I18n.describe(compiled.error, compiled.errorDetail));
        valid = false;
        firstInvalid = firstInvalid || wrapper.querySelector('[data-field="pattern"]');
        continue;
      }

      const key = pattern.toLowerCase();
      if (seen.has(key)) {
        showRowError(wrapper, I18n.message("errDuplicate"));
        valid = false;
        firstInvalid = firstInvalid || wrapper.querySelector('[data-field="pattern"]');
        continue;
      }
      seen.set(key, true);

      rule.pattern = pattern;
      rule.title = title;
    }

    el.count.textContent = countText(state.rules.length);
    if (!valid && firstInvalid) firstInvalid.focus();
    return valid;
  }

  async function save() {
    if (!validate()) {
      setStatus(I18n.message("statusFixInvalid"), "error");
      el.save.disabled = false;
      return;
    }
    el.save.disabled = true;
    setStatus(I18n.message("statusSaving"));
    try {
      const result = await Config.saveRules(state.rules);
      state.rules = result.rules;
      state.dirty = false;
      render();
      setStatus(I18n.message(result.area === "local" ? "statusSavedLocal" : "statusSaved"), "ok");
    } catch (error) {
      el.save.disabled = false;
      setStatus(errorText(error, "statusSaveFailed"), "error");
    }
  }

  function runTest() {
    const raw = String(el.testUrl.value || "").trim();
    if (!raw) {
      el.testResult.className = "test-result";
      I18n.render(el.testResult, "testNeedUrl", { c1: "https://example.com/" });
      return;
    }
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : "https://" + raw;
    const url = Matcher.safeUrl(withScheme);
    if (!url) {
      el.testResult.className = "test-result test-result--miss";
      el.testResult.textContent = I18n.message("testBadUrl");
      return;
    }
    const rule = Matcher.findMatchingRule(state.rules, url);
    if (!rule) {
      el.testResult.className = "test-result test-result--miss";
      el.testResult.textContent = I18n.message("testMiss");
      return;
    }
    const label = url.hostname + url.pathname;
    el.testResult.className = "test-result test-result--hit";
    I18n.render(el.testResult, "testHit", { b1: rule.pattern, b2: rule.title, c1: label });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
