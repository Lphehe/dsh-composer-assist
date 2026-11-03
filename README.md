# 输入框预测 · Composer prediction

> **中文**：根据当前对话和你说话的方式，在输入框上方给出你下一条最可能发的消息，按 Tab 即可采用；同时支持输入时补全草稿、一键润色提示词。
>
> **English**: Predicts your next message in the DSH composer, based on your conversation and how you talk to it. Press Tab to take it. It also completes a draft as you type and rewrites a prompt for clarity on demand.

## 开发进展 · Development update

以下介绍的是**尚未公开发布的开发版**，并非下方 v0.1.1 安装包的功能清单。开发和验收仍在进行，实际表现取决于宿主能力、会话状态和模型配置。

- **预测与决策**：除下一条消息预测、草稿补全和润色外，开发版支持预测、决策选择及组合模式；润色先预览，再由用户应用。预测的自评分数和决策模型的选择把握均不等于正确率。
- **自动续接**：开启后围绕当前会话中的原始目标选择下一步，可选仅观察或自动执行，并调整轮数、判定严格度和工具策略。自动提交的续接会标记；遇到需要人工处理、状态变化或结果未知等情况会暂停，宿主权限和用户原有约束仍然适用。
- **动态工作流**：复杂任务可以给出多个工作流方案，展示步骤、依赖与调用概况；用户选择并确认启动。也可先准备草稿，再在工作流页面核对和运行。工作流支持多代理、阶段、并行及有界反馈，提供运行记录、停止、恢复和修订；未知副作用需要核实。
- **监控与角色**：工作流页面和会话侧栏展示任务、代理、活动、用量和结果，可查看流程、节点及日志。显示内容以实际记录为准，缺失数据保持未知。角色库可保存职责和模型策略；协作修复预设包含主控、执行和审查角色，并结合测试与审查反馈。角色职责不等同于正在运行的代理。

自动续接、动态工作流、监控、角色库及开发版新增决策能力**尚未包含在本页提供的 v0.1.1 安装包中**。预测、决策和工作流代理可能产生实际模型调用费用；公开版安装与许可仍以下文为准。

The following describes an **unreleased development version**, not the features in the v0.1.1 package below. Development and verification are ongoing; behavior depends on host capabilities, session state and model configuration.

- **Prediction and decisions:** Alongside next-message prediction, draft completion and polish, the development version supports prediction, decision selection and combined modes. Polish is previewed before applying. Model self-scores and decision confidence are not measures of correctness.
- **Automatic continuation:** When enabled, it selects next steps within the original goal of the current session. Observe-only and automatic modes offer configurable round limits, decision strictness and tool policy. Automatically submitted continuations are labelled. It pauses for conditions such as human decisions, changed state or unknown outcomes; host permissions and the user's existing constraints continue to apply.
- **Dynamic workflows:** Complex tasks can offer multiple plans showing steps, dependencies and an estimate of calls; the user selects and confirms a launch. A draft can also be prepared for review before running. Workflows support multiple agents, phases, parallel work and bounded feedback, with records, stop, resume and amendment. Unknown side effects require review.
- **Monitoring and roles:** The workflow page and conversation sidebar show tasks, agents, activity, usage and results, with access to flows, nodes and logs. Views use recorded data and leave missing information unknown. A role library saves responsibilities and model policies; the collaborative repair preset combines lead, execution and review roles with test and review feedback. A role is not itself a running agent.

Automatic continuation, dynamic workflows, monitoring, the role library and the new decision capabilities **are not included in the v0.1.1 package linked below**. Prediction, decisions and workflow agents can incur real model-call charges. The installation and license sections below apply to the public version.

## 反馈 · Feedback

问题、建议或使用疑问，欢迎加入 QQ 群 **1129389677**。

Bugs, suggestions and usage questions: join the QQ group **1129389677**.

<p align="center">
  <img src="screenshots/composer-bar.png" alt="建议栏显示在输入框上方" width="720">
</p>
<p align="center"><sub>输入框上方的独立建议栏，与输入框同宽对齐</sub></p>

<p align="center">
  <img src="screenshots/settings.png" alt="设置页" width="560">
</p>
<p align="center"><sub>设置 → 输入框预测</sub></p>

## 功能 · Features

| 中文 | English |
|---|---|
| 自动预测 | Predicts the next message after each finished turn |
| 手动预测 | Predict on demand from the composer tool row |
| 草稿补全 | Completes the second half of a draft as you type |
| 润色提示词 | Rewrites the current draft into a clearer instruction |

按 **Tab** 接受建议（填进草稿但不发送），**Esc** 隐藏，「忽略」按钮则永久丢弃。草稿为空时 **←/→** 在候选之间切换（按住修饰键、或输入法正在组合时不会拦截方向键）。
Tab accepts a suggestion (fills the draft, does not send); Esc hides it; the dismiss button forgets it. With an empty draft, **←/→** cycles between candidates (arrows are left alone while a modifier is held or an IME is composing).

## 安装 · Install

