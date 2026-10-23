# dsh-composer-assist 仓库审计笔记（供 Lead 撰写议题文档）

> 注：为提交到公开仓库，本文把审查机器的本地路径替换为占位符：`<DSH_INSTALL_DIR>` = DSH 运行时安装目录，`<DSH_REPO_CHECKOUT>` = deepseek-harness 仓库检出，`<PLUGIN_CHECKOUT>` = dsh-composer-assist 仓库检出，`<REVIEW_DIR>` = 审查材料目录。行号与结论不受影响。
> 审计对象：`https://github.com/Lphehe/dsh-composer-assist`，本地 clone `<PLUGIN_CHECKOUT>`
> 审计时 HEAD：`b626b670ac23c729ef564e7401cd44ae2ad4df6e`（tag `v0.1.1`，main）
> 审计方法：通读 `client.js`(1392 行)/`index.js`(707 行)/`selfcheck.mjs`(317 行)/`README.md`(136 行) 全文；`git log/show/diff`；`node --check`；Node 脚本统计函数长度/嵌套深度/i18n 键；下载 release 资产做逐文件 diff；把截图复制到 `/tmp` 转 `.jpg` 后用图像读取核对（仓库内文件未改，`git status --porcelain` 为空）；执行 `node selfcheck.mjs`（纯 mock，未安装/未运行插件，未触碰用户 DSH 配置），结果通过（exit 0）。
> **行号约定**：`file:line` 均为审计时 HEAD 的行号；commit 证据用短 hash。无法在仓库内验证的一律标「未验证」。

---

## 0. 仓库事实卡

| 项目 | 实际值 | 证据 |
|---|---|---|
| 仓库名 / 版本 | `dsh-composer-assist` / `0.1.1` | `package.json:2-3` |
| 提交数 | 11（单分支 `main`，无合并提交） | `git rev-list --count HEAD` |
| tag / release | 仅 `v0.1.1`（annotated，2026-10-24 00:36:17 +0800，tagger `Lphehe`），无 `v0.1.0` tag/release | `git tag -l`、`git for-each-ref` |
| tag 与 HEAD 一致性 | `v0.1.1` == `b626b67`，`git diff v0.1.1 HEAD` 为空 | `git rev-parse`、`git diff --stat` |
| last commit 时间 | `2026-10-24 00:36:17 +0800`（`b626b67 release: v0.1.1 license and packaged distribution`） | `git log -1` |
| 首次提交 | `2026-10-22 18:20:37 +0800`（`264e4f4`） | `git log` |
| 作者 | `lphehe-bot` 2 个提交（`264e4f4`、`4341710`），`Lphehe <<author-local-email>>` 9 个提交 | `git log --format` |
| license | 自定义「源码可见、禁止修改」中文许可，非 OSI；`package.json` 为 `SEE LICENSE IN LICENSE` | `LICENSE:1-15`、`package.json:6`、`README.md:132-136` |
| 构建/依赖 | 无构建、零 npm 依赖（host 侧仅 node 内置模块；client 侧 `require('react')` 由宿主提供）；无 lockfile | `index.js:9-10`、`client.js:10`、`git ls-files` |
| CI / 测试入口 | 无 `.github`、无 CI、无 `scripts`；唯一测试是手跑 `node selfcheck.mjs` | 仓库根目录、`package.json:1-44`、`README.md:127-130` |
| release 资产 | URL 存在（HTTP 302→200，下载 37,793 B），内容与 HEAD 逐文件一致：LICENSE/client.js/index.js/locale/en.json/locale/zh.json/package.json/README.md/icon.svg/cordis.patch.yml；**不含 screenshots/ 与 selfcheck.mjs** | 下载核对（见 §B.4、§C.3） |
| 截图格式 | `screenshots/composer-bar.png` 实为 JPEG 1434×416、51,915 B；`screenshots/settings.png` 实为 JPEG 1628×1612、172,695 B（扩展名与字节格式不符） | `file screenshots/*.png` |
| 模块规模 | `client.js` 1392 行/67,616 B；`index.js` 707 行/34,104 B；`selfcheck.mjs` 317 行/19,007 B；`README.md` 136 行/12,762 B；`package.json` 44 行/1,186 B；`LICENSE` 15 行/886 B；`locale/en.json` 6 行；`locale/zh.json` 6 行；`icon.svg` 7 行/651 B | `wc -l -c` |
| 文件表（tracked） | `.gitignore`、`LICENSE`、`README.md`、`client.js`、`cordis.patch.yml`、`icon.svg`、`index.js`、`locale/{en,zh}.json`、`package.json`、`screenshots/{composer-bar,settings}.png`、`selfcheck.mjs`（共 13 个） | `git ls-files` |
| 关键结构统计 | 最长函数 `SuggestionStrip` 356 行（`client.js:671-1026`）、`SettingsSection` 174 行（`client.js:1144-1317`）、host `apply` 198 行（`index.js:507-704`）；最深处花括号嵌套 8 层（`client.js:872`、`index.js:673`）；模块级可变状态 24 处（§A.5）；i18n 中文/英文各 58 键、无缺键 | Node 统计脚本、`grep` |

**结论先行**：代码纪律总体高于同类 hobby 插件（注释解释“为什么”、失败软降级、自检覆盖真实代码路径、release 资产与源码一致），但存在 3 类硬伤：**① 静默失效路径多且用户不可见；② 生产环境残留调试探针并在每次 React render 时发网络请求（含草稿文本）；③ 工程设施/文档/版本契约缺失，导致“看起来发布完整、实际无法协作与升级”。** 下文按 A/B/C 展开，每条给可复核行号。

---

## A. 工程化 / 可读性

### A.1 职能与 section 划分（先给全图，便于后续定位）

**client.js（浏览器半边，1392 行）**：一个大 `factory` 闭包内按功能段落平铺，无文件级 section 横幅，但 `/** */` 注释 41 处可当锚点：

| 段 | 行范围 | 内容 |
|---|---|---|
| 头注释 | 1-6 | 声明「strip + polish 按钮 + **two General settings rows**」——已过期（现为 `settings.section` 整页，见 A-14） |
| locale 字典 | 17-136 | zh 58 键 + en 58 键，与 DSH locale 机制配合 |
| settings store / HTTP | 138-244 | `settingsStore`、`readSettings/saveSettings`、`withTimeout`、`request`、`recordFeedback` |
| 行内 ghost / DOM | 246-420 | 样式注入、`[data-composer-*]` 查询、ghost span、`--dsh-composer-hint`、探针上报、清理 |
| 预测通道 / 会话存储 | 422-668 | `manualRequest` 跨 slot 通道、`runRequest`、sessionStorage v2 恢复、request id、`sourceMatches`、候选/建议 Map |
| SuggestionStrip | 671-1026 | 建议栏组件（含自动轮询、词补全、键盘、accept、描边测量） |
| PredictButton / PolishButton | 1028-1141 | 工具行两个按钮 |
| SettingsSection | 1143-1317 | 设置左栏整页 |
| 插件注册 | 1319-1389 | `inject`、locale、5 个 slot、Tab 快捷键 |

**index.js（Host 半边，707 行）**：

| 段 | 行范围 | 内容 |
|---|---|---|
| 路由常量 + 模块级状态 | 12-55 | 5 条 `/api/composer-assist/*` 路径、probe/align/transcript 缓存、turn 记账 Map |
| settings 持久化 | 57-175 | `DEFAULTS`、`statsOf`、`readSettings`、`writeSettings`、`withSettings` 串行队列 |
| transcript 组装 | 177-246 | `messageText`、`clipText`、字符预算分配 |
| source 边界 | 248-251 | `sourceOf(session)`（依赖 `session.surface.*` 私有字段） |
| 工作区上下文 | 253-328 | `within`、`gitStatus`、`workspaceContext` |
| 路由解析 / 文本清洗 | 330-368 | `resolveRoute`、`clean`、`abortable` |
| 辅助模型调用 | 370-417 | `runningCalls`、`generate`、`runAuxiliary`（low reasoning） |
| 解析 / 学习 | 419-487 | `parseCandidates`、`buildPrompt`、`learnHint` |
| 请求/响应工具 | 489-501 | `readJson`、`json` |
| **apply 巨型函数** | 503-704 | 5 条 fetch 路由 + 1 个 `agent/turn-stopping` 监听，全部内联闭包 |
| 测试导出 | 706-707 | `__test`（18 个内部符号） |

### A.2 函数规模（最长函数、热点）

| 文件 | 函数/组件 | 行范围 | 行数 | 备注 |
|---|---|---|---|---|
| client.js | `SuggestionStrip` | 671-1026 | **356** | 一个组件内混了 **11 个 useEffect**（697/708/728/778/819/845/851/861/891/930/939）+ 渲染 + 内联样式；自动轮询、词补全、accept、键盘、ghost 全在一处 |
| client.js | `SettingsSection` | 1144-1317 | **174** | 9 行设置项的 h() 树 + 网络 + 校验 + 错误处理 |
| client.js | `PredictButton` | 1029-1088 | 60 | 含 1000ms 轮询补偿（1041）、3000ms 假 busy 兜底（1057）——注释自认是 workaround |
| client.js | `PolishButton` | 1091-1141 | 51 | |
| client.js | `reportProbe` | 358-395 | 38 | 读 DOM + `fetch` POST 副作用 |
| client.js | `request` | 195-228 | 34 | 网络 + 协议校验 + 超时 |
| client.js | `restoreSessionState` | 468-494 | 27 | 存储格式校验（旧格式静默丢弃） |
| index.js | `apply` | 507-704 | **198** | 5 条路由全内联；单条 suggest 路由 handler 即 612-702（91 行） |
| index.js | `transcript` | 193-246 | 54 | 预算分配 magic 比例多（见 A.6） |
| index.js | `workspaceContext` | 300-328 | 29 | |
| index.js | `parseCandidates` | 427-452 | 26 | |
| index.js | `writeSettings` | 151-175 | 25 | 无范围校验（见 A-02） |

