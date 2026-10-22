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

按 **Tab** 接受建议（填进草稿但不发送），**Esc** 隐藏，「忽略」按钮则永久丢弃。
Tab accepts a suggestion (fills the draft, does not send); Esc hides it; the dismiss button forgets it.

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
| 模式：自动 / 单词补全 / 两者 / 仅手动 | Mode: auto / word / both / manual only |
| 显示位置：建议栏 / 行内 / 卡片 | Display: bar above the box / inline / card |
| 预测模型（留空则跟随本会话） | Predict model (blank follows the session) |
| 输出上限 / 输入停顿 / 超时 / 上下文上限 | Output cap / debounce / timeout / context cap |

设置存于 `$DSH_HOME/composer-assist/settings.json`。
Settings live in `$DSH_HOME/composer-assist/settings.json`.

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

## 实现说明 · Implementation notes

`display: inline`（行内模式）依赖宿主的 `.input p:last-child::after` 与 `--dsh-composer-hint` 约定。DSH 升级后若该规则改变，行内 ghost 会静默不再显示（不会报错、不会污染草稿）。默认的 `bar` 模式不依赖宿主内部类名，只使用主题变量。

The `display: inline` mode depends on the host's `.input p:last-child::after` and `--dsh-composer-hint` convention. If that rule changes after a DSH upgrade, the inline ghost silently stops showing — no error, no draft corruption. The default `bar` mode uses only theme variables and no host-internal class names.

## 成本提醒 · Cost warning

**每次预测都是一次真实计费的模型调用。** 默认开启自动模式，即每轮回答后一次调用。可在设置中改为「仅手动」或直接关闭。

**Every prediction is a real, billed model call.** With auto mode on, that is one call after each finished turn. Switch to manual-only, or turn the plugin off, in the settings page.

## 许可证 · License

MIT
