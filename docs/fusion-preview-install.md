# Fusion 开发预览安装（PR #16）

> 这份说明只适用于 PR #16 的开发分支，不是 npm 正式发布版。当前 main 分支的 0.7.5 仍只有输入框预测功能。

## 1. 编译与自检（Mac / Linux，Node >=22.13，推荐 Node 26）

请在**独立开发目录**操作，不覆盖现有 DSH 配置或已经运行的工作流。

```bash
git clone --branch feat/fusion-review-loop-20261025 --single-branch https://github.com/Lphehe/dsh-composer-assist.git dsh-fusion-preview
cd dsh-fusion-preview
pnpm install --frozen-lockfile
pnpm run build
pnpm run selfcheck
pnpm pack --dry-run
```

这个分支中有两个 Cordis Host 入口：

- `dsh-composer-assist`：保留现有输入框预测功能
- `dsh-composer-assist/workflow`：ZCode 工作流服务、Fusion 编排与 `/api/composer-assist/workflow` 路由

Client `dist/client.js` 同时注入现有输入框 UI 和工作流主视图 `conversation.view`。工作流 Host 输出在 `dist/workflow-host.js`，编译 Worker 在 `dist/compiler-worker.js`。

`package.json` 暂时带 `"private": true`，防止误把未经实机验收的预览版发布到 npm。**不要运行 npm publish。**

## 2. 在 DSH 里安装开发目录

建议先用独立测试 Profile，不要对正在运行重要任务的 Profile 热替换。确认该 Profile 没有同时加载另一个 `dsh-composer-assist`（npm 副本或链接开发版）。

在 DSH 中使用宿主插件管理工具（不是终端命令）：

```text
plugin_manager install_bundle
target: <dsh-fusion-preview 目录的绝对路径>
```

等待返回安装应用成功（历史接口的成功状态为 `application: applied`）。如果插件管理工具不存在或返回不兼容，不要修改、重签 DSH 主程序，停止并记录错误。

如果 DSH 已经在该 Profile 中加载同名旧插件，先按官方插件管理界面正常移除/停用旧副本，再将上述目录作为单个 bundle 安装；不要在工作流运行期间卸载或替换。验证时重新打开 DSH 的目标会话。

## 3. Fusion UI 操作

1. 进入 DSH 会话第二排 **工作流**。
2. 点击顶部 **Fusion 协作**，输入任务（例如“修复订单金额误差，添加回归测试”）。
3. Lead、Sidekick、Reviewer 三个选择框可以分别选会话允许的模型；不选则继承本会话。
4. 将测试脚本改成当前项目 `package.json` 实际存在的名称，例如 `test` 或 `selfcheck`（输入的是 `pnpm run` 后面的名称）；配置最多 1–3 轮。
5. 点击 **生成草稿并查看流程**。此操作不启动模型。
6. 审核生成的脚本、权限、执行工作区和依赖图，然后点击 **确认并运行**。
7. 在流程图、节点日志、结果面板和 Fusion 摘要查看真实进度、测试退出码、审查问题；必要时停止/恢复。未知副作用必须人工核对，不得盲目重试。

运行会真实消耗模型额度，测试脚本也可能有副作用。请先在不含重要凭据及生产写权限的测试仓库验证。

## 4. 实机验收状态（2026-10-26）

专用 Web Profile 的目录安装、双 Host 运行、真实 UI 明暗主题及 1440/900/390 窗口检查已完成。完整命令、截图与明确待验收项见[实机验收记录](fusion-acceptance-20261026.md)。这些结果不等于 Fusion 多 Agent 闭环已通过。

Fusion 当前要求父会话使用**原生工具模式**；PTC 会在启动前明确拒绝。未启用 Teams 时，插件仍能加载视图和准备草稿，执行前会提示缺少能力。

尚待用户首次运行确认后执行真实 Lead / Sidekick / Reviewer → 测试 → 修复反馈闭环，以及真实停止恢复、未知结果、权限/预算和多提供方路由验收。正式 npm 发布及向后兼容迁移尚未执行。

GitHub CI 与本机离线自检不能代替上述运行验收。保持 PR #16 Draft，`main` 和 npm 正式版不变。
