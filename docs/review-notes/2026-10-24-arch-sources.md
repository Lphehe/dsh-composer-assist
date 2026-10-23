# Doc1 来源摘录（arch-sources）

> 注：为提交到公开仓库，本文把审查机器的本地路径替换为占位符：`<DSH_INSTALL_DIR>` = DSH 运行时安装目录，`<DSH_REPO_CHECKOUT>` = deepseek-harness 仓库检出，`<PLUGIN_CHECKOUT>` = dsh-composer-assist 仓库检出，`<REVIEW_DIR>` = 审查材料目录。行号与结论不受影响。
> 本文件是 `docs/2026-10-24-dsh-architecture-review.md` 的证据附件：只记"我读了什么、哪句原文、哪个命令得出什么"，不重复正文。行号对 commit `22ddee3` 与 DSH `0.2.1-rc.2`。

## 0. 环境基线

```
$ dsh --version                      # 0.2.1-rc.2
$ ls <DSH_INSTALL_DIR>/node_modules/@deepseek-ai | wc -l
305
$ cd <DSH_REPO_CHECKOUT> && git log --oneline -1
22ddee3 Merge pull request #7075 from deepseek-harness/worktree-chatgap
$ git sparse-checkout list
docs
packages/boot/plugin-manager
packages/client
apps/desktop            # 本轮追加
apps/cli                # 本轮追加
packages/boot/app-boot
packages/boot/hmr
packages/core
packages/fs
packages/host
packages/interaction
packages/llm
packages/session
packages/sandbox
packages/tools
```

> 追加稀疏目录是为了**本地校验行号**（例如 `sed -n '417p' packages/core/agent/src/runtime-types.ts`）。未额外 clone。

## 1. 一手文档（权威度：高）