推荐安装预打包的 v0.1.1，不需要源码构建。在 Harness 中让助手使用 `plugin_manager install_bundle` 安装这个 URL：
Install the prepacked v0.1.1 archive with Harness's `plugin_manager install_bundle`; no source build is required:

```
https://github.com/Lphehe/dsh-composer-assist/releases/download/v0.1.1/dsh-composer-assist.tgz
```

普通 CLI profile 可按下面的示例安装（将 `web` 换成你的 profile 名；Desktop 请使用插件管理器）：
For a regular CLI profile, replace `web` with your profile name; use Plugin Manager for Desktop:

```bash
dsh plugin --profile web add https://github.com/Lphehe/dsh-composer-assist/releases/download/v0.1.1/dsh-composer-assist.tgz
```

也可克隆仓库，再让 `plugin_manager install_bundle` 安装克隆目录的绝对路径：
Alternatively, clone the repository and install its absolute directory path with `plugin_manager install_bundle`:

```bash
git clone https://github.com/Lphehe/dsh-composer-assist.git
```

v0.1.1 沿用 0.1 系列输入预测功能，本次更新许可与分发；不包含开发中的 ZCode 动态工作流。
v0.1.1 retains the 0.1-series composer features and updates licensing/distribution; it does not include the in-development ZCode dynamic workflows.

## 设置 · Settings

设置 → **输入框预测** · Settings → **Composer prediction**

| 中文 | English |
|---|---|
| 启用 | Enable |
| 接受学习（默认关闭，可清除统计） | Acceptance learning (off by default, with a clear-stats button) |
| 模式：自动 / 单词补全 / 两者 / 仅手动 | Mode: auto / word / both / manual only |
| 显示位置：建议栏 / 行内 | Display: bar above the box / inline |
| 预测模型（留空则跟随本会话） | Predict model (blank follows the session) |
| 输出上限 / 输入停顿 / 超时 / 上下文上限 | Output cap / debounce / timeout / context cap |
| 置信度门槛（0 保留全部） | Confidence bar (0 keeps everything) |

设置存于 `$DSH_HOME/composer-assist/settings.json`。
Settings live in `$DSH_HOME/composer-assist/settings.json`.

建议栏上的「置信度」是模型的自评，只显示为高/中/低三档，不是校准过的概率。
The confidence on the bar is the model's own rough self-assessment, shown only as high/medium/low — not a calibrated probability.

## 设计要点 · Design notes

- **不写会话日志**：预测是 `ctx.llm.prepareCall()` 的辅助调用，不进入对话历史。
  **Never writes to the session log**: prediction is an auxiliary `ctx.llm.prepareCall()` call.
- **每轮只预测一次**：Host 侧监听 `agent/turn-stopping` 记账；预测自身产生的 turn 事件会被过滤，并按 turn 号去重。
  **Exactly one prediction per finished turn**: the Host records `agent/turn-stopping`, filters the prediction's own turn events, and deduplicates by turn number.
- **打字不触发**：轮询不依赖草稿内容，键击不会重启轮询或消耗 turn。
  **Typing never triggers it**: polling does not depend on draft content, and keystrokes neither restart the poll nor consume a turn.
- **建议跟着会话走**：建议与「生成中」状态都按会话保存在模块级存储，切换对话再切回不会丢失。
  **Suggestions belong to their conversation**: both the suggestion and the generating state are kept per session in a module-level store, so switching away and back does not lose them.
- **不抢宿主的命令提示**：行内模式会避让宿主的 `--dsh-composer-hint`。
  **Does not steal the host's hint**: inline mode avoids the host's `--dsh-composer-hint`.
- **工作区上下文只给名字**：工作目录顶层文件名与 git 分支/改动列表会随提示词一起发送，经宿主 `fs` / `subprocess` provider 读取。不读文件内容，过滤常见凭据类文件名；目录最多扫描 200 项、发送 8 个文件名和 20 行 git 状态，缺失或超时不阻断预测。
  **Workspace context is names only**: top-level file names plus the git branch and changed-file list ride along with the prompt through the Host `fs` / `subprocess` providers. No file contents are read; common credential-shaped names are filtered. Scanning is capped at 200 entries, with 8 names and 20 git status lines sent; missing context or a timeout does not fail the prediction.

### 上下文与过期保护 · Context and stale-result protection

- 在现有对话历史字符预算内（不含当前草稿及工作区摘要），优先最新用户请求及回答、较早用户约束，再加入最近最多四条工具文本证据（带工具名、错误标记和截断标记）。不复制隐藏推理、图片、附件、工具参数或整个系统提示词；工具证据不作为指令。
- 预测只给有依据的 1～3 条候选，不强求数量、不新增授权或任务；不确定时可以不给建议。空结果不会清除已有有效候选。
- 请求绑定会话、当前消息视图边界和草稿修订。来源变化、乱序结果或期间改稿的请求不能写入候选；接受前再核对来源，草稿变化时接受按钮禁用。润色期间的新输入也不会被旧结果覆盖。
- 已完成候选仍按会话缓存；旧版无来源缓存不会恢复。只读上下文来自 DSH 的 `Session.deriveMessages()`，不是完整模型请求快照；不创建活跃预测子会话。

