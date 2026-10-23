# dsh-composer-assist 的 Host/Client 契约与维护风险

> 注：为提交到公开仓库，本文把审查机器的本地路径替换为占位符：`<DSH_INSTALL_DIR>` = DSH 运行时安装目录，`<DSH_REPO_CHECKOUT>` = deepseek-harness 仓库检出，`<PLUGIN_CHECKOUT>` = dsh-composer-assist 仓库检出，`<REVIEW_DIR>` = 审查材料目录。行号与结论不受影响。
> 调查对象：`<PLUGIN_CHECKOUT>`（HEAD `b626b67`，v0.1.1，文件规模 `client.js` 1392 行 / `index.js` 707 行 / `selfcheck.mjs` 317 行）。
> 对照实现：本机安装 DSH **0.2.1-rc.2**（`<DSH_INSTALL_DIR>/`，下称 `I/`）+ 官方仓库稀疏 clone **`<DSH_REPO_CHECKOUT>` commit `22ddee3`**（下称 `D/`）。
> 证据等级标注：**【公开】**= 官方 docs 明文承诺的契约；**【源码】**= 官方已发布代码/类型声明中可核实的事实，但无文档承诺；**【内部】**= 无发布承诺、可随版本改动的实现细节；**【推测】**= 我未验证或需外部知识补充。
> 本文件**只写契约与维护风险**，不写 Doc2 议题正文。路径缩写：`P/` = 插件仓库，`D/` = 官方 clone，`I/` = 本机安装的 `@deepseek-ai/*` 包目录。

---

## 0. 结论摘要（先看这 8 条）

1. **Host 半边的核心 API 是公开契约**：`ctx.llm.prepareCall(config, signal, configure)`、`GenerateOptions`、`Session.deriveMessages()/requestHeader()/surface`、`ctx.connection.fetch.register`、`agent/turn-stopping` 事件、`ctx.fs` / `ctx.subprocess` 都在官方 docs 或已发布 `.d.ts` 中有正式签名。**【公开】**
2. **`prepareCall` 第三参 `configure` 是公开的**（`D/docs/subsystems/llm-streaming.md:1128`；`I/dsh-llm/lib/types/index.d.ts:407`），插件用法（`{...route, maxTokens}` + `configure` 选低推理档 + `call.stream({...call.config, messages, system, sessionId, signal})`）与官方语义一致，**不会被** `INVALID_PREPARED_CALL` 拒绝（实现：`I/dsh-llm/lib/index.js:2250-2251`）。**但按 id 字符串 `'low'` 找推理档属半公开假设**：官方只承诺 `efforts` 按"从低到高"排序、id 是适配器私有不透明值（`D/docs/upgrade-guide/v0.2.1-alpha.1/session-title-adapters/guide.md:12`），官方自己的策略是"取第一个"，不是按名字找。
3. **"辅助调用不计入会话"在代码上成立、在契约上无承诺**：`request/header` 的持久记录发生在 agent-loop（`I/dsh-agent-loop/lib/index.js:1226-1237`），`dsh-llm` 本身不碰 Session；插件只调 `prepareCall`+`stream`，故确实不写会话日志。**【源码】** 但 `GenerateOptions.purpose` 只允许 `'compaction' | 'session-title'`（`I/dsh-llm/lib/types/types.d.ts:557-560`），说明"预测"不是官方分类的辅助调用类型，未来若给辅助调用加统一计费/限流/审计，预测调用**没有位置可站**。
4. **`agent/turn-stopping` 是公开 serial 事件**，payload 为 `{ agent, turn, signal }`，声明处 `D/docs/subsystems/core.md:1110-1134`、生产者/消费者矩阵 `D/docs/event-producer-consumer.md:23`。插件只用 `{agent, turn}`，忽略 `signal` 与"可 steering 改变结局"的语义 —— 这是合法消费方式，但它把该事件当作**全局单例通知**用（Host 进程内 Map 按 sessionId 记 turn），于是**多标签页/多客户端只会有一个客户端拿到 turn**（`consume=1` 先到先得，`deliveredTurns` 再挡一次，`P/index.js:55,584-587,571`）。
5. **`data-composer-card` / `data-composer-input` / `data-composer-placeholder` / `--dsh-composer-hint` 在官方源码里真实存在但完全没有文档承诺**：源码证据 `D/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:417`、`.../input/editor/ComposerContentEditable.tsx:46`、`.../input/editor/DraftEditor.tsx:56,53`；0.2.1-rc.2 产物里同样存在（`I/dsh-client-ui-conversation/lib/client.js` 命中）。**全量 docs grep 零命中**（`D/docs/**` 对 `data-composer|composer-hint` 无任何条目）。判定：**【内部】**——插件最脆的一层依赖。
6. **`engines.dsh` / `peerDependencies` 双缺失 = 兼容性检查完全跳过**：app-boot 的实现是 `if (!Object.hasOwn(fields,'peerDependencies')) return {}`（`I/dsh-app-boot/lib/index.js:276-296`），即既不读 `engines.dsh` 也没有 peer 时**返回"全部满足"**。插件 `P/package.json` 两者都没有 → 今天在 0.2.1 上"免检通过"，将来在任何破坏性版本上也**免检通过**（静默）。**【源码】**；公开文档明确建议声明（`D/docs/user/develop/basic/publish.md:66`）。
7. **`icon` 的两种写法在 0.2.0-rc.2 → 0.2.1 之间从"只认一种"变成"两种都认"**：插件只写了 `exports["./icon"]`、没写顶层 `package.json.icon` → 在 0.2.0-rc.2（当时最新 `latest` 通道）上图标**静默丢失**；`exports` 里已正确导出 `./package.json` 与 `./locale/*.json`，所以文本元数据不会静默丢。**【公开】**（`D/docs/cookbook/adding-a-package.md:146,148`；`D/docs/upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/guide.md`，以及技能实测的 0.2.0 vs 0.2.1 差异）。
8. **该插件不是"只用公开契约"，也不是"全深耦合"**：Host 半边 ≈ 公开契约（约 85%），Client 半边 ≈ 半公开+内部实现（slot 名与标准 props 公开，但 DOM 标记、CSS 变量、`window.__ModuleLoader__` 手写 bundle、slot 内 `session.blank/running` 属半公开/内部）。逐接口结论见 §6。

---

## 1. 依赖点总览

| 半边 | 依赖面 | 数量 | 公开占比 |
|---|---|---|---|
| Host（`index.js`） | 3 个注入服务（`llm`/`connection`/`sessions`）+ 4 个 `ctx.get()` 可选服务（`fs`/`subprocess`/`workingDirectory`/`agentDefaultModel`）+ Session 只读 API + 1 个事件 + 1 个自写文件存储 + 5 条 `/api` 路由 | 16 | 高（12/16 有文档或发布类型） |
| Client（`client.js`） | `window.__ModuleLoader__.load` + `require('react')` + 5 个注入服务（`slots`/`locale`/`shortcuts`/`remote`/`remote.session`）+ 4 个 slot 名 + 标准 props + 4 个 DOM 标记 + 3 个 CSS 变量 + 3 个 `--dsw-alias-*` token + `sessionStorage` 键 + `Symbol.for` 全局键 + 自建 `<style>`/DOM 注入 | 24 | 中（11/24 有文档承诺） |
| 分发 | `dsh.bundle.patch` / `dsh.client` / `exports` / `files` / locale meta / icon / engines / peerDeps / license | 9 | 高（7/9 有文档） |

---

## 2. 契约清单表

> "契约类型"：公开=文档承诺；半公开=已发布类型/一线代码惯例但无文档承诺；内部=无任何承诺的实现细节。
> "稳定性"：A=跨版本稳定（公开且被多处依赖）；B=可能随小版本调整；C=随时可能变。

### 2.A 装载与分发