**最深处嵌套**：`client.js:872`（`client.js:863-885` accept 的 async IIFE 内 `if` 套 await/try，花括号 8 层）；`index.js:673`（suggest 路由 try→`abortable`→callback→`workspaceContext({...})` 对象字面量，8 层）。两处都在“一个函数干完所有事”的地方，属于可读性热点。

### A.3 职责边界：Host（index.js）与 Client（client.js）是否分离

- **大体分离**：模型调用、transcript 组装、settings 持久化、工作区扫描、turn 记账在 Host；React/slot/DOM/i18n/键盘在 Client。这是符合 DSH 插件规范的（Host `apply(ctx)` + Client `window.__ModuleLoader__` 两个入口，`package.json:21-34`）。
- **client.js 内混入网络与业务规则**：`fetch` 调用 8 处（154、169、200、237、390、516、787、796），且重复实现 Host 已实现的约束：
  - deadline：client `195-198` 与 host `666`；
  - stale-source：host `627-634` 校验 + client `209-219`、`514-521` 再校验；
  - 候选条数上限 3：host `439`、client `222`/`483`；
  - confidence 归一化：host `166`/`435`/`687`、client `225`/`486`；
  - 超时默认 20000、debounce 600：host `DEFAULTS` `60-86`、client `198`/`825`。
- **Host 侧也混入展示/调试关注点**：probe 路由 `index.js:593-610` 就是浏览器 DOM 量测的接收端，属于“开发工具”而不是产品功能，却被正式编进 Host 路由表（见 A-09/C-08）。
- **结论**：边界方向正确，但**契约没有单一来源**：同一不变量在两侧各写一遍，靠注释维持一致；没有 types/contract 文档（见 B-12）。严重度：中。

### A.4 全局可变模块级状态清单（24 处）

**client.js（13）**：`settingsStore`(139-150，含 `listeners` Set)、`manualRequest`(426-432)、`listeners`(435，与 manualRequest 订阅混用)、`ownedHints`(312)、`acceptRef`(637)、`instanceSeq`(551)、`sessionState`(495-496，挂在 `window[Symbol.for(...)]` 上，跨插件重载存活)、`requestSeqBySession`(497)、`draftBySession`(498)、`suggestionBySession`(541)、`candidateIndexBySession`(548)、`pendingBySession`(554)、`storeListeners`(563)。
**index.js（11）**：`lastProbe`(24)、`lastAlign`(27)、`lastTranscript`(30)、`probes`(33)、`finishedTurns`(41)、`predictingIn`(48)、`deliveredTurns`(55)、`settingsQueue`(114)、`runningCalls`(371)，以及 `apply` 作用域内 `inflight`(510)、`latestRequests`(511)。

问题：
- `finishedTurns`/`deliveredTurns`/`predictingIn` **无上限、无清理**（只在消费/结束时 delete 部分 key；`deliveredTurns` 只 set 不 delete，见 `571`/`586`）——长寿命 Host 进程按会话数线性增长。严重度：低。
- `sessionState` 挂在 `window` 上，插件卸载时没有清空 `requests/pending/listeners`；`restoreSessionState` 只在 window 符号不存在时执行（`496`），所以“重载插件”沿用旧内存态，形成隐式生命周期。可接受但需文档。
- `settingsStore.error`(157/163) **写了但全仓库无读取点**（`grep settingsStore.error` 只有赋值两行）——注释 `161-162` 说 “Keep the reason so a surface can say it out loud”，实际没有 surface，属于死诊断（见 A-07/C-09）。

### A.5 magic number（超时/上限/重试/并发）

**命名常量只有指数级少数**：`index.js:100` `MAX_TRANSCRIPT_MESSAGES=12`、`103-104` `STAT_MAX_*`、`107` `MAX_FEEDBACK_CHARS=4000`、`264-266` `MAX_SCAN_ENTRIES/MAX_GIT_BYTES/CONTEXT_TIMEOUT_MS`；client 只有 `GHOST_CLASS/GHOST_STYLE_ID`（`248-249`）。其余全部内联：

| 位置 | 值 | 含义 | 问题 |
|---|---|---|---|
| `client.js:198` | `20000`、`2000/120000` | timeout 默认/夹取 | 与 `index.js:76` 重复 |
| `client.js:227` | `deadline + 1000` | 浏览器兜底 | |
| `client.js:476` | `slice(-8)` | 恢复条目上限 | 与 `593` 的 8 重复 |
| `client.js:520` | `5000` | 来源校验超时 | README 101 描述与之不完全一致 |
| `client.js:527` | `32` | 每会话 request 序号上限 | 有驱逐 bug（A-11） |
| `client.js:593` | `8` | 建议缓存会话数 | |
| `client.js:740` | `5000` | 缓存来源复核间隔 | |
| `client.js:807/811/812` | `1000` / `900,2200` / `5000` | turn 轮询节奏 | 4 个魔数、无注释来源 |
| `client.js:825` | `600` | debounce 默认 | 与 `index.js:77` 重复 |
| `client.js:856` | `60` | 对齐测量延迟 | |
| `client.js:1041` | `1000` | 按钮补偿轮询 | workaround |
| `client.js:1057` | `3000` | 假 busy 兜底 | 注释自认 floor |
| `client.js:1290-1310` | `100-4000` 等 5 组 | 设置项 UI 范围 | 与 Host 无效验冲突（A-02） |
| `index.js:187` | `0.6` | 截断头占比 | |
| `index.js:215` | `MAX_TRANSCRIPT_MESSAGES / 2` | 6 组 | |
| `index.js:218` | `-4` | 工具证据条数 | README 写“最多四条” |
| `index.js:230-243` | `0.2/0.25/0.5/24/8/1200` | transcript 预算分配 | 无注释、不可解释 |
| `index.js:286` | `1000` | git graceMs | |
| `index.js:301/321` | `8` / `20` | 文件名/git 行上限 | README 87 宣称的 200/8/20 只在 `264/301/321` |
| `index.js:476` | `5` | 学习最小样本 | |
| `index.js:480/483` | `0.7/1.4` | 学习长短偏好阈值 | |
| `index.js:492` | `200_000` | 请求体上限 | |
| `index.js:603` | `40` | probe 环形缓冲 | 调试残留 |

严重度：中（可维护性；其中 A-02 因 magic 0 值会变成 bug）。

### A.6 错误处理一致性

- **空 catch / 全吞** 9 处：`client.js:492,577,737,801,882,1061`、`index.js:297,605,675`；无一打日志（全仓库运行时代码**零** `console.*`，只在 `selfcheck.mjs:317` 有一行成功输出）。
- **HTTP 错误语义不一致**：settings/feedback 路由失败回 `400 {ok:false}`（`index.js:525,556`），suggest 路由内部错误回 `200 {ok:false}`（`index.js:695`）；客户端 `request` 把两者都当 throw（`client.js:208`），随后被 `runRequest` 的 `.catch(() => null)` 吞掉（`client.js:456`）。
- **用户可见错误通道是死的**：`SuggestionStrip` 的 `failed` state 只在 `682` 初始化、`724/754/761` 被置 false，**该组件内没有任何 `setFailed(true)`**（`client.js:1115` 的 `setFailed(true)` 属于 `PolishButton` 自己的独立 state，`1100`），所以 `strip.failed`（“生成失败”，`client.js:31/91`）与 `failed` 分支（`951-954`）永远不可达；`settingsStore.error` 同样无人读（A.4）。结果是：模型路由缺失（`index.js:376`）、5xx、网络失败、解析失败全部表现为“点了没反应”。
- **静默降级**：工作区上下文、transcript、gitStatus 全部 best-effort 返回 `''`（`index.js:294,325,675`），符合设计意图，但与“静默失败不可见”叠加后，用户无法区分“没有上下文”与“功能坏了”。
- 严重度：**高**（符合 README “静默丢弃不打扰输入”的意图，但把“失败”也一起静默了）。

### A.7 重复块（同一段逻辑在 client.js 与 index.js 各写一遍）

| 逻辑 | client.js | index.js | 风险 |
|---|---|---|---|
| “Promise 超时竞速” | `withTimeout` 179-194 | `within` 269-276 + `abortable` 354-368（两套） | 三份实现，语义略有差异 |
| 候选归一化/截断 3 条 | 221-225 | 439-449（parseCandidates） | 解析规则与客户端清洗漂移 |
| confidence 夹取 [0,1] | 225、486 | 166、435、687 | 4 份校验 |
| 默认超时/debounce/上限 | 198、825（还有 520、1057） | 60-86 | 改默认值容易漏 |
| 模式/显示枚举 | 1252-1256（auto/word/both/off）、1257-1265（bar/inline） | 158（off 合法值）、161（还含 legacy `card`） | 两侧枚举不一致即 bug |
| source 绑定 | 514-521（重新请求校验） | 249-251/631-634 | 同一概念两套实现 |

另有 client 内部重复：`reportProbe`(358-395) 与 `measureAlignment`(343-357) 都量 DOM；`stripStyle` 与 inline 覆盖样式（974-978）同一组件双形态；`number()`（1197-1205）五处重复调用。
严重度：中（建议把“协议常量/枚举/默认值”抽成文档或可共享的 JSON 契约，Client 用 fetch 读或打包时生成；注意 DSH client 半边是单文件 `__ModuleLoader__` 加载，能否多文件/引用未验证）。

### A.8 i18n（locale/*.json vs 代码内联字符串）

