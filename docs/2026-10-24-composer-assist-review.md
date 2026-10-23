# dsh-composer-assist 可行性议题报告

> 注：为提交到公开仓库，本文把审查机器的本地路径替换为占位符：`<DSH_INSTALL_DIR>` = DSH 运行时安装目录，`<DSH_REPO_CHECKOUT>` = deepseek-harness 仓库检出，`<PLUGIN_CHECKOUT>` = dsh-composer-assist 仓库检出，`<REVIEW_DIR>` = 审查材料目录。行号与结论不受影响。
> 对 [Lphehe/dsh-composer-assist](https://github.com/Lphehe/dsh-composer-assist) 的工程化、文档、新老冲突与 DSH 维护层审查。
> 配套文档：[2026-10-24-dsh-architecture-review.md](./2026-10-24-dsh-architecture-review.md)（DSH 分层与插件层深潜）。

| 项 | 值 |
|---|---|
| 审查对象 | `Lphehe/dsh-composer-assist`，`main` @ `b626b67`（v0.1.1，2026-10-24 00:36 +08:00） |
| 审查基线 | DSH `0.2.1-rc.2`（本机安装 `<DSH_INSTALL_DIR>/`）+ 官方仓库 `deepseek-ai/deepseek-harness` @ `22ddee3` |
| 方法 | 全量通读 `index.js`(707) / `client.js`(1392) / `selfcheck.mjs`(317)；逐条读 11 笔提交；跑通 `node selfcheck.mjs`；下载 release tgz 与源码逐文件比对；对照官方 `docs/` 与 `packages/` 源码核对每个被依赖的接口 |
| 未覆盖 | 未在本机 profile 安装运行该插件（不改动用户配置），UI 结论来自代码与截图；真实多标签页/真实模型链路未实测，涉及处标注证据等级（源码事实 / 代码推演 / 推断 / 未验证） |

---

## 0. 摘要

**一句话结论**：这是一个功能完整度与细节打磨都明显高于平均水平的 DSH Web 插件——有 Host/Client 双半边、有会话级状态、有过期保护、甚至有可执行的 `selfcheck.mjs`；但它把「30 小时原型」的工程结构直接带进了 v0.1.1 发布：**单文件超阈值、调试脚手架常驻生产、与宿主的非公开 DOM 契约深耦合、版本兼容/CI/变更记录全部缺位**。这些不是功能 bug，而是会随 DSH 升级逐条引爆、并让外部贡献者无法介入的维护债。

关键量化事实：

| 指标 | 实测 | 判读 |
|---|---|---|
| `client.js` | 1392 行 | 超过 1000 行阈值 39%，且单文件承担 9 类职责 |
| `index.js` | 707 行 | 未超阈值，但混合 prompt/转录/工作区/路由/测试钩子 |
| 调试探针调用 | `reportProbe()` 14 处调用 + 1 处定义，其中 1 处在 **React render 函数体**里（`client.js:943`，每次击键重渲染即 POST）；Host 常驻 5 条 `/api/composer-assist/*` 路由，`probe` 可读回草稿/候选文本 | 开发期验证设施进入发布版，兼有隐私与性能成本 |
| 数字设置项 | 清空 `<input type=number>` → `Number('')===0` 直接保存；Host 不校验 4 个数值字段范围（`client.js:1197-1205`、`index.js:151-175`） | 一次误操作即可让功能「看起来坏了」（E11） |
| 外部契约依赖 | 十余个宿主接口：公开契约（slot / locale / shortcuts / `prepareCall` / `agent/turn-stopping` / `deriveMessages` / `ctx.get` 服务）与未文档化实现（4 个 DOM 标记 + 2 个 CSS 变量 + `session.surface` 调用点）混用 | 宿主升级即可静默错位 |
| 安全边界 | 工作区上下文用 `ctx.subprocess.spawn` 直接起 `git`，绕过工具层沙箱/审批（`index.js:282-288`） | 受限会话里仍有宿主机执行通道（M11） |
| 版本兼容声明 | `package.json` 无 `engines.dsh`、无 `peerDependencies` | 0.2.1 起兼容性检查完全绕过 |
| 发布物一致性 | release `v0.1.1` tgz（37,793 B，9 个文件）与仓库源码**逐字节一致** | 这点做得对，应保持 |
| 测试/CI | `selfcheck.mjs` 本地可通过；无 `.github/`、无 test runner、无锁文件 | 回归不可见 |
| 文档 | README 136 行、中英双语、设计说明细；但截图过期、无 CHANGELOG、无版本矩阵 | 文档质量高但维护滞后 |

严重度分布（详见各节编号）：

| 角度 | 高 | 中 | 低 |
|---|---|---|---|
| 工程化（E） | E1、E4、E5、E7、E11、E12 | E2、E3、E6、E13 | E8、E9、E10 |
| 文档（D） | D1、D5 | D2、D3、D4、D9 | D6、D7、D8 |
| 新老冲突（N） | N2、N3 | N1、N4、N5 | N6、N7、N8、N9 |
| 维护层（M） | M1、M3、M5、M11 | M4、M6、M7、M9 | M2、M8、M10 |

建议节奏（详见第 6 节）：**v0.1.2 止血**（文档 + 兼容声明 + 数字设置校验 + 调试面开关 + 工作区上下文开关，1～2 天）→ **v0.2.0 拆分**（client 拆模块 + 构建 + CI，约 1 周）→ **v0.3.0 契约层**（宿主适配层 + 多客户端投递 + 上游提议）。

---

## 1. 仓库快照（事实卡）

### 1.1 文件与职责

| 文件 | 行数 | 实际职责（按代码段） |
|---|---|---|
| `index.js` | 707 | Host 半边：常量与路由名（12-16）、调试状态（24-33）、默认设置（60-86）、系统提示词（88-98）、设置读写与串行化（109-175）、转录压缩（177-246）、来源指纹（249-251）、工作区上下文（264-328）、模型路由（331-340）、辅助 LLM 调用（353-417）、候选解析（419-487）、5 条 HTTP 路由（489-702）、测试钩子导出（707） |
| `client.js` | 1392 | Client 半边：内联中英字典（17-136）、设置 store（138-177）、HTTP 封装（179-244）、DOM 幽灵预览与样式注入（246-420）、模块级会话状态（422-634）、样式常量（639-668）、`SuggestionStrip`（671-1026）、`PredictButton`（1029-1088）、`PolishButton`（1091-1141）、`SettingsSection`（1144-1317）、slot 注册与快捷键（1319-1392） |
| `selfcheck.mjs` | 317 | 断言脚本：解析器/统计/转录（3-51），再用 `vm.runInNewContext` 执行**真实 client.js**（53-228），最后跑 Host 路由（229-316） |
| `README.md` | 136 | 安装、设置、设计要点、硬超时、实现说明、成本、自检、许可 |
| `locale/{en,zh}.json` | 各 6 | **仅**插件市场展示用的 `meta.title/description` |
| `package.json` | 44 | 无 scripts / devDependencies / engines / peerDependencies |
| `cordis.patch.yml` | 3 | `insert` 一行 bundle 行 |

仓库总计 2416 行 JS/MJS；**唯一超过 1000 行的文件是 `client.js`**。

### 1.2 提交与发布

- 11 笔提交，时间跨度 **2026-10-22 18:20 → 2026-10-24 00:36**（约 30 小时），作者 `Lphehe`(9) + `lphehe-bot`(2)，即单人高强度迭代。
- 只有 `v0.1.1` 一个 tag/release；README:52 的「v0.1.1 沿用 0.1 系列」暗示存在 0.1.0，但仓库**没有 v0.1.0 tag，也没有 CHANGELOG**（见 D5/D6）。
- release tgz 下载后与源码逐文件 `diff` 全部 SAME（`client.js`、`index.js`、`package.json`、`README.md`、`LICENSE`、`icon.svg`、`cordis.patch.yml`、`locale/*.json`），说明发布流程至少是「打包当前 HEAD」，不是人工漏文件。
- 本机未安装该插件（`~/.dsh` 下无 composer-assist 痕迹），审查未触碰用户配置。

### 1.3 在 DSH 分层中的位置

按 01 文档的分层，它同时占用 Host 插件层与 Web 客户端半边：

```
宿主平台层（无统一 PAL：Electron 壳 + Node Host；详见 01 文档 §3.1）
  └─ Cordis 微内核（profile/bundle/patch → Loader 行 → fiber）
       ├─ dsh-composer-assist / index.js（Host 插件）
       │    ├─ ctx.llm.prepareCall    → 辅助模型调用
       │    ├─ ctx.sessions           → 读会话、派生消息
       │    ├─ agent/turn-stopping    → 轮次边界记账
       │    ├─ ctx.get(fs, subprocess, workingDirectory, agentDefaultModel)
       │    └─ ctx.connection.fetch   → 5 条 /api/composer-assist/* 路由
       └─ dsh-composer-assist / client.js（Client 插件 bundle）
            ├─ slots: conversation.input.dock / conversation.input.left / settings.section
            ├─ ctx.locale / ctx.shortcuts / ctx.remote.session.modelCatalog
            └─ 直接操作宿主 composer DOM（data-composer-* / --dsh-composer-hint）
```

结论：它不是「只在公开槽位里画画」的轻插件，而是**横跨 Host 路由、LLM 旁路调用、会话事件、Web DOM 四层**的深集成插件。这决定了后文 M 组议题的重要性。

---

## 2. 角度一：工程化（可读性 / 可维护性）

> 用户关注点：代码文件应小于 1000 行以保证可读性、可维护性。当前 `client.js` 1392 行是唯一硬性超标项，但「为什么会到 1392 行」比数字本身更值得修。

### E1【高】`client.js` 1392 行：单文件承担 9 类职责，且无构建步骤可拆

**证据**：`client.js:1-6` 注释明确「Plain JavaScript on purpose — no build step, so the bundle is the source a future upgrade reads」；`package.json:9` 直接把 `./client` 映射到源文件 `./client.js`。

代码段职责分布：

| 段 | 行号 | 行数 | 说明 |
|---|---|---|---|
| 内联 i18n 字典 | 17-136 | 120 | 中英各 60 条 UI 文案 |
| 设置 store + 读写 | 138-177 | 40 | 模块级 store、fetch 封装 |
| HTTP 请求封装 | 179-244 | 66 | 超时/反馈/响应校验 |
| DOM 幽灵预览 | 246-420 | 175 | 样式注入、span 增删、度量、探针 |
| 模块级会话状态 | 422-634 | 213 | 请求序号、草稿修订、候选、订阅 |
| 样式常量 | 639-668 | 30 | bar 布局 |
| `SuggestionStrip` | 671-1026 | 356 | 轮询、接受、键盘、渲染、探针 |
| `PredictButton` | 1029-1088 | 60 | 手动预测按钮 |
| `PolishButton` | 1091-1141 | 51 | 润色按钮 |
| `SettingsSection` | 1144-1317 | 174 | 设置页 8 个表单行 |
| 注册与快捷键 | 1319-1392 | 74 | 5 个 slot、2 个 effect |

**为什么现在难拆**：官方 `client-modules` 文档规定 `dsh.client` 插件在 `exports["./client"]` 导出的是**构建好的单文件 bundle**（`docs/subsystems/client-modules.zh.md:94`；路由把单个包的 `client.js` 作为 combo 成员拼接）。所以「拆成多文件」与「保持零构建」当前是互斥的，作者在 `client.js:1-6` 也把零构建当成了刻意选择。

**建议（可行，且能顺带解决其它 E 项）**：
1. 引入最小构建链（esbuild/tsdown 均可）：源码拆到 `src/client/*.js`，`pnpm build` 产出 `dist/client.js` + `dist/client.js.map`，`exports["./client"]` 指向 `dist/client.js`，`files` 增加 `dist/`。
2. 保留 `window.__ModuleLoader__.load({ id, factory(require) })` 外壳；`react` 仍通过 `factory(require)` 由宿主提供（external），不引入运行时依赖。
3. 拆分建议（目标：每个文件 100～300 行，均 < 1000，且可单测）：

| 新模块 | 承接源码段 | 预估行数 | 可测点 |
|---|---|---|---|
| `src/client/i18n.js` | 17-136 | 120 | 键集合完整性 |
| `src/client/http.js` | 152-244 | 90 | 超时、响应校验、reason 分支 |
| `src/client/session-store.js` | 422-634 | 210 | v2 恢复、候选切换、序号 |
| `src/client/ghost.js` | 246-420 | 170 | 提示避让、清理、度量 |
| `src/client/components/SuggestionStrip.js` | 671-1026 | 356→可再拆 `strip-polling.js` / `strip-keys.js` | 轮询状态机、接受条件 |
| `src/client/components/PredictButton.js` | 1029-1088 | 60 | busy 计时器 |
| `src/client/components/PolishButton.js` | 1091-1141 | 50 | 编辑保护 |
| `src/client/components/SettingsSection.js` | 1144-1317 | 174 | 表单校验 |
| `src/client/index.js` | 1319-1392 | 74 | slot 注册 |

预计 `SuggestionStrip` 拆分后仍可能接近 400 行，需要把「轮询/接受/键盘/渲染」再分成 2-3 个 hook 文件；Host 侧 `index.js` 707 行未超阈值，但也建议按「prompt / transcript / workspace / llm / routes / settings」拆 6 文件，把 `__test` 钩子从生产入口移出。

**收益**：可单测（取代 `selfcheck.mjs` 的源码字符串替换，见 E5）；有 source map 后宿主侧调试可读；未来 DSH 升级只改契约层文件。

### E2【中】内联样式 54 处、视觉常量散落，且与宿主主题 token 半耦合

**证据**：`client.js` 内 `style:` 出现 54 次；`stripStyle`(639-668)、`stripBadge`/`stripText`/`stripActions`(659-668)、按钮内联样式(1000-1024、1075-1085、1127-1138、1218-1246)、设置页 `card/row/selectStyle`(1175-1205) 全部是字面量对象，字号/圆角/间距硬编码。主题色使用了 `--dsw-alias-brand-primary` 等官方 token（这是对的），但布局尺寸没有走 token。

**建议**：抽 `src/client/styles.js`（或 CSS-in-JS 常量模块）统一字号阶、圆角、间距；把可主题化的尺寸改为 `var(--dsw-alias-*)` 回退值写法；设置页的「行/卡片」结构可抽一个 `SettingsRow` 组件，减少 174 行里约 80 行重复 JSX 结构。

### E3【中】魔法数字与隐式时序常量

**证据**（仅列关键）：

| 位置 | 值 | 含义 | 问题 |
|---|---|---|---|
| `client.js:198` | `2000…120000` | 请求时限夹取 | 与 Host `timeoutMs` 默认 20000 双源 |
| `client.js:227` | `deadline + 1000` | 客户端兜底 | README 已写，但注释缺失 |
| `client.js:520` | `5000` | 接受前来源校验 | 与 `timeoutMs` 无关 |
| `client.js:740` | `5000` | 轮询式来源验证 | 每 5s 一次网络请求 |
| `client.js:807-812` | `1000` / `900` / `2200` / `5000` | 轮询节奏 | 四个魔法数描述同一条状态机 |
| `client.js:856` | `60` | 对齐测量延迟 | |
| `client.js:1057-1060` | `3000` | 按钮 busy 释放 | 与真实请求脱钩（N6） |
| `index.js:264-267` | `200/64KiB/3000` | 工作区扫描上限 | |
| `index.js:492` | `200_000` | 请求体上限 | |
| `index.js:604` | `40` | 探针环形缓冲 | |

**建议**：建 `src/client/timing.js` / `index.js` 顶部常量区，命名（`TURN_POLL_RUNNING_MS` 等）并注释推导依据；`timeoutMs` 只在 Host 解析一次，客户端从设置接口读取（现在已读，但又有 2000/120000 夹取，双处定义）。

### E4【高】Host 侧模块级 Map 无生命周期清理；多标签页语义未定义

**证据**：`index.js` 在模块顶层持有 6 个跨会话容器：`finishedTurns`(41)、`predictingIn`(48)、`deliveredTurns`(55)、`runningCalls`(371)、`inflight`/`latestRequests`(510-511)，另有 `lastProbe/lastAlign/lastTranscript/probes`(24-33)。其中 `finishedTurns`、`deliveredTurns`、`lastProbe` 等**在会话结束/删除后没有清理路径**（`progress`：`finishedTurns.delete` 只在 consume 时发生，`deliveredTurns` 只增不删）。DSH 是长驻 Host，长期使用会按会话数线性增长。

**多标签页**：`deliveredTurns` 由 Host 全局按 sessionId 记账（`index.js:584-586`），`turn` 被**任一**客户端 `consume=1` 后即标记 delivered，第二个标签页（或重连后的同页）永远拿不到该轮的边界 → 只有先轮询到的标签页会预测（代码推演，依据 client.js:787-798 的 peek→claim 流程与 index.js:571 的永久挡板）。这既是工程问题也是维护层问题（M5）。

**建议**：
1. 注册会话生命周期监听（官方 `sessions` 服务/事件），在 session 关闭或删除时清理 4 个 Map；或改用带 TTL 的 LRU（Map → 小工具类），上限如 512 会话。
2. 多客户端投递改为「边界带 clientId/订阅者集合」或在 Host 侧用事件推送（SSE/长轮询），而不是「一次性消费」。
3. 把 `lastProbe/lastAlign/probes` 移到可选 debug 模块（见 E7）。

### E5【高】测试无法在重构中存活：`selfcheck.mjs` 靠字符串替换注入被测符号

**证据**：`selfcheck.mjs:79-81`：

```js
let clientSource = await readFile(new URL('./client.js', import.meta.url), 'utf8')
clientSource = clientSource.replace("      inject: ['slots'", "      checks: { runRequest, trackDraft, ... },\n      inject: ['slots'")
runInNewContext(clientSource, sandbox)
```

这段代码要求 `client.js` 中**恰好存在** `      inject: ['slots'`（含 6 个前导空格）。任何格式化、改名、或按 E1 拆文件都会让它失配；虽然 `assert(client)` 会失败而非静默，但这意味着测试与实现强耦合到「源码文本」。此外：

- 无 test runner（`node selfcheck.mjs` 手跑），无断言报告（失败即 throw），无覆盖率。
- 无 `.github/workflows`、无 `pnpm-lock`、无 lint 配置；`client.js:702` 有 `// eslint-disable-next-line react-hooks/exhaustive-deps`，但仓库**根本没有 eslint 配置**——注释指向了一个不存在的工具（也属文档/工具链漂移）。
- `index.js:707` 把 14 个内部符号经 `export const __test` 暴露到包入口（`.` 导出），发布包用户也能 import 到，属公共 API 污染。

**建议**：按 E1 拆模块后，纯函数（`parseCandidates`、`transcript`、`workspaceContext`、`statsOf`、`learnHint`、`sourceOf`）直接单测；组件用 `@testing-library/react` + jsdom 测 `SuggestionStrip` 状态机；把 `__test` 改为 `src/client/testing.js` 条件导出（`exports["./testing"]`），或仅测试内可见。CI 至少 `node selfcheck.mjs` + `node --check` + `npm pkg` 校验。

### E6【中】包元数据缺口：无 `engines.dsh`、无 peer、无 scripts、无 lint

**证据**：`package.json` 全文（1-44）：没有 `scripts`、`devDependencies`、`engines`、`peerDependencies`；`dependencies` 也没有。Host 插件只 import node builtins（`index.js:9-10`），Client 的 `react` 走宿主 `factory(require)`，所以「无依赖」本身合理；但**兼容性声明缺失**属于维护层问题（M3），**无 scripts/lint/CI** 属于工程化问题。

**建议**：加 `"engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }`（按实际支持范围，见 M3）、`scripts: { "test": "node selfcheck.mjs", "check": "node --check index.js && node --check client.js", "build": "esbuild ..." }`、`devDependencies` 放 eslint/prettier/vitest/esbuild；`npm pkg fix` 不需要手写锁文件（库不发布依赖）。

### E7【高】调试探针常驻生产：14 个调用点 + 可读的 `/api/composer-assist/probe`

**证据**：
- Host 注册 `PROBE_PATH`（`index.js:15`），`GET` 返回 `{ probe, align, transcript, recent }`（`index.js:593-610`）；`recent` 保留最近 40 条客户端报告，`lastTranscript` 含会话 id、消息数、字符数、seq（`index.js:645-650`）。
- Client 在挂载/卸载/请求/结果/清除/渲染/对齐/绘制/点击未命中时都发探针（`client.js:214,444,447,698,700,720,750,760,835,855,936,943,1049,1052`），每次 `reportProbe` 做 DOM 测量并发一次 `POST /api/composer-assist/probe`（`client.js:390-392`）。
- **最严重的一处在 render 函数体**：`client.js:943-945` 在 `SuggestionStrip` 的渲染路径里无条件调用 `reportProbe`，而该组件订阅 `draft`（`client.js:672`）——**每次击键重渲染都会 POST 一次**，而且这行在 `946 if (!enabled) return null` 之前，插件被禁用时也会发。
- **探针 body 带用户文本**：`client.js:760` 把 `draft: at`（用户草稿全文）塞进请求；`client.js:374` 把 ghost 文本（候选内容）上报；Host `GET /probe` 原样返回 `lastProbe`（含 `ghostText`）与 `lastTranscript`。虽然 `/api` 有浏览器认证与 Host/Origin 校验、非 owner Peer 会 403（`packages/client/connection/README.zh.md`「浏览器认证与请求信任」），但「草稿与候选文本进入 Host 内存并可被同源页面读回」不是产品应有行为。

**影响**：性能噪声（击键级网络请求 + 渲染期强制同步布局测量）；隐私面；接口一旦发布就难删（外部脚本可能已在读）；生产包含调试代码。

**建议**：把探针抽成可编译期剔除的 dev 模块（`__DEV__` 常量 + build define），默认不注册 `/probe`；保留一个显式设置开关（「诊断模式」）供用户排障；对齐测量移入 `useEffect`/`requestIdleCallback` 且节流；从 probe body 里剥离 `draft` 与 `ghostText`。

### E8【低】Host 错误文案中文硬编码，与 Client i18n 双轨

**证据**：`index.js:376`（`没有可用的模型路由：请先在设置里选择模型`）、`492`（`请求过大`）、`494`（`请求格式不正确`）、`543`（`action 必须是…`）、`625`（`会话不存在或未加载`）都是中文常量；Client 侧有完整 `zh/en` 字典并依赖 `ctx.locale`。英语用户看到中文错误。

**建议**：Host 返回错误码（`{ ok:false, code:'NO_ROUTE' }`），文案由 Client 字典渲染；或至少 Host 侧也走 `ctx.locale`/`LocalizedText`。

### E9【低】同一校验逻辑在多处重复

**证据**：设置归一化在 `writeSettings`（`index.js:151-175`）；统计归一化 `statsOf`（122-137）又在 `learnHint` 里重做一次；候选校验在 Host `parseCandidates`（427-452）与 Client `request`（`client.js:221-225`）各一遍；`source` 过期判定在 Host（631/634/663/681）与 Client（209-219/735-737/872-878）各一套。

**建议**：把「设置 schema/统计/候选/来源」做成共享纯模块（`src/shared/*.js`，Host 与 Client 都能 import；若担心 Client bundle 打包，可构建时内联），单测覆盖。

### E10【低】其它小项

- `index.js:215` `groups.slice(-MAX_TRANSCRIPT_MESSAGES / 2)`：除以 2 得到 6，语义正确但写法暗示「消息对数」，建议改为 `MAX_TRANSCRIPT_GROUPS`。
- `index.js:281-298` `gitStatus` 的 `finally` 里 `handle?.terminate()` 对同步 throw 的 `handle` 未定义安全，已有 try/catch，但 `terminate()` 自身抛错被吞（`catch { /* already gone */ }`）——可接受，建议注释说明。
- `client.js:321` `CSS.escape(text)` 用于 CSS 变量值；若文本含换行/引号，`--dsh-composer-hint` 的 `content` 语义依赖宿主样式实现，属 M1 契约风险。
- `client.js:527` 请求序号表上限 32、`client.js:593` 建议上限 8，均为魔法数（E3）。
- `client.js:1332` `loadCatalog` 错误信息 `model catalog unavailable` 未走 i18n（设置页会拼进 `catalogFailed` 前缀，尚可）。
- `index.js:707` 一行 400+ 字符的导出，可读性差。

### E11【高】数字设置项清空即保存 `0`，Host 不校验范围 → 功能「看起来坏了」

**证据**（这是本次审查发现的最高性价比 bug）：

```js
// client.js:1197-1205  数字输入框
const number = (key, min, max) => h('input', {
  type: 'number', min, max,
  value: current?.[key] ?? '',
  onChange: event => {
    const parsed = Number(event.target.value)          // 清空 → Number('') === 0
    if (Number.isFinite(parsed)) void save({ [key]: parsed })  // 0 是有限数 → 保存
  },
  ...
})
```

Host 的 `writeSettings` 只归一化 `enabled/mode/display/provider/model/minConfidence/learn/learnStats`（`index.js:151-175`），**完全不校验** `timeoutMs/debounceMs/maxInputChars/maxOutputTokens` 的数值范围。于是：

| 用户操作 | 写入值 | 后果 |
|---|---|---|
| 清空「超时」 | `timeoutMs: 0` | `index.js:666` `setTimeout(..., 0)` 立即 abort → 全部预测返回 `timeout`，客户端静默丢弃 |
| 清空「上下文上限」 | `maxInputChars: 0` | `index.js:194-195` 直接返回 `''` → `next` 返回 `empty-transcript`（`index.js:654`），永远没有建议 |
| 清空「输入停顿」 | `debounceMs: 0` | 每次击键后立即发请求 |
| 清空「输出上限」 | `maxOutputTokens: 0` | 模型无输出预算，返回空建议 |

`<input min>` 只约束浏览器 spinner，不约束手输/清空；而所有失败又被吞掉（E12），用户只会得出「插件坏了」。

**建议**：`number()` 对 `value === ''` 不保存（保持旧值）或保存 `min`；Host 侧对所有数值字段 clamp 到 `DEFAULTS` 允许范围（与 client 的 `min/max` 同一张表，做成共享常量）；补一条 `selfcheck` 用例覆盖「空值 → 不写入 0」。

### E12【高】所有失败对用户不可见：`strip.failed` 不可达、`settingsStore.error` 无人读

**证据**：
- `SuggestionStrip` 的 `failed` 状态只有 `setFailed(false)`（`client.js:682,724,754,761`），**没有任何 `setFailed(true)`**——`strip.failed`（`client.js:952`）是死分支；唯一会让失败 UI 出现的是 `PolishButton`（`client.js:1115`）。
- `runRequest(...).catch(() => null)`（`client.js:456`）与 `poll`/`verify`/`accept` 的空 catch（`801,737,882`）把所有错误吞掉；`settingsStore.error` 只写不读（`157,163`）。
- Host 路由失败时返回 `{ ok:false, error }`（`index.js:695`），客户端 `request()` 抛错后仍被 `catch` 吞成「无结果」。

**影响**：用户无法区分四种状态：没有建议 / 未配置模型 / 请求失败 / 插件坏了。排障只能靠 probe（E7）或看控制台，而 release 用户不会。

**建议**：接线 `setFailed(true)`（区分 `error` 与 `timeout` 文案）；设置页显示一条「上次预测失败：<reason>」；或至少在 README 明确写「失败静默是设计选择」——但从 UX 看前者更好。

### E13【中】`requestSeqBySession` 用「最早插入」驱逐，可能删掉活跃会话序号

**证据**：`client.js:524-529`

```js
const next = (requestSeqBySession.get(sessionId) ?? 0) + 1
requestSeqBySession.set(sessionId, next)
if (requestSeqBySession.size > 32) requestSeqBySession.delete(requestSeqBySession.keys().next().value)
```

Map 按首次插入顺序驱逐。若当前会话是最早插入的 key，且期间另有 31 个会话进入过，它会被删；`currentRequestId()` 回落 0，随后 `runRequest` 的 `id !== currentRequestId(sessionId)` 判定（`client.js:446`）可能把**旧结果**判成新结果（或反过来把新结果判成 stale）。触发需要 32+ 会话，概率低但真实，且失败表现为「偶尔采纳了上一条建议」。

**建议**：按最近使用（Map delete+set 提升）或按 pending 保护；绝不要驱逐 `pendingBySession.has(sessionId)` 的 key。

---

## 3. 角度二：文档（没有及时更新的代码）

> 用户关注点：文档是否跟得上代码。这个仓库的 README 写得相当细（连硬超时、推理档、隐私过滤都写了），**问题不是「文档缺失」，而是「发布后没有回写」**：截图、依赖清单、行为描述各有 1～2 处与当前代码不符；同时缺一整套维护型文档（CHANGELOG/版本矩阵/排障/契约）。

### D1【高】README 两张截图已过期：截图提交后 UI 又改了 5 次

**证据**：截图加入于 `4341710`（README 双语 + 真实 UI 截图，2026-10-22 18:57），之后 UI 相关提交：`4b86ffc`（候选选择/学习/工作区，10-22 20:33）、`93b3d04`（仅消息编辑器接受，10-22 21:13）、`b53b912`（会话保留/行内预览，10-22 22:54）、`bca5aa1`（按钮紧凑，10-23 10:49）、`0877c90`（截止与低推理，10-23 12:19）。

比对截图与当前代码：

| README 截图显示 | 当前代码 | 结论 |
|---|---|---|
| 设置页有「启用/模式/显示位置/预测模型/输出上限/输入停顿/超时/上下文上限」，**没有**「接受学习」「置信度门槛」 | `client.js:1223-1247` 有接受学习+清除统计；`client.js:1306-1310` 有置信度门槛 | 截图早于 `4b86ffc` |
| 显示位置下拉：`输入框内（推荐）` / 提示「行内 = 直接显示在输入框里；卡片 = 输入框上方」 | `client.js:115-116`：`Bar above the composer (recommended)` / `Inside the composer`；默认 `display:'bar'`（`index.js:70`） | 旧设计（card 时代），语义已反转 |
| 输入框按钮：「→ 重新预测输入框」「✨ 润色提示词」长标签 | `client.js:33/36` 短标签 `预测` / `润色`；`client.js:1087` 只渲染 `t('predict.short')` | 截图早于 `bca5aa1` |
| 建议栏只有「Tab 接受 / 忽略」+ 文本 | 现在还有候选计数 `1/3`（`client.js:964,991`）与置信度高/中/低徽标（`client.js:967-970,980-986`） | 截图早于 `4b86ffc` |

**建议**：重拍两图（当前默认 `bar` 模式 + 有候选/置信度的场景），并在仓库加一条「UI 变更提交必须同步截图」的 PR 检查项（可手工 checklist，见 D5）。

### D2【中】`screenshots/*.png` 实际是 JPEG 字节

**证据**：`file screenshots/*.png` 输出 `JPEG image data, baseline, … 1434x416` / `1628x1612`；工具按扩展名做校验时直接拒绝（本次审查用 `read_image` 读取即报「the .png extension declares image/png, but the bytes use a different image format」）。README:9/14 以 `.png` 引用。

**影响**：GitHub 页面通常能靠内容嗅探显示，但任何按 MIME/扩展名处理的工具链（图片优化、CI 校验、文档生成、无障碍检查）会失败；这也是「文档目录里存在未经验证资产」的信号。另外 `package.json:14-20` 的 `files` 不含 `screenshots/`，所以 release tgz 里的 README（npm 会自动打包 README）引用的两张图**在包内是 404**（已核对 tgz 清单：只有 `LICENSE/client.js/index.js/locale/*/package.json/README.md/icon.svg/cordis.patch.yml`）。

**建议**：转存真 PNG（或把文件改名为 `.jpg` 并改 README 引用），顺手压缩；`files` 加 `screenshots/`，或 README 改用绝对 URL（`https://raw.githubusercontent.com/...`）。

### D3【中】README 对 `--dsh-composer-hint` 的描述与代码相反

**证据**：README:85 写「不抢宿主的命令提示：行内模式会避让宿主的 `--dsh-composer-hint`」；README:109 又写「草稿补全复用宿主的 `--dsh-composer-hint`」。代码实际：

```js
// client.js:318-319  已有宿主提示 → 直接放弃绘制（避让）
const existing = getComputedStyle(element).getPropertyValue('--dsh-composer-hint').trim()
if (existing !== '' && existing !== '""') return
// client.js:320-329  否则：写入自己的提示值，记录原值以便恢复
element.style.setProperty('--dsh-composer-hint', value)
```

即：**空提示时接管宿主的变量，有提示时让位**；不是「行内模式避让」。109 行的说法更接近代码但也不完整（未说明接管后会影响宿主 placeholder 行为，且恢复逻辑依赖 `ownedHints`）。

**建议**：把 85 行改为「空提示时临时接管宿主的 hint 变量，退出/卸载时恢复；宿主已有提示时让位」，并在 README 的「与宿主契约」一节列出它改写的 DOM/CSS 面（呼应 M1）。

### D4【中】README 的「20 行 git 状态」「来源检查 = 配置时限 + 1 秒」两处与实现不符

**证据**：
1. README:87「…发送 8 个文件名和 20 行 git 状态」。代码 `index.js:317-323` 把最多 20 个变更项用 `'; '` 拼成**一行** `git: …`；不是 20 行。
2. README:101/105「浏览器对请求、响应体和来源检查另设配置时限 + 1 秒兜底」——代码里只有请求+body 是 `deadline + 1000`（`client.js:227`）；来源校验是**固定** `5000ms`（`client.js:514-521`），不随配置变化（README 下一句「接受候选的来源检查最多 5 秒」才是对的，但前半句把来源检查也算进了「配置+1 秒」）。

**建议**：改为「最多 20 个 git 变更项（单行分号分隔）」与「请求/响应体：配置时限 + 1s；来源校验：固定 5s」。这类「数字对但单位/范围错」的描述最容易误导使用者判断隐私与超时边界。

### D5【高】缺失维护型文档：CHANGELOG / 版本矩阵 / 排障 / 卸载 / 数据流 / 契约

现状只有 README 一个文档；以下都是「作者每次升级都要重新推导、用户出事时无处可查」的内容：

| 缺失文档 | 为什么必须有 | 建议内容 |
|---|---|---|
| `CHANGELOG.md` | 11 笔提交没有对外可读的变更记录；README:52 一句「v0.1.1 沿用 0.1 系列」无法解释 `4b86ffc` 新增候选/学习/工作区等行为变化 | 按 Keep a Changelog 补 0.1.0/0.1.1；之后每 tag 一条 |
| 版本支持矩阵 | `package.json` 无 `engines.dsh`；README 未写适配哪个 DSH 版本（见 M3） | 表格：插件版本 × DSH 版本 × 验证状态；声明 `engines.dsh` |
| 排障指南 | 已出现的失败模式：装完不显示（slot/DOM 标记变了）、无候选（模型路由/低推理/空转录）、设置不生效（旧 `display:card`） | 症状 → 诊断命令（`--dump-config`、看 `/probe`、看 `settings.json`）→ 修复 |
| 卸载/回滚 | README 只有安装；tgz 安装后如何移除、如何回到旧版未写 | `dsh plugin --profile <p> remove` / 重装旧 tgz；插件管理器步骤 |
| 数据流与隐私说明 | 每轮把对话摘要 + 工作区文件名 + git 状态发给模型；`/probe` 保留 `lastTranscript`；README 只散落在设计要点里 | 一页「发送什么/不发送什么/存在哪/如何关闭」；给工作区上下文单独开关（M6） |
| Host↔Client HTTP 契约 | 5 条路由、请求/响应字段、`reason` 枚举（`stale-source`/`empty-transcript`/`empty-input`/`model-empty`/`low-confidence`/`timeout`）只存在于代码 | `docs/protocol.md` + 版本字段（M10） |

### D6【低】版本叙事断档：源码里有过 v0.1.0，但没有任何 tag/release

**证据**：`git tag -l` 仅 `v0.1.1`；但初始提交 `264e4f4` 的 `package.json` 里 `"version": "0.1.0"`、`"license": "MIT"`，README 自称「DSH 桌面端插件」——即 v0.1.0 在源码中存在过、从未发布；`b626b67` 才把版本改成 0.1.1 并加入 ZCode 说明。用户无法得知 0.1.0→0.1.1 改了什么（实际上 `4eafe23` 把 MIT 改成了 source-available，是一次**许可性质变更**，却没有任何 release note）。

**建议**：补 v0.1.0 的 tag/release note（标注「未公开发布」）、补 CHANGELOG 并写清许可证变更；README 的「沿 0.1 系列」才有依据。

### D7【低】双语结构不对称

**证据**：README 大量段落是「中文一行 + 英文一段」，但「上下文与过期保护」的四条要点只有中文（README:94-97），英文只给汇总段（README:99）；「实现说明」的中英文信息量也不对等（109-111 vs 113-119）。对英文用户而言，关键约束（不复制隐藏推理、候选 1～3 条、来源检查）不完整。

**建议**：要么 `README.zh.md` + `README.md` 两文件逐段对齐，要么保持单文件但每段严格双语；CI 可用简单脚本检查段落配对。

### D8【低】关键设计只存在于代码注释

**证据**：宿主契约（DOM 标记、hint 变量）、轮询状态机（`client.js:771-816` 的长注释）、旧实现教训（785-793）、探针用途（`index.js:18-23`、`client.js:337-341`）都写得很好，但只对读源码的人可见。

**建议**：把 3 段最有价值的注释上移到 README 的「实现说明」，并在代码里保留简短引用（`See docs/protocol.md#polling`）。注释是设计文档的草稿，不是替代品。

### D9【中】README 公开了设置文件路径，却没有 schema / 默认值 / 枚举表

**证据**：README:69 写明「设置存于 `$DSH_HOME/composer-assist/settings.json`」，但全文没有：

- 默认值表（`enabled:true`、`mode:'auto'`、`display:'bar'`、`maxOutputTokens:600`、`debounceMs:600`、`timeoutMs:20000`、`maxInputChars:12000`、`minConfidence:0`、`learn:false`，见 `index.js:60-86`）；
- 枚举值表（`mode: auto|word|both|off` —— README 写的是「仅手动 / manual only」，实际存储值是 `off`，见 `index.js:158`；`display: bar|card(legacy)|inline`）；
- 手改文件的注意事项（`writeSettings` 会丢掉未知键、非法值静默回落默认，见 `index.js:151-175`）。

**建议**：在 README 加一张「settings.json 字段表：key / 类型 / 默认值 / 范围 / 说明」；公开可手改的配置文件就应当有 schema（这也顺带解决 E11 的「0 值」问题：文档里写清 min/max，UI 与 Host 都按它校验）。

---

## 4. 角度三：新老冲突层（新旧代码并存的问题）

> 「新老冲突」在本仓库不是「两套目录并存」，而是**五次修复留下的兼容分支、调试脚手架与旧语义**：新路径已经上线，旧路径没有删除或没有正式迁移，二者共享同一份运行时状态。

### N1【中】旧显示值 `display:'card'` 仍被接受，但 UI 已只认 `bar|inline`

**证据**：

```js
// index.js:159-161
// 'card' is a legacy value: it renders like 'bar', so it stays accepted rather
// than rewriting a saved setting behind the user's back.
if (!['bar', 'card', 'inline'].includes(next.display)) next.display = DEFAULTS.display
```

```js
// client.js:1263  旧值被静默归一化为 bar
value={current?.display === 'inline' ? 'inline' : 'bar'}
```

README 与设置页只呈现 `bar`/`inline`；旧截图（D1）显示的正是 `card` 时代。风险：用户配置文件里若有 `card`，UI 显示为 bar 且下次保存才被改写；语义上旧 `card` 指「输入框上方卡片」，新 `bar` 同名不同实现（新 bar 有候选计数/置信度），用户感知不到差异但配置没有迁移记录。

**建议**：保留兼容可以，但写入 `settings.json` 时做一次性迁移（读到时改写为 `bar` 并在 CHANGELOG 说明），或在 README 写「兼容旧值 card」；两者选一，别让兼容分支无限期存在。

### N2【高】会话缓存「三代格式」并存：v1 键、v2 键、无版本 pending 分支，无迁移/无清理

**证据**（按 git 历史）：

| 代际 | 引入提交 | 形态 | 现状 |
|---|---|---|---|
| v1 | `b53b912`（10-22 22:54） | `sessionStorage['dsh.composer-assist.predictions.v1']` + `Symbol.for('dsh.composer-assist.session-state')`（**无版本后缀**） | 无删除代码，永久残留 |
| v2 | `01be400`（10-23 10:49） | `predictions.v2`（`client.js:467`）+ `session-state.v2`（495）；恢复时要求 `record.source` 是 string，否则 `continue`（`client.js:479-481`） | 旧 v1 记录不迁移、静默丢弃 |
| pending 结构 | `0877c90`（10-23 12:19） | `pendingBySession` 条目新增 `bounded: true`（`client.js:442`）；重载时丢弃 `bounded !== true` 的旧 pending（`client.js:555-560`） | 兼容分支长期保留 |

`selfcheck.mjs:83-94` 专门构造 legacy 状态，断言「无 bounded 的请求不能存活为 busy」「旧候选/draft 保留」，说明作者知道有旧数据；但运行时没有任何迁移提示，用户只感觉「刷新/升级后建议没了」。README:97 只写「旧版无来源缓存不会恢复」，没说是升级导致的。

**建议**：初始化时显式清理 v1 键与无版本 Symbol（一行代码）；在 `restoreSessionState` 里对「有记录但缺 source」做一次 `console.info` 或设置页提示；CHANGELOG 写「升级会清空一次建议缓存」。pending 的 `bounded` 分支保留一个版本后删除，并在注释里标注引入提交。

### N3【高】轮次边界的两代实现：旧逻辑已删，补偿路径留下双请求竞态

**证据**（注释本身就是证据）：

```js
// client.js:784-786
// Peek first: consuming before we know we can act would burn the
// boundary if a session switch lands in between (the old code lost the
// turn exactly that way, leaving nothing to show on return).
// client.js:790-793
// A draft in progress means the user is already writing; leave the
// boundary UNCONSUMED ... (The old code consumed it here, which is why a
// finished turn could produce nothing at all.)
```

现实现每次轮询最多 2 个请求（`GET /turn` peek → `GET /turn?consume=1` claim，787-798），加 Host 端 `deliveredTurns` 去重（571）。这套 peek/claim 是旧 bug 的补丁，没有收敛为单一原子操作；两个并发轮询（多标签页、running 切换、StrictMode 双挂载）仍可能两个都 peek 成功、先后 claim。Host 端 `deliveredTurns` 是最后防线，但它同时造成 M5 的「单客户端消费」问题。

**建议**：把 peek+claim 合并为一次 `POST /turn/claim {sessionId, revision, clientId}`，Host 原子返回 `{turn, source}` 或 `null`；或改为 SSE/事件推送（M5）。旧补偿路径与旧注释一起清掉，避免下一个人继续在此基础上补丁。

### N4【中】两套提示渲染通道，清理逻辑不同

**证据**：

| 通道 | 触发 | 写入 | 清理 |
|---|---|---|---|
| A：overlay span（空草稿预览） | `client.js:331-335` `ghostSpanFor`/`paintGhost` | 在 composer wrapper 里 `appendChild` 一个 `span.composer-assist-ghost`（303-307），并注入全局 `<style>`（252-281） | `clearGhosts`(398-412) 隐藏并清空；`disposeGhosts`(415-420) 移除 span 与 style |
| B：接管宿主 `--dsh-composer-hint`（续写） | `client.js:320-329` | `element.style.setProperty('--dsh-composer-hint', '"..."')` + 自定义属性 `data-composer-assist-continuation` | `ownedHints` 记录原值/优先级后恢复（402-405）；**不**由 span 清理路径处理 |

两套通道的 DOM 归属、恢复方式、失败模式都不同（A 依赖宿主 wrapper 结构，B 依赖宿主 CSS 使用该变量的方式），且 A 的 `:has()` 选择器（276-278）直接改写宿主 placeholder 的显示。任何宿主 DOM 调整都会让其中一套先坏。

**建议**：统一为 A（overlay，宿主结构变化时最多不显示，不会污染宿主状态）或统一为 B（零 DOM 注入，但依赖宿主变量语义）；短期至少把 B 的恢复逻辑并入同一个 `clearGhosts`，并在 README「宿主契约」列出两套通道。

### N5【中】调试脚手架与正式代码混居（开发期夹具未剥离）

**证据**：`index.js:24-33` 的 `lastProbe/lastAlign/lastTranscript/probes` + `PROBE_PATH` 路由；`client.js:342-395` 的 `measureAlignment`/`reportProbe`（含 `composerBox/ghostBox/placeholderVisible/insideComposer` 这类纯开发断言字段）。这些设施在 `0877c90`/`01be400` 两次提交中快速长出来，最后一次提交（`b626b67` release）没有剥离。

**建议**：编译期 `__DEV__` 条件注册；或把 `/probe` 移到一个独立的 dev-only 边车插件（`composer-assist-devtools`），发布包只保留空实现，这样即便未来想留诊断能力也不污染主插件。

### N6【低】`PredictButton` 的 3 秒 busy 是旧跨组件回调失败后的 workaround

**证据**：`client.js:1053-1060` 注释直说「A cross-component 'settled' callback depends on the strip re-rendering, which can be skipped — that left the button permanently disabled. 3s is a floor, not a correctness dependency」。现状：按钮 busy 由本地 `setTimeout(3000)` 释放，与 strip 的真实 `pendingBySession` 不同步；strip 侧另有 1s interval 读 `manualRequest.hasSuggestion`（1041）。两个真值源（local busy vs session pending）靠轮询对齐。

**建议**：让 `manualRequest` 暴露可订阅的 pending source（`subscribe(listener)` 已存在，`client.js:839-842`），按钮直接订阅 strip 的 `busy` 真值；删除 3s 兜底。

### N7【低】未发布功能的叙事残留在发布说明里

**证据**：README:52-53「不包含开发中的 ZCode 动态工作流」。仓库内 `grep -ri zcode` 无任何代码/文档（除这两行）；「开发中」的功能在发布页被提及，用户会去找入口。另 README:52 的「沿 0.1 系列」与单 tag 事实冲突（D6）。

**建议**：把未发布功能从 README 移到 `docs/roadmap.md`（或删掉），release note 只写已交付内容。

### N8【低】「dependency-free」的设计前提与现实耦合矛盾

**证据**：`index.js:1-8` 注释「Kept dependency-free on purpose: only node builtins and the injected Cordis services, so a profile upgrade cannot break the module at import time」。这句话对 **import 期**成立，但运行时依赖大量非稳定面（`session.surface`、DOM 标记、`ctx.get` 软依赖），升级照样会坏——只是坏在运行期而非 import 期，更难诊断。

**建议**：把注释改成「import 期无第三方依赖；运行期依赖的宿主面见 docs/contracts.md」，并把 N8 的认知写进维护文档（M1 的前提）。

### N9【低】过期注释与死字段：告诉维护者「已经不是这样了」

**证据**（都是「新代码上线、旧描述/旧字段没删」）：

| 项 | 位置 | 现状 |
|---|---|---|
| 头注释「its two General settings rows」 | `client.js:1-6` | 现在注册的是 `settings.section` 整页（`client.js:1367-1372`），General 里没有任何行；`package.json:31` 却仍 inject `dsh-client-ui-settings-general`（D5 之外的另一处残留） |
| `// eslint-disable-next-line react-hooks/exhaustive-deps` | `client.js:702` | 仓库没有 eslint 配置/依赖，指令指向不存在的 linter |
| `settingsStore.error` | `client.js:157,163` | 只写不读（E12） |
| `strip.failed` | `client.js:952` | `SuggestionStrip` 从不 `setFailed(true)`，死分支（E12） |
| feedback 的 `kind: 'next'` | `client.js:240` | Host `index.js:534-554` 不读该字段 |
| `__test` 的 6 个导出 | `index.js:707` | `gitStatus/readSettings/writeSettings/withSettings/buildPrompt/abortable` 在 selfcheck 中 0 引用（另有 13 个被用） |

**建议**：删除或接线（`error` 接设置页、`failed` 接 strip、`kind` 删除、`__test` 缩窄）；「old code」类注释改成 `fix: <commit>` 链接，避免下一位维护者把历史当现状。

---

## 5. 角度四：核心插件与 DSH 维护层（多个议题）

> 这是本报告最重要的一组：插件功能没问题，问题在于它**押注了哪些 DSH 面**、这些面是否被承诺、以及上游变化时谁先发现。

**最危险的三条（先看这个）**：

| 风险 | 内容 | 对应条目 |
|---|---|---|
| **R1** | 无 `engines.dsh`/peer + 无 CI = 升级静默失效；最脆的 4 类依赖（DOM 标记、CSS 变量、`session.surface` 调用点、`prepareCall` 旁路）在 0.2.x upgrade-guide 里没有任何变更预警机制 | M1、M3、M9 |
| **R2** | Client 体验主路径（行内 ghost、Tab 接受、像素对齐）全部建在未文档化的 DOM 标记与 `--dsh-composer-*` 变量上；上游一改就是「半坏不报错」 | M1 |
| **R3** | `ctx.subprocess.spawn` 绕过工具沙箱与审批——受限会话里模型不能执行命令，插件仍会跑 `git status` | M11（安全面） |

### M1【高】深耦合未文档化的宿主 DOM / CSS 契约（6 个依赖点，官方无承诺）

**证据**（插件侧 → 官方侧；「定义者」是真正拥有该标记/变量的包，「消费方」只是同样在读它的官方包——后者说明短期不会随意改名，但**不构成承诺**）：

| 插件依赖 | 插件位置 | 官方定义者（权威） | 官方消费方 | 文档承诺 |
|---|---|---|---|---|
| `[data-composer-card]` | `client.js:286, 346, 898, 1385` | `ui-conversation/src/client/skeleton/InputBar.tsx:417` | `ui-model-selection/.../ModelSelect.tsx:673`、`ui-input-trigger/.../MenuView.tsx:86`、`ui-message-feedback/.../FeedbackDialog.tsx:53` | **无** |
| `[data-composer-input]` | `client.js:286, 1385` | `ui-conversation/src/client/input/editor/ComposerContentEditable.tsx:46` | `ui-conversation/tests/input-bar.client.spec.tsx:537` | **无** |
| `[data-composer-placeholder]` | `client.js:369` | `ui-conversation/src/client/input/editor/DraftEditor.tsx:56` | 同上 `:392` | **无** |
| `--dsh-composer-hint` | `client.js:318-329` | `DraftEditor.tsx:53`（写） | `InputBar.module.css:202-207`（读，宿主自己的 claim hint） | **无**（测试断言存在，但无扩展契约） |
| `--dsh-composer-side-clearance` | `client.js:648` | 无单一所有者（`ui-goal/src/client/GoalBar.module.css:9`、`ui-user-questions/...module.css:7` 自用） | 多个官方包的 dock CSS | **无** |
| `--dsh-composer-card-max-width` | `client.js:649` | 同上（`ui-goal/src/client/GoalBar.module.css:27`） | 同上 | **无** |
| `--dsw-alias-*` 主题 token | 大量 | `docs/web-styling` 有设计 token 文档 | — | **有**（可放心用） |

**关键区分**：官方 slot 是公开契约（见 M2），`--dsw-alias-*` 也是；但这 6 个 DOM 标记/CSS 变量在官方 `docs/` 全量 grep **零命中**（已用 host-contract 调查确认），属 `ui-conversation` 内部实现。DSH 0.2.x 已经发生过大量客户端破坏性变更（`docs/upgrade-guide/v0.2.1-*` 有 30+ 条），DOM 结构/类名不在兼容承诺内。

**失效模式不是单一的**，同一类升级会表现为三类故障（这也是最难排查的地方）：

| 失效形态 | 例子 | 用户感知 |
|---|---|---|
| 静默错位/不显示 | `querySelector('[data-composer-card]')` 返回 null → 行内预览不出现、建议栏宽度算错（`client.js:648`） | 「没有建议」 |
| 静默功能缺失 | `--dsh-composer-hint` 语义变化 → 续写提示不显示或污染 placeholder（`client.js:318-329`） | 「补全坏了」 |
| **直接报错**（相邻问题，非同属本表） | 公开 API `SessionSurface` 的 `sourceOf()` 调用未防御（`index.js:249-251` 在 try 外，`index.js:627`）→ `/suggest` 500 | 「预测直接失败」 |

> 说明：`session.surface.nodes/replaceGeneration/contentGeneration` 是**官方文档化的公开 API**（`docs/subsystems/session.md:400-424`），不属于「未文档化契约」；第三行的问题在于**调用点未防御**，建议 `sourceOf()` 包 try/catch 并降级为「不校验来源」，别让路由 500。

**可行建议**：
1. 建 `src/client/host-adapter.js`：所有 `querySelector`/CSS 变量访问集中于此，返回 `{ available, bar, input, hint }`；不可用时降级为「只渲染 bar、不做行内」而不是静默坏掉。
2. `sourceOf()` 包 try/catch 并回落到「不校验来源」或显式版本探测（至少不让路由 500）。
3. 启动时做一次自检（存在性 + `getComputedStyle` 非空），把结果写入设置页「诊断」行或 `/probe`（dev-only），让用户能报「我的 DSH 版本下 X 不可用」。
4. README 加「宿主契约」一节，明确列出这 6 个依赖点为**非稳定**，并给出适配 DSH 版本的步骤（呼应 D5 版本矩阵）。
5. 向上游提议（附录 C）：把 composer 扩展面正式化为 slot props/CSS 变量文档，或提供 `ctx.composer` 句柄。

### M2【低】正面结论：slot / locale / 快捷键用法是符合公开契约的

**证据**：`conversation.input.dock`（`docs/subsystems/slots.zh.md:177`）、`conversation.input.left`（同上）、`settings.section`（`packages/client/ui-settings/src/client/contract/slots.ts:57`）都是官方声明的 slot；`ctx.locale.register`（`client.js:1322`）符合 locale 包契约（`packages/client/locale/README.zh.md:40`：要求 `zh`/`en` 齐全）；`ctx.shortcuts.observeFixedInput`（`client.js:1378`）是官方快捷键 API。**这三处不需要改**——说明作者在「有公开 API 的地方」用对了，问题集中在「没有公开 API 的地方自己凿」。（这一条写进报告是为了避免 maintainer 误以为要重构所有集成点。）

**限定**：`observeFixedInput` 只「观察已仲裁的输入」，它**不注册** fixed catalog、不占键位、也不进快捷键设置 UI（官方是 `registerFixed`；见 `packages/client/shortcuts` 类型定义 `registerFixed`）。因此「Tab 符合契约」成立，但「Tab 不会被别的插件先消费」「用户可改键」都**没有保证**。

### M3【高】版本声明缺失 + 图标元数据的 0.2.0/0.2.1 行为差异，构成静默不兼容

**证据**：
- `package.json` 无 `engines.dsh`、无 `peerDependencies`（1-44 全文）。DSH 0.2.1 起：`engines.dsh` 一旦存在即**单独决定**兼容性并压过 peer；两者都不存在时**不设约束**（插件管理器 `README.zh.md:81` 与 `docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/`；实现上命中 app-boot 的「无 engines 且无 peer 则全部满足」分支，等于**永久免检**）。结果是：这个插件在任何 DSH 版本都能装上，装完才在运行期出错。
- 图标：`package.json:11` 用 `exports["./icon"]` 暴露图标；0.2.1 起支持「顶层 `icon` 优先，否则回退 `exports["./icon"]`」，而 **0.2.0 只认顶层 `icon`**（`docs/cookbook/adding-a-package.md` 与 0.2.1 破坏性变更说明）。因此同一个包在 0.2.0 上图标静默缺失、在 0.2.1 上正常。**locale 不受影响**：0.2.0 已读取 `locale/*.json` 的 `meta.title/description`（已核实）。
- 插件调用的是 `LlmRuntime.prepareCall(config, signal?, configure?)`（`index.js:396` 用单 config 对象 + 第三参 `(controls, model) => …`；官方签名见 `docs/subsystems/llm-streaming.zh.md:1134`）。注意别把它与适配器层的 `LlmAdapter.prepareCall(provider, model, signal)`（`llm-streaming.zh.md:934`）混淆——两者不同；0.2.1-alpha.1 指南写明「现有 `prepareCall()` 输入仍有效」，故 `prepareCall` 本身不是主要风险点；主要风险仍是 engines/icon。

**建议**：
1. 声明 `engines.dsh`，按真实验证范围写（如 `">=0.2.1-rc.2 <0.3.0"`）；若想支持 0.2.0，补顶层 `icon` 字段并写进版本矩阵。注意 0.2.1 下 **engines 一旦声明，peer 检查被忽略**，区间必须覆盖真正支持的全部版本。
2. 补 `peerDependencies`（`@deepseek-ai/dsh*` 版本区间）作为 `engines.dsh` 缺失时的回退；两者范围要一致。
3. 发布前跑 `dsh --profile <p> --dump-config` 与 `--dump-config-schema`（0.2.1 新增）做冒烟，避免 patch 行/图标/locale 静默失效。
4. 在 README 写「最低 DSH 0.2.1-rc.2（图标依赖 exports["./icon"]）」，让 0.2.0 用户有预期。

### M4【中】`predictingIn` 防的是「不会发生的事件」，反而可能吞掉真实轮次边界

**证据**：
- 插件用 `ctx.llm.prepareCall(...)` + `call.stream(...)` 发起旁路调用（`index.js:395-417`）。这是**裸 LLM 运行时调用，不经过 agent-loop**——而 `request/header` 的 append 与 `agent/turn-stopping` 的派发都发生在 `dsh-agent-loop` 内部（源码事实：`dsh-agent-loop/lib/index.js` 的 header 写入/事件发射；官方 `docs/subsystems/core.zh.md:1122-1146` 定义事件）。也就是说：**预测调用根本不会产生 `agent/turn-stopping` 事件**。
- 但插件仍维护 `predictingIn`（`index.js:48, 379-391`）并在事件回调里判断「若本会话有我们的调用在飞，就忽略这个边界」（`index.js:563-573`）。它防的是一个不存在的事件；真实副作用是：**当用户真实轮次的结束与一次预测调用恰好同时在飞时，真实边界会被当成「我们自己的」而吞掉**（小概率，但与 `deliveredTurns` 叠加后表现为「偶发不预测」）。
- 官方 `LlmCallConfig.purpose` 只有 `'compaction' | 'session-title'`（`docs/subsystems/llm-streaming.zh.md:662-666`），没有给「输入框预测」一个官方分类；官方文档提到辅助调用有独立的循环标识，避免被误认成对话请求，但没给第三方插件受支持的入口。

**建议**：
1. **短期**：删除 `predictingIn` 及其事件过滤（裸调用不会触发该事件），只保留 `deliveredTurns`/`finishedTurns`；用真实自测确认「预测期间用户发消息」不会漏边界。
2. **中期**（向 DSH 上游提议，见附录 C）：`ctx.llm.auxiliary({ purpose: 'composer', sessionId, … })` 或扩展 `purpose` 枚举，并保证「不写 `request/header`、不触发 `agent/turn-stopping`、token/telemetry 有独立归类」。
3. README「宿主契约」写明：本插件依赖「裸 `prepareCall` 不写会话事件」这一**源码事实**（非文档承诺），升级时需复核。

### M5【高】每轮轮询 + 单客户端 turn 所有权 = 多标签页/多客户端功能缺口

**证据（代码推演确定，未做双标签实测）**：每轮预测依赖客户端轮询 `/api/composer-assist/turn`（`client.js:787-798`），running 时 1s 一次、空闲 5s 一次（807-812）；`turn` 在 Host 侧是**一次性**的：任一客户端 `consume=1` 即写 `deliveredTurns`（`index.js:584-587`），之后永久挡后续查询（`:571`），而 Host 侧 Map 是进程级单例（`:41,55`）。同一浏览器开两个标签页、或桌面端 + Web 端同时连同一会话时，只有一个会得到建议（README 未提）。

**另一个未提的副作用**：`agent/turn-stopping` 对**子 agent 会话也同样触发**，而插件只按 sessionId 过滤、没有区分 agent → `finishedTurns` 会持续写入（与 E4 的 Map 无清理叠加）。

另外每会话一个 1s 轮询，N 个打开的会话 = N 个轮询器 × 每秒 1 次 HTTP；插件还叠加每 5s 的来源校验请求（`client.js:740`）。对 Host 是无谓负载。

**建议**：
1. Host 侧把「turn 边界」从「一次性令牌」改为「按客户端投递 + 已读游标」：`GET /turn` 返回 `{turn, source}` 并存 `clientId → delivered`；或直接改用事件流（DSH 有 SSE/事件流机制）。
2. 客户端用 `visibilitychange` 暂停后台标签页轮询；把 1s 轮询降为 2-3s 并加抖动。
3. 增加 `clientId`（`crypto.randomUUID()` 存 sessionStorage）以免刷新后重复消费。
4. 事件回调里区分主 agent 与子 agent（payload 里有 `agent`），子 agent 边界不写 `finishedTurns`。

### M6【中】数据外发面：工作区上下文默认开、无独立开关；探针保留会话摘要

**证据**：
- 每次预测会把「工作区顶层文件名（≤8）+ git 分支/变更（≤20 项）」拼进 prompt（`index.js:301-328, 678`）。这个行为只有总开关 `enabled` 可关（`index.js:64`），**没有**「发送工作区上下文」的独立开关；README:87 只用一段说明告知。
- `/api/composer-assist/probe` GET 返回 `lastTranscript`（会话 id、`deriveMessages().length`、字符数、seq；`index.js:645-650, 606-608`）与 `lastProbe`（含 ghost 文本、bbox、placeholder 可见性）。虽然 `/api` 要求浏览器认证（`packages/client/connection/README.zh.md`「浏览器认证与请求信任」），且非 owner Peer 会 403，但这是**把会话元数据与 UI 文本保留在 Host 内存中**，且没有可见的保留期限/清理。

**建议**：设置页加「发送工作区上下文（文件名/git 状态）」开关，默认关或首次询问；README「数据流」一节列全字段；探针进入 dev-only（E7/M1）。

### M7【中】安装/升级/回滚链路不完整（README 只覆盖「装上」）

**证据**：README:31-47 给了三种安装方式（`plugin_manager install_bundle` URL、CLI `dsh plugin --profile web add <tgz URL>`、克隆目录绝对路径），但没有：如何验证安装成功（`--dump-config` 看行）、如何升级（重装新 tgz? `dsh plugin update`?）、如何回滚、如何卸载、离线安装、tgz 校验（无 checksum/签名）。release 只有 tgz（37,793 B），无 source map、无 SBOM。`package.json:14-20` 的 `files` 与 tgz 内容一致（已验证），这点没问题。

**建议**：README 安装节加「验证/升级/卸载/排障」四小节；release 附 `sha256sum`；说清两件 0.2.1 的安装语义：① 声明 `engines.dsh` 后 **peer 检查被忽略**，区间必须覆盖所有支持版本；② tgz/git spec 的兼容性判定发生在**安装之后**，失败才回滚 profile 清单与锁文件（`packages/boot/plugin-manager/README.zh.md:75`），不是下载前拦截——所以 README 要写「装完跑一次 `--dump-config` 验证」。

### M8【低】许可与长期维护模式冲突：源码可见但禁止修改

**证据**：初始提交 `264e4f4` 的 `package.json` 是 `"license": "MIT"`；`4eafe23`（2026-10-24 00:12）改为现在的自定义许可（`LICENSE:1-8`「允许使用未经修改的本软件…未经著作权人事先书面许可，不得修改本软件、制作衍生版本或分发修改版本」），README:132-136 同义。这直接排除了外部 PR 修复 DSH 升级适配、DOM 标记变更、超时逻辑等**必须改代码**的贡献；仓库也没有 `CONTRIBUTING.md` / PR 模板 / issue 模板（无 `.github/`）。另注意：许可变更发生在首次公开发布前（`b626b67` 与 `4eafe23` 同一天），但源码历史里 MIT 版本长期可见，早期 clone/fork 的授权状态与当前不同——需要在文档里说清适用版本。

**建议**：明确维护模式并写出来，三种可行路线：
1. 保持禁改：在 README 写「本项目不接受代码 PR；DSH 升级适配由作者负责；issue 只用于报告与建议」——至少消除贡献者预期落差。
2. 改成 MIT/Apache-2.0（或双许可）：与 DSH 生态（MIT）一致，能接受社区 PR。
3. 保留许可但加 CLA/书面授权流程：适合作者想控制方向又想收补丁。
无论哪条，都建议补 `CONTRIBUTING.md`（如何跑 selfcheck、如何提 issue、如何本地安装验证），并在 CHANGELOG 记录 `4eafe23` 的许可变更。

### M9【中】没有上游漂移监测：DSH next 的破坏性变更不会在发布前暴露

**证据**：无 `.github/workflows`；`selfcheck.mjs` 只跑纯 JS（不启动 DSH、不加载真实 slot/DOM）；官方 `docs/upgrade-guide/` 每版都有破坏性变更（0.2.1 有 30+ 篇），其中「engines 强制」「展示元数据」「slot/客户端」相关条目直接影响本插件。当前只能在用户升级后暴露。

**建议**：GitHub Actions 矩阵（`dsh@next`、当前 latest）+ 三步冒烟：
1. `npm i`（或直接 `npx @deepseek-ai/dsh@next --version`）
2. 临时 profile 安装本插件并 `dsh --profile ci --dump-config`（验证 patch 行、图标/locale 解析、engines 检查）
3. `node selfcheck.mjs`（Host/Client 纯逻辑）
4. （可选）Playwright 起 `dsh web`，断言 composer 里存在 `.composer-assist-ghost` / 建议栏节点——这是唯一能发现 DOM 契约断裂的自动化手段（呼应 M1）。

### M10【低】Host↔Client 私定 HTTP 契约无版本号，宿主/客户端版本错配时行为未定义

**证据**：5 条路由（`index.js:12-16`）、请求/响应字段（`sessionId`/`kind`/`draft`/`revision`/`source`/`candidates`/`confidence`/`reason`）、6 个 `reason` 枚举，全部由本仓库自己定义，无版本字段。插件升级时 `/api` 路径不变，但旧 Client bundle 可能因 HMR/缓存继续跑；Host 与 Client 是同一包发布，正常应同步，但 HMR 期间或 `dsh` 桌面端缓存旧 bundle 时可能错配。

**建议**：响应加 `api: 1`；Client 校验 `api` 不符时降级为「不显示建议 + 设置页提示」；README/protocol.md 记录契约（D5）。

### M11【高】`ctx.subprocess.spawn` 绕过工具沙箱与审批：受限会话里仍会执行宿主命令

**证据**：
- `index.js:282-288` 用 `subprocess.spawn({ argv: ['git', '-C', cwd, 'status', '--short', '--branch'], … })` 直接起进程。
- `SubprocessSpawnSpec` 没有任何 sandbox / approval / permission 字段（`dsh-subprocess` 类型定义）；沙箱是**工具层**在调用 bash/pwsh 前施加的（官方 `dsh-fs-sandbox` README 明说「工具层把调用会话的模式与 workspace root 解析成 bash runner 收到的同一策略」），而 `ctx.fs` 的**读**路径本身是 unconfined 的（同 README："reads stay unconfined"）。
- 结果：在一个被 sandbox 限制（如只读/禁止执行）的会话里，**模型不能执行命令，但本插件仍会在宿主机执行 `git status`**；且没有审批记录。

**影响**：安全/合规边界不一致——插件以「读上下文」为名获得了一条绕过会话策略的执行通道。`git status` 本身危害低，但它是**通道存在**的证据；如果未来把 `git` 换成可配置命令（例如 `git diff`、`git log -p`，甚至按 workspace 配置外部命令），风险会成倍放大。同时它也是 M1 之外的另一个「宿主内部协议」依赖：`subprocess` seam 的权限模型不在插件手里的。

**建议**：
1. 短期：把 workspace 上下文做成**可关闭**（见 M6），默认只发送文件名，`git status` 移到一个显式的「允许执行只读 git」开关后面；或在无 sandbox 权限时不做 git 调用（探测会话权限模式，官方有 permissionPresets/会话模式可读）。
2. 中期：用 `ctx.fs` 能提供的信息替代 `git`（例如工作区变更由 `workspaceChanges` 服务/投影提供；官方有 `dsh-workspace-changes`），避免为了 20 个变更项起子进程。
3. 向上游提议（附录 C）：给 subprocess seam 一个「按调用方会话策略校验」的入口，让插件复用和 bash 工具同一套沙箱/审批，而不是各用各的。

---

## 6. 可行性与优先级路线图

工作量：S ≤ 半天，M ≤ 2 天，L ≤ 1 周（单人）。

| 优先级 | 编号 | 事项 | 工作量 | 验收标准 |
|---|---|---|---|---|
| P0 | E11 | 数字设置项拒绝空值/越界值，Host 补数值 clamp | S | 清空任一数字项后预测仍正常；新增 selfcheck 用例 |
| P0 | D1/D2 | 重拍截图 + 转真 PNG + 包内图片可用 | S | README 图片与当前 `bar` 模式一致；`file` 显示 PNG；tgz 内图片不再 404 |
| P0 | D3/D4 | 修正 README 行为描述（hint、git 行数、来源校验 5s） | S | 与 `client.js:318-329`、`index.js:317-323`、`client.js:514-521` 一致 |
| P0 | M3 | 声明 `engines.dsh` + 版本矩阵 | S | 0.2.0 安装被拒/提示；0.2.1 正常；`--dump-config` 通过 |
| P0 | D5 | 补 CHANGELOG + 排障/卸载/数据流 | M | 用户可自查「装上没反应」 |
| P0 | E7 | 探针改 dev-only 或加诊断开关，剥离草稿/候选文本 | M | 默认构建不注册 `/probe`；无渲染级 fetch |
| P1 | E12 | 失败可见：接线 `strip.failed` / 设置页上次失败原因 | S | 断网/未配置模型时用户能看到原因 |
| P1 | E4/M5 | 清理会话 Map + 多客户端投递 | M | 1000 会话压测内存稳定；双标签页都能拿到同轮边界 |
| P1 | E5/E6 | test runner + lint + CI（含 selfcheck） | M | PR 自动跑 3 项检查 |
| P1 | E13 | 请求序号按 LRU/保护 in-flight | S | 32+ 会话下不误判 stale |
| P1 | N1/N2 | 旧值迁移 + v1/v2 缓存清理与说明 | S | 旧 `card` 自动改写；v1 键被清；CHANGELOG 写明 |
| P1 | N3 | peek/claim 合并为原子 claim | M | 单请求完成 claim；无双请求竞态 |
| P1 | M11 | 工作区上下文/`git status` 加独立开关，或改走受沙箱约束的数据源 | M | 受限会话中不再起子进程；无审批绕过 |
| P2 | E1 | client 拆模块 + 构建 + source map | L | 单文件 < 400 行；`dist/client.js` 生效；selfcheck 改为模块单测 |
| P2 | M1 | host-adapter 契约层 + 特征探测降级 | L | DOM 变化时不静默：降级为纯 bar 并可在设置页看到诊断 |
| P2 | M4/M8/M9/M10 | 上游提议、许可策略、CI 矩阵、协议版本 | M | 有 issue/PR 或文档落地 |

建议里程碑：

- **v0.1.2（止血，1～2 天）**：P0 全部 + E12 + N1/N2 迁移；发布 note 写清「建议 DSH ≥0.2.1-rc.2」。
- **v0.2.0（结构，约 1 周）**：E1 拆分 + 构建 + E2/E3 常量 + E5 CI + M5 投递 + E7 探针剥离。
- **v0.3.0（契约，约 1～2 周）**：M1 adapter + M3 版本矩阵自动化 + M4 上游能力（若 DSH 接受）+ M6 隐私开关。

---

## 7. 附录 A：可直接提交的 issue 模板

> 以下每条都可直接开 issue；标题中英双语，正文按「背景 / 证据 / 影响 / 建议 / 验收」组织，已填好证据位置。

### A1【P0】README 截图与当前 UI 不一致 / Screenshots are stale

**证据**：截图加入于 `4341710`；之后 `4b86ffc`（候选/学习/工作区）、`bca5aa1`（按钮紧凑）改变 UI。`screenshots/settings.png` 缺少「接受学习」「置信度门槛」两行（代码 `client.js:1223-1247,1306-1310`），显示位置仍是旧文案「输入框内（推荐）」（代码 `client.js:115-116` 已改为 bar 推荐）；`screenshots/composer-bar.png` 按钮是旧长标签（代码 `client.js:33,36,1087` 已用短标签）。
**建议**：重拍两张；README 加「UI 变更需同步截图」checklist。

### A2【P0】`screenshots/*.png` 实为 JPEG，工具链会拒绝 / Screenshot MIME mismatch

**证据**：`file` 输出 JPEG；按扩展名校验的工具报错。
**建议**：转存为真 PNG 或改扩展名为 `.jpg` 并更新 README:9/14。

### A3【P0】补 `engines.dsh` 与版本支持矩阵 / Declare engines.dsh and a version matrix

**证据**：`package.json` 无 `engines.dsh`/`peerDependencies`；DSH 0.2.1 起 `engines.dsh` 单独决定兼容、两者都无则不设约束；`exports["./icon"]` 仅在 0.2.1+ 生效。
**建议**：声明 `engines.dsh: ">=0.2.1-rc.2 <0.3.0"`（或真实范围）+ peer 区间；README 加矩阵；发布前跑 `--dump-config`/`--dump-config-schema`。

### A4【P0】补 CHANGELOG 与排障/卸载/隐私文档 / Add CHANGELOG and ops docs

**证据**：仅 `v0.1.1` 一个 tag；11 笔提交无对外变更记录；README 无卸载/回滚/排障/数据流。
**建议**：Keep a Changelog；加 `docs/troubleshooting.md`、`docs/data-flow.md`；README 安装节补「验证/升级/卸载」。

### A5【P1】`client.js` 1392 行，建议拆模块并引入构建 / Split client.js and add a build step

**证据**：9 类职责同文件（见 E1 表）；官方 `client-modules` 要求 `exports["./client"]` 为构建产物。
**建议**：esbuild 打包 `src/client/*` → `dist/client.js` + sourcemap；`files`/`exports` 同步；拆分表见 E1。

### A6【P1】移除/开关化调试探针与 `/api/composer-assist/probe` / Gate the debug probe

**证据**：14 处 `reportProbe`；`index.js:15,593-610` 常驻路由返回 `lastProbe/lastAlign/lastTranscript/recent(40)`；每次 render 触发一次网络请求（`client.js:943`）。
**建议**：dev-only 注册或设置开关；README 记录诊断模式。

### A7【P1】会话状态 Map 无界增长 + 多标签页单客户端消费 / Unbounded session maps and single-consumer turns

**证据**：`index.js:41,55,371,510-511` 无 TTL；`deliveredTurns` 一次性 consume（584-587）；双标签页只有一方能预测（代码推演）。
**建议**：会话关闭清理/TTL；投递带 clientId 或改事件推送。

### A8【P1】清理新旧并存：`display:'card'`、v2 缓存静默丢弃、peek/claim 双请求 / Legacy conflicts

**证据**：`index.js:159-161`、`client.js:1263`、`client.js:467-492`、`client.js:784-798`。
**建议**：一次性迁移并写 CHANGELOG；claim 合并为原子接口。

### A9【P2】与 DSH 上游对齐：composer 去全局契约与辅助调用能力 / Align with upstream

**证据**：6 个未文档化 DOM/CSS 依赖（M1 表）；`LlmCallConfig.purpose` 仅 compaction/session-title（`llm-streaming.zh.md:662-666`）。
**建议**：向 `deepseek-ai/deepseek-harness` 提议（附录 C）；本仓库先加 host-adapter 层与诊断。

### A10【P2】许可与贡献策略需明确 / Clarify license and contribution model

**证据**：初始提交为 MIT（`264e4f4`），`4eafe23` 改为 source-available 禁改（`LICENSE:1-8`）；无 `CONTRIBUTING.md`；无 issue/PR 模板。
**建议**：三选一并写清：仅作者维护 / 改 MIT / CLA 授权；CHANGELOG 记录许可变更。

### A11【P0】数字设置项清空保存 0，预测静默失效 / Clearing a numeric setting saves 0

**证据**：`client.js:1197-1205`（`Number('') === 0` → `save`）；`index.js:151-175`（Host 不校验数值范围）；后果：`timeoutMs=0` 立即超时（`index.js:666`）、`maxInputChars=0` 永远空转录（`index.js:194-195,654`）、`maxOutputTokens=0` 空输出。
**建议**：UI 对空值不保存/恢复旧值；Host 对所有数值字段 clamp；补 selfcheck 用例。

### A12【P1】所有失败对用户不可见 / Failures are swallowed

**证据**：`SuggestionStrip` 只有 `setFailed(false)`（`client.js:682,724,754,761`），无 `setFailed(true)`；`strip.failed` 死分支（952）；`runRequest(...).catch(() => null)`（456）；`settingsStore.error` 只写不读（157,163）。
**建议**：接线失败态并显示 reason；或在 README 明确「失败静默」。

### A13【P1】工作区上下文绕过会话沙箱执行 `git status` / Workspace context bypasses the session sandbox

**证据**：`index.js:282-288` 用 `ctx.subprocess.spawn` 直接起 `git`；`SubprocessSpawnSpec` 无 sandbox/approval 字段；沙箱由 bash 工具层施加，`ctx.fs` 读路径本就不受限 → 受限会话里插件仍会执行宿主机命令，且无独立开关（`index.js:301-328` 无设置项）。
**建议**：给工作区上下文/`git status` 加显式开关（默认只发文件名）；或改用 `workspaceChanges` 等服务/投影，避免起子进程；README 的隐私节写清。

---

## 8. 附录 B：证据索引

| 结论 | 证据位置 |
|---|---|
| client.js 1392 行、职责分布 | `client.js:17-1392`；本报告 E1 表 |
| 单文件 client bundle 的官方要求 | `docs/subsystems/client-modules.zh.md:94` |
| Host 5 条路由 | `index.js:12-16` |
| 探针状态与路由 | `index.js:24-33, 593-610` |
| 设置默认值/迁移 | `index.js:60-86, 151-175` |
| 转录压缩与证据预算 | `index.js:193-246` |
| 工作区上下文 | `index.js:264-328`；README:87 |
| 辅助 LLM 调用/推理档 | `index.js:374-417` |
| turn 边界监听与去重 | `index.js:563-573, 584-587` |
| 客户端轮询/peek/claim | `client.js:778-816, 787-798` |
| 幽灵预览/接管 hint | `client.js:248-335, 398-420` |
| 模块级状态与 v2 存储 | `client.js:426-634, 467-496` |
| 旧值 `card` | `index.js:159-161`；`client.js:1263`；截图 |
| 数字设置项 0 值 bug | `client.js:1197-1205`；`index.js:151-175, 194-195, 666` |
| 失败不可见 / 死分支 | `client.js:456, 682, 724, 752-761, 952`；`client.js:157,163` |
| 序号表驱逐 | `client.js:524-529, 446` |
| v1 存储键与 pending `bounded` 兼容分支 | 提交 `b53b912`、`01be400`、`0877c90`；`client.js:442, 467, 474-481, 495, 555-560` |
| v0.1.0 / MIT 许可的源码历史 | `git show 264e4f4:package.json`；`4eafe23` |
| 自检字符串替换 | `selfcheck.mjs:79-89`；另见 `:176-177, 204-206` |
| 官方 DOM 标记定义者（非契约） | `ui-conversation/src/client/skeleton/InputBar.tsx:417`、`input/editor/ComposerContentEditable.tsx:46`、`input/editor/DraftEditor.tsx:56,53`；外部消费方 `ui-model-selection/.../ModelSelect.tsx:673` 等；官方 `docs/` 零命中 |
| 官方 slot 声明 | `docs/subsystems/slots.zh.md:177`；`packages/client/ui-settings/src/client/contract/slots.ts:57` |
| `SessionSurface` 是公开 API | `docs/subsystems/session.md:400-424`（`nodes`/`replaceGeneration`/`contentGeneration`） |
| `prepareCall` 契约 | `docs/subsystems/llm-streaming.zh.md:1134`（Runtime）、`:928`（Adapter，勿混淆）；`purpose` 枚举 662-666 |
| 裸 `prepareCall` 不派发 `agent/turn-stopping` | header 写入与事件发射在 `dsh-agent-loop` 内（`lib/index.js`），`dsh-llm` 不碰 Session；事件定义见 `docs/subsystems/core.zh.md:1122-1146` |
| `agent/turn-stopping` 契约 | `docs/subsystems/core.zh.md:1122-1146`；`docs/event-producer-consumer.zh.md:25` |
| `deriveMessages` 契约 | `docs/subsystems/session.zh.md:664-677` |
| `ctx.get()` 语义（无 inject、只返回 active） | `docs/cordis-api/context.md:237-256` |
| `ctx.connection.fetch` 精确路由 | `packages/client/connection/README.zh.md`（`/api` bridge 与 exact route） |
| `engines.dsh` 强制规则 | `packages/boot/plugin-manager/README.zh.md:81`；`docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/` |
| 0.2.0/0.2.1 图标差异 | `docs/cookbook/adding-a-package.md`；本机技能 `dsh-plugin-construction`（实测记录） |
| M11 子进程绕过沙箱 | `index.js:282-288`；`dsh-subprocess` 类型定义（无 sandbox/approval 字段）；`dsh-fs-sandbox` README（工具层施加策略、读路径 unconfined） |
| release tgz 与源码一致；tgz 内无 screenshots | 下载 `v0.1.1/dsh-composer-assist.tgz` 后逐文件 `diff` 均 SAME；`tar -tzf` 清单；`package.json:14-20` |

---

## 9. 附录 C：给 DSH 上游的 4 条提议（与本插件直接相关）

1. **composer 区域的公开扩展契约**：把 `[data-composer-card]`/`[data-composer-input]`/`--dsh-composer-hint` 等内部标记固化为文档化契约（或提供 `ctx.composer` / 专用 slot props：`draft`、`placeholderHint`、`inset`），并纳入升级指南的兼容清单。当前任何输入框增强插件（预测、补全、翻译、语音）都在重复凿同一面墙。
2. **受支持的辅助模型调用入口**：`LlmCallConfig.purpose` 增加可扩展枚举或新增 `ctx.llm.auxiliary(...)`，保证不写 `request/header`、不触发 `agent/turn-stopping`、有独立 token 归类。这样插件不必自建 `predictingIn/deliveredTurns` 抑制逻辑。
3. **多客户端会话事件投递语义**：明确「同一 session 被多个浏览器/桌面客户端订阅时，turn 边界/建议如何投递」，提供按客户端游标或订阅式 API；否则每个「轮次后动作」插件都要自己发明一次性 token。
4. **subprocess seam 的会话策略校验**：给 `ctx.subprocess.spawn` 增加「按调用方 session 的 sandbox/permission 校验」入口（或提供只读 provider 的受限变体），让插件复用 bash 工具同一套沙箱与审批，而不是各用各的。预测类插件都要读工作区元数据，否则每个插件都自带一条越权执行通道。

---

*本报告与 [2026-10-24-dsh-architecture-review.md](./2026-10-24-dsh-architecture-review.md) 配套阅读；01 提供「插件层是什么」，02 提供「这个插件在插件层里的具体风险与改法」。*
