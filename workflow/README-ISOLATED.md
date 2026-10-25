# workflow/ — 历史隔离记录（0.7.0 起），Fusion PR #16 开发预览已恢复打包

> **注意**：下面的清单描述的是 main 的 0.7.5（输入框预测单独发布包），不是 `feat/fusion-review-loop-20261025` 开发预览分支。该预览分支已通过独立 Cordis Host 入口 `dsh-composer-assist/workflow` 恢复 ZCode 编排，Client 同时注册「工作流」页面和 Fusion UI；完整本地验证/安装步骤参阅 [预览安装说明](../docs/fusion-preview-install.md)。开发预览仍未经过真实 DSH Mac GUI 验收，不可直接发布 npm。

这个目录是从 ZCode 移植的动态工作流实现（编译器、执行引擎、DSH 适配层、画布 UI）。
它**仍然保留在这里**，但从 0.7.0 起已经与本包解耦：

## 文档位置

工作流的文档与截图证据都在 `workflow/docs/`，不在仓库根的 `docs/`：

| 文件 | 内容 |
|---|---|
| `docs/dynamic-workflows.md` | 用户说明：入口、编写、运行、恢复 |
| `docs/verification.md` | 各版本验收记录 |
| `docs/动态工作流验收合同.md` | 验收合同 |
| `docs/workflow-recovery-receipt.md` | 恢复回执 |
| `docs/orchestration-baseline-3748c082.md` | 编排基线实跑记录 |
| `docs/evidence-0.6.2/`、`docs/evidence-0.6.4/` | 界面截图与可访问性树证据 |
| `docs/workflow-compact.png` | 画布缩略图 |

根 `docs/` 只保留输入预测相关的验收文档。

## 待办：第二步迁移

`PRODUCT.md` 与 `DESIGN.md` 仍是工作流的设计文档，但留在仓库根。它们正在被另一条工作分支编辑，所以没有随本次迁移移动。

合并那条分支后要一起做：

1. 把 `PRODUCT.md`、`DESIGN.md` 移到 `workflow/docs/`
2. 修 `PRODUCT.md:55` 的两处旧路径：
   - `docs/verification.md` → `workflow/docs/verification.md`
   - `docs/evidence-0.6.2/` → `workflow/docs/evidence-0.6.2/`
3. 检查 `DESIGN.md` 里指向 `docs/verification.md` 的链接（约第 379 行）
4. 全仓 grep `docs/verification.md` 与 `docs/evidence-0.6` 确认无残留

## 现状

| 方面 | 状态 |
|---|---|
| `package.json` `exports` | 不导出 `./workflow` |
| `package.json` `files` | 不打包 `workflow/` 与 `vendor/` |
| `scripts/build-client.mjs` | 不构建 `workflow-host` 或 `compiler-worker` |
| `cordis.patch.yml` | 只注册 `composer-assist`，不注册 workflow 入口 |
| `client.js` | 不引用 `workflow/client/ui.js` |
| `index.js` | 不引用 `workflow/host/*` |
| 依赖 | `@zcode/*`、`typescript` 已移至 `devDependencies`，仅为源码按需构建保留 |

**安装本包不会带来工作流功能。**

## 为什么还留着

不用重写：编译器移植、schema 合成、四种分析图、日志重放引擎、子进程运行器、结算原子性修复、
SIGKILL 回归测试都在这里，是可用的参考实现。

## 如果要用它

1. 从 `devDependencies` 安装依赖（默认已安装，因为它们是 devDependencies）
2. 单独构建 worker：`node -e "…"` 或参考 git 历史 `a0a8eb4` 之前的 `build-client.mjs`
3. 自行接入宿主：`workflow/plugin.js` 是入口，`workflow/host/manager.js` 是运行生命周期
4. 需要把 `./workflow` 加回 `exports`，并把 `workflow`/`vendor/zcode` 加回 `files`

## 自检

各模块的自检仍可单独运行（需要 devDependencies）：

```bash
node workflow/host/selfcheck.mjs
node workflow/host/settled-effect-selfcheck.mjs
node workflow/host/settle-pair-selfcheck.mjs
node workflow/host/model-stats-selfcheck.mjs
node workflow/client/selfcheck.mjs
```

它们不在 `pnpm run selfcheck` 链里，因为工作流已不属于本包的发布内容。

## 注意

- 不要把 `workflow/` 加回 `dependencies` 或 `files`，除非确实要恢复工作流功能
- `vendor/zcode` 是上游移植源码，保留 `PROVENANCE.md` 与许可证声明