- 代码内联 `zh`/`en` 字典：`client.js:17-76` / `77-136`，各 **58 键，键集完全一致**（脚本校验无缺键）；`locale/en.json`、`locale/zh.json` 只有 `meta.title/description`（各 6 行，`locale/en.json:1-6`、`locale/zh.json:1-6`），符合 DSH 0.2.1 “展示元数据 + 运行时字典”的分工（`package.json:10-11` 导出 `./locale/*.json`）。
- **Host 侧错误文案硬编码中文**：`index.js:376`（没有可用的模型路由…）、`492`（请求过大）、`494`（请求格式不正确）、`543`（action 必须是…）、`625`（会话不存在或未加载）——英文用户也只会看到中文（如果这些错误能显示的话，实际上被吞，见 A.6）。
- **死键**：`strip.failed` 不可达（A.6）；`settings.catalogFailed` 用字符串拼接而非插值（`client.js:1170`），翻译者拿不到占位符。
- 未发现 `locale/*.json` 缺键或中英不同步（这点比多数插件好）；但“UI 文案全在 client.js 里”意味着**无法通过 locale 包/翻译文件更新文案**，只能改代码。
- 严重度：中。

### A.9 工程设施（package.json / CI / 锁文件 / 打包 / license）

**package.json 实情（`package.json:1-44`）**：

