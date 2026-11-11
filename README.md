# Tab Title Pinner

Pin the browser tab title of the sites you choose to any text you want — and keep it that way even when the site fights back.

**English** | [简体中文](README.zh-CN.md)

## Why

Some web apps cram unreadable noise into their tab titles: message counters, marketing suffixes, ever-changing page names. This extension pins the tab title of the sites you care about to a string you picked, and quietly restores it whenever the page changes it again.

## Features

- **Per-site rules** — match a domain, a subdomain, a path prefix, or the whole URL.
- **First match wins** — rules are evaluated top to bottom; each rule has its own on/off switch.
- **Sticky titles** — a `MutationObserver` puts your text back when the page rewrites the title, and a 1-second URL check handles client-side route changes.
- **Live updates** — saving a rule updates already-open tabs immediately, no reload needed.
- **Popup quick apply** — one click to rewrite the current site.
- **Rule tester** — paste a URL in the options page to see which rule would win and what the title would become.
- **Bilingual UI** — English and Simplified Chinese, following the browser UI language.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `tab-title-pinner` folder.
4. Open a page that matches a rule — for example `https://example.com`. The tab title changes. Tabs that were already open need one reload (`Ctrl+R`).

Microsoft Edge uses the same steps at `edge://extensions`.

> Keep the folder where it is. Chrome loads the code directly from that directory; moving or deleting it disables the extension.

Requirements: Chrome 102 or newer (Manifest V3, `document_start` content script, `options_ui`).

## Usage

- **Toolbar icon** — reads the current site, lets you type a title and apply it. If no rule exists yet, one is created for the site's hostname (leading `www.` removed).
- **Options page** — right-click the toolbar icon → **Options**, or `chrome://extensions` → **Details** → **Extension options**. Manage the full rule list, toggle rules on and off, test URLs, and read the syntax help.

## Rule syntax

| Rule | Matches |
| --- | --- |
| `example.com` | That domain and every subdomain (`www.example.com` included) |
| `*.example.com` | Same as above |
| `example.com/notes*` | Only paths starting with `/notes`; `*` stands for any characters |
| `*` | Every site — use with care |
| `/^https:\/\/example\.com\//` | Wrapped in `/…/`, the rule is a regular expression tested against the full URL |

Host matching ignores letter case and ports; path matching is case-sensitive.

## How it works

A content script is declared for `http` and `https` pages with `run_at: document_start`, top frame only. On load it reads your rules from storage, picks the first match for the current URL, and enforces the title with:

- a `MutationObserver` on the document (title element changes, text changes, subtree edits),
- a 1-second `location.href` poll for single-page-app route changes,
- a `chrome.storage.onChanged` listener so edits apply to open tabs instantly.

Rules are stored in `chrome.storage.sync`, with an automatic fallback to `chrome.storage.local` when sync is unavailable (for example, signed-out profiles). Nothing else is persisted.

## Permissions and privacy

| Permission | Why |
| --- | --- |
| `storage` | Save your rules (sync, falling back to local) |
| `activeTab` | Read the current tab's URL when you open the popup |

- No host permissions are requested; page access comes only from the declared `http`/`https` content script.
- No network requests, no analytics, no telemetry, no remote code. Your rules never leave the browser except through Chrome's own sync, if you have it enabled.

## Internationalization

All user-facing text lives in `_locales` and is resolved through `chrome.i18n`:

```
_locales/en/messages.json      default_locale (English)
_locales/zh_CN/messages.json   Simplified Chinese
shared/i18n.js                 lookup helpers + DOM localization
```

Pages declare what to translate with attributes — `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label` — and `data-i18n-tpl` for messages that embed `<code>` / `<strong>` fragments via `{c1}` / `{b1}` tokens. Chinese text stays in the markup as a fallback, so a missing key degrades to readable text instead of a blank label.

To add a language, copy `_locales/en/messages.json` to `_locales/<locale>/messages.json`, translate the values, keep the key set identical, then reload the extension. Message keys are also used by `shared/matcher.js` and `shared/config.js`, which return error codes rather than text, so the UI can translate them.

## Project layout

```
manifest.json            Manifest V3: storage + activeTab, content script at document_start
_locales/en/             English messages (default_locale)
_locales/zh_CN/          Simplified Chinese messages
shared/config.js         Default rule, rule normalization, storage read/write (sync → local)
shared/i18n.js           chrome.i18n lookup, data-i18n DOM localization, template rendering
shared/matcher.js        Rule compilation and URL matching, with a compile cache
content/title-guard.js   Keeps document.title pinned to the configured text
options/                 Options page: rule list, per-rule switches, URL tester, syntax help
popup/                   Toolbar popup: apply a rule to the current site
icons/                   16 / 32 / 48 / 128 px icons
README.md                This file (English)
README.zh-CN.md          Chinese README
LICENSE                  MIT
```

## Limitations

- Only `http` and `https` pages. Browser-internal pages (`chrome://`, the Web Store, other extensions) cannot be modified.
- Only the tab title is changed; page content is never touched.
- If a site rewrites its title several times within a single event-loop tick, you may see a very brief flicker before the configured text settles.
- Rules are matched by hostname and path only — query strings are ignored unless you use the `/regex/` form.

## License

MIT — see [LICENSE](LICENSE).

Issues and pull requests are welcome. If you touch the UI, keep every message key present in all locales, and keep `shared/matcher.js` returning error codes rather than translated strings.