| # | 依赖点 | 位置（插件 file:line） | 官方实现证据（路径:行） | 契约类型 | 稳定性 | 失效后果 | 建议 |
|---|---|---|---|---|---|---|---|
| A1 | `dsh.bundle.patch` 指向 `cordis.patch.yml` | `P/package.json:21-24`；`P/cordis.patch.yml:1-3` | `D/docs/user/develop/basic/publish.md:13,34-60`；loader 语义同「层序」`publish.md:126-140` | 公开 | A | 包被当普通依赖安装，profile 打印警告且**不激活任何层**（`publish.md:64`），表现为"装了没反应" | 保持 `- insert:` + `id`/`name`，`name` 用包名由 Node 解析到 `exports["."]` |
| A2 | `insert` 行引用包名而非相对路径 | `P/cordis.patch.yml:3` | `D/docs/user/develop/basic/publish.md:55-62`（"plugin rows reference the package by name instead of a relative source path"） | 公开 | A | 写成相对路径则只在 checkout 内可解析，tgz 安装失效 | 保持包名；不新增 `override` 行 |
| A3 | `dsh.client.platform: 'web'` | `P/package.json:26` | `D/docs/subsystems/client-modules.md:94`；`D/docs/subsystems/client-modules.md:15-40`（`WebBootEntry`） | 公开 | A | 缺 `platform` 或值不对 → 不进入浏览器 entry 表，Client 半边永不加载（且 Host 正常，最难排查） | 固定 `"platform":"web"`；Desktop 若要复用需另评 |
| A4 | `dsh.client.immediately: true` | `P/package.json:27` | `D/docs/subsystems/client-modules.md:17-19,88` | 公开 | A | 去掉只是延后到 application 阶段预取，功能不坏；与"按钮必须第一帧可用"冲突时才会显性差异 | 可保留；若要减少首屏带宽可改 false 并接受按钮晚一帧出现 |
| A5 | `dsh.client.inject` 三个包边 | `P/package.json:28-32` | `D/docs/subsystems/client-modules.md:17-19,94`；实现只在 graph 里有该行时才等待（`D/packages/client/modules/src/client/system.ts:274-277`） | 公开 | B | **注入不存在的包不会报错**（`dependency !== undefined` 才等待）——这既是容错也是隐患：它给出"声明了依赖但其实没校验"的错觉；真正会硬失败的是 Client 半边 `inject: ['slots',...]` 缺服务（见 B1） | 保留；把这 3 个包同时写进 `devDependencies` 以便本地类型/联调（当前 `package.json` 无任何 devDeps） |
| A6 | `exports` 必须导出 `./package.json` 与 `./locale/*.json` | `P/package.json:7-13` | `D/docs/cookbook/adding-a-package.md:125-133,146` | 公开 | A | 不导出 → 图标与 locale 元数据**静默丢失**（解析抛 `ERR_PACKAGE_PATH_NOT_EXPORTED` 后被内部吞掉） | 现状正确；未来新增资源（如 detail 文档）记得同步 `exports` + `files` |
| A7 | `files` 白名单 | `P/package.json:14-20` | `D/docs/cookbook/adding-a-package.md:148`（"Include each image in files"） | 公开 | A | 漏 `icon.svg`/`locale` → 发布物缺文件，元数据静默退化为默认图/包名 | 现状正确；`README.md`、`screenshots/` 未在 `files` 内（README 会被 npm 默认带入，截图不会）——插件详情页靠 README 仍可显示 |
| A8 | `locale/en.json`+`zh.json` 的 `meta.title`/`meta.description` | `P/locale/en.json`、`P/locale/zh.json` | `D/docs/cookbook/adding-a-package.md:139-145`（回退链：`meta.title` → 包名 → 完整 Cordis 名） | 公开 | A | 缺失 → 回退到包名 `dsh-composer-assist`，不是错误只是难看 | 现状正确；第三方包不强制 ja/es/…（那是 first-party 规则） |
| A9 | 图标：只写 `exports["./icon"]`，无顶层 `package.json.icon` | `P/package.json:11`；`P/icon.svg` | `D/docs/cookbook/adding-a-package.md:148`（"sets top-level icon … or exports ./icon when that field is omitted"） | 公开 | B | **0.2.0-rc.2 上图标静默不显示**；0.2.1 起两种都支持。技能实测：0.2.0 仅认顶层 `icon` | 补一行 `"icon": "./icon.svg"`（顶层字段优先，0.2.0/0.2.1 双兼容），零风险 |
| A10 | 无 `engines.dsh` | `P/package.json`（全文无 `engines`） | `D/docs/user/develop/basic/publish.md:66`；`D/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.md`（迁移第 1 条）；实现 `I/dsh-app-boot/lib/index.js:276-296` | 公开（建议）/源码（后果） | C | **不设约束**：今天装得上，未来破坏性版本也照样装得上 → 硬报错从"安装时"推迟到"运行时"，且多半是静默半失效 | 声明覆盖实测版本的区间，如 `"engines": { "dsh": ">=0.2.0 <0.3.0" }`；一旦声明它**单独决定**兼容性并让 peer 检查失效（见 §3.4） |
| A11 | 无 `peerDependencies` | `P/package.json`（全文无 peerDeps） | `D/docs/user/develop/basic/publish.md:105`；实现 `I/dsh-app-boot/lib/index.js:287-296` | 公开（建议） | B | 与 A10 叠加 = 兼容性检查**完全跳过**；另：插件 Host 半边刻意零 `@deepseek-ai/*` import（`P/index.js:6-10`），所以当前不会触发 `ERR_MODULE_NOT_FOUND` 红线；但未来一旦加一行官方 import 而没有 peer，就会命中技能的静默失效红线 | 若将来 Host 半边 import 官方包：同时加 `peerDependencies` + `devDependencies`（`publish.md:105`） |
| A12 | `private: false` + `license: "SEE LICENSE IN LICENSE"`（source-available 禁改） | `P/package.json:6,35`；`P/LICENSE` | 无 DSH 侧契约（npm 语义） | 公开（npm）/无 DSH 承诺 | A（语义）/C（维护） | `private:false` 只是"可发布"，与 DSH 装载无关；`SEE LICENSE IN LICENSE` 不是 SPDX → npm 页面/部分扫描器只显示非标准许可；**禁改条款使社区无法在契约漂移时发补丁** | 若要长期维护：至少允许"为兼容性提交 patch"的例外，或托管一份可分发 fork 授权；否则插件失效时用户只剩"不升级 DSH"一条路 |
| A13 | tgz / `install_bundle` 安装路径 | `P/README.md:31-46` | `D/packages/boot/plugin-manager/README.zh.md:75`（git/tarball spec 先抓取、安装后才判定兼容性并回滚）；`D/docs/user/develop/basic/publish.md:186` | 公开 | B | tarball 安装的兼容性判定在**安装之后**（失败会恢复 profile 清单+锁文件）；无 `engines.dsh` 时该判定恒通过 | README 里的 `dsh plugin --profile web add <tgz-url>` 参数位置符合 0.2.1 新规（`D/docs/upgrade-guide/v0.2.1-alpha.1/plugin-option-placement/guide.md`） |
| A14 | `plugin_manager` 工具名 + `install_bundle` action | `P/README.md:31` | `D/packages/boot/plugin-manager/src/tools.ts:86,89` | 公开 | B | 工具名/枚举变更会让 README 的安装指令失效（不是插件运行时问题，是文档问题） | 用 CLI 路径作主推荐，工具路径作备选 |

### 2.B Client 半边

| # | 依赖点 | 位置（插件 file:line） | 官方实现证据 | 契约类型 | 稳定性 | 失效后果 | 建议 |
|---|---|---|---|---|---|---|---|
| B1 | `window.__ModuleLoader__.load({id, factory(require)})` 手写 CJS 工厂 bundle | `P/client.js:7-12` | `D/packages/client/web/src/boot.ts:59-61`（缺 facade 直接抛错）；`D/packages/client/modules/README.md:77`（factory 只在 materialize 时执行）；**docs 无 `__ModuleLoader__` 条目** | 内部（实现）/事实稳定 | B | 若 facade 形态改名/改签名：Client 半边整体不加载 → Web boot 审计抛**聚合错误，整页起不来**（`D/packages/client/web/src/boot-client.ts:58-90`） | 保留最小的 `load({id, factory})` 用法；不要用 `require.async`/chunk（那需要构建器配合）；升级前跑一次真页面冒烟 |
| B2 | `require('react')` 走 loader 平台种子表 | `P/client.js:10` | `D/packages/client/modules/README.md:77`（解析顺序：platform seed → memoized → boot-graph rows → factories） | 半公开（REACT 属平台种子） | A | React 不在种子表 → factory 抛错 → 同上整页起不来 | 保持只用 `react`（`useState/useEffect/useRef`），不引 `react-dom`、不引任何 `@deepseek-ai/dsh-client-*` 运行时 |
| B3 | Client 插件 `inject: ['slots','locale','shortcuts','remote','remote.session']` | `P/client.js:1320` | `D/docs/subsystems/web-client.md:60-62`（服务由 ui-session/ui-conversation 发布）；`D/packages/client/web/src/boot-client.ts:80-86`（缺服务 → pending → 审计失败） | 公开（服务名）/源码（失败形态） | B | **任一服务缺失 = 整个 Web 客户端 boot 抛聚合错误**（不是本插件静默失效）。`shortcuts` 只在 `ui-shortcuts` 载入时存在；`remote.session` 依赖 api remotes 组合 | 给 `shortcuts` 的使用加"可用即用、不可用降级"（去掉 Tab 接受，仍可点按钮接受）；或至少 CI 矩阵覆盖"无 shortcuts 的自定义组合" |
| B4 | slot `conversation.input.dock`（建议栏） | `P/client.js:1355-1357` | `D/docs/subsystems/slots.md:175`（树形清单）；`D/packages/client/ui-conversation/src/client/contract/slots.ts:290`（`kind:'list', scope:'session', owner:InputZone`） | 公开 | A | slot 被删/改 scope → `slots.inject` 永不回调，**建议栏静默消失**（无报错） | 关注 release note 的 slot 树变更；`slots.inject(name, cb)` 本身是官方容错形态 |
| B5 | slot `conversation.input.left` ×2（预测/润色按钮） | `P/client.js:1359-1365` | `D/.../contract/slots.ts:296`；渲染点 `D/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:489` | 公开 | A | 同上：按钮静默消失 | 同 B4 |
| B6 | slot `settings.section`（设置页） | `P/client.js:1368-1372` | `D/packages/client/ui-settings/src/client/contract/slots.ts:57`；官方注册形状对照 `D/packages/client/ui-settings-plugins/src/client/index.ts:76-84` | 公开 | A | 设置页消失 → 用户无法关闭/调参（但默认值仍工作） | 保留官方选项形状（`name/id/order/label/locale/inject`），勿自创字段 |
| B7 | 标准 props：`sessionId`、`useSession`、`useInput`、`inputActions`、`t`（registration 的 `locale`） | `P/client.js:671,677-679,1327` | `D/docs/subsystems/slots.md:87-102`（session scope 标准 props 表）；`D/docs/subsystems/slots.md:102`（renderer 用声明的 locale 生成 `t`） | 公开 | A | 改名/改 scope → 组件拿到 `undefined`，`useSession(...)` 立即 TypeError → React 渲染抛错（该 slot 子树崩，未必整页） | 保留；对 `useSession` 返回值做空值兜底 |
| B8 | `session.blank` / `session.running`（经 `useSession` 选择器） | `P/client.js:677-679,773-816` | 发布类型 `I/dsh-client-ui-session` 的 `SessionSnapshot`；docs 无字段级承诺（`D/docs/**` 对 `blank` 仅见 Host 侧复用语义 `D/docs/subsystems/session.md:861-862`） | 半公开 | B | 字段改名 → 自动触发逻辑失效（半开半关），不报错 | 改成"默认不自动预测、只手动"的保守回退，或至少 try/catch + 缺失即关闭 auto |
| B9 | DOM 标记 `data-composer-card` | `P/client.js:276-287,346,369,898,1385` | `D/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:417`；0.2.1-rc.2 产物命中 `I/dsh-client-ui-conversation/lib/client.js` | **内部** | C | 改名 → 定位不到 composer：inline ghost 不画、Tab 不接管、对齐测量恒 `{present:false}`。**全部静默** | 见 §3.3：把 DOM 依赖降级为"可选增强"，主路径改用 slot 提供的 props/官方 API |
| B10 | DOM 标记 `data-composer-input` | `P/client.js:268,286,1385` | `D/packages/client/ui-conversation/src/client/input/editor/ComposerContentEditable.tsx:46` | **内部** | C | Tab 接受失效（`closest('[data-composer-input]')` 找不到 → 直接 return）、ghost 定位失效 | 同上；Tab 应改为 `ctx.shortcuts.registerFixed` + slot 内自持焦点判断，不查 DOM |
| B11 | DOM 标记 `data-composer-placeholder` | `P/client.js:278,369` | `D/packages/client/ui-conversation/src/client/input/editor/DraftEditor.tsx:56` | **内部** | C | 仅影响"隐藏宿主 placeholder"这层 CSS 躲让 → 两行文字叠字（UI 错位，非报错） | 用 `:has()` 之外的方案难以避免；把该条 CSS 写成"失败也无害"的增强项即可（现状已如此） |
| B12 | CSS 变量 `--dsh-composer-hint`（读写 + 恢复） | `P/client.js:318-329,401-405` | 设置点 `D/packages/client/ui-conversation/src/client/input/editor/DraftEditor.tsx:53`；消费点 `.../skeleton/InputBar.module.css:205`（注释明说它属于"claim 的 ghost hint"） | **内部** | C | 变量不存在/语义变 → 行内模式（`display:'inline'`）静默不显示；`display` 默认值是 `'bar'`，所以**只影响非默认模式** | 行内模式标注 experimental；默认 bar 模式完全不碰该变量（现状 OK） |
| B13 | CSS 变量 `--dsh-composer-side-clearance`、`--dsh-composer-card-max-width` | `P/client.js:648-649` | `D/packages/client/ui-conversation/src/client/skeleton/InputBar.module.css`（ui-conversation 自有 local custom property）；0.2.1-rc.2 产物命中 | **内部**（跨包消费别人的 local prop） | C | 变量改名/删除 → 建议栏宽度退化（`calc(100% - 2*16px)` 兜底仍在，所以是轻微错位而非崩） | 有 `var(...,16px)` 兜底，可接受；不要在此基础上继续写死像素补偿 |
| B14 | 主题 token `--dsw-alias-label-secondary` / `-state-error-primary` / `-label-primary` | `P/client.js:266,269,1313,1315` | `D/docs/web-styling.md:14-34`（feature 组件**必须**用 `--dsw-alias-*`） | 公开 | A | token 改名 → 颜色回退到继承值（可读性下降） | 已符合规范；不要抄静态色值 |
| B15 | `sessionStorage['dsh.composer-assist.predictions.v2']` | `P/client.js:467,474,574` | 无官方承诺（各包自管键名，`D/docs/**` 对 `sessionStorage` 无约定） | 内部（自家键，无冲突风险） | A | 浏览器禁用 storage → 已有 try/catch 降级为内存（`P/client.js:492,577`） | 保持；注意 `v2` 已在键名里，将来结构变更要升版本号 |
| B16 | `window[Symbol.for('dsh.composer-assist.session-state.v2')]` 跨实例共享 | `P/client.js:495-496` | 无官方承诺；借用 `Symbol.for` 做全局单例 | 内部（自家） | A | HMR/重载后新旧 factory 共享状态，是**刻意**设计；若将来同包被两条 entry 加载会串状态 | 保持；文档里注明"同一页面只能有一个实例" |
| B17 | `ctx.locale.register(NS, {zh,en})` + `ctx.locale.bind(NS)` | `P/client.js:1322,1327` | 发布类型 `I/dsh-client-locale/lib/types/client/index.d.ts:199-226` | 公开（类型）/半公开（字符串命名空间重载） | B | 命名空间未 merge 时 TS 不过但运行时可用；若 locale 服务实现改校验 → 字典注册失败，UI 回落 key 名（如 `strip.next`） | 保留；建议 `import type {} from '@deepseek-ai/dsh-client-locale/client'` 做 namespace augmentation（需 devDeps） |
| B18 | `ctx.shortcuts.observeFixedInput`（仅观察，不注册） | `P/client.js:1378-1388` | `I/dsh-client-shortcuts/lib/types/client/types.d.ts:64-71,51-62`；`index.d.ts:33,108` | 公开 | B | 只观察不注册的后果：Tab **不进快捷键目录**、不占位、无法被用户改键；若别的 fixed action 先 consume 掉 Tab，本插件拿不到（作者已按 `defaultPrevented`/`composing`/region 过滤，属正确写法） | 若要"产品级" Tab：`registerFixed` 会同时进快捷键 UI 并参与仲裁；代价是必须给 label/i18n |
| B19 | `ctx.remote.session.modelCatalog()` | `P/client.js:1331-1337` | 发布类型 `I/dsh-api-session-controller/lib/types/index.d.ts:117` | 公开（生成 API） | B | 失败已捕获并显示 `settings.catalogFailed`（`P/client.js:1332,74-75`）→ 设置页模型下拉为空，不静默 | 现状 OK |
| B20 | 自建 `<style id="composer-assist-ghost-style">` + 向 composer DOM 追加 `<span>` | `P/client.js:252-281,298-310,415-420` | 官方组件规则要求"组件只在自身 slot 内渲染、样式走 CSS Module/主题 token"（`D/docs/defensive-patterns/client-components.md`、`D/docs/web-styling.md:14-34`） | **违反风格契约**（非硬失败） | C | React 不知道这个 span 的存在：composer 重渲染/替换 Lexical root 时 span 可能被连带清掉 → 需要 `MutationObserver`/重试（插件没有）；卸载清理靠 `ctx.effect` 手动 `disposeGhosts`（`P/client.js:1375`） | 只保留"附加装饰"语义（已 `aria-hidden`/`pointer-events:none`）；important 的是**绝不能**依赖它承载唯一信息 |
| B21 | 全局 `window` keydown 监听 | `P/client.js:918-919` | 无契约；官方推荐 `ctx.shortcuts` | 内部 | C | 与宿主快捷键竞争；卸载清理正确（effect 返回 removeEventListener） | 与 B18 合并：只走 shortcuts 服务 |

