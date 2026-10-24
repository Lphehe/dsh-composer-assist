# workflow/ — 已隔离，不参与本包

这个目录是从 ZCode 移植的动态工作流实现（编译器、执行引擎、DSH 适配层、画布 UI）。
它**仍然保留在这里**，但从 0.7.0 起已经与本包解耦：

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
