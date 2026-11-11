# 标签标题钉子

把你指定网站的标签标题钉成任何你想要的文字——网站自己改回去也没用。

[English](README.md) | **简体中文**

## 为什么做这个

有些网页把标签标题塞得没法看：未读消息数、营销后缀、一直在变的页面名。这个扩展把你关心的网站标签标题固定成你自己写的一句话，网站再改就立刻改回来。

## 功能

- **按站点配置规则** —— 可以匹配域名、子域名、路径前缀或完整网址。
- **从上往下第一条生效** —— 每条规则都有自己的启用开关。
- **标题钉住不放** —— 页面重写标题时由 `MutationObserver` 拉回；单页应用切路由由每秒一次的地址检查兜住。
- **保存即生效** —— 改完规则，已经打开的标签立即跟着变，不用刷新。
- **弹窗一键应用** —— 打开弹窗就能改当前网站。
- **规则测试** —— 在设置页粘贴一个网址，直接看它会被哪条规则命中、标题会变成什么。
- **中英双语界面** —— 跟随浏览器界面语言。

## 安装

1. 打开 `chrome://extensions`。
2. 右上角打开「开发者模式」。
3. 点「加载未打包的扩展程序」（Edge 叫「加载解压缩的扩展」），选择 `tab-title-pinner` 目录。
4. 打开一个能命中规则的页面，例如 `https://example.com`，标签标题就会变。已经在运行的标签需要按一次 `Ctrl+R`。

Microsoft Edge 在 `edge://extensions` 按同样步骤操作。

> 目录要保留在原位。Chrome 是直接从该目录加载代码的，移动或删除目录会让扩展失效。

要求：Chrome 102 及以上（Manifest V3、`document_start` 内容脚本、`options_ui`）。

## 使用

- **工具栏图标** —— 读取当前网站，输入文案后一键应用；如果这个网站还没有规则，会按它的域名（去掉开头的 `www.`）自动建一条。
- **设置页** —— 图标右键 →「选项」，或 `chrome://extensions` →「详情」→「扩展程序选项」。完整的规则列表、启用开关、网址测试和写法说明都在这里。

## 网站规则怎么写

| 写法 | 含义 |
| --- | --- |
| `example.com` | 该域名及其所有子域名（`www.example.com` 也命中） |
| `*.example.com` | 同上 |
| `example.com/notes*` | 只命中 `/notes` 开头的路径，`*` 代表任意字符 |
| `*` | 所有网站，谨慎使用 |
| `/^https:\/\/example\.com\//` | 用 `/…/` 包裹时，按正则表达式匹配完整网址 |

域名比较忽略大小写和端口；路径部分区分大小写。

## 工作原理

内容脚本声明在 `http` 与 `https` 页面上，`run_at: document_start`，只作用于顶层框架。加载时从存储读取规则、为当前地址选出第一条命中的规则，然后用三种手段维持标题：

- `MutationObserver` 盯住文档（`<title>` 节点替换、文本变化、子树改动），
- 每秒检查一次 `location.href`，覆盖单页应用的路由切换，
- 监听 `chrome.storage.onChanged`，让设置页的改动立刻作用到已打开的标签。

规则保存在 `chrome.storage.sync`；同步存储不可用（例如未登录浏览器账号）时自动退回 `chrome.storage.local`。除此之外不持久化任何内容。

## 权限与隐私

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存你的规则（sync，失败时回退 local） |
| `activeTab` | 打开弹窗时读取当前标签的地址 |

- 不申请任何主机权限；页面访问仅来自声明的 `http` / `https` 内容脚本。
- 没有网络请求、没有埋点、没有遥测、没有远程代码。除了你自己在 Chrome 里开启的同步之外，规则不会离开这台浏览器。

## 国际化

所有面向用户的文案都在 `_locales` 里，通过 `chrome.i18n` 解析：

```
_locales/en/messages.json      默认语言（英文）
_locales/zh_CN/messages.json   简体中文
shared/i18n.js                 取词助手 + DOM 本地化
```

页面用属性声明要翻译的内容：`data-i18n`、`data-i18n-placeholder`、`data-i18n-title`、`data-i18n-aria-label`；需要内嵌 `<code>` / `<strong>` 片段的文案用 `data-i18n-tpl`，配合 `{c1}` / `{b1}` 占位符。HTML 里保留中文原文作为兜底，缺键时降级为可读文本，而不是空白标签。

新增语言：把 `_locales/en/messages.json` 复制到 `_locales/<locale>/messages.json`，翻译其中的值，保持键集合完全一致，然后重新加载扩展。`shared/matcher.js` 与 `shared/config.js` 返回的是错误码而不是译文，界面层负责翻译，所以加语言时不需要改逻辑。

## 文件结构

```
manifest.json            MV3 清单：storage + activeTab，内容脚本在 document_start 注入
_locales/en/             英文文案（default_locale）
_locales/zh_CN/          简体中文文案
shared/config.js         默认规则、规则归一化、存储读写（sync → local）
shared/i18n.js           chrome.i18n 取词、data-i18n 本地化、模板渲染
shared/matcher.js        规则编译与 URL 匹配（带编译缓存）
content/title-guard.js   持续把 document.title 固定成目标文案
options/                 设置页：规则列表、启用开关、网址测试、写法说明
popup/                   弹窗：给当前网站快速应用规则
icons/                   16 / 32 / 48 / 128 图标
README.md                英文说明
README.zh-CN.md          本文件
LICENSE                  MIT
```

## 已知限制

- 只支持 `http` 与 `https` 页面；浏览器内部页面（`chrome://`、应用商店、其他扩展）无法修改。
- 只改标签标题，不碰页面内容。
- 如果网站在同一个事件循环里连续改写标题，可能会看到极短暂的闪烁，之后稳定为你配置的文案。
- 规则只按主机名和路径匹配；查询串不参与匹配，除非使用 `/正则/` 写法。

## 许可

MIT，见 [LICENSE](LICENSE)。

欢迎提 issue 和 PR。改界面时请保证每个文案键在所有语言包里都存在；改匹配逻辑时请继续返回错误码，而不是译文。