### 2.C Host 半边

| # | 依赖点 | 位置（插件 file:line） | 官方实现证据 | 契约类型 | 稳定性 | 失效后果 | 建议 |
|---|---|---|---|---|---|---|---|
| C1 | `ctx.inject(['llm','connection','sessions'], scoped => ...)` | `P/index.js:507-508` | `D/docs/cordis-api/registry.md:8-30`（callback 在服务齐备后运行，服务变化会重跑） | 公开 | A | 任一服务缺失 → **整块不注册**（5 条路由 + 事件全无），profile 无显式报错；客户端表现为 `/api/composer-assist/* 404` → 设置读取失败、建议栏不出现 | 这是**唯一**的"全有或全无"入口；建议在 `apply` 里先 `ctx.get()` 探测并 `logger.warn` 一条自诊断，避免静默 |
| C2 | `ctx.connection.fetch.register({path:'/api/...', methods, requestBody:'buffered', fetch})` ×5 | `P/index.js:12-16,513-528,534-559,575-591,593-610,612-702` | 发布类型 `I/dsh-client-connection/lib/types/rpc.d.ts:119-141`；实现 `I/dsh-client-connection/lib/index.js:823-853,926-931,973-977` | 公开（API）/半公开（path 必须含 `/api` 前缀这一点文档文案与实现不一致：类型注释写 "Absolute path below `/api`"，实际 `assertFetchRoute` 要求以 `/api/` 开头） | B | 少写 `/api` → `register` 直接抛错（响亮）；重复 path → 抛 `already registered`（响亮）；路由只在 owner Peer 可用（`I/.../index.js:823-828`，其他 principal 403） | 现状正确；5 条路由建议加版本前缀（`/api/composer-assist/v1/...`）以便未来改协议 |
| C3 | `requestBody:'buffered'` + 自限 200 KB | `P/index.js:490-496` | 同上类型；`D/docs/subsystems/web-server.md`（buffered 受配置 JSON cap 限制） | 公开 | A | 超过配置 cap → 平台层先 413，插件看不到 | OK |
| C4 | 事件 `agent/turn-stopping`，payload `{agent, turn}` | `P/index.js:563-573` | `D/docs/subsystems/core.md:1110-1134`（serial、payload 含 `signal`、可 steering）；`D/docs/event-producer-consumer.md:23`（生产者 agent-loop、消费者 hooks/workspace-changes） | 公开 | A | 事件改名/改 payload → 自动预测永不触发（**静默**，只剩手动按钮）；多客户端语义见 §3.2 | 保留；显式忽略 `signal` 是 OK 的（不 `await` 也不改变结局），但**不要再往监听器里做长任务**（serial 会 await） |
| C5 | `scoped.sessions.get(sessionId)` | `P/index.js:588,624` | 发布类型 `I/dsh-session/lib/types/index.d.ts:491`（`get(id): Session \| undefined`） | 公开 | A | 返回 undefined → 插件回 404 `会话不存在或未加载`（响亮） | OK；注意只返回 live session |
| C6 | `session.deriveMessages()` | `P/index.js:196,647` | `D/docs/subsystems/session.md:673-690`；类型 `I/dsh-session/...`（cached、冻结、每次新数组） | 公开 | A | 投影规则变化（如新增可投影事件）→ 预测上下文质量变化，不报错 | 已按 `message.source.kind`/`role` 过滤，属正确消费；不要假设消息可变 |
| C7 | `session.requestHeader()?.config.{provider,model}` | `P/index.js:331-340` | `D/docs/subsystems/session.md:194-206`（`EpochHeader.config: LlmCallConfig`）、`:625-636`（`requestHeader()` 文档） | 公开 | A | 无 header（会话第一条消息前）→ 回退到 `agentDefaultModel`，再失败则报"没有可用的模型路由"（响亮） | 可再读 `header.adapterDefaults`/`reasoningEffort` 以更贴近会话；当前只用 provider/model 足够 |
| C8 | `session.surface.nodes/replaceGeneration/contentGeneration` 组合成 `sourceOf()` | `P/index.js:249-251,627,634` | `D/docs/subsystems/session.md:400-424`（`SessionSurface` 三字段均公开、注释明确"增量消费者用 replaceGeneration 区分尾部增长与重写"） | 公开 | A | 语义变化 → stale 判定失灵（重复预测或拒绝预测），静默 | 这是插件最优雅的一处设计（用公开 generation 做乐观并发），保留 |
| C9 | `session.seq`、`session.id` | `P/index.js:649,378,564` | `I/dsh-session/lib/types/index.d.ts:154,239-241`（`get seq()` 注释说明 seq=log.length 连续性契约） | 公开 | A | — | OK |
| C10 | `ctx.llm.prepareCall(config, signal, configure)` + `call.config` + `call.stream(options)` | `P/index.js:396-416` | `D/docs/subsystems/llm-streaming.md:827,1128`；`I/dsh-llm/lib/types/index.d.ts:93-115,407`；`I/dsh-llm/lib/index.js:2245-2259` | 公开 | A（签名）/ B（`configure` 用法细节） | 见 §3.1。config 不匹配 → `INVALID_PREPARED_CALL`（响亮）；签名变化 → 加载期/调用期抛错 | 保留；把 `'low'` 换成"取 `efforts[0]`"更贴官方策略 |
| C11 | `ctx.get('fs')` → `fs.resolve(cwd,{signal})` / `fs.listDir(target, signal)` | `P/index.js:306-315,673-674` | `I/dsh-fs/lib/types/index.d.ts:94,208`；`I/dsh-fs/lib/types/types.d.ts:93-104`（`FsDirEntry.name/type`） | 公开 | A | `ctx.get` 默认 strict（只返回 active 实现）→ 沙箱/远程组合下可能 undefined，已有 `fs === undefined → ''` 降级（`P/index.js:302-303`） | OK；见 §3.7 关于"读不受沙箱约束"
| C12 | `ctx.get('subprocess').spawn({argv,cwd,stdio,graceMs,signal})` + `handle.done` + `collected.stdout.readFrom(0)` + `terminate()` | `P/index.js:282-299,673` | `I/dsh-subprocess/lib/types/types.d.ts:69-99`（`SubprocessSpawnSpec` **没有** sandbox/approval 字段）；`D/docs/subsystems/subprocess.md:137,269-278` | 公开（API）/**内部风险**（沙箱边界） | A（签名）/ C（安全语义） | 见 §3.7：**不经过工具沙箱/审批**；`git status` 在恶意仓库可触发 `core.fsmonitor` 等外部命令（外部 git 行为，**未验证**） | 建议加 `env:{GIT_CONFIG_NOSYSTEM:'1', GIT_TERMINAL_PROMPT:'0', GIT_OPTIONAL_LOCKS:'0'}` 与 `--no-optional-locks`；或直接删掉 git 探测（收益/风险比低） |
| C13 | `ctx.get('workingDirectory')?.get(session)` | `P/index.js:674` | `I/dsh-working-directory/lib/types/index.d.ts:64`（`get(session): string`） | 公开（发布类型） | A | 缺失 → `workspaceContext` 收到 undefined 返回 ''（`P/index.js:303`） | OK |
| C14 | `ctx.get('agentDefaultModel')?.currentSelection()` | `P/index.js:337` | `I/dsh-agent-default-model/lib/types/index.d.ts:42`；服务名声明 `:8` | 公开（发布类型） | B | 模型解析链第三级；缺失/换名 → 无 header 的新会话预测报错（响亮） | 可加 `requestContext()` 作为第二级补充 |
| C15 | 自写设置文件 `$DSH_HOME/composer-assist/settings.json` | `P/index.js:58,140-175` | 官方持久化建议是插件 `Config` schema + settings 服务/ profile patch（`D/docs/subsystems/settings.md:1-20`）；`ctx.storage`/`ctx.storageDomain` 是"非会话事件"的正式持久化缝（`D/docs/subsystems/storage.md:5,9`） | **内部（自造路径）** | B | `DSH_HOME` 迁移/只读 → 读写都失败，`readSettings` 静默回落 DEFAULTS（`P/index.js:145-147`），表现为"设置不保存、每次重启复原"；不受 profile 隔离、不参与导出/备份 | 保留文件做"运行时热设置"，但**把默认值同时暴露成 `Config` schema**（配置层可声明、可被 profile patch 覆盖、可在 settings UI 出现）；README 明确它不在 `$DSH_HOME/profiles/*` 里 |
| C16 | 模块级可变状态：`finishedTurns`/`predictingIn`/`deliveredTurns`/`probes`/`runningCalls`/`latestRequests` | `P/index.js:24-55,371,509-511` | 无契约（插件自有） | 内部 | B | **无上限增长**：每出现一个 session 就往 2 个 Map 写一条且只删 `finishedTurns`；长生命周期 Web host（多会话/子 agent）内存缓增；`predictingIn` 若因异常路径未清理会让该会话**永久**跳过 turn-stopping（`P/index.js:568`） | 加 LRU/TTL 清理；`predictingIn` 用 `try/finally` 保证（已有 finally，但 Map 级兜底仍建议）；`deliveredTurns` 只保留最近 N 个 session |
| C17 | `__test` 导出内部函数（`export const __test = {...}`） | `P/index.js:707`；`P/selfcheck.mjs:1-3` | 无契约（自家） | 内部 | A | 公开导出面被 selfcheck 依赖；对第三方无害但把"内部"写进包 API | 可接受；若在意 API 面，可改为 `./selfcheck` 子路径或 `#test` exports |
| C18 | 5 条 `/api` 路由的**响应契约**（客户端依赖 `ok/text/sessionId/source/revision/reason/confidence`） | `P/index.js:498-501,630,679-695`；`P/client.js:206-227` | 无第三方承诺（自家前后端协议） | 内部（自家） | A | 前后端同包同版本，风险低；但 `reason` 枚举（`stale-source`/`timeout`/`model-empty`/…）只在本仓库有定义，无文档 | 建议在 README/CHANGELOG 固定该 mini-protocol，否则外部无法调试 |

---

## 3. Lead 指定五问的详细结论

### 3.1 `ctx.llm.prepareCall` 的真实签名与语义

**签名（公开）**：`prepareCall(config: LlmCallConfig, signal?: AbortSignal, configure?: ConfigureCall): Promise<PreparedLlmCall>`
- 证据：`D/docs/subsystems/llm-streaming.md:1128`（cordis-catalog 生成块），`I/dsh-llm/lib/types/index.d.ts:407`。
- `LlmCallConfig = { provider, model, reasoningEffort?, temperature?, maxTokens?, stop? }`（`I/dsh-llm/lib/types/call-config.d.ts`）。
- `ConfigureCall = (controls: Readonly<LlmCallControls>, model: Readonly<LlmResolvedModelInfo>) => LlmCallControls`（同文件 `:36`），纯同步、失败即拒绝准备。
- `PreparedLlmCall = { config, retryPolicy, context?, inputModalities?, systemPromptUpdate?, toolUpdate?, adapterDefaults, stream(options) }`（`I/dsh-llm/lib/types/index.d.ts:93-115`）。

**插件用法逐项核对**（`P/index.js:396-416`）：
| 插件行为 | 官方语义 | 结论 |
|---|---|---|
| `prepareCall({...route, maxTokens}, signal, (controls, model) => …)` | 第二参 signal = 取消适配器能力查询；第三参同步选 controls | ✅ 合法 |
| `configure` 里找 `model.reasoning?.efforts.find(e => e.id === 'low')` | 官方承诺：`efforts` "from least to greatest"（`I/dsh-llm/lib/types/types.d.ts:366-375`）；id 是 **opaque**（`brand.d.ts:49-55`）；官方自己的策略是"取第一个条目"（`D/docs/upgrade-guide/v0.2.1-alpha.1/session-title-adapters/guide.md:12`） | ⚠️ **半公开假设**。DeepSeek 直连适配器确实有 `'low'`（`I/dsh-llm-deepseek/lib/index.js:462`），但 pi-ai 适配器的 id 来自 `getSupportedThinkingLevels()`（`I/dsh-llm-pi-ai/lib/index.js:1809`），第三方网关可自定义。找不到 `'low'` 时插件静默使用适配器默认档（可能是最高档）→ **更慢更贵且无提示** |
| `call.config` 展开进 stream options | `stream` 会校验 call-config 字段必须与 prepared config 相等，否则 `INVALID_PREPARED_CALL`（`I/dsh-llm/lib/index.js:2250-2251,2327`） | ✅ 展开是最稳妥的写法 |
| `sessionId: session.id` | `GenerateOptions.sessionId` 注释："Session identity **stamped by the loop** for request routing. Replay uses it to separate cursors"（`I/dsh-llm/lib/types/types.d.ts:548-553`） | ⚠️ 手写 call 也传 sessionId 合法，但语义是"loop 盖章"；**是否会让 replay/cursor 记录到该会话**未验证（**【推测】**：dsh-llm 自身不写 Session，replay 属 `llm-replay` 测试支持包） |
| 不设 `purpose` | `purpose?: 'compaction' \| 'session-title'`（同文件 `:555-560`） | ⚠️ 没有"prediction"档；预测调用无法被适配器/中间件按用途分类（计费、审计、限流、屏蔽） |
| 逐 chunk 读 `text-delta`，遇到 `finish.reason.kind === 'error'/'aborted'` 抛错 | `StreamChunk` 词汇公开（`I/dsh-llm/lib/types/types.d.ts`） | ✅ 正确 |

**"不写会话日志"是否成立？—— 成立，但属源码事实而非文档承诺。**
- 证据：`request/header` 的持久 append 只在 agent-loop：`I/dsh-agent-loop/lib/index.js:1226-1237`；`dsh-llm` 的 `prepareCall/stream` 不引用任何 Session（对 `I/dsh-llm/lib/index.js` 全量 grep 无 `session.append`）。
- 因此"辅助调用不计入会话"**不是官方机制**：官方唯一承认的"不入会话日志的模型调用"是 **compaction / session-title**（`purpose` 枚举），它们同样是裸 `prepareCall` + `stream`。插件做法与官方同类调用的做法**同构**，但没有名分——这既是当前可行性的基础，也是长期风险（若未来辅助调用统一走 `purpose` 白名单或统一计费/配额，predictions 会被拒绝或无名额）。
- **可取消 / 超时**：有，且是公开契约。`prepareCall` 的 signal 管能力查询；`GenerateOptions.signal` 管 dispatch/stream。插件用 `AbortController` + `setTimeout`（`P/index.js:664-666`）+ 自己的 `abortable()`（`P/index.js:354-368`）+ `AbortSignal.timeout` 包 fs/subprocess（`P/index.js:287,304`），属正确用法。注意官方 `SubprocessSpawnSpec.signal` 注释："starts the terminate escalation… The caller owns deadlines"（`I/dsh-subprocess/lib/types/types.d.ts:85-90`）——插件"signal 只是建议、真正兜底靠 `within()` + `terminate()`"的判断与官方一致。
- **模型选择**：插件三级解析（设置 → `session.requestHeader().config` → `agentDefaultModel.currentSelection()`，`P/index.js:330-340`）。官方在 0.2.1-alpha.4 起强调"插件必须在 prompt 组装前选好 provider/model/显式推理档"（`D/docs/upgrade-guide/v0.2.1-alpha.4/session-model-selection/guide.md`），插件符合；但它丢掉了 header 里的 `reasoningEffort` 并强制低档，属于**产品选择**而非契约违反。

### 3.2 `agent/turn-stopping` 与多客户端语义

**事件本身（公开）**：
- 声明：`'agent/turn-stopping'(this: Scoped<Agent>, payload: { agent: Agent; turn: number; signal: AbortSignal }): Promise<void> | void`，**serial、无 `next()`**（`D/docs/subsystems/core.md:1112-1136`）。
- 语义："轮次即将关闭：模型不再欠响应（无活动工具调用、无新 steering）。在边界提交**之前** await；提出异议的监听器通过 `agent.steer()` 让机器重读收件箱 —— 有 steering 就再跑一步，没有就关轮。**数据决定，监听器顺序不能改变结果**。"（同段）。"a tool result carrying `concludesTurn` 会在该步结束轮次"。
- 生产者/消费者矩阵：生产者 agent-loop（serial dispatch），官方消费者仅 `hooks-claude-code`、`hooks-codex`、`workspace-changes`（`D/docs/event-producer-consumer.md:23`）。
- 作用域：`Scoped<Agent>` 过滤，**未注入 Agent 的根监听器会收到每个 agent 的事件**（dsh-scope 的 dispatch 语义，见 `core.md:1136` 注释）。

**插件消费方式**：`scoped.on('agent/turn-stopping', ({agent, turn}) => { finishedTurns.set(String(agent.session.id), turn) })`，前置 `predictingIn` 防自触发、`deliveredTurns` 防重复（`P/index.js:563-573`）。合法、无 `await`、不改结局。**两点隐患**：
1. **`predictingIn` 防自触发是防错了对象**：插件的辅助调用是裸 `llm.prepareCall`，**不经过 agent-loop**，不会派发 `agent/turn-stopping`（官方"辅助调用不派发 `agent/request`"同理，见 alpha.4 guide）。而 guard 的副作用是：若真实轮次恰在预测调用在飞时结束，这条**真实**边界被吞掉 → 该轮不自动预测（静默漏一次）。不是致命，但属"为不存在的问题付真实成本"。
2. **多客户端语义不成立（这是最实质的跨端契约问题）**：
   - Host 侧 `finishedTurns`/`deliveredTurns` 是**进程级单例**（`P/index.js:41,55`），不区分浏览器。
   - `/api/composer-assist/turn` 的 `consume=1` 是"谁先到谁消费"（`P/index.js:584-587`），`deliveredTurns` 再把后续请求永久挡掉（`:571`）。
   - 结果：**开两个标签页/两个客户端（Web + Desktop）时，只有先轮询的那个会得到自动预测**；另一个永远看不到（也不会报错）。同时 `sourceMatches` 的二次校验（`P/client.js:514-521,217`）让"另一个客户端拿到结果后发现 source 不匹配"的路径变成静默丢弃。
   - 官方事件模型本身是**广播**语义（serial 派发给所有监听器），没有任何"单客户端消费"概念；插件在其上自建了单消费者队列。这是"深耦合到宿主生命周期之外"的典型例子：它假设"一个 session 只有一个 UI 消费者"。
3. 另一个副作用：`agent/turn-stopping` 也会为**子 agent** 会话触发；子会话通常没有 UI 在轮询，于是 `finishedTurns` 只增不减（与 C16 的内存问题同源）。

### 3.3 宿主 DOM 标记 / CSS 变量：是否存在文档化契约？

**结论：全部没有文档承诺；全部能在官方源码里找到确切定义点；全部在 0.2.1-rc.2 产物中存在。**

| 标记/变量 | 官方定义点（源码） | 0.2.1-rc.2 产物 | docs 是否提及 | 判定 |
|---|---|---|---|---|
| `data-composer-card` | `D/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:417` | ✅ `I/dsh-client-ui-conversation/lib/client.js` 命中 1 次 | ❌ `grep -r "data-composer" D/docs/` = 0 | 【内部】 |
| `data-composer-input` | `D/.../input/editor/ComposerContentEditable.tsx:46` | ✅ 命中 1 次 | ❌ | 【内部】 |
| `data-composer-placeholder` | `D/.../input/editor/DraftEditor.tsx:56` | ✅ 命中 1 次 | ❌ | 【内部】 |
| `--dsh-composer-hint` | 写入 `D/.../input/editor/DraftEditor.tsx:53`；消费 `D/.../skeleton/InputBar.module.css:202-207`，注释明说它服务于 "claim"（命令 chip 的 ghost hint） | ✅ 命中 2 次 | ❌（`composer-hint` 在 docs 零命中） | 【内部】 |
| `--dsh-composer-side-clearance` / `--dsh-composer-card-max-width` | ui-conversation 自有 local custom property（`InputBar.module.css`，同时被 ui-goal/ui-approval/ui-user-questions 复用） | ✅ 命中 | ❌ | 【内部】（跨包复用别人的 local prop） |
| `data-composer-assist-bar`（插件**自己**的标记） | `P/client.js:978` | — | — | 自家 |
| `data-composer-assist-continuation`（插件**自己**的标记） | `P/client.js:268,328,401` | — | — | 自家 |

补充公开面：
- 官方**公开**的 composer 扩展面是 **slot**（`conversation.input.dock`/`.left`/`.overlay`/`composer.dock`，`D/docs/subsystems/slots.md:166-180`；0.2.1-rc.2 产物里 4 个都在），以及**主题 token**（`--dsw-alias-*`，`D/docs/web-styling.md:34`）。
- 官方 stylesheet 规则说"A component may define a **local** custom property when its value is part of that component's layout…"，即 `--dsh-composer-*` 属于 ui-conversation 的**局部**契约，跨包消费 = 依赖别人的实现细节（`D/docs/web-styling.md:14`）。
- 因此三种依赖的风险排序：**slot（公开，可依赖）> 主题 token（公开）> `--dsh-composer-*` local prop（内部）> `data-composer-*` DOM（内部，最脆）**。

**slot 组件生命周期/卸载清理**：官方要求"注册进 slot 的值必须是模块作用域的稳定函数组件"（`D/docs/defensive-patterns/client-components.md` 第 3 条）；卸载清理走 `ctx.effect(() => () => cleanup)`。插件两处都做了：`StripSlot` 是 apply 内声明的稳定组件（`P/client.js:1351-1353`），外层有 `ctx.effect(() => () => disposeGhosts())`（`P/client.js:1375`）。**这是插件做得对的地方**。但 DOM 注入的生命周期不归 React 管：composer 重渲染时 span 可能被移除而插件只在下一次 `paintGhost` 时"按需重建"，没有 observer → 可能出现"ghost 消失直到下一次预测"。

### 3.4 `engines.dsh` / icon / locale 的 0.2.0 vs 0.2.1 差异

| 项 | 0.2.0-rc.2（上一 `latest`） | 0.2.1-rc.2（本机，`next`） | 插件现状 | 影响 |
|---|---|---|---|---|
| `engines.dsh` 语义 | 纯声明式；兼容性只看 `@deepseek-ai/dsh*` peer | **自身 `engines.dsh` 单独决定**，peer 被忽略；仅当 `engines.dsh` 缺失才回退 peer；`workspace:` 在 engines 里非法；`engines` 非对象/`engines.dsh` 非字符串 = 畸形清单 → 拒绝（`D/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.md`；实现 `I/dsh-app-boot/lib/index.js:276-296`） | 两者都无 | **无约束**：任何 DSH 版本都装得上（今天"能装"是运气，不是兼容） |
| 兼容性检查的"缺席分支" | — | `unmetRequirements`：无 `engines` → 无 `peerDependencies` → `return {}`，即"全部满足"（`I/dsh-app-boot/lib/index.js:287`） | 命中该分支 | 0.2.1 不会因兼容性拒绝本插件；**同理 0.3.0 也不会** |
| 拒绝记录字段 | `peers` | 改名 `requirements`（键为 `engines.dsh` 或 peer 包名） | 无关（无拒绝） | 只影响读拒绝记录的代码 |
| 图标 | 只认顶层 `package.json.icon`（技能实测结论） | 顶层 `icon` **优先**；缺失时回退 `exports["./icon"]`（`D/docs/cookbook/adding-a-package.md:148`） | 只有 `exports["./icon"]`（`P/package.json:11`） | **0.2.0 上图标静默丢失；0.2.1 正常** |
| 子路径插件展示清单 | 会读 `<pkg>/<sub>/package.json` | **一律不读**，只读 `<pkg>/<sub>/locale/*.json` 与 `<pkg>/<sub>/icon`（`D/docs/upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/guide.md`） | 插件是**包根**插件，不受影响 | 无 |
| locale 展示元数据 | 同 0.2.1（`meta.title` → 包名 → 完整 Cordis 名） | 同左 | `en.json`/`zh.json` 都有 `meta.title`/`meta.description`（`P/locale/*.json`） | 正常；缺 `files` 里没有 locale 的坑已避开 |
| `dsh plugin` 参数位置 | `--profile` 可任意位置 | **只能在转发给 pnpm 的参数之前**（`D/docs/upgrade-guide/v0.2.1-alpha.1/plugin-option-placement/guide.md`） | README 已写对（`P/README.md:42`） | 无 |

**"版本豁免机制"**：`dsh plugin --profile <p> version-exemptions` / `allow-version <pkg@ver> --dsh-version <runtime> --accept-risk`（`D/packages/boot/plugin-manager/README.zh.md:81`）。前提是**存在未满足的 requirement**；本插件没有任何 requirement，所以**连豁免机制都用不上**——不存在"它被拒绝、我豁免它"的路径，只存在"它没被检查、然后某天悄悄坏了"。

### 3.5 `ctx.get()` 读取未注入服务的语义

**公开契约**：`ctx.get(name, strict = true)` —— "Read a service from the store **without the inject requirement**"；`strict` 为 true 时**只返回 provider fiber 当前 active 的实现**；返回 `undefined` **不等于**服务不存在（可能还没提供，或已在卸载中）。证据：`D/docs/cordis-api/context.md:237-256`。
- 对比：`ctx.<name>` 属性代理**要求** inject，否则抛 `cannot get property "..." without inject`（技能实测红线）。
- 插件用法核对：
  - `scoped.get('fs')`、`scoped.get('subprocess')`、`scoped.get('workingDirectory')`、`ctx.get('agentDefaultModel')`（`P/index.js:673-674,337`）全部在 `ctx.inject([...])` 的 scoped context 上调用，且**只读、不缓存句柄**（每次请求现取）。
  - 这是**正确**用法：可选能力 + 缺失即降级（`fs === undefined → ''`，`subprocess === undefined → ''`，`agentDefaultModel` 缺失 → 最终报错）。
  - 语义陷阱（值得写进文档）：`strict:true` 意味着**服务在卸载瞬间会短暂返回 undefined**；插件把它解释成"没有这个能力"并永久降级到"无 workspace 上下文"，而不是重试。对预测场景可接受，但要意识到这不是"服务不存在"的可靠信号。
  - 另一个陷阱：`ctx.get` 不建立依赖 → host 不会因为本插件而在服务缺失时给出"pending"诊断；这也是 C1 里"建议加 logger.warn"的原因。

### 3.6 Client 其余契约（简）

- **slot 名与标准 props**：`conversation.input.dock` = `{kind:'list', scope:'session', owner:InputZone}`（`D/packages/client/ui-conversation/src/client/contract/slots.ts:290`），`InputZone = { session: SessionSnapshot, input: InputState }`（同文件 `:404-408`）；标准 props 由 scope 适配器给：`sessionId`、`useSession`、`useProjection`、`useAccess`（ui-session）+ `useConversation`、`useInput`、`inputActions`（ui-conversation）（`D/docs/subsystems/slots.md:87-100`）。插件只取其中 5 个，全部在列。**公开**。
- **locale**：`ctx.locale.register(ns, dicts)` / `bind(ns)`（发布类型 `I/dsh-client-locale/lib/types/client/index.d.ts:199-226`）；slot 注册项声明 `locale: NS` 后 renderer 生成 `t`（`D/docs/subsystems/slots.md:102`）。插件 `NS='composerAssist'` 是字符串命名空间，属"半公开"重载（官方 first-party 包都通过 `LocaleNamespaceMap` merge 强类型）。
- **shortcuts**：见 B18。`observeFixedInput` 是"观察已仲裁后的 fixed input"，**不注册、不占键位**；官方 fixed action 需 `registerFixed` 才能进目录/被改键（`I/dsh-client-shortcuts/lib/types/client/types.d.ts:73-80,102-108`）。
- **storage**：`sessionStorage` 键与 `Symbol.for` 全局键均为插件自造，无冲突面、无契约面。

### 3.7 `ctx.fs` / `ctx.subprocess` 的权限与沙箱边界（重要）

**事实链**：
1. `ctx.fs` 的**写**操作接受每次调用的 `sandboxPolicy`（`I/dsh-fs/lib/types/index.d.ts:216-237`），由调用方（工具层）把 session 的沙箱模式与 workspace root 传进来；`dsh-fs-sandbox` 的 README 明确："confines model file **writes and edits** … while **preserving the local filesystem's read behavior**"、"reads stay unconfined"（`I/dsh-fs-sandbox/README.md` Summary 段）。→ **读路径（`resolve`/`listDir`/`readText`）本来就不受沙箱约束**。
2. `ctx.subprocess.spawn` 的 spec **没有任何沙箱/审批字段**（`I/dsh-subprocess/lib/types/types.d.ts:69-99`）；沙箱是 bash 工具在调用前解析并施加的（`I/dsh-fs-sandbox/README.md`："The tool layer resolves the calling session's mode and workspace root into the same policy the bash runner receives"）。
3. 结论：
   - 插件 `workspaceContext` 只用 `fs.resolve` + `fs.listDir`（**目录名，不读内容**）+ 一条 `git status`，它"看到的世界"= 宿主机对进程可见的世界，**不是**"session 被允许的世界"。插件注释"this must never see a file the session itself cannot"（`P/index.js:260-262`）在**读**语义下是对的（session 的读也不受沙箱限制），但在**权限**语义下会误导读者以为读了策略。
   - `ctx.subprocess.spawn` 直接跑 `git -C <cwd> status`（`P/index.js:282-288`）**绕过** bash 工具的沙箱与审批：`danger-full-access` 之外的会话里，模型被限制不能执行命令，但本插件仍会在宿主机上起进程。**这是本插件最值得上报的安全/契约问题**。
   - 缓解现状：只跑 `git status`（低危但非无害：git 的 `core.fsmonitor` 可配置为任意命令、`core.untrackedCache`、`includeIf` 等；**外部 git 行为，未在 DSH 侧验证**）；`env` 未覆盖 → 继承 scrub 后的父环境（`SubprocessSpawnSpec.env` 注释 `I/dsh-subprocess/lib/types/types.d.ts:91-98`）；`graceMs:1000` + 3 s 硬超时 + `terminate()` 兜底（正确）。
   - 建议：`gitStatus` 增加 `--no-optional-locks` + `-c core.fsmonitor=false` + `env:{GIT_CONFIG_NOSYSTEM:'1'}`；或改为只读 `.git/HEAD`/`.git/index` mtime（不跑进程，彻底消除边界问题）；或干脆删掉 git 探测。

### 3.8 settings 持久化建议

- 官方**存在** `ctx.settings`（`SettingsForms`，schema 派生表单 + 写 profile patch；`D/docs/subsystems/settings.md:1-20`；类型 `I/dsh-settings/lib/types/index.d.ts`）与 `ctx.storage`/`ctx.storageDomain`（非会话事件的正式持久化缝；`D/docs/subsystems/storage.md:5,9,128`）。
- 官方**推荐的插件配置**做法：插件声明 `Config`（Schemastery schema），用户级持久值由 settings 服务写进 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`；插件通过自己的 Config 引用 `.get()` 读（`D/docs/subsystems/settings.md:5-11`；`D/docs/user/develop/basic/publish.md:126-140`）。
- 插件现状：自写 `$DSH_HOME/composer-assist/settings.json`（`P/index.js:58,140-175`）。**不是违约**（插件有权写自己的文件），但代价明确：
  1. 不出现在 settings 表单体系 → 不能被 profile patch 覆盖、不能被"打开配置文件"编辑、不参与 `dsh --dump-config`；
  2. 不受 profile 隔离（同一 DSH_HOME 下所有 profile 共享一份设置）；
  3. 无原子写（`writeFile` 直接覆盖；官方有 `dsh-atomic-write` 包，`I/dsh-atomic-write/`）→ 断电/并发可截断，虽有 `readSettings` 的 try/catch 兜底但会**静默重置全部设置**；
  4. `DSH_HOME` 未设时回退 `$HOME/.dsh`（`P/index.js:58`）—— 与官方默认一致，属【源码】事实，非文档承诺（docs 只承诺 `$DSH_HOME` 环境变量本身）。
- 建议：把**默认值 + 只读配置**放进 `Config` schema（`llm`/`maxOutputTokens`/`timeoutMs`/`enabled` 等），把**高频运行时状态**（learnStats、最近一次模式）留在 JSON；写文件改用 atomic 写（先写 `.tmp` 再 rename）。

---

## 4. 版本影响表

> 方法：`cd D/docs/upgrade-guide && grep -rln -- <keyword> .`，逐条读命中文件；再对本机 0.2.1-rc.2 产物做字符串核实。

### 4.1 upgrade-guide 全量 grep 结果（对本插件有意义的命中）

| keyword | 命中文件 | 与本插件关系 |
|---|---|---|
| `composer` | `v0.2.1-rc.2/file-drag-callbacks/guide.md` | 只影响 `conversation.input.attachments` 的公开 props（"公开 props 不变"）；本插件不用该 slot → **无关** |
| `composer-hint` / `data-composer` / `input.dock` / `settings.section` / `observeFixedInput` / `turn-stopping` / `deriveMessages` / `sessionStorage` | **0 命中** | 印证 §3.3：这些依赖面**从未被官方在变更日志里承诺过**，因此也**不会因"破坏性变更清单"而提前通知**——只能靠读代码/冒烟发现 |
| `prepareCall` / `ctx.llm` / `reasoning effort` | `v0.2.1-alpha.1/session-title-adapters/guide.md`；`v0.2.1-alpha.4/session-model-selection/guide.md`；`v0.2.1-rc.2/conditional-tools/guide.md` | ① 标题策略用 `prepareCall`，明确"现有具体 `prepareCall()` 输入仍然有效"（**兼容承诺**）；② `efforts` 必须按从低到高、策略取第一条；③ 辅助调用（compaction）**不派发** `agent/request`；④ 插件须在 prompt 组装前选好 route/effort → 本插件的 `'low'` 查找方式与新策略不一致 |
| `engines.dsh` | `v0.2.1-alpha.3/plugin-engines-dsh/guide.md` | 见 §3.4 |
| `client-ui-conversation` / `shortcuts` | 仅 `v0.2.1-alpha.2/desktop-font-size-shortcuts/guide.md`、`from-default-profile-replaces-target` | 不涉及 slot/observeFixedInput 语义变更 |

补充（同 grep 未命中但与本插件相邻、需关注的指南）：
| 指南 | 相关性 |
|---|---|
| `v0.2.1-filter-.../session-projection-handles`（rc.2） | Client 会话投影句柄变化 → 影响 `useSession` 返回快照的形态（插件用 `blank`/`running`，属半公开字段） |
| `v0.2.1-rc.2/webserver-index-peer` | index 注入按 Peer 收集 → 影响 client bundle 注入（插件依赖 `__ModuleLoader__` 与 boot graph） |
| `v0.2.1-rc.2/new-session-blank-reuse` | `blank` session 复用语义变化 → 直接影响"新会话空白态是否触发预测" |
| `v0.2.1-alpha.4/session-model-selection` | 模型选择必须在组装前完成；`agent/request` 弃用 → 插件未用，但 `requestHeader()` 的写法是正确替代 |

### 4.2 0.2.0 → 0.2.1 破坏性变更命中点

| 变更 | 证据 | 对插件命中？ | 风险等级 |
|---|---|---|---|
| `engines.dsh` 从声明变强制且压过 peer | `D/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.md`；`I/dsh-app-boot/lib/index.js:276-296` | **未命中（因为两者都没写）**，但这恰恰是最坏情况：今天免检，未来也免检 | **高** |
| 图标新增 `exports["./icon"]` 回退 | `D/docs/cookbook/adding-a-package.md:148` + 技能实测 0.2.0 差异 | **命中（改善方向）**：0.2.0 缺图标，0.2.1 正常 | 中 |
| 子路径插件不再读 `package.json` | `D/docs/upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/guide.md` | 未命中（包根插件） | 低 |
| `dsh plugin --profile` 参数位置 | `D/docs/upgrade-guide/v0.2.1-alpha.1/plugin-option-placement/guide.md` | README 已正确 | 低 |
| 拒绝记录 `peers` → `requirements` | 同上 engines guide | 未命中（无拒绝） | 低 |
| Client 侧 slot/标准 props 在本区间**无破坏性条目** | §4.1 grep | 未命中 | 低 |
| Host 侧 `prepareCall` 在本区间**保持兼容** | `session-title-adapters` guide "Existing concrete `prepareCall()` inputs remain valid" | 未命中 | 低 |
| DOM 标记/CSS 变量在本区间无变更公告，但**源码可能已变**（无法从 changelog 判断） | §3.3 + 0.2.1 产物 grep | **潜在命中** | **高**（无预警类） |

**一句话**：0.2.0→0.2.1 对本插件**没有硬命中**，唯一实质变化是"图标从坏变好"。真正的风险不是这次升级，而是**下一次没有任何 changelog 覆盖 DOM 标记/`--dsh-composer-*`/`session.blank` 的升级**。

---

## 5. 维护层风险 Top 5

### R1（最高）契约无声明 + 无 CI → 升级静默失效无法被提前发现
- **证据**：`P/package.json` 无 `engines`/`peerDependencies`（→ 兼容性检查直接 `return {}`，`I/dsh-app-boot/lib/index.js:287`）；仓库无 CI、无 test/lint 脚本（`P/package.json` 无 `scripts`，`P/selfcheck.mjs` 只测纯函数、不启动 Host/Client）；插件最脆的四类依赖（DOM 标记、`--dsh-composer-hint`、`useSession` 字段、`sessionStorage`）在官方 upgrade-guide 里**零命中**（§4.1）。
- **失效形态**：装得上 → 跑起来 → 建议栏/按钮/Tab 之一不工作，无日志、无报错。
- **可行建议**：
  1. `"engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }`（先 pin 到实测区间；一旦声明它就单独决定兼容性，所以区间必须覆盖真正支持的版本）；
  2. 加 `scripts.verify`：`node selfcheck.mjs` + `node -e "import('./index.js')"` + 一条 `--dump-config` 冒烟（`dsh --profile <p> --dump-config | grep composer-assist`）；
  3. 加 GitHub Actions 矩阵：`dsh` 版本 × {`node selfcheck`, `--dump-config`, 真页面 Playwright 冒烟（断言 slot 注册与 `data-composer-card` 存在）}，任一版失败即 CI 红；
  4. 在 selfcheck 里加"契约自检"：断言 `package.json` 的 `exports`/`locale`/`icon` 能被 `resolve`、`dsh.client.inject` 的 5 个服务名在目标版本产物里存在、DOM 选择器在当前 `lib/client.js` 里能命中——**这就是"契约漂移探测器"**。

### R2 Client 半边依赖未文档化的 DOM 标记与跨包 CSS 变量
- **证据**：`P/client.js:276-287,318-329,346,369,648-649,898,1385` vs `D/.../InputBar.tsx:417`、`ComposerContentEditable.tsx:46`、`DraftEditor.tsx:53,56`、`InputBar.module.css:202-207`；docs 零命中（§3.3）。
- **失效形态**：inline 模式不显示（CSS 变量被占用/改名）、Tab 失效、建议栏宽度错位、ghost 被宿主 placeholder 叠字。
- **可行建议**：
  1. **默认路径不依赖 DOM**：bar 模式（默认）本来就是 slot 内渲染，只需让"测量/对齐"变成可选增强（失败即用 `width:100%`）；
  2. inline 模式与 Tab-DOM 判断标注 `experimental / best-effort`，探测失败时降级为"点按钮接受"；
  3. Tab 改用 `ctx.shortcuts.registerFixed`（公开 API，进快捷键目录），焦点判断用 slot props 而非 `closest('[data-composer-input]')`；
  4. 给 `paintGhost` 加一次 `MutationObserver` 重挂或 `requestAnimationFrame` 校验，避免 composer 重渲染后 ghost 消失。

### R3 `ctx.subprocess.spawn` 绕过工具沙箱/审批（安全与合规面）
- **证据**：`P/index.js:278-299`；`I/dsh-subprocess/lib/types/types.d.ts:69-99`（spec 无 sandbox/approval）；沙箱由工具层施加（`I/dsh-fs-sandbox/README.md`）；fs 读路径本就 unconfined。
- **失效形态**：在只读/受限会话里，插件照样在宿主机起 `git` 进程；若仓库配置了 `core.fsmonitor`/恶意 `includeIf` 等，可执行外部命令（外部 git 行为，**未验证**）。
- **可行建议**：① 删掉 git 探测（收益 ≈ 一行 branch 名）；② 或改为纯文件读（`.git/HEAD`、`.git/index` 的 mtime）；③ 必须跑进程时：`--no-optional-locks`、`-c core.fsmonitor=false`、`env:{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}`，并在 README 里声明"本插件会以宿主用户权限执行 git"。

### R4 「辅助调用不计入会话」没有官方名分
- **证据**：`GenerateOptions.purpose` 只有 `'compaction' | 'session-title'`（`I/dsh-llm/lib/types/types.d.ts:555-560`）；官方辅助调用同样走裸 `prepareCall`（`D/docs/upgrade-guide/v0.2.1-alpha.1/session-title-adapters/guide.md`）；`request/header` 由 agent-loop 写（`I/dsh-agent-loop/lib/index.js:1226-1237`）。
- **失效形态**：若未来给"辅助调用"加统一分类/配额/审计/计费开关（`purpose` 白名单化），predictions 无档可归 → 被拒或无法统计；若未来 Session 增加"所有 provider HTTP 必须留痕"的审计，插件是唯一绕过路径。
- **可行建议**：① 在 README/设计里显式声明"每次预测是一次**独立计费**的模型调用，不进会话日志、不占会话 token 预算"；② 请求里带 `purpose` 时优先用官方枚举（当前不能）；③ 观察 `dsh-llm` 的 `GenerateOptions` 变更（这是唯一需要盯的 P0 类型）；④ 给预测调用加自己的成本上限（已有 `maxOutputTokens`/`timeoutMs`）并在设置页显示累计次数。

### R5 模型/推理档解析的假设过强（`'low'` 按名查找 + 单档强制）
- **证据**：`P/index.js:396-399`；官方 effort id 为 opaque（`I/dsh-llm/lib/types/brand.d.ts:49-55`）、`efforts` 有序（`I/dsh-llm/lib/types/types.d.ts:366-375`）、官方策略取第一条（`session-title-adapters` guide）。
- **失效形态**：第三方/pi-ai 模型没有名为 `low` 的档 → 静默用适配器默认档（可能最高）→ 预测变慢/变贵/超时率上升，无提示。
- **可行建议**：`const low = model.reasoning?.efforts[0]`（取最低档），并把选中的 effort id 写进 `/probe` 或日志；设置页显示"本次预测使用推理档 X"。

**次要但建议一起修的**：C16 内存表无界（session/子 agent 越多越大）、C15 设置写非原子（截断即静默重置）、B3 `shortcuts` 缺失会让**整页 boot 失败**（应降级而非硬依赖）。

---

## 6. 逐接口判定：深耦合 vs 公开契约

| 半边/接口 | 判定 | 依据 |
|---|---|---|
| `dsh.bundle.patch` / `cordis.patch.yml` | **公开** | `D/docs/user/develop/basic/publish.md:13,55-66` |
| `dsh.client.{platform,immediately,inject}` | **公开** | `D/docs/subsystems/client-modules.md:15-40,94` |
| `exports`/`files`/locale meta/icon | **公开** | `D/docs/cookbook/adding-a-package.md:125-160`；icon 的 0.2.0 差异为公开变更 |
| `engines.dsh`/`peerDependencies` | **公开（建议）但插件未使用** | `publish.md:66,105`；实现 `I/dsh-app-boot/lib/index.js:276-296` |
| `window.__ModuleLoader__.load` / `require('react')` | **内部（事实稳定）+ 半公开（react 平台种子）** | `D/packages/client/web/src/boot.ts:59-61`；`D/packages/client/modules/README.md:77`；docs 无条目 |
| `ctx.slots.inject/register` + 4 个 slot 名 | **公开** | `D/docs/subsystems/slots.md:166-180`；`contract/slots.ts:290-296`；`D/docs/defensive-patterns/client-components.md` |
| slot 标准 props（sessionId/useSession/useInput/inputActions/t） | **公开** | `D/docs/subsystems/slots.md:87-102` |
| `session.blank` / `session.running`（Client 快照字段） | **半公开** | 发布类型有、docs 无字段级承诺 |
| `ctx.locale.register/bind` | **公开（类型）/半公开（字符串 ns 重载）** | `I/dsh-client-locale/.../index.d.ts:199-226` |
| `ctx.shortcuts.observeFixedInput` | **公开**（但"只观察不注册"是用法选择，不是契约保证） | `I/dsh-client-shortcuts/.../types.d.ts:64-108` |
| `ctx.remote.session.modelCatalog` | **公开（生成 API）** | `I/dsh-api-session-controller/.../index.d.ts:117` |
| `data-composer-card` / `data-composer-input` / `data-composer-placeholder` | **内部（最脆）** | 源码存在、docs 零命中、0.2.1 产物存在 |
| `--dsh-composer-hint` | **内部** | `DraftEditor.tsx:53` + `InputBar.module.css:202-207`（明确服务于 host 自己的 claim hint） |
| `--dsh-composer-side-clearance` / `--dsh-composer-card-max-width` | **内部（跨包 local prop）** | `InputBar.module.css`；`D/docs/web-styling.md:14`（local prop 属组件自身布局契约） |
| `--dsw-alias-*` | **公开** | `D/docs/web-styling.md:34` |
| `sessionStorage` 键 / `Symbol.for` 键 / 自建 style+span | **内部（自家）** | 无契约面、无冲突面 |
| `ctx.inject(['llm','connection','sessions'])` | **公开** | `D/docs/cordis-api/registry.md:8-30` |
| `ctx.get(name)` 可选能力 | **公开** | `D/docs/cordis-api/context.md:237-256` |
| `ctx.connection.fetch.register` + 5 条 `/api` 路由 | **公开（API）/半公开（path 含 `/api` 的实情）** | `I/dsh-client-connection/.../rpc.d.ts:119-141`；实现 `index.js:823-853,926-931,973-977` |
| `agent/turn-stopping` | **公开** | `D/docs/subsystems/core.md:1110-1136`；`D/docs/event-producer-consumer.md:23` |
| `session.deriveMessages` / `requestHeader` / `surface.*` / `seq` / `id` | **公开** | `D/docs/subsystems/session.md:400-424,625-636,655-690`；`I/dsh-session/.../index.d.ts:154,239-241,491` |
| `ctx.llm.prepareCall` + `GenerateOptions` | **公开（签名）/半公开（`'low'` 假设、`sessionId` 由 loop 盖章、无 `purpose`）** | `D/docs/subsystems/llm-streaming.md:827,1128`；`I/dsh-llm/.../index.d.ts:93-115,407`；`types.d.ts:506-560` |
| `ctx.fs` | **公开（API）** | `I/dsh-fs/.../index.d.ts:94,208` |
| `ctx.subprocess.spawn` | **公开（API）/ 沙箱语义内部且危险** | `I/dsh-subprocess/.../types.d.ts:69-99`；`I/dsh-fs-sandbox/README.md` |
| `ctx.get('workingDirectory'/'agentDefaultModel')` | **公开（发布类型）** | `I/dsh-working-directory/.../index.d.ts:64`；`I/dsh-agent-default-model/.../index.d.ts:8,42` |
| `$DSH_HOME/composer-assist/settings.json` | **内部（自造）** | 官方替代：`D/docs/subsystems/settings.md:1-20`、`storage.md:5` |

**总判定**：
- **Host 半边 = "用公开契约搭的、带一个自造存储和一个越界 subprocess"**。除 C15（自写 settings 文件）与 C12（未沙箱化的 spawn）外，其余全部落在公开 docs 或发布类型上；`sourceOf()` 用 `SessionSurface` generation 做乐观并发甚至是"教科书式公开契约用法"。
- **Client 半边 = "slot 公开 + 表现层深耦合"**。注册方式、props、locale、生命周期都合规；但**所有看起来"像原生输入框"的效果**（行内 ghost、Tab、placeholder 躲让、像素级对齐）都建立在**未文档化的 DOM 与 CSS 变量**上。这就是它"能用但脆"的根因：功能主路径（slot 里画一条建议栏）是公开的，**体验主路径**（画在输入框里、Tab 接受）是内部的。
- **分发层 = 公开契约，但缺少 engines/peer 的自保声明** + 一个 0.2.0 才有的图标兼容坑。

---

## 7. 未验证项（明确标注）

1. `git status` 在恶意仓库中触发 `core.fsmonitor` 等外部命令 —— **git 侧行为，未在本机验证**；也未验证 DSH 的 `subprocess-local` 是否会额外施加限制（从 `SubprocessSpawnSpec` 类型看不会）。
2. `GenerateOptions.sessionId` 在**非 loop** 调用中是否被 `llm-replay`/checkpoint 策略记录 —— 未读 `dsh-llm-replay` 实现（不在稀疏 checkout 内，本机有包但未展开核实）。
3. `--dsh-composer-hint` 的"写后恢复"在并发场景的正确性（多个 ghost 同时写同一元素）—— 插件用 `ownedHints` 记录原值，但未验证 host 在渲染过程中重设该变量的时机。
4. `useSession(s => s.blank)` / `s.running` 在 0.2.1-rc.2 的 `SessionSnapshot` 上是否与 0.2.0 完全同义 —— 只确认字段存在于发布类型，未逐版 diff。
5. `ctx.locale.register('composerAssist', {zh,en})` 的字符串命名空间在**运行时**是否要求先声明 `LocaleNamespaceMap` —— 只确认 3 参重载存在；未做运行时实验。
6. 多客户端测试：**未实际开两个标签页验证**"只有一个客户端拿到 turn"，结论来自代码路径（`consume=1` + `deliveredTurns` + 进程级 Map）推演。
7. 0.2.0-rc.2 上图标是否真的不显示 —— 依据技能 `dsh-plugin-construction` 的**已实测结论**与 0.2.0-rc.2 升级指南的措辞，本机只装了 0.2.1-rc.2，无法直接复验。
8. `dsh.client.inject` 中列出的 `dsh-client-ui-settings-general` 是否在所有官方组合（web/desktop/headless）中都存在 —— 只确认包在本机安装中存在；自定义组合可能没有它（不过按 `system.ts:274-277`，缺失不会硬失败）。

## 8. 复现命令（供 Lead/评审复核）

```sh
# 插件侧
grep -n "engines\|peerDependencies\|icon\|exports\|dsh" <PLUGIN_CHECKOUT>/package.json
grep -n "prepareCall\|turn-stopping\|connection.fetch.register\|deriveMessages\|requestHeader\|ctx.get" <PLUGIN_CHECKOUT>/index.js
grep -n "data-composer\|composer-hint\|__ModuleLoader__\|sessionStorage\|slots.register\|observeFixedInput" <PLUGIN_CHECKOUT>/client.js

# 官方文档承诺
cd <DSH_REPO_CHECKOUT> && grep -rln "data-composer\|composer-hint" docs/            # → 空
grep -rn "agent/turn-stopping" docs/subsystems/core.md docs/event-producer-consumer.md
sed -n '66p' docs/user/develop/basic/publish.md                                # engines.dsh 建议
sed -n '148p' docs/cookbook/adding-a-package.md                                # icon 两种写法

# 0.2.1-rc.2 本机产物（实现事实）
I=<DSH_INSTALL_DIR>/node_modules/@deepseek-ai
grep -c "data-composer-card\|data-composer-input\|dsh-composer-hint" $I/dsh-client-ui-conversation/lib/client.js
grep -o "conversation\.[a-z.-]*" $I/dsh-client-ui-conversation/lib/client.js | sort -u | grep "input\.\(dock\|left\)"
sed -n '276,296p' $I/dsh-app-boot/lib/index.js            # 无 engines 无 peer → 全部满足
sed -n '2245,2259p' $I/dsh-llm/lib/index.js                # INVALID_PREPARED_CALL
sed -n '823,853p;926,931p;973,977p' $I/dsh-client-connection/lib/index.js   # fetch route 语义
sed -n '69,99p' $I/dsh-subprocess/lib/types/types.d.ts    # spawn spec 无沙箱字段
```

---

## 9. 与 Doc2「M1–M10」的对照：需要修正/升级的事实

> 结论先行：**M1–M10 的方向都成立**，但有 3 处证据定位错误、2 处结论需升级、1 处过度悲观。以下按 Doc2 编号给差异，供 Lead 直接改 Doc2 第 5 节。

| Doc2 条目 | 现有表述 | 本次核实 | 建议改法 |
|---|---|---|---|
| **M1 证据表** | 4 个 DOM 标记的"官方出现位置"列成 `ui-model-selection/ModelSelect.tsx:673`、`ui-input-trigger/MenuView.tsx:86`、`ui-message-feedback/FeedbackDialog.tsx:53` 与**测试文件** | **定义者被漏了**：`data-composer-card` 定义在 `ui-conversation/src/client/skeleton/InputBar.tsx:417`；`data-composer-input` 在 `input/editor/ComposerContentEditable.tsx:46`；`data-composer-placeholder` 在 `input/editor/DraftEditor.tsx:56`；`--dsh-composer-hint` 由 `DraftEditor.tsx:53` **写入**、由 `InputBar.module.css:202-207` **消费**（注释明说服务 host 自己的 claim hint）。ModelSelect/MenuView/FeedbackDialog 只是"外部消费方" | 补 4 行定义者路径；结论从"仅源码/测试使用"改为"**定义者是 ui-conversation，另有 3 个官方包也在消费**"——后者反而说明它短期不会随意改名（多包耦合），但**仍无承诺** |
| **M1 失效形态第 3 条** | "`session.surface.nodes` 结构变化 → `sourceOf()` 抛错（`index.js:249-251`），调用点在 try 之外（`index.js:627`）→ `/suggest` 500" | `sourceOf` 用的是**公开文档化的 `SessionSurface`**（`D/docs/subsystems/session.md:400-424`：`nodes`/`replaceGeneration`/`contentGeneration` 三字段均有注释与增量消费者语义），不是 DOM/CSS 内部契约。把它算进 M1 会**混淆"内部实现依赖"与"公开契约依赖"** | 从 M1 移除，单列一条"**公开 API 但调用点未防御**"：`sourceOf` 建议包 try/catch（路由 500 与"契约是否公开"是两个问题） |
| **M3 "prepareCall 旧签名"** | "插件调用单 config 对象签名，而旧版是 `prepareCall(provider, model, signal)`；**在 0.2.0 上可能直接抛错**" | **冲突**：`prepareCall(provider, model, signal)` 是 **`LlmAdapter` 子类**上的方法（`D/docs/subsystems/llm-streaming.md:928`，位于 `LlmAdapter` 契约小节），不是 `LlmRuntime` 的旧 API；`LlmRuntime.prepareCall(config, signal, configure)` 在 0.2.1-alpha.1 期间就是既有 API，且指南明写"**Existing concrete `prepareCall()` inputs remain valid**"（`D/docs/upgrade-guide/v0.2.1-alpha.1/session-title-adapters/guide.md:12`） | 删掉"0.2.0 上可能直接抛错"这一句（或标注**未验证**）；M3 的真实风险只剩 engines/icon |
| **M3 "locale 元数据同理"** | "locale 元数据同理依赖 `exports["./locale/*.json"]`，在 0.2.0 的展示元数据解析路径上**未必生效**" | **过度悲观**：0.2.0-rc.2 就会读 locale 的 `meta.title/description`（`D/docs/upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/guide.md` 说明 0.2.0 "`name` and `description` filled missing locale fields"）；0.2.1 新增的只是 **icon 的 `exports["./icon"]` 回退** | 只保留 icon 差异；locale 改为"0.2.0/0.2.1 都正常" |
| **M4 结论** | "插件自己维护 `predictingIn`/… 把**自己产生的边界**排除掉…这是**正确但不优雅**的做法" | **需升级**：插件的辅助调用是裸 `llm.prepareCall`，**不经过 agent-loop**，因此**根本不会派发 `agent/turn-stopping`**（`request/header` 的 append 只在 `I/dsh-agent-loop/lib/index.js:1226-1237`）。`predictingIn` 防的是**不存在的事件**，而它的真实副作用是：真实轮次若与预测调用同时在飞，边界被误判为"我们自己的"而**吞掉**（`P/index.js:568`） | 改为"**过度防御，且有吞真实边界的小概率**"；建议删除（裸调用没有 agent，"按 agent 过滤"也不可行） |
| **M5 多客户端** | 标注为"**推断**" | 可升级为"**代码推演确定**"：`/turn` 的 `consume=1` 先到先写 `deliveredTurns`（`P/index.js:584-587`），`deliveredTurns` 再永久挡后续（`:571`），Host 侧 Map 是进程级单例（`:41,55`）；未做双标签实测，但三条路径互相印证 | 证据等级从"推断"升为"代码推演"；同时补一条 **M5 未提的副作用**：`agent/turn-stopping` 对**子 agent 会话**同样触发 → `finishedTurns` 只增不减（与 E4 的 Map 清理合并） |
| **M2 快捷键** | "`ctx.shortcuts.observeFixedInput` 是官方快捷键席位的用法…不需要改" | 精度需补：`observeFixedInput` 只"观察已仲裁输入"，**不注册** fixed catalog、**不占键位**、不进快捷键设置 UI；官方 `registerFixed` 才做这些（`I/dsh-client-shortcuts/lib/types/client/types.d.ts:73-108`）。因此"符合契约"成立，但"Tab 不被别人先消费""用户可改键"**都没有保证** | 在 M2 加半句限定；不改变"不需要改"的结论 |
| **M7 安装** | "给 `plugin_manager` 安装路径写一句「0.2.1 会按 engines.dsh 检查兼容性」（声明后自然生效）" | 需补两点：① 声明 `engines.dsh` 后 **peer 被忽略**，区间必须覆盖真正支持的所有版本（`D/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.md` 迁移 1）；② **tarball/git spec 的兼容性判定发生在安装之后**，失败才回滚 profile 清单与锁文件（`D/packages/boot/plugin-manager/README.zh.md:75`），不是下载前拦截 | M7 建议补这两句 |

**Doc2 完全没有、本调查新发现的高价值项（建议新增 M11）**：
- `ctx.subprocess.spawn`（`P/index.js:282-288`）**绕过工具沙箱与审批**：`SubprocessSpawnSpec` 没有任何 sandbox/approval 字段（`I/dsh-subprocess/lib/types/types.d.ts:69-99`），沙箱由 bash 工具在调用前施加（`I/dsh-fs-sandbox/README.md` Summary："The tool layer resolves the calling session's mode and workspace root into the same policy the bash runner receives"）；而 `ctx.fs` 的**读**路径本来就 unconfined（同 README："reads stay unconfined"）。即：受限会话里模型不能执行命令，但本插件仍会在宿主机跑 `git status`。建议作为 M6 之外的安全条目（或并入 M6 作"主机面副作用"）。