| 文件 | 摘录（原文） | 用途 |
|---|---|---|
| `docs/architecture.zh.md:9` | "产品的每一部分都是插件，包括模型适配器、工具注册表、会话日志，以及 agent loop（智能体循环）本身" | 一切皆插件 |
| `docs/architecture.zh.md:11` | "不存在需要打补丁的特权内核：扩展 dsh 的方式是把插件挂载到其他插件旁边，而各项注册都是副作用" | 微内核哲学 |
| `docs/architecture.zh.md:17` | "profile 是存放在 Harness home 中的具名组装……`web`、`headless`、`sdk`、`sdk-minimal` 和 `acp` 作为模板随发行版交付" | profile 形态 |
| `docs/architecture.zh.md:25` | "各层依次应用在空条目列表之上：profile 中有序的组合包、其 `cordis.patch.yml`、home patch，最后是 `--patch` overlay。一条 patch 按 id 定位某个条目并替换其整个 config，或插入新条目。" | 五层叠加 + patch 语义 |
| `docs/architecture.zh.md:57-66` | 核心包表：`core/session`→`ctx.sessions`、`core/system-prompt`→`ctx.systemPrompt`、`core/tools`→`ctx.tools`、`core/agent`→`ctx.agents`、`core/agent-loop`→`ctx.agentLoop`、`llm/llm`→`ctx.llm` | 服务槽位 |
| `docs/architecture.zh.md:71-76` | 会话事件 / Agent 事件 / 能力事件三域定义 | 事件三域 |
| `docs/architecture.zh.md:87-108` | 轮次流程文本图（`turn/start` → `agent/pre-step` → `step/start` → `agent/request` → `llm/stream` → `tools/*` → `step/end` → `agent/turn-stopping` → `turn/end`） | 请求旅程 |
| `docs/architecture.zh.md:110` | "`agent/pre-step`、`agent/request`、`llm/stream` 和三个 `tools/*` 事件是 waterfall……`agent/turn-stopping` 是 serial 事件，没有 `next()`" | 分发模式 |
| `docs/architecture.zh.md:126-134` | 会话日志、`deriveMessages()`、JSONL generation、"模型可见即已记录"、投影 seam | 事件溯源 |
| `docs/cordis-primer.zh.md:9-13` | 五概念：插件 / 上下文 / inject / 类型化事件 / 可逆副作用 | Cordis 语义 |
| `docs/cordis-primer.zh.md:21-27` | 五种分发模式表 | 事件模式 |
| `docs/cordis-primer.zh.md:35-39` | "`ctx.waterfall` 是环绕中间件……不调用 `next()` 直接返回则短路" | waterfall 必委托 |
| `docs/capability-seams.zh.md:634-738` | 约 100 行服务表：`ctx.*` / 角色 / 提供方包 / 实现 / 消费者 | 槽位清单 |
| `docs/event-producer-consumer.zh.md:11-96` | 生成式产销矩阵（模式 + 声明位置 + dispatchers + listeners） | 事件表 |
| `docs/event-producer-consumer.zh.md:98-112` | "Non-harness or undeclared event strings"（`agent/request`、`internal/*`、`loader/volatile-update`、`slots/changed`） | 事件名必须有声明 |
| `docs/subsystems/sandbox.zh.md:5` | "`dsh-sandbox-local` 提供 Linux bwrap/Landlock、macOS Seatbelt 与 Windows ACL 受限令牌后端" | 三平台沙箱 |
| `docs/subsystems/sandbox.zh.md:11` | "`SandboxMode` 仅管控文件系统效果……网络与进程可见性不在此处的定义范围内" | 沙箱边界 |
| `docs/subsystems/sandbox.zh.md:30` | "`partial` 表示活跃后端或较旧的内核 ABI 仅管控其中一个子集" | enforcement |
| `docs/subsystems/sandbox.zh.md:163` | "`await ctx.sandbox.confine(argv, policy, signal)`……静默的无隔离透传永远不合法" | fail-closed |
| `docs/subsystems/slots.zh.md:23` | "`root` 是唯一内建声明……`ui-renderer` 调用 `ctx.slots.renderSlot('root', {})`" | slot 根 |
| `docs/subsystems/slots.zh.md:52-66` | cardinality / scope 两维表 | slot 语义 |
| `docs/subsystems/slots.zh.md:124-195` | 当前 slot 层级图（含 `conversation.composer.bar`、`conversation.input.left`、`conversation.input.dock`） | slot 名 |
| `docs/subsystems/client-modules.zh.md:94` | "包加入这张表的方式，是在自己的 package.json 中声明 `dsh.client`（`platform: 'web'`、可选的 `inject` 边、可选的 `immediately`），并在 `exports["./client"]` 导出构建好的 bundle" | client 形态 |
| `docs/subsystems/web-client.zh.md:24` | "Host 把组合后的 `WebBootGraph` 写入 `window.__DSH_BOOT__`……lazy CommonJS 表" | 浏览器启动 |
| `docs/subsystems/web-client.zh.md:91-93` | 包边界：只能 `import type`；跨包用注入服务或 slot；`dsh.client.external` 不得滥用 | 包边界 |
| `docs/subsystems/tools.zh.md:9` | `ToolDefinition` 全字段；执行/展示回调"绝不能泄漏到模型请求中" | 工具定义 |
| `docs/subsystems/tools.zh.md:639-740` | `register/restrict/guard/get/executable/resolve/definitions/schemas/setExecutor/execute` | 工具 API |
| `docs/subsystems/session.zh.md:9-183` | `SessionEventMap`：`turn/start`、`turn/end`、`step/*`、`user/message`、`system/message`、`assistant/message`、`assistant/attempt`、`tool/call`、`tool/result` | 会话事件 |
| `docs/subsystems/session.zh.md:675-692` | `deriveMessages()` 投影规则 + fork API | 派生历史/分叉 |
| `docs/subsystems/session.zh.md:810-814` | 持久化约定："所有 `event.data` 都必须可序列化为 JSON；`Session.append` 会从源头强制" | 红线 |
| `docs/subsystems/llm-streaming.zh.md:831-940` | `LlmAdapter` 约定、`prepareCall` 两种（adapter 级 / `ctx.llm` 级） | LLM seam |
| `docs/subsystems/storage.zh.md:5` | "`ctx.storage.backend` 是一张名称 → 后端的表……`register(name, backend)` 返回 disposer" | storage 多后端 |
| `docs/glossary.zh.md:13-21` | scope / scope key / agent.ctx / scoped dispatch / shadowing / restriction / setup window / lineage | 作用域语义 |
| `docs/web-styling.zh.md:9,18` | "`ui-theme` 负责 `--dsw-*` 静态色阶、语义别名……功能组件使用 `--dsw-alias-*` 语义 token" | 主题契约 |
| `docs/api-gateway.zh.md:9-11` | "未标记的方法不会进入生成的 Client 类型或运行时贡献"；`TypertLookupMap` 解释 `agent → agentId` | Remote |
| `docs/subsystems/typert.zh.md:5-15` | `TypertLookupMap` / `TypertContextMap` 声明合并 | Remote 类型 |

## 2. 安装包产物（权威度：最高，与运行时同版本）