Within the existing character budget, recent user requests/answers and older user constraints take priority, followed by up to four bounded textual tool results. Hidden reasoning, attachments, tool arguments, and system prompts are not copied. Predictions offer 1–3 grounded candidates or abstain. Session/source/draft-revision checks reject outdated responses; acceptance rechecks the source and never overwrites an edited draft. Polishing also protects intervening edits. Completed candidates remain session-local; legacy entries without a source are discarded. This uses the read-only message view, not a full model-request snapshot or an active fork.

### 硬超时与响应速度 · Hard deadlines and latency

- Host 在工作区准备、等待旧调用退出、模型准备和生成期间执行同一硬截止；浏览器对请求、响应体和来源检查另设配置时限 + 1 秒兜底。接受候选的来源检查最多 5 秒。超时结束「生成中」，丢弃迟到结果，保留有效旧候选，不自动重试。
- 对明确支持 `low` 推理的模型，只为本次预测、补全或润色调用使用低推理档；其他模型保持默认。不更换模型、不改主会话设置，也不缩减现有上下文。输出预算是否是远端硬限制取决于提供方。
- 截止后会请求取消，但不能保证远端立即停止生成或计费；未结束的调用仍被记账，同会话同类新请求等待它退出，避免叠加后台调用。

The Host enforces one deadline across workspace preparation, previous-call draining, model preparation and generation. The browser bounds the request, response body and source validation by the configured timeout plus one second; acceptance checks have a five-second limit. Late results are discarded without clearing valid suggestions or retrying. Auxiliary calls use low reasoning only when the exact model advertises it, without changing the main session or selected model. Cancellation is best-effort upstream: an unfinished call remains owned until it drains, and replacements do not overlap it. Token-budget enforcement depends on the provider.

## 实现说明 · Implementation notes

`display: inline`（行内模式）在空草稿上显示一个非编辑预览，与编辑器共享网格区域并隐藏 placeholder；换行会撑开输入区域。草稿补全复用宿主的 `--dsh-composer-hint`，跟随文字末尾排版。继续编辑使原建议与草稿不匹配时，行内预览隐藏，候选仍保留在建议栏。接受、切换会话或退出行内模式时会清理插件拥有的提示。

Inline mode shows a non-editable preview over an empty editor, shares its grid area, and hides the placeholder; wrapped text expands the input area. Draft continuations use the host's `--dsh-composer-hint` at the end of the text. Editing a draft hides a mismatched inline preview while keeping the candidate in the suggestion bar. Accepting, switching sessions, or leaving inline mode clears the plugin's own hints.

预览使用清晰的灰色，常显「预览 · 未填入草稿」与键盘提示；只有 Tab 或接受按钮会填入草稿。候选和选中位置按会话保存在标签页会话存储中，切换会话、重载插件或刷新后会恢复；关闭标签页会清空这份缓存。生成中状态保留在当前页面内存中，正常切换会话不会丢失。

Readable gray text and visible preview/keyboard hints distinguish suggestions from the draft; only Tab or the accept button inserts them. Per-session candidates and selection survive session switches, plugin reloads, and page refreshes in tab session storage. Closing the tab clears this cache. In-flight state lives in page memory and survives normal session switches.

行内显示依赖宿主的 `[data-composer-card]` / `[data-composer-input]` 标记及原生提示样式；DSH 升级改名后需要适配。Tab 接受也依赖消息输入框标记，以免搜索等其他输入框误接受候选。

Inline rendering relies on the host's composer markers and native hint styles, which may need adapting after a DSH upgrade. Tab acceptance also checks the message-editor marker so other editable fields, such as search, cannot accept a candidate.

## 成本提醒 · Cost warning

**每次预测都是一次真实计费的模型调用。** 默认开启自动模式，即每轮回答后一次调用。可在设置中改为「仅手动」或直接关闭。

**Every prediction is a real, billed model call.** With auto mode on, that is one call after each finished turn. Switch to manual-only, or turn the plugin off, in the settings page.

## 自检 · Self-check

克隆仓库后运行 `node selfcheck.mjs`，检查解析、学习统计和上下文失败降级；不调用模型或改写用户设置。
After cloning, run `node selfcheck.mjs` for parser, learning-counter and context-fallback checks. It does not call a model or change user settings.

## 许可证 · License

原创程序代码采用“源码可见、禁止修改”条款，并非开放源代码许可证。允许使用未经修改的版本；未经著作权人事先书面许可，不得修改本软件、制作衍生版本或分发修改版本。完整条款见 [LICENSE](LICENSE)。用户自己的配置、输入、输出和工作流脚本不受本项修改限制。

The original program code is source-available under use-permitted, modification-prohibited terms, not an open-source license. Use of the unmodified software is permitted; modification or derivative versions require the copyright holder's prior written permission. See [LICENSE](LICENSE). These restrictions do not apply to users' own configuration, input, output or workflow scripts.