| 字段 | 实际 | 影响 |
|---|---|---|
| `scripts` | **无**（无 test/lint/build/dev） | 无 `npm test`，README 只能写 `node selfcheck.mjs` |
| `devDependencies` / `peerDependencies` | **都没有** | 无 `@deepseek-ai/*` 依赖（代码确实不 import，符合规范）；但也因此没有任何版本约束机制 |
| `engines` / `engines.dsh` | **缺失** | DSH 0.2.1 起 `engines.dsh` 存在即强制生效；不写 = 不设任何兼容上限，未来 DSH 破坏性变更时**无警告加载**。建议至少声明 `engines.dsh` 覆盖实测过的版本（本机 `dsh --version` = `0.2.1-rc.2`） |
| `dsh.bundle` / `dsh.client` | 有（`21-34`）；`client.platform=web`、`immediately=true`、inject 三个 `@deepseek-ai/dsh-client-ui-*` | 结构合规；`inject` 里 `-settings-general` 是设置页 shell（`settings.section` 槽的提供方），经 0.2.1 安装包核对**不是**残留（曾疑为旧 General 行残留，已排除） |
| `exports` | `.`/`./client`/`./locale/*.json`/`./icon`/`./package.json` | 合规（0.2.1 要求 `exports` 时显式导出 `./package.json` 与 locale；已做） |
| `icon` | 仅 `exports["./icon"]`，无顶层 `icon` 字段 | 0.2.1 支持回退，可用；0.2.0-rc.2 只支持顶层 `icon`（若还想兼容旧版则缺图标，未验证目标人群） |
| `files` | index.js/client.js/cordis.patch.yml/locale/*.json/icon.svg | 与仓库实际差 `screenshots/`、`selfcheck.mjs`、`README`/`LICENSE`（npm 自动带 README/LICENSE）；实测 release tgz 里**没有 screenshots** → 包内 README 的两张图 404；也没有 selfcheck.mjs → README 的“克隆后自检”在安装包里不可用（README 语境是 clone，勉强自洽） |
| license | `SEE LICENSE IN LICENSE`（非 SPDX） | GitHub/npm 无法归类；npm 会视为无效 SPDX 值；“source-available 禁止修改”与 `CONTRIBUTING/PR` 天然冲突（见 B-12） |
| `private` | `false` | 可发布 npm，但许可证语义下分发未修改版本可以、修改版本不行 |

- **无 CI**：`.github` 不存在；无 workflow、无 issue/PR 模板、无 Dependabot、无标签自动化。11 个提交期间没有任何自动校验，`selfcheck` 只靠作者手跑（提交 `01be400: selfcheck.mjs +179 行` 说明是手动加测试）。
- **无锁文件**：`git ls-files` 无 `package-lock.json`/`pnpm-lock.yaml`；当前零依赖所以可接受，但未来加 devDeps 后会不可复现。
- **无 source map**：无构建步骤（`client.js:4-5` 明确“no build step, so the bundle is the source”），发布即源码，**可接受**（且对审计友好）。
- **无 lint/format/type 配置**：但 `client.js:702` 有 `// eslint-disable-next-line react-hooks/exhaustive-deps` —— 引用了仓库里不存在的 ESLint（要么补配置，要么删注释）。
- 严重度：中（许可证/engines 高，其余建议修）。

### A.10 selfcheck.mjs 评估

**它测什么**（7 个 section，`//` 注释标记在 25/53/132/175/203/229/260 行）：① parseCandidates/statsOf/learnHint 边界；② workspaceContext 失败降级；③ transcript 内容与预算；④ sourceOf 变化；⑤ System prompt 断言；⑥ 用 `vm` + 源码字符串手术注入 `checks`，执行真实 client store/请求/超时/accept/polish 逻辑；⑦ 用假 ctx 执行真实 `apply()` 的 suggest 路由（stale/timeout/不叠加）。

**覆盖量**：75 处 `assert` 标识符（其中 50 处 `assert.*` 调用），`node selfcheck.mjs` 实测 exit 0 并通过。覆盖面在同类插件里算强。

**问题**：
1. **与源码字符串强耦合**：`selfcheck.mjs:80-82` 用 `clientSource.replace("      inject: ['slots'", "...checks: {...},\n      inject: ['slots'")` 注入测试钩子；`:176-177`、`:204-206` 用 `indexOf` 切出 `accept`/`polish` 的源码片段再用 `runInNewContext` 执行。文件缩进/重命名任一变化就静默失效（replace 匹配不到时靠 `assert(client)` 兜住，但 `indexOf` 失配只报一个 assert）。
2. **测试替身与生产契约同形重复**：`selfcheck.mjs:264-270` 手写 `ctx/sessions/llm/effect/on/inject/connection`，`:72-79` 手写假 `fetch`。DSH 契约一变，替身不会跟着报错，测试“绿”但插件已坏。
3. **只覆盖 suggest 路由**：`turn`（`index.js:575-591`）、`settings`（`513-528`）、`feedback`（`534-559`）、`probe`（`593-610`）路由零测试；`__test` 导出的 18 个符号中 `gitStatus/readSettings/writeSettings/withSettings/buildPrompt/abortable` 6 个在 selfcheck 里出现 0 次（grep 计数）。
4. **测试改写生产默认值**：`selfcheck.mjs:295-312` 直接改 `check.DEFAULTS.timeoutMs` 再还原；属可接受的 monkeypatch，但说明没有可注入的 config。
5. **无可度量输出**：只有最后一行 `console.log`（`:317`），没有用例名、计数、耗时；失败时只有 assert 堆栈；无 CI 时结果不可追踪。
6. **README 对它的描述偏窄**：`README.md:129-130` 只说“解析、学习统计和上下文失败降级”，实际还覆盖 deadline/ownership/路由；文档与测试互相低报/漏报。
- 严重度：中。

### A.11 代码正确性风险（审计中发现的 bug 级问题）

**A-02（必须修，高）数字设置项清空 → 保存 0 → 预测静默失效**
`client.js:1197-1205`：`Number(event.target.value)`，`<input type=number>` 被清空时 `value === ''`，`Number('') === 0` 且 `Number.isFinite(0)` 为真 → 立即 `save({ [key]: 0 })`。Host `writeSettings` 只校验 mode/display/provider/model/minConfidence/learn，**不校验 timeoutMs/debounceMs/maxInputChars/maxOutputTokens 的数值范围**（`index.js:151-175`）。后果：
- `timeoutMs=0` → `index.js:666` `setTimeout(..., 0)` 立即 abort，所有预测回 `timeout`，客户端静默丢弃（A-06）；
- `maxInputChars=0` → `index.js:194-195` 直接返回 `''` → `next` 报 `empty-transcript`（`index.js:654`），用户只看到“没有建议”；
- `debounceMs=0` → 每次击键后 0ms 请求；`maxOutputTokens=0` → 模型空输出。
UI 下限（`client.js:1290-1310` 的 min）只在 `<input min>` 上，`onChange` 不过滤。修复：在 `number()` 里对 `''`/`<min` 不保存或恢复旧值，Host 侧强制 clamp 所有数值字段。

**A-03（必须修，高）生产环境调试探针：每渲染一次 POST，且携带草稿/候选文本**
- `client.js:359-395` `reportProbe` 读 `document`、`getBoundingClientRect` 并 `fetch POST /api/composer-assist/probe`（`390-392`）；
- `client.js:943-945` 在 **React 组件 render 体里**无条件调用 `reportProbe({ phase: 'render', ... })`——该组件订阅 draft（`672`），**每次击键都会重新 render 并 POST 一次**；且位置在 `946 if (!enabled) return null` 之前，插件禁用时也会发；
- `client.js:760` 把 `draft: at`（用户草稿全文）塞进 probe body；`client.js:374` 把 ghost 文本（候选内容）一起上报；
- Host `index.js:593-610` 的 probe 路由无开关、无鉴权外的额外限制，GET 直接返回 `lastProbe / lastAlign / lastTranscript / recent(40 条)`，`lastTranscript` 含 `sessionId`、消息数、字符数（`645-650`）。
影响：隐私（草稿与候选文本进入 Host 内存/可被同源页面读回）、性能（击键级网络请求 + 渲染期强制同步布局）、可维护性（调试代码进入发布包）。修复：探针改为显式 debug 开关/default off，移到 `useEffect`，剥离草稿/候选文本，或在发布前删除整条 probe 通道。

**A-04（必须修，高）错误不可见（与 A.6 同一根因，单列便于建 issue）**
用户能触发的所有失败（模型未配置 `index.js:376`、超时、stale、5xx、空结果）在 client 侧都被 `runRequest(...).catch(() => null)`（`client.js:456`）或空 catch（`882`/`801`/`737`）吞掉，且 `failed`/`settingsStore.error` 均无读取点（`682/752-761`、`157-163`）。README 只承诺“超时静默”，未承诺“失败可诊断”。修复：至少把 `strip.failed` 接上（`setFailed(true)`）并在 probe 之外留一条可读的原因；或对 README 明确“失败静默”。

**A-05（建议修，中）`requestSeqBySession` 驱逐可能删掉活跃会话的序号**
`client.js:524-529`：`if (requestSeqBySession.size > 32) delete(first key)`。Map 按首次插入顺序驱逐；若当前会话的 key 是最早插入且期间其他 31 个会话活跃过，它会被删，`currentRequestId()` 回落 0，随后 `runRequest` 的 `id !== currentRequestId(...)` 判定（`446`）可能把旧结果当新结果。触发需要 32+ 会话，概率低但真实。修复：按最近使用（LRU）或按 pending 保护，不要驱逐有 in-flight 的 session。

**A-06（建议修，低）`finishedTurns/deliveredTurns/predictingIn` 无清理**（`index.js:41/48/55`，`571` 只写不删、`586` 只写不删）——多会话长跑内存线性增长；建议随 session 关闭/上限清理。

**A-07（建议修，低）`workspaceContext` 用 `ctx.get('fs'/'subprocess'/'workingDirectory')` 但未在 `inject` 声明**（`index.js:673-674`，`apply` 只 inject `['llm','connection','sessions']`，`508`）。`ctx.get()` 对未激活服务返回 `undefined`（DSH 契约），于是工作区上下文会**静默为空**；README `87-88` 把该能力写成确定行为。属契约风险，需在 Host contract 文档里确认 `get` 语义（task-3 范围），当前标记为「未验证」。

**A-08（建议修，低）`sourceOf` 无兜底**：`index.js:249-251` 直接访问 `session.surface.nodes/replaceGeneration/contentGeneration`，`surface` 缺失会抛错，而调用点 `627` 在 try 之外 → 路由 500（不是软降级）。DSH 升级改内部结构时表现为“预测直接报错”。建议 try/catch 回落到不校验或显式版本检查。

---

### A 节问题清单表

| 编号 | 问题 | 证据(file:line) | 严重度 | 影响 | 建议 |
|---|---|---|---|---|---|
| A-01 | 单文件过大/组件过长：`SuggestionStrip` 356 行、`SettingsSection` 174 行、Host `apply` 198 行，最长嵌套 8 层 | `client.js:671-1026`、`client.js:1144-1317`、`index.js:507-704`、`client.js:872`、`index.js:673` | 中 | 阅读/改动成本高，回归风险集中在组件内 | 至少拆出 `useAutoPredict/useWordCompletion/useAcceptKey` 自定义 hook 与 `settings` 子组件；Host 拆 route handler 成具名函数。**先确认 client 半边是否允许多文件（未验证）** |
| A-02 | 数字设置项清空保存 0，导致超时/上下文/输出预算归零，预测静默失效 | `client.js:1197-1205`、`index.js:151-175`、`index.js:194-195`、`index.js:666` | **高** | 一次清空输入框即让功能“看起来没反应” | UI 拒绝空/越界值；Host 对所有数值字段 clamp 到 `DEFAULTS` 附近 |
| A-03 | 调试探针在 render 期发 POST（击键级），并上报草稿/候选文本；Host 常开 probe 路由可 GET 读回 | `client.js:359-395`、`client.js:760`、`client.js:943-945`、`index.js:24-33`、`index.js:593-610` | **高** | 隐私 + 性能 + 生产包含调试代码 | 加 debug 开关默认关闭；移到 effect；删草稿文本；发布构建剔除 probe |
| A-04 | 失败路径用户不可见：`strip.failed` 不可达、`settingsStore.error` 无人读、请求错误全吞 | `client.js:456`、`client.js:682`、`client.js:724/752-761`、`client.js:951-954`、`client.js:157-163` | **高** | 用户无法区分“没有建议/功能坏了/未配置模型” | 接线 failed/error；或在 README 明确静默策略 |
| A-05 | request 序号 LRU 驱逐策略错误，可能删活跃会话序号 | `client.js:524-529`、`client.js:446` | 中 | 极端多会话下接受过期结果 | 保护 in-flight 会话，按最近使用淘汰 |
| A-06 | turn 记账 Map 无上限/无清理 | `index.js:41/48/55`、`index.js:571/586` | 低 | 长跑内存增长 | 会话结束/超时清理 |
| A-07 | 工作区上下文服务用 `ctx.get` 未声明 inject，可能静默为空 | `index.js:673-674`、`index.js:508` | 中（未验证 DSH get 语义） | README 宣称的工作区上下文可能不生效 | 研究 DSH 0.2.1 `ctx.get` 激活语义；必要时加入 inject 或用可选注入 |
| A-08 | `sourceOf` 依赖 `session.surface.*` 且无兜底 | `index.js:249-251`、`index.js:627` | 中 | DSH 内部结构变化 → suggest 路由 500 | 包 try/catch 或版本探测 |
| A-09 | Host/Client 重复实现超时、stale、候选、confidence、默认值 | `client.js:179-194/221-225/225/486/514-521`、`index.js:60-86/269-276/354-368/435-449/166-490` | 中 | 双份不变量漂移，改一处漏一处 | 抽出协议常量/枚举到可读契约（README 或 JSON），selfcheck 加“两侧一致”断言 |
| A-10 | 24 处模块级可变状态，`window` 上挂 sessionState；`settingsStore.error` 死字段 | `client.js:139/312/426/435/495-496/541-554`、`index.js:24-55/114/371`、`client.js:157/163` | 中 | 生命周期难推理、测试难隔离 | 集中到一个显式 store 对象/生命周期钩子；删死字段 |
| A-11 | 大量 magic number（超时/轮询/预算/上限），client 无命名常量 | `client.js:198/227/520/527/593/740/807-812/825/856/1041/1057`、`index.js:187/215-243/286/476-483/492/603` | 中 | 调参与审计困难 | 至少把 “轮询节奏/预算分配/缓存上限” 命名并集中 |
| A-12 | 错误处理不一致：settings 400 vs suggest 200 ok:false；空 catch 9 处；runtime 无日志 | `index.js:525/556/695`、`client.js:492/577/737/801/882/1061`、`index.js:297/605/675` | 高（可观测性） | 线上问题不可诊断 | 统一错误契约；加一个 debug 日志开关 |
| A-13 | i18n：两侧 58 键齐平，但字典内联在 client.js；Host 错误文案纯中文；`strip.failed` 死键 | `client.js:17-136`、`locale/*.json:1-6`、`index.js:376/492/494/543/625`、`client.js:31/91` | 中 | 英文用户看到中文错误；翻译无法脱离代码 | Host 错误走错误码 + 客户端翻译；或至少英文文案 |
| A-14 | 过期注释：头注释仍称 “two General settings rows”；`eslint-disable` 引用不存在的 linter | `client.js:1-6`、`client.js:702` | 低 | 误导维护者 | 更新注释；补 lint 配置或删指令 |
| A-15 | 工程设施缺失：无 scripts/test/lint/devDeps/engines/engines.dsh/peer；无 CI；无锁文件；无 .github；license 非 SPDX | `package.json:1-44`、`.github` 不存在、`LICENSE:1-15`、`README.md:132-136` | 高（其中 engines/CI） | 升级契约漂移不可见；无法自动验证；协作受限 | 加 `engines.dsh`、`scripts.test`、最小 CI（`node --check` + selfcheck）、CHANGELOG；重新评估许可证 |
| A-16 | `files`/打包与仓库不一致：release tgz 不含 screenshots/selfcheck，README 图片在包内 404 | `package.json:14-20`、release tar 清单、`README.md:7-15/127-130` | 中 | 安装包内文档破图；自检不可用 | `files` 加 `screenshots/` 或 README 用绝对 URL；明确 selfcheck 仅源码仓库 |
| A-17 | selfcheck 与源码字符串强耦合、无 runner/CI、无输出度量、路由覆盖不全 | `selfcheck.mjs:80-82/176-177/204-206/263-270/295-312/317`、`index.js:575-610` | 中 | 格式一改测试静默失效；契约漂移测不出 | 改为导出显式测试 API（不用字符串手术）；补 turn/settings/feedback/probe 路由测试；加 CI |
| A-18 | 死导出/死字段：`__test` 18 个符号中 6 个未被测试使用；feedback 请求带 `kind:'next'` 但 Host 忽略 | `index.js:706-707`、`selfcheck.mjs`（grep 计数）、`client.js:240`、`index.js:534-554` | 低 | 生产包多暴露内部实现 | 缩窄 `__test` 或改测试 API；删无用字段 |

---

## B. 文档漂移（README.md 136 行 vs 代码）

### B.1 README 声明逐项核对

| README 声明 | 代码实际 | 结论 |
|---|---|---|
| 功能表：自动预测/手动预测/草稿补全/润色（`README.md:19-24`） | 四种 kind：`next/complete/polish` + 手动 channel（`index.js:626`、`client.js:758/836/1112`） | ✅ 一致 |
| Tab 接受、Esc 隐藏、忽略永久丢弃（`README.md:26`） | `client.js:1378-1388`（Tab，限定消息编辑框）、`client.js:916`（Esc→`clear('hide')`）、`client.js:1010-1023`（dismiss→`rememberSuggestion(null)`） | ✅ 基本一致；**未写 Esc 需焦点在 composer 内**（`client.js:896-899`） |
| 空草稿 ←/→ 切换候选、修饰键/IME 不拦截（`README.md:26-27`） | `client.js:902-914`（isComposing/keyCode 229/修饰键/`draftRef.current===''`） | ✅ 一致 |
| 模式：自动 / 单词补全 / 两者 / 仅手动（`README.md:63`） | 存储值 `auto/word/both/off`（`index.js:158`、`client.js:1252-1256`）；`off` 的中文标签是“只在手动调用时”（`client.js:52`） | ⚠️ 标签一致、**枚举值 `off` 未文档化**；README 又公开了 settings 文件路径（`README.md:69`），暗示可手改，却没有任何 key/value 表 |
| 显示位置：建议栏 / 行内（`README.md:64`） | UI 只给 `bar/inline`（`client.js:1257-1265`）；Host 仍接受 legacy `card`（`index.js:159-161`） | ⚠️ `card` 已被文档删除但代码仍接受，且 UI 把 `card` 静默显示为 bar（`client.js:1263`） |
| 预测模型：留空跟随本会话（`README.md:65`） | `resolveRoute` 依次：settings → `session.requestHeader().config` → `agentDefaultModel.currentSelection()` → undefined（`index.js:331-340`） | ✅ 大体一致；README 未写第二/第三回落 |
| 输出上限/输入停顿/超时/上下文上限/置信度门槛（`README.md:66-67`） | 设置页 5 个数字项（`client.js:1285-1311`）；默认 600/600/20000/12000/0（`index.js:73-80`） | ⚠️ **默认值未文档化**；且与 A-02 的 0 值 bug 相关 |
| 设置存于 `$DSH_HOME/composer-assist/settings.json`（`README.md:69`） | `join(DSH_HOME ?? HOME/.dsh, 'composer-assist/settings.json')`（`index.js:58`） | ✅ 一致；DSH_HOME 未设置时回落到 `~/.dsh`，README 未说明 |
| 置信度只显示高/中/低三档（`README.md:72-73`） | 阈值 `>=0.7 high / >=0.4 medium / else low`（`client.js:967-970`） | ✅ 一致；阈值本身未写（可接受） |
| 不写会话日志（`README.md:77-78`） | `prepareCall` + `call.stream`，无 `session.append`（`index.js:395-417`） | ✅ 一致 |
| 每轮只预测一次，过滤自身 turn，按 turn 号去重（`README.md:79-80`） | `predictingIn` 过滤（`index.js:48/379-391/568`）、`deliveredTurns` 去重（`index.js:55/571/586`）、turn  consume（`index.js:583-589`）；旧实现注释在 `client.js:785-793` | ⚠️ 方向正确，但四层去重（+client request id）没有文档化，见 C-05 |
| 打字不触发轮询、键击不重启轮询（`README.md:81-82`） | 轮询 effect 依赖不含 draft（`client.js:815-816`）；词补全 effect 依赖 draft（`client.js:819-827`） | ✅ 对 auto 成立；词模式“打字才触发”属预期 |
| 建议与生成中状态按会话缓存在模块级存储（`README.md:83-84`） | `suggestionBySession/pendingBySession`（`client.js:541/554`）；建议持久化到 sessionStorage（`client.js:467/574`） | ✅ 一致（“模块级”实际是 window+sessionStorage，`README.md:113` 有补充） |
| 行内模式避让 `--dsh-composer-hint`（`README.md:85-86`） | 空草稿用自有 ghost span 并隐藏 placeholder（`client.js:256-279/315-335`）；续写模式反而**复用**该 CSS 变量（`client.js:320-329`） | ⚠️ 两句话都对但容易读成矛盾；`README.md:109` 才解释 |
| 工作区上下文：名字、200 项、8 文件名、20 行 git status、过滤凭据、缺失/超时不阻断（`README.md:87-88`） | `MAX_SCAN_ENTRIES=200`（`index.js:264`）、`maxFiles=8`（`301`）、`slice(0,20)`（`321`）、`PRIVATE_NAME`（`267`）、`CONTEXT_TIMEOUT_MS=3000`（`266`）、全部 catch 返回 `''`（`294/325`） | ✅ 上限一致；**3000ms 超时与 64KiB git 上限未文档化**；`ctx.get` 可能未激活（A-07） |
| 历史预算优先最近请求/回答/旧约束 + 最多 4 条工具证据；不复制推理/附件/工具参数/系统提示（`README.md:92`、`97`） | `transcript`（`index.js:193-246`），只取 `type==='text'`（`179`）、`slice(-4)`（`218`）、`PRIVATE_NAME`、无 system prompt | ✅ 一致；预算比例 0.2/0.25/0.5 未文档化（可接受） |
| 只给 1–3 条有依据候选；空结果不清旧候选（`README.md:93`） | `parseCandidates` 最多 3（`index.js:439`）；`runRequest` 空文本返回 null 不写 store（`client.js:449`）；`selfcheck.mjs:122-124` 断言 | ✅ 一致 |
| 请求绑定会话/视图边界/草稿修订；接受前复核来源、草稿变化禁用按钮（`README.md:94`） | `client.js:196-227`（sessionId/revision/source）、`209-219`、`872-878`、`997-1002` | ✅ 一致 |
| 旧版无来源缓存不恢复（`README.md:95`） | `restoreSessionState` 要求 `source` 为 string（`client.js:479-481`） | ✅ 一致；但旧 v1 key 永不清理（C-02） |
| Host 同一硬截止覆盖工作区准备/等旧调用/模型准备/生成（`README.md:101/105`） | 单个 `setTimeout(abort, settings.timeoutMs)`（`index.js:664-666`），包住 workspace(670)、等旧调用(668-669)、prepareCall(396)、流式生成(409-415) | ✅ 一致（读 settings/transcript 在计时器之前，属实现细节） |
| 浏览器对请求、响应体和**来源检查**设配置时限 + 1 秒兜底；接受来源检查最多 5 秒（`README.md:101/105`） | 请求+body：`deadline + 1000`（`client.js:227`）；**来源检查固定 5000ms（`client.js:514-521`），不是配置时限+1 秒** | ❌ 英文句 “bounds the request, response body and source validation by the configured timeout plus one second” 不准确（source validation 是固定 5s）；中文前半句同样含糊。低严重度文档偏差 |
| 低推理档只给明确支持 low 的模型，不改模型/主会话（`README.md:102`） | `runAuxiliary` 经 `prepareCall(..., (controls, model) => ...)` 第三参选择 `reasoningEffort: 'low'`（`index.js:396-399`）；selfcheck 用假实现断言（`selfcheck.mjs:229-242`） | ⚠️ 实现依赖 `prepareCall` 第三参语义，**未在真实 DSH 0.2.1 验证**（task-3 范围） |
| 取消是 best-effort；未结束调用仍记账、不叠加（`README.md:103/105`） | `runningCalls` 保活（`index.js:370-392`）、同 key 等待旧调用（`index.js:668-669`） | ✅ 一致 |
| 行内模式：空草稿非编辑预览、共享网格、隐藏 placeholder、换行撑开（`README.md:109`） | `ensureGhostStyle` CSS（`client.js:256-279`）、`paintGhost`（`315-335`） | ✅ 一致；实现依赖 `:has()` 与 `[data-composer-*]`，README 117 已警告 |
| 候选+选中位置存标签页 sessionStorage，重载/刷新恢复，关标签清空（`README.md:113`） | `sessionStorageKey='dsh.composer-assist.predictions.v2'`（`client.js:467`）、`publishStore`（`574`）、`restoreSessionState`（`468`） | ✅ 一致；旧 v1 未清理（C-02） |
| 行内依赖 `[data-composer-card]/[data-composer-input]` 与原生提示样式；Tab 也依赖消息输入框标记（`README.md:117-119`） | `client.js:284-289`、`1378-1388`；还依赖 `shortcuts.observeFixedInput`（未在 README 点名） | ✅ 大体一致；**未提 `shortcuts`/`slots`/`remote.session` 等宿主任一契约变化也会静默失效** |
| 默认开启自动模式，每轮一次真实计费调用（`README.md:123/125`） | `enabled:true, mode:'auto'`（`index.js:64-65`） | ✅ 一致 |
| 自检检查解析、学习统计、上下文失败降级，不调用模型/不改设置（`README.md:129-130`） | `selfcheck.mjs` 7 段、75 断言，还覆盖 deadline/ownership/路由；mock llm；临时 DSH_HOME（`272-273`） | ⚠️ 描述**偏窄**（少列 4 类覆盖）；“不改写用户设置”成立 |
| 许可证非开源、允许未修改使用、禁止修改/衍生/分发修改版（`README.md:134-136`） | `LICENSE:1-15`、`package.json:6` | ✅ 一致；但影响协作（A-15/B-12） |
| 安装：`plugin_manager install_bundle` + release URL v0.1.1；CLI `dsh plugin --profile web add <URL>`；也可 clone 后装绝对路径（`README.md:31-50`） | release 资产存在且内容=HEAD（§B.4）；CLI 参数顺序符合 DSH 0.2.1（`--profile` 在 add 前）；**本机未实际安装（未验证）** | ✅ 链接有效；命令未实测 |
| v0.1.1 沿用 0.1 系列；不含开发中的 ZCode 动态工作流（`README.md:52-53`） | 全仓库/全历史 grep `ZCode` 只在这一行（`git log -S ZCode` 仅 `b626b67`）；代码无任何 ZCode；**没有 v0.1.0 tag/release**，“0.1 系列”无发布记录可查 | ⚠️ 对外部读者不可核验；无 CHANGELOG 支撑版本叙事 |
| 截图：建议栏/设置页（`README.md:7-15`） | 两张图实为 JPEG 冒充 PNG；设置页截图早于 `4b86ffc`/`bca5aa1`，内容已过期（§B.2） | ❌ 过期 |

### B.2 截图核对（可读性证据）

审计时把两张图复制到 `<AUDIT_IMAGES>/*.jpg` 后读取（未改仓库）：

- `screenshots/settings.png`（1628×1612）显示的是**旧版设置页**：
  - 有“启用 / 模式 / 显示位置 / 预测模型 / 输出上限 / 输入停顿 / 超时 / 上下文上限”；
  - **没有** `接受学习`（`client.js:1223-1247` 新增）、**没有** `置信度门槛`（`client.js:1306-1310` 新增）；
  - 显示位置提示写的是“行内 = 直接显示在输入框里；**卡片** = 输入框上方”，选项值显示“输入框内（**推荐**）”——当前代码已无“卡片”选项（`client.js:1257-1265`），且推荐项是 bar（`client.js:115`：`Bar above the composer (recommended)` / `client.js:55` 中文“建议栏…（推荐）”）。
  - 依据：截图提交 `4341710`（2026-10-22 18:57）早于 `4b86ffc`（20:33，新增 learning/confidence/bar 推荐）、`bca5aa1`（23:18，按钮紧凑化）。
- `screenshots/composer-bar.png`（1434×416）：
  - 工具行按钮文案是“→ 重新预测输入框”和“✨ 润色提示词”，而当前可见文案是 `t('predict.short')='预测'`、`t('polish.short')='润色'`（`client.js:1086-1087`、`1139-1140`；`bca5aa1` 新增短标签）；
  - 建议栏本身（badge + Tab 接受 + 忽略）与当前 UI 结构一致，属可继续使用。
- **格式问题**：`file` 判定两个 `.png` 实为 `JPEG image data`（composer-bar 1434×416、settings 1628×1612）。浏览器通常 sniff 后仍能显示，但 GitHub 的 content-type 由扩展名决定、部分工具/npm/编辑器会失败（本次审计的 `read_image` 即报格式不符，必须改后缀才能读）。且 `files` 不含 `screenshots/`，release 包内 README 的这两张图会 404（§A-16）。

### B.3 缺失文档

| 缺失项 | 影响 | 证据 |
|---|---|---|
| `CHANGELOG.md` | 版本只有 tag 与 commit 标题；`v0.1.1` 的“沿用 0.1 系列、不含 ZCode”无法追溯；无法知道 0.1.0→0.1.1 改了什么（实际只改 README/package.json/许可证） | `git show --stat b626b67`（仅 README/package.json）、无 CHANGELOG 文件 |
| `CONTRIBUTING.md` | 与许可证冲突（禁止修改 → 不接受 PR）；也没有自检/提交规范 | `LICENSE:6-8`、`README.md:134-136`、无该文件 |
| `SECURITY.md` | 有 `$DSH_HOME/composer-assist/settings.json` 写入、probe 路由、草稿文本上报，却没有安全/隐私声明与漏洞渠道 | `index.js:151-175/593-610`、`client.js:760` |
| 架构 / 契约文档 | Host 侧 5 条 `/api/composer-assist/*` 路由（`index.js:12-16`）无公开说明；Client 依赖的 `data-composer-*` 标记、CSS 变量、`shortcuts.observeFixedInput`、`slots`、`remote.session.modelCatalog`、`prepareCall` 第三参都靠代码自述；README 只有 2 段“实现说明” | `index.js:12-16`、`client.js:1320/1378`、`README.md:107-119` |
| DSH 版本兼容说明 | 没有 `engines.dsh`，README 不写支持哪些 DSH 版本；`README.md:117` 只说“DSH 升级改名后需要适配” | `package.json:1-44`、`README.md:117-119` |
| issue/PR 模板、`.github` | 无 CI、无模板、无发布流程文档 | 仓库根目录 |
| 升级适配记录 | 无“0.2.0→0.2.1 破坏性变更对本插件命中点”的记录；skill 已指出 0.2.1 强制 `engines.dsh`，本包未声明 | `package.json`、skill 知识（本机 `dsh --version=0.2.1-rc.2`） |

### B.4 安装 / release 核对（实际下载验证）

- URL `https://github.com/Lphehe/dsh-composer-assist/releases/download/v0.1.1/dsh-composer-assist.tgz`：HTTP 302→200 有效；下载得到 37,793 B gzip。
- `tar -tzf` 内容：`package/{LICENSE,client.js,index.js,locale/en.json,locale/zh.json,package.json,README.md,icon.svg,cordis.patch.yml}`（9 个）。
- 与 HEAD 逐文件 diff：**全部 SAME**（`LICENSE/client.js/index.js/locale/*/package.json/README.md/icon.svg/cordis.patch.yml`），无“发布二进制与源码不一致”问题；tar 内 mtime 为 npm pack 归一化的 1985 时间，属正常。
- 差异点：包里**没有** `screenshots/`、`selfcheck.mjs`、`.gitignore`（后两者按 README 语境可接受；截图导致包内 README 破图）。
- README 安装命令：`dsh plugin --profile web add <URL>` 的 `--profile` 位置符合 DSH 0.2.1 规则；`plugin_manager install_bundle` 是 DSH 工具动作名（本机 0.2.1 安装包中存在 `install_bundle`）；**未实际安装（按审计要求不运行插件），标记未验证**。

### B 节问题清单表

| 编号 | 问题 | 证据(file:line) | 严重度 | 影响 | 建议 |
|---|---|---|---|---|---|
| B-01 | 截图过期且格式错误：settings 截图缺 learning/置信度门槛、仍展示已删“卡片”并推荐 inline；bar 截图按钮文案是旧长标签；两图实为 JPEG 冒充 .png | `screenshots/settings.png`、`screenshots/composer-bar.png`、`client.js:1086-1087/1139-1140`、`client.js:115/1223-1247/1257-1265/1306-1310`、提交 `4341710` vs `4b86ffc`/`bca5aa1`；`file` 输出 | **高（文档可信度）** | 读者以为 UI 仍如此；工具/打包报错 | 重截图并用 `.jpg` 或真 PNG；`files` 加 screenshots 或 README 改绝对 URL |
| B-02 | 模式枚举值未文档化：README 写“仅手动/manual only”，settings 实际值是 `off`；README 公开 settings 路径却不给 key/value/默认值表 | `README.md:63/69`、`index.js:158`、`client.js:1252-1256`、`index.js:60-86` | 中 | 手改 settings 的用户会写错值（被静默回退为 auto） | README 增设“settings 文件 schema/默认值”表 |
| B-03 | 默认设置值大多未写：600/600/20000/12000/0、display=bar、enabled=true 只在代码里 | `README.md:59-67`、`index.js:60-86` | 中 | 用户无法预期成本/行为 | 表格补默认值 |
| B-04 | “来源检查 = 配置时限+1s”表述不准（实际固定 5s） | `README.md:101/105`、`client.js:227/514-521` | 低 | 误导排障 | 改正为“来源校验 5 秒固定超时” |
| B-05 | `ZCode 动态工作流`只在 release note 出现一次，无定义/链接/代码证据；“0.1 系列”无 v0.1.0 tag/release；无 CHANGELOG | `README.md:52-53`、`git log -S ZCode`（仅 `b626b67`）、`git tag -l`（仅 v0.1.1） | 中 | 外部读者无法核验版本叙事，疑似“内部上下文泄漏到公开文档” | 删除或改成可核验表述；补 CHANGELOG/发布说明 |
| B-06 | selfcheck 描述偏窄（少列 deadline/ownership/路由覆盖） | `README.md:129-130`、`selfcheck.mjs:25/53/132/175/203/229/260` | 低 | 低估测试价值 | 更新描述 |
| B-07 | 缺失文档：CHANGELOG/CONTRIBUTING/SECURITY/架构契约/版本兼容/issue 模板 | 仓库根目录、`README.md:107-119/134-136` | 高（协作） | 无法安全升级、无漏洞渠道、PR 与许可证冲突 | 至少补 CHANGELOG + SECURITY + 兼容矩阵 |
| B-08 | README 安装 release 链接有效、包内容=源码（**已核验通过**，记录为事实而非问题）；但“CLI 命令可用”未实测 | `README.md:31-50`、release tar diff、`package.json:21-34` | 记录项 | — | 建议在 README 标注实测 DSH 版本 |
| B-09 | 包内 README 图片 404 / selfcheck 不在包内 | `package.json:14-20`、release tar 清单、`README.md:7-15/127-130` | 中 | 安装包用户看到破图/按 README 找不到 selfcheck | `files` 补 screenshots，或 README 说明“自检仅源码仓库” |
| B-10 | README 未提 Tab 仅在消息编辑框内生效、未提依赖 `shortcuts.observeFixedInput` | `README.md:117-119`、`client.js:1378-1388` | 低 | 用户在某些输入框按 Tab 无效会困惑 | 补一句 |

---

## C. 新老冲突层

### C.0 git 历史（全 11 条，按时间）

| # | commit | 时间(+0800) | 说明 |
|---|---|---|---|
| 1 | `264e4f4` | 2026-10-22 18:20:37 | 初始插件（client 1060 行，含 `display: inline/card`，MIT，README 用 clone 目录安装，repo 名 `dsh-composer-prediction`） |
| 2 | `4341710` | 2026-10-22 18:57:34 | 双语 README + **两张截图**（当时 UI 含“卡片”模式） |
| 3 | `4b86ffc` | 2026-10-22 20:33:24 | 候选选择/接受学习/工作区上下文；显示模式改为 **bar/inline**（`card` 变 legacy 值，`index.js:159-161`）；截图自此开始过期 |
| 4 | `93b3d04` | 2026-10-22 21:13:33 | Tab 只在消息编辑框接受（`client.js:1378-1388` 的来源） |
| 5 | `b53b912` | 2026-10-22 22:54:18 | 引入 session 持久化：`predictions.v1` + `Symbol.for('dsh.composer-assist.session-state')`（无版本后缀） |
| 6 | `bca5aa1` | 2026-10-22 23:18:15 | 按钮紧凑化，新增 `predict.short/polish.short` 短标签 → 截图按钮文案过期 |
| 7 | `01be400` | 2026-10-23 10:49:00 | stale-source 保护；存储键升 **v2**（`predictions.v2` / `session-state.v2`），**无 v1→v2 迁移** |
| 8 | `96c1e78` | 2026-10-23 10:54:27 | 仅改 locale meta 描述/package description |
| 9 | `0877c90` | 2026-10-23 12:19:01 | 硬截止 + low reasoning；修改 `session-state.v2` 的 pending 结构（引入 `bounded`，`client.js:555-560`） |
| 10 | `4eafe23` | 2026-10-24 00:12:07 | MIT → source-available 自定义许可（README/LICENSE/package） |
| 11 | `b626b67` | 2026-10-24 00:36:17 | v0.1.1：README 安装改为 release URL、package version 0.1.1、repo URL 大小写修正（`lphehe-bot`→`Lphehe`）、加入 ZCode 说明；**无代码改动** |

### C.1 新老路径逐条清单（位置 / 新旧 / 冲突 / 建议 / 分级）

**C-01 旧版 pending 兼容分支（window 内存态跨插件重载）**
- 位置：`client.js:555-560`（丢弃 `bounded !== true` 的 pending 并递增 request id）；自检 `selfcheck.mjs:83-94` 断言；`bounded:true` 在 `client.js:442` 才写入。
- 旧：`0877c90` 之前写入 `window[session-state.v2].pending` 的条目没有 `bounded`；新：有。
- 冲突：同一 `window` 符号跨版本重载时，旧条目会让 UI 永久“生成中”；分支是防御而不是迁移。`nextRequestId` 在丢弃时还会污染序号。
- 建议：保留一个版本周期后在下次 key 升级时删除；把“旧条目 = 放弃 + 清空 pending”写成注释/测试名。**可接受（有兼容理由）**。

**C-02 会话缓存键 v1→v2，无迁移与清理（含旧/新候选存储格式）**
- 位置：`client.js:467`（v2 key）、`474-481`（只读 v2；缺 `source` 的旧记录被 `continue` 丢弃）、`495-496`（v2 Symbol）；历史 `b53b912` 引入 v1（`predictions.v1` + 无版本 Symbol），`01be400` 直接升 v2。
- 旧格式（v1 / 更早）：记录只有 `{kind, text, draftAt}`（无 `source`、无 `candidates/confidence`）；新格式（v2）：`{kind, text, draftAt, source, candidates, confidence}`（写入见 `client.js:450-454/484-490`）。
- 兼容残留：`currentCandidate`（`client.js:612-621`）在 `candidates` 为空时回落到 `record.text`，`candidateTotal` 返回 1（`603-609`）；即“单条 text 的旧式记录”仍能在内存里渲染，但 v2 恢复校验又要求 `source`，所以**旧格式既被兼容又被拒绝**（两处判断不一致的叠加态）。
- 冲突：v1 的 sessionStorage 键永久残留（无删除代码），用户升级后历史建议静默消失（README `95` 明说“旧版无来源缓存不会恢复”，但没人知道这是升级导致的）。
- 建议：初始化时 `sessionStorage.removeItem('...v1')`；把 Symbol 也升级/清理；统一“记录必须带 source”为唯一判据（删掉 `record.text` 回落或标为内部兜底）；在 CHANGELOG 写“升级后旧建议会丢失”。**建议修（低）**。

**C-03 旧显示模式 `card` 残留**
- 位置：`index.js:159-161`（接受 `card`，渲染同 bar）；`client.js:1263`（非 inline 一律显示/存为 `bar`）；历史：`264e4f4:client.js:38-41`、`4341710` 的 README 有“卡片”选项，`4b86ffc` 删除 UI 与 README 描述。
- 旧：`card` = 输入框上方卡片；新：`bar` = 独立建议栏，`inline` = 输入框内。
- 冲突：文档/UI 已删，Host 仍持久化 `card`；用户设置里看到下拉是 bar，但文件里仍是 card（`writeSettings` 不重写未提交的键）。无功能 bug，但“文档删除 ≠ 兼容结束”。
- 建议：保留值映射（用户无感），在 `writeSettings`/迁移时把 `card` 归一为 `bar`，或至少写 departed 注释与移除时间表。**可接受**。

**C-04 行内 ghost 的两套机制（旧绝对定位/共享网格 vs 新 `--dsh-composer-hint`）**
- 先澄清：当前“建议栏 vs 行内”**不是两份组件代码**，而是同一 `SuggestionStrip` 的双分支（`inline = settings?.display === 'inline'`，`client.js:922`；渲染分支 `974-978`）；真正的新旧并存出现在**行内内部**——空草稿走自建 ghost span，草稿续写走宿主 CSS 变量。
- 位置：空草稿 = 自建 `<span class=composer-assist-ghost>` + CSS `:has()` 隐藏 placeholder（`client.js:248-281`、`298-335`、`974-978`）；草稿续写 = 覆写宿主 `--dsh-composer-hint`（`client.js:320-329`、`ownedHints` 312、`clearGhosts` 398-412）。
- 旧 README（`b53b912` 之前）明确写“inline 不用 `--dsh-composer-hint`”；现版本两种都用。
- 冲突：同一“行内预览”在两种机制间切换（`continuation` 判断 `client.js:923-926`），依赖宿主私有标记与 CSS 变量；DSH 改版时一半失效、一半继续，会出现“半透明幽灵/placeholder 重叠”的静默 bug。
- 建议：抽一个 `InlinePreviewAdapter`，把 selector/CSS 变量/`:has()` 兼容逻辑集中，并在 README 标注“已知依赖宿主 4 个私有标记/变量”。**可接受（有产品理由），但建议修（可维护性）**。

**C-05 turn 去重的四层机制（旧/新叠加）**
- 位置：① Host `predictingIn` 过滤自身 turn（`index.js:48/379-391/568`）；② Host `deliveredTurns` 按 turn 号去重（`55/571/586`）；③ `/turn?consume=1` 消费（`575-591`）；④ client request id + `stale()`（`client.js:446/631-634`）；另有 client 注释“The old code lost the turn exactly that way”（`client.js:785-793`）。
- 旧：`264e4f4` 用 `session.running`（step 级）判断轮次结束，会中途触发；新：Host `agent/turn-stopping` + consume。
- 冲突：四层语义重叠（尤其 `predictingIn` 与 `deliveredTurns` 都可能吞/重放边界），没有一处文档说明组合不变量；`client.js:285-297` 的“peek → 草稿检查 → claim”把边界消费逻辑放在 UI 组件里，组件卸载即无轮询。
- 建议：写成一条状态机（每 session：`idle → boundary-ready → claimed → inflight → stored`）并在 README/架构文档记录；保留四层但标注每层目的。**建议修（中）**。

**C-06 兼容旧 DSH 的 fallback（隐式、不可检测）**
- `client.js:286-287`：`[data-composer-input]` 找不到时退到 `[contenteditable="true"]`（旧标记 fallback）；
- `index.js:331-340`：settings → session requestHeader → agentDefaultModel 的模型路由 fallback；
- `client.js:495-496`：window 内存态复用（跨重载）；
- `index.js:249-251`：`session.surface.*` 无 fallback（改 struct 即抛错）；
- `client.js:1320`、`1378`：`slots/locale/shortcuts/remote.session` 无 presence 检测；
- `package.json` 无 `engines.dsh`（A-15），README 不写支持版本。
- 冲突：部分有 fallback、部分直接崩、部分静默空，**同一 DSH 升级会表现成三种不同故障**（报错/无建议/没反应），且没有 CI 或版本门禁提示。
- 建议：补 `engines.dsh`（0.2.1 起为强制兼容门）；所有私有 API 做 feature-detect 并降级为“禁用该子功能 + 一条可见提示”；README 加兼容矩阵。**必须修（高，分发场景）**。

**C-07 experimental / ZCode 残留**
- `grep -r ZCode` 全仓库只命中 `README.md:52-53`（且只由 `b626b67` 引入）；代码、locale、package 无任何 ZCode 实现或占位。
- 冲突：README 的发布说明提到一个仓库内不存在、无链接、无定义的“ZCode 动态工作流”；结合“0.1 系列”说法与缺失的 CHANGELOG，读者会误以为有未发布功能或历史版本。
- 建议：删除该句，或改为“本插件不含 X 功能，见 <链接>”。**建议修（中）**。

**C-08 调试/探针残留（从首个提交就在生产路径）**
- 位置：Host `probe` 路由 `index.js:593-610` + 全局 `lastProbe/lastAlign/lastTranscript/probes`（`24-33`）；client `reportProbe`（`358-395`）、`measureAlignment`（`343-357`）、`render` 期上报（`943-945`）、草稿/候选文本入 body（`760`、`374`）。`git log -S'composer-assist/probe'` 命中 `264e4f4` —— 从 v0.1.0 起就是生产路由。
- 冲突：这是“开发期自检工具”与“运行产品”并存；无 feature flag、无 README 说明、无清理机制（probes 环形 40 条）。
- 建议：默认关闭（settings 或 env），发布构建移除；或至少把 draft/ghost 文本剥离。**必须修（高：隐私+性能）**。

**C-09 注释掉的代码 / 过期注释 / 死字段**
- 未发现被注释掉的整段代码（`grep -nE '^\s*//\s*(const|let|if|return|await|function)'` 仅命中 `index.js:79` 一行普通注释）。
- 过期注释 3 处：`client.js:1-6`（“two General settings rows”，实际是 `settings.section` 整页 `1367-1372`）；`client.js:785-793`（“old code”叙述保留旧 bug 历史，属设计说明但无 issue 链接）；`client.js:962-963`（“locale helper's placeholder behaviour is not verified”）。
- 死字段：`settingsStore.error`（157/163 写，无读）；`strip.failed`（无 `setFailed(true)`）；`recordFeedback` 的 `kind:'next'`（`client.js:240`，Host `534-554` 不读）。
- 建议：清理注释/死字段；把“old code”注释改成 `fix: <commit>` 链接。**建议修（低）**。

**C-10 未被引用的导出/测试接口**
- `index.js:707` `__test` 导出 18 个内部符号；selfcheck 实际使用 12 个，`gitStatus/readSettings/writeSettings/withSettings/buildPrompt/abortable` 6 个为 0 次引用（grep `check.<name>`）。
- `client.js` 的 `SuggestionStrip` 内部 `manualRequest.hasSuggestion/subscribe` 有使用（`1037-1042`），不算死。
- 建议：要么补测试，要么从 `__test` 移除；测试钩子不应进入发布入口。**建议修（低）**。

**C-11 重复实现的工具函数（见 A.7）**
- 位置/证据同 A.7 表；建议在协议层收敛，而不是两侧各写。**建议修（中）**。

**C-12 发布 tag/二进制 vs 源码一致性、版本叙事**
- 已核验：tag `v0.1.1` == HEAD；release tgz 内容与 HEAD 逐文件相同；**不存在二进制/源码不一致**。
- 冲突在“版本叙事”而非二进制：只有 `v0.1.1` 一个 tag/release，但 README 说“沿用 0.1 系列”；`b626b67` 自身无代码改动（纯文档+版本号）；无 CHANGELOG；`selfcheck.mjs`/`screenshots` 不入包。**建议修（低）**。

### C 节问题清单表

| 编号 | 问题 | 证据(file:line / commit) | 严重度 | 影响 | 建议 |
|---|---|---|---|---|---|
| C-01 | 旧 pending（无 `bounded`）兼容分支，跨插件重载时清理并改序号 | `client.js:555-560`、`client.js:442`、`selfcheck.mjs:83-94`、`0877c90` | 低 | 旧内存态让 UI 卡“生成中”，已被清理逻辑兜住 | 保留并写测试名；下个存储版本删除 |
| C-02 | 存储键 v1→v2 无迁移/无清理；旧候选格式（仅 text、无 source）与 v2 校验并存 | `client.js:467/474-481/495-496/603-621`、`b53b912`、`01be400` | 中 | 旧建议静默丢失、v1 数据永久残留、格式判据不一致 | 初始化删除 v1；统一记录判据；CHANGELOG 说明 |
| C-03 | legacy `display:'card'` 仍在 Host 被接受/持久化，UI 已删除 | `index.js:159-161`、`client.js:1263`、`README.md:64`、`4b86ffc` | 低 | 设置文件与 UI 语义不一致 | 读取时归一为 bar；文档标注 deprecated |
| C-04 | 行内模式两套实现（ghost span + `--dsh-composer-hint`），依赖宿主私有 CSS/标记 | `client.js:248-281/298-335/320-329/923-938`、`client.js:117`（README） | 中 | DSH 改版时行内“半失效”且难定位 | 抽 adapter + 兼容矩阵；加 DOM 存在性自检报警 |
| C-05 | turn 去重四层叠加（predictingIn / deliveredTurns / consume / request id），旧逻辑注释残留 | `index.js:48/55/568/571/586/575-591`、`client.js:446/631-634/785-793` | 中 | 边界漏触发/重复触发难推理 | 写成状态机与不变量文档；删除“old code”叙述 |
| C-06 | 兼容旧 DSH 的 fallback 不一致（有的静默、有的抛错、无版本门禁） | `client.js:286-287`、`index.js:331-340/249-251`、`client.js:1320/1378`、`package.json`（无 engines.dsh） | **高** | 升级 DSH 后三种不同故障形态，且无提示 | 加 `engines.dsh`；feature-detect + 可见降级；README 兼容矩阵 |
| C-07 | ZCode 文档残留 | `README.md:52-53`、`git log -S ZCode`（仅 `b626b67`） | 中 | 公开文档引用不可核验功能；版本叙事混乱 | 删除或加链接；补 CHANGELOG |
| C-08 | 调试探针从 v0.1.0 起进入生产：render 期 POST、含草稿/候选、Host 可 GET | `client.js:359-395/760/943-945`、`index.js:24-33/593-610`、`264e4f4` | **高** | 隐私/性能/发布卫生 | 默认关闭并剥离文本；发布剔除 |
| C-09 | 过期注释（header “two General settings rows”）、死字段（`settingsStore.error`、`strip.failed`、feedback `kind`） | `client.js:1-6/157-163/240/682/752-761/962-963`、`index.js:534-554` | 低 | 误导维护者、死路径 | 清理并接线或删除 |
| C-10 | `__test` 18 个导出中 6 个无测试引用，测试钩子进入发布入口 | `index.js:706-707`、selfcheck grep | 低 | 暴露内部实现、契约更脆 | 缩小导出面/改显式测试 API |
| C-11 | Host/Client 重复实现 deadline/候选/confidence/source/枚举 | 见 A.7 表 | 中 | 双份不变量漂移 | 抽契约常量 + 一致性测试 |
| C-12 | 发布资产/源码一致（**已核验无问题**）；但版本叙事缺 v0.1.0/CHANGELOG，包内缺 screenshots/selfcheck | `git tag -l`、release tar diff、`package.json:14-20` | 低 | 读者无法追溯 0.1.0→0.1.1 | 补 CHANGELOG；打包补图或改链接 |

### C.2 关键提交是否留下未清理旧路径（逐条结论）

- `01be400`（stale-source）：把存储/状态键升 v2，**留下 v1 数据与 Symbol 无清理**（C-02）；同时把“候选/来源”校验加进 client（A.7 重复的起源）。
- `b53b912`（会话持久化）：引入 v1 存储；**留下“旧代码会丢 turn”的叙述注释**（`client.js:785-793`），无 issue 链接（C-05/C-09）。
- `4b86ffc`（候选/学习/工作区）：把显示模式从 card 改为 bar/inline，**Host 的 `card` 兼容分支留下且 UI/README 删除**（C-03）；截图未更新（B-01）。
- `0877c90`（deadline/low reasoning）：给 pending 加 `bounded`，**留下旧 pending 兼容分支**（C-01）；probe/align 上报被强化为“生产可观测手段”（C-08）。
- `b626b67`（v0.1.1）：纯文档/版本/URL 变更；**留下 ZCode 说明、v0.1.1 安装 URL、无 CHANGELOG**；源码与 tag 一致（C-07/C-12）。

---

## 附：给 Lead 的 Top 10 可用议题（可直接改写为 issue）

1. **数字设置项清空即保存 0，导致预测静默失效（超时=0 立即超时 / 上下文=0 无历史）**
   证据：`client.js:1197-1205`（`Number('') === 0`）、`index.js:151-175`（无数值校验）、`index.js:194-195`、`index.js:666`。建议：UI 拒绝空值 + Host clamp。
2. **生产包内调试探针：每次 render/击键 POST，且上报草稿与候选文本；Host 可 GET 读回**
   证据：`client.js:359-395`、`client.js:760/943-945`、`index.js:24-33/593-610`（`264e4f4` 起存在）。建议：默认关闭/剥离文本/发布剔除。
3. **所有失败对用户不可见：`strip.failed` 不可达、`settingsStore.error` 无人读、请求错误被 `.catch(() => null)` 吞**
   证据：`client.js:456/682/724/752-761/951-954/157-163`、`index.js:695`。建议：接线失败 UI 或 README 明确静默策略。
4. **缺少 `engines.dsh` 与版本兼容声明；同时依赖多项宿主私有契约（`session.surface.*`、`data-composer-*`、`--dsh-composer-hint`、`slots`、`shortcuts.observeFixedInput`、`prepareCall` 第三参）**
   证据：`package.json:1-44`、`index.js:249-251/396-399`、`client.js:286-287/495-496/1320/1378`、`README.md:117-119`。建议：声明 `engines.dsh`、feature-detect + 可见降级、README 兼容矩阵。
5. **README 截图过期且格式错误（JPEG 冒充 .png）；设置截图仍展示已删除的“卡片”模式、缺 learning/置信度门槛，按钮文案是旧标签**
   证据：`screenshots/settings.png`、`screenshots/composer-bar.png`、`client.js:1086-1087/1139-1140/1257-1265/1306-1310`、`4341710` vs `4b86ffc`/`bca5aa1`；`file` 输出。建议：重制截图、改正扩展名、`files` 纳入或改绝对 URL。
6. **sessionStorage/内存状态从 v1 升 v2 无迁移无清理：旧建议静默丢失、v1 数据永久残留**
   证据：`client.js:467/474-481/495-496`、`b53b912`、`01be400`、`README.md:95`。建议：初始化清 v1 + CHANGELOG 说明。
7. **`requestSeqBySession` 以“最早插入”驱逐 key，可能删掉活跃会话序号，使过期响应被当成新结果**
   证据：`client.js:524-529`、`client.js:446`。建议：保护 in-flight / LRU。
8. **无 CI、无 `scripts.test`、无 lint；selfcheck 依赖源码字符串手术（`replace("      inject: ['slots'"` / `indexOf`）且唯一输出一行 `console.log`**
   证据：`package.json:1-44`、`.github` 不存在、`selfcheck.mjs:80-82/176-177/204-206/295-312/317`（实测当前 exit 0）。建议：加最小 CI + test script，改用显式测试 API。
9. **许可证“源码可见、禁止修改”非 SPDX，与协作/分叉/贡献目标冲突；同时缺 CONTRIBUTING/SECURITY/CHANGELOG**
   证据：`LICENSE:1-15`、`package.json:6`、`README.md:134-136`。建议：产品决策（换 OSI 许可或明确“仅 issue、不接受修改 PR”），并补文档。
10. **单文件 1392 行 + 组件 356 行/Host `apply` 198 行 + 24 处模块级可变状态；Host/Client 重复实现超时/候选/confidence/source 不变量**
    证据：`client.js:671-1026`、`client.js:1144-1317`、`index.js:507-704`、`client.js:139-163/312/426/435/495-554`、`index.js:24-55`、A.7 表。建议：组件拆分 + 协议常量收敛 + 一致性测试。

---

## 附：审计限制与未验证项

- 按任务要求**未安装、未运行插件**；安装命令（`dsh plugin add <URL>` / `plugin_manager install_bundle`）只做了格式与 release 资产核验，**未在真实 profile 实测**。
- `ctx.llm.prepareCall` 第三参（`(controls, model) => ...`）与 `call.stream`/`maxTokens` 的真实签名、`ctx.get('fs'/'subprocess'/'workingDirectory')` 的激活语义、`session.surface.*` 字段稳定性，均属 DSH Host 契约范围，本笔记只记录代码依赖点，**未验证**，应由 task-3 的 host-contract 笔记确认。
- `agentDefaultModel.currentSelection()`、`remote.session.modelCatalog()`、`shortcuts.observeFixedInput`、`settings.section` slot 的 0.2.1 存在性只做了安装包内 grep 核对（存在），未做运行时验证。
- 截图内容判断基于本地读图（已转 `<AUDIT_IMAGES>/*.jpg`）；「当前 UI」只能从代码结构推断，未在运行中的 DSH 页面比对。
- `selfcheck.mjs` 于审计时执行一次，结果 `exit 0`；其“无 CI”结论来自仓库无 `.github` 与无 scripts。