| 文件 | 摘录 | 用途 |
|---|---|---|
| `node_modules/@deepseek-ai/cordis/package.json` | `"version": "4.0.5"`；`repository.directory: "vendor/cordis"`；`author: "Shigma <...>"` | Cordis 版本与来源 |
| `node_modules/@deepseek-ai/dsh/package.json` | `"version": "0.2.1-rc.2"`；依赖 `@deepseek-ai/cordis ~4.0.5`、`cordis-plugin-loader ~1.0.6`、`cordis-plugin-include ~1.0.10` | 运行时依赖 |
| `node_modules/@deepseek-ai/dsh-base/package.json` | `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` | bundle 形态 |
| `node_modules/@deepseek-ai/dsh-base/cordis.patch.yml:1-14` | "A patch replaces the targeted row's whole `config` rather than merging into it"；"Row order carries no load semantics (activation is service-availability driven)" | patch 语义 |
| `node_modules/@deepseek-ai/dsh-client-ui-theme/package.json` | `dsh.client { inject: [...], platform: "web", immediately: true }`；`exports` 含 `"./client"`、`"./package.json"`、`"./locale/*.json"`；`peerDependencies: { "@deepseek-ai/cordis": "~4.0.5" }` | client 形态 |
| `node_modules/@deepseek-ai/dsh-client-ui-theme/locale/en.json` | `{"meta":{"title":"ui-theme"}}` | locale meta |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:43` | required list：`agent-loop`、`webserver`、`web-runtime`、`modules`、`connection`、`headless-runner`、`acp`、`sdk-jsonrpc-server` | 特权服务集合 |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:50` | profile 位置与组成；skip 组合包 → `skippedBundles` | profile |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:52` | "清单声明了 `engines.dsh` 时，只由该范围决定，忽略 `peerDependencies`" | 版本兼容 |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:61` | patch 层优先级、整 config 替换、`!!js`、空文件导致启动失败（要写 `[]`）、`patch: entry not found` stderr 警告 | patch 细节 |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:63` | HMR 监视 profile manifest 与两份用户 patch | 热插拔条件 |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:67` | runtime resolution 安装进 ESM/CJS resolver，不创建 fallback 链接 | 模块解析 |
| `node_modules/@deepseek-ai/dsh-app-boot/README.zh.md:94` | `recomposeProfile(...)` 重载流程、`app-boot/config-reload` | 重载 |
| `packages/boot/plugin-manager/README.zh.md:40` | profile patch 只记录与组合包不同的设置；关闭再开启 bundle 会排到末尾、可能改变优先级 | bundle 顺序 |
| `packages/boot/plugin-manager/README.zh.md:56` | `plugin-manager/update-state` 的 `checking/removing/installing/restoring` | 包操作诊断 |
| `packages/boot/plugin-manager/README.zh.md:75-81` | 版本兼容与 `compatibility.json` 豁免、CLI `allow-version` / `revoke-version` | 豁免 |
| `packages/boot/plugin-manager/README.zh.md:122-126` | HMR 队列、`restart-required`、`package-moved`、模块逐出 | 热插拔限制 |

## 3. 本机用户环境（只读观察）

| 项 | 值 |
|---|---|
| `~/.dsh/profiles/` | `headless`、`ops-panel-e2e`、`ops-test`、`web` |
| `~/.dsh/profiles/web/package.json` | `dsh.profile.bundles` 8 项：`dsh-base` → `dsh-web-app` → `experimental-auto-review` → `experimental-agent-team-profile` → `dsh-dream-skin` → `dsh-context` → `experimental-inspector-profile` → `dsh-compress-codex` |
| `~/.dsh/profiles/web/cordis.patch.yml` | 用户 tweak 层，示例为 `llm-pi-ai` 加 provider |
| `~/.dsh/plugins/` | 只有 `dsh-boot-animation`（第三方 JS 插件 checkout，`package.json` + `cordis.patch.yml` + `entry.js`）；官方文档与运行时代码对它零引用 |

## 4. 否定证据（"零命中"也是证据）

