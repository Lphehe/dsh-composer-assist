# 输入框预测 · Composer prediction

> **中文**：根据当前对话和你说话的方式，在输入框上方给出你下一条最可能发的消息，按 Tab 即可采用；同时支持输入时补全草稿、一键润色提示词。
>
> **English**: Predicts your next message in the DSH composer, based on your conversation and how you talk to it. Press Tab to take it. It also completes a draft as you type and rewrites a prompt for clarity on demand.

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

```bash
git clone https://github.com/lphehe-bot/dsh-composer-assist.git ~/.dsh/local/composer-assist
```

再用 `plugin_manager` 把该目录作为 bundle 安装：
Then install the directory as a bundle with `plugin_manager`:

```
plugin_manager install_bundle  target: ~/.dsh/local/composer-assist
```

仓库声明了 `dsh.bundle` manifest，因此也可以直接：
The repo declares a `dsh.bundle` manifest, so it also works directly:

```
dsh plugin add lphehe-bot/dsh-composer-assist
```

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

## 实现说明 · Implementation notes

`display: inline`（行内模式）在输入框所在的相对定位容器里插入一个自己的绝对定位 ghost，并临时隐藏宿主占位符——宿主的 `--dsh-composer-hint` 画在占位符之后，空草稿时会被占位符盖住，所以本插件不用它。该模式依赖宿主的 `[data-composer-card]` / `[data-composer-input]` 标记；DSH 升级后若标记改名，行内 ghost 会静默不再显示（不报错、不污染草稿）。默认的 `bar` 模式不依赖宿主内部标记，只使用主题变量。

The `display: inline` mode inserts its own absolutely-positioned ghost into the composer's positioned container and hides the host placeholder while it shows — the host's `--dsh-composer-hint` paints after the placeholder, which is exactly what covers it on an empty draft, so this plugin does not use it. That mode relies on the host's `[data-composer-card]` / `[data-composer-input]` markers; if a DSH upgrade renames them, the inline ghost silently stops showing — no error, no draft corruption. The default `bar` mode uses only theme variables and no host-internal markers.

## 成本提醒 · Cost warning

**每次预测都是一次真实计费的模型调用。** 默认开启自动模式，即每轮回答后一次调用。可在设置中改为「仅手动」或直接关闭。

**Every prediction is a real, billed model call.** With auto mode on, that is one call after each finished turn. Switch to manual-only, or turn the plugin off, in the settings page.

## 自检 · Self-check

克隆仓库后运行 `node selfcheck.mjs`，检查解析、学习统计和上下文失败降级；不调用模型或改写用户设置。
After cloning, run `node selfcheck.mjs` for parser, learning-counter and context-fallback checks. It does not call a model or change user settings.

## 许可证 · License

MIT
