# 输入框预测

**让 DSH 先起草下一句，由你决定是否采用。**

结合当前对话预测后续输入、补全草稿，或按需润色提示词。建议按会话保留；按 **Tab** 只填入草稿，**不会自动发送**。

![中文功能介绍：预测下一句、补全草稿、提示词润色；Tab 只填入草稿，不自动发送](<screenshots/overview-zh.png>)

当前公开版本为 **[v0.1.1](<https://github.com/Lphehe/dsh-composer-assist/releases/tag/v0.1.1>)**，只包含输入预测相关功能，不包含开发中的动态工作流。上图是功能介绍图，不是模型生成结果截图。

> **先看费用：**预测、补全和润色会发起真实模型调用，可能产生费用。默认自动模式会在每轮回答后预测一次；建议先在设置中切到“只在手动调用时”，确认模型和预算后再启用自动预测。
>
> **许可边界：**源码可见，不是开放源代码许可证。允许使用未经修改的版本；修改、制作衍生版本或分发修改版本须事先取得著作权人书面许可。详见[完整许可](<LICENSE>)。

## 快速安装

在 DSH 中打开 **插件 → 添加插件**，粘贴下面的公开下载地址，完成安装后启用：

```text
https://github.com/Lphehe/dsh-composer-assist/releases/download/v0.1.1/dsh-composer-assist.tgz
```

这是已预打包的 v0.1.1，不需要源码构建。也可以让 Harness 助手使用 `plugin_manager install_bundle` 安装同一个地址。

普通 CLI profile 可使用下列命令；把 `web` 换成你的 profile 名，Desktop 使用插件管理器：

```bash
dsh plugin --profile web add https://github.com/Lphehe/dsh-composer-assist/releases/download/v0.1.1/dsh-composer-assist.tgz
```

## 你可以怎么用

| 你想做的事 | 使用方式 |
| --- | --- |
| 接着当前对话继续提问 | 自动模式在回答结束后预测下一句，也可点“预测”手动调用。 |
| 已写了一半，不想从头改写 | 单词补全模式在输入停顿后补全草稿。 |
| 把现有草稿说得更清楚 | 点“润色”，检查结果后再采用。 |
| 只想自己决定什么时候调用 | 进入“设置 → 输入框预测”，选择“只在手动调用时”。 |

**接受不等于发送。** Tab 或接受按钮只把建议填进草稿；Esc 隐藏建议，“忽略”丢弃候选。草稿为空时可用左右方向键切换候选；按住修饰键或输入法正在组合时不拦截方向键。

## 中文界面实图

以下图片来自 v0.1.1 在官方 DSH **0.2.1-rc.2** 中的实际 GUI 安装验收，只展示草稿、操作入口和设置；没有配置模型，也没有生成预测结果。

![中文输入框实图：草稿旁的预测与润色入口；未执行模型生成](<screenshots/composer-bar.png>)

![中文设置实图：只在手动调用时、显示位置、预测模型与调用参数](<screenshots/settings.png>)

## 设置与使用边界

- **先配置模型。**未指定预测模型时，跟随本会话上次真实用过的模型；没有可用模型时，需要先在 DSH 的模型设置中配置。
- **自动调用可关闭。**支持自动预测、输入时补全、两者都要和仅手动四种模式。可调整输出上限、输入停顿、超时、上下文上限及置信度门槛。
- **接受学习默认关闭。**启用后会记录接受/忽略统计，也可以清除统计。
- **注意发送给模型的上下文。**调用会使用近期对话、用户约束、有限工具文本证据，以及经筛选的工作区顶层文件名和 Git 状态摘要；不读取这些工作区文件的内容，也不复制隐藏推理、图片、附件、工具参数或整个系统提示词。
- **迟到结果会被丢弃。**会话、来源或草稿发生变化时，旧请求不能覆盖新输入；取消远端调用是尽力而为，不能保证立刻停止生成或计费。
- **置信度不是概率保证。**高/中/低是模型自评，不是经过校准的准确率。

配置保存在 `$DSH_HOME/composer-assist/settings.json`。本次验证覆盖安装、启用、设置保存与重开、浅深色界面、未发送草稿；**不代表模型输出质量、完整候选接受链或其他 DSH 版本已经验收**。

## 自检与许可

克隆仓库后可运行 `node selfcheck.mjs`，检查解析、上下文、所有权与超时保护等已有自检；不调用模型，也不改写用户设置。

原创程序代码采用“源码可见、禁止修改”条款，完整内容见 [LICENSE](<LICENSE>)。用户自己的配置、输入、输出和工作流脚本不受本项修改限制；第三方组件继续遵守各自许可证。

<details>
<summary>完整设置与技术资料（保留原文及英文对照）</summary>

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

</details>