| 用户说法 | 验证命令 | 结果 |
|---|---|---|
| Rust 实现 | `cd <DSH_REPO_CHECKOUT> && git ls-tree -r --name-only HEAD \| grep -c '\.rs$'` | `0` |
| winit | `grep -ril 'winit' <DSH_REPO_CHECKOUT>` | 无命中 |
| serde_json | `grep -ri 'serde_json' <DSH_REPO_CHECKOUT>` | 无命中 |
| C ABI 入口 | `grep -rl 'plugin_init\|dlopen\|\.dylib' node_modules/@deepseek-ai` | 无命中 |
| `ctx.llmStreams` | `grep -rn 'llmStreams' <DSH_REPO_CHECKOUT> <install>/node_modules` | 无命中 |
| `dsh-plugin-contract` | `grep -rn 'dsh-plugin-contract' <DSH_REPO_CHECKOUT>` | 无命中 |
| `~/.dsh/plugins` 官方扫描 | `grep -rn '\.dsh/plugins' <DSH_REPO_CHECKOUT>/docs` | 无命中 |
| WebView | `grep -rni 'webview' <DSH_REPO_CHECKOUT>/docs` | 无命中 |
| Rust 移植项目名 | `grep -rn 'dsh-bash-rtk\|dsh-studio' <DSH_REPO_CHECKOUT>` | 无命中（仅外部生态有近似项目） |
| 桌面栈 | `apps/desktop/package.json` 的 `electron ^44.7.0`、`electron-builder` | Electron，不是 winit |
| 唯一原生源码 | `apps/desktop/cli/link-entry.c`（20 行，`linkat` 包装） | 与插件 ABI 无关 |

## 5. 计数类事实（可复跑）

```
# 声明 dsh.client / dsh.bundle / engines.dsh 的包数
python3 - <<'EOF'
import json,glob
pk=glob.glob('<install>/node_modules/@deepseek-ai/*/package.json')
cl=bd=en=0
for p in pk:
    d=json.load(open(p)); s=d.get('dsh') or {}
    cl += isinstance(s,dict) and 'client' in s
    bd += isinstance(s,dict) and 'bundle' in s
    en += 'dsh' in (d.get('engines') or {})
print(cl,bd,en)
EOF
# → 78 18 0（其中 dsh-client-ui-* 共 54 个）
# dsh-base patch 行数
grep -c '    - id:' <install>/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml   # 96
```

## 6. 行号抽检（已逐条 sed 验证）

`packages/core/agent/src/runtime-types.ts:290/309/350/399/417` → `agent/created`、`agent/status`、`agent/pre-step`、`agent/assistant-stream`、`agent/turn-stopping`
`packages/core/session/src/index.ts:56/76/84` → `session/created`、`session/event`、`session/flush`
`packages/core/system-prompt/src/index.ts:31` → `system-prompt/assemble`
`packages/core/tools/src/events.ts:18/29/41/49` → `tools/pre-execute`、`tools/execute`、`tools/post-execute`、`tools/result`
`packages/boot/hmr/src/index.ts:35/40` → `hmr/change`、`hmr/reload`
`packages/fs/fs/src/index.ts:59/67/77` → `fs/write-intent`、`fs/edit-intent`、`fs/observed`
`packages/host/webserver/src/index.ts:44` → `webserver/index-inject`
`packages/interaction/user-approval/src/types.ts:87` → `approval/request`
`packages/llm/llm/src/index.ts:75` → `llm/stream`

## 7. 外部来源（**不可信数据**，仅用于判断"参考项目"是否存在）

| URL | 用途 | 结论 |
|---|---|---|
| https://www.npmjs.com/package/@deeptrial/dsh-bash-rtk | 核 `dsh-bash-rtk` 是否存在 | 存在，但为第三方 npm 包，非官方 Rust 移植 |
| https://github.com/pmndrs/zustand/discussions/3561 | 核 "DSH Studio" 的 Rust supervisor 说法 | 存在同名第三方项目讨论，非官方实现 |
| https://agentspace.cc/tool/dsh-studio | 同上 | 同上 |
| https://github.com/deepseek-harness-evoforge/dsh-evoforge/blob/e8dada4ac0dd277ca89fc8e1e19b82799badd093/skills/build-dsh-plugin/references/dsh-contract.md | 核第三方对"插件契约"的描述 | 其"Official anchors"全部指向 Cordis 教程与 profile/bundle 文档，未提 C ABI |

> 处理原则：外部来源只用于"该名字是否存在于生态"，**不用于确立实现事实**；实现事实一律以本机代码/官方仓库为准。

## 8. 本文未验证项（与正文附录 B 对应）

1. `~/.dsh/plugins/` 的官方语义（零文档/零代码引用，仅本地存在）。
2. 三个外部项目名（`dsh-bash-rtk`、`dsh-studio`、`dsh-plugin-contract`）的准确归属与内容。
3. 具体 slot key 的长期稳定性（官方只承诺 slot 系统语义）。
4. `agent/turn-stopping` 是否覆盖所有终止路径（取消/崩溃）。
5. composer-assist 在本机 0.2.1-rc.2 的实际运行兼容性（未安装验证）。
6. `--dsh-composer-hint` 是官方变量还是插件自造（官方样式文档只列 `--dsw-*`）。
