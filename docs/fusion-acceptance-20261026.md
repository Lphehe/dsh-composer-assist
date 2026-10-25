# Fusion PR #16 实机验收记录（2026-10-26）

本轮在 `feat/fusion-review-loop-20261025` 独立工作树修复并验收。结论：当前 DSH 的目录安装、真实 UI、严格两轮 Lead → Sidekick → 宿主测试 → Reviewer → 修复反馈 → Lead 签收均已通过；中途原生停止/恢复也通过。保持开发预览，不合并 main、不发布 npm。

[结构化实机证据](evidence/fusion-real-20261026.json)包含运行/角色 ID、每轮退出码、停止恢复、实际 token 计数及验收 bundle SHA-256；不包含令牌或账号配置。

## 环境与边界

- macOS；DSH Desktop runtime `0.2.1-rc.3`；Node `26.12.1`；pnpm `11.24.0`。
- 使用应用自带 CLI 创建专用 `fusion-pr16-20261026` Web Profile，通过原生插件管理 UI 从目录安装。启用原生团队后，输入预测与动态工作流两个 Host 均运行。
- 原 desktop Profile 未替换、未重启。DSH Profile 仍共享用户级会话/凭据存储，并非独立账号沙箱。截图前收起侧栏以避免显示其他会话。
- 三个角色继承已有授权路由 `magpie-responses / codex/gpt-6.1-sol`；本次是三个独立原生会话使用同一获准模型，没有新增授权，也没有实测不同提供方组合。
- 原 `zcode-dynamic-workflow` 工作区的未提交修改全部保留。此预览未整包搬入其中尚未提交的 decision、润色预览和预测工作流推荐能力，不能据此替换当前开发版后声称这些能力已完成整合。

## 本轮修复

1. Host 不再硬依赖根级 Teams 才能加载；执行前检查实际父会话能力，Teams/Subagents 从父会话作用域解析。
2. 恢复运行重新验证全部模型 pin 当前授权，保留固定的推理强度和输出上限。选择器关闭时不展示、不自动使用旧候选。
3. 新生成 Fusion 的 Lead 与 Reviewer 使用同一宿主只读守卫和各自作用域的 native 工具展示。允许读取本地技能；写入、Shell、任意代码和二次派发仍被拒绝。旧无前缀保存脚本不会自动获得这个新角色合同，应重新生成或明确修订。
4. Sidekick 的合同只执行当前 `attempt`，测试与下一轮由工作流推进，避免角色在单次 ask 内提前完成全部轮次。
5. 修复同级 `sandbox_permissions=workspace-write` 被误判提权：只允许与子会话当前有效模式相同的声明，不修改策略；更大、未知或不同模式仍拒绝，实际工具继续走宿主审批和沙箱。没有关闭安全检查。
6. 每轮真实测试/Review 通过既有 `report` 持久化，摘要读取已完成证据；表单七字段纳入会话草稿缓存。
7. 修复输入预测置信度单位/小数保存；用 `fileURLToPath` 修复中文/空格目录下打包自检。
8. 提交三个构建产物，并让 CI 对源码重建差异报错。

## 验证结果

| 项目 | 实测结果 |
| --- | --- |
| 依赖和离线回归 | 锁文件安装、完整 `pnpm run selfcheck`、`git diff --check` 通过；不是实机通过的替代物 |
| 实际打包 | dry-run 与真实打包、解压、Host 导入通过，Client/Host/worker 和两个 ZCode runtime 均在包内 |
| 独立源码审查 | 授权、pin 保持、PTC 范围、同级权限和新角色守卫的已报问题均修正并复核 |
| 输入预测 | 真实空草稿 next 返回 HTTP 200 / 合法空候选；明确草稿 complete 返回 HTTP 200 / 7 字符非空补全。浏览器 Tab 接受未实测 |
| UI | 六组实测通过：入口共存、输入校验、草稿保留、四图、明暗/宽窄、标签/焦点/错误抽查 |
| 真实严格闭环 | `0754c1b5-5fc7-4125-93d6-9ee13e274fa4`，`completed`，`success=true`，`rounds=2`，10/10 节点、4 报告 |
| 停止/恢复 | 同一 Host 中有序停止，`stopped` 且 holds 为空；恢复后仍用同一 run 和三个角色 session ID，最终完成 |
| 独立最终验证 | 在真实修复文件上再次执行原 selfcheck，五条断言通过；原测试、配置和 fixture HEAD 均未改，仅实现文件产生差异 |

## 真实运行及反馈

用户首先亲自在工作流面板确认了 `b4629149-5739-4b1a-8906-d9285a7b62c4`。该次运行真实失败，暴露同级权限声明误拒；Reviewer 与 Lead 都拒绝验收。没有把该失败改写成通过。

修复后通过原生允许的 `amend` 继续：`56614568-6bee-452e-adc7-a60bd9baac25` 成功，但角色在 ask 内部做完了任务描述的两轮，工作流只记录一轮，故未将它作为“宿主控制两轮反馈”的验收结论。再明确规划只读及当前轮合同，重置专用故障注入项目基线，使用原生 `amend` 继续；没有调用隐藏 launch、扩大权限或代替未知结果确认。

最终运行 `0754c1b5-5fc7-4125-93d6-9ee13e274fa4` 的真实顺序：

| 阶段 | 实际证据 |
| --- | --- |
| Lead 规划 | 只读确认恒返回 0 的基线、唯一调用方和原五条断言，没有编辑或执行测试 |
| Sidekick 第 1 轮 | 仅实现 `Math.max(0, a) + Math.max(0, b)`，提交后等待反馈 |
| 宿主测试第 1 轮 | `pnpm run selfcheck` 退出 1，负数断言 `3 !== 1` |
| Reviewer 第 1 轮 | `approved=false`，指出负数截断及缺少类型/有限数校验两个阻断问题 |
| 原生停止/恢复 | 测试已完成、无未知操作时停止；恢复同一运行及会话身份 |
| Sidekick 第 2 轮 | 根据 `priorTest` 和 `priorReview` 加入对称 `Number.isFinite` 校验，非法参数抛 `TypeError`，否则 `a + b` |
| 宿主测试第 2 轮 | 退出 0，输出 `Five real arithmetic and validation assertions passed` |
| Reviewer 第 2 轮 | 独立重读当前源码/测试，`approved=true`，无阻断项 |
| Lead 签收 | 只读核对源码和工作流证据，`approved=true` |
| 主开发代理复验 | 原五条断言再次全过；测试和配置未改，fixture HEAD 仍为 `87b894c` |

Reviewer/Lead 的 Shell 被只读守卫拒绝，测试执行由宿主完成；不能把审查批准描述成 Reviewer 自己执行了测试。此运行实际记录 468,552 tokens；三个开发验收运行累计 1,545,116 tokens，不据此估算金额。

## UI 实证与截图

- 空任务及 `test;unsafe` 无法生成；合法 `selfcheck` 可创建。
- task/name/三个角色/testScript/maxRounds 在收起重开及对话/工作流往返后完整保留。
- 四图实测：依赖图 8/20，执行顺序 6/8，控制流 11/13，阶段交接 5/3。
- light 1440、dark 900、dark 390 无页面级横向溢出；390 局部画布可滚动，确认按钮在屏内。
- 七个表单控件有标签，真实键盘 Tab 焦点轮廓可见，页面错误/alert 抽查为空。
- 运行后“节点与日志”真实显示 10 节点及执行事件；“结果与产物”真实包含 `success=true`、`rounds=2`。结构化结果不等于文件产物，本次文件产物数为 0。

以下均为真实已安装页面；原始 JPEG 捕获已无缩放重编码为 PNG：

- [最终两轮成功画布](screenshots/pr16-20261026-real-completed.png)
- [真实停止态及第 1 轮阻断](screenshots/pr16-20261026-real-stopped.png)
- [权限问题修复前的真实失败](screenshots/pr16-20261026-real-first-failure.png)
- [浅色配置表单](screenshots/pr16-20261026-form-light.png)
- [浅色 1440 草稿](screenshots/pr16-20261026-draft-light-1440.png)
- [深色 900 草稿](screenshots/pr16-20261026-draft-dark-900.png)
- [深色 390 草稿](screenshots/pr16-20261026-draft-mobile-390.png)

## 剩余限制

Fusion 自动测试当前要求父会话为 native 模式；PTC 在启动 Actor 前明确拒绝。普通已有 PTC 工作流未被新增规则整体禁用。未实现 PTC 的 world.run 传输。

本次已验证有序停止/恢复，未注入进程崩溃或真实未知副作用，也未由代理处理其人工门禁。不同提供方组合、预算耗尽、浏览器 Tab 接受、正式迁移/卸载及原未提交开发能力整合尚未实测。不得把离线检查或本次结果扩大为这些场景通过。

保持 PR Draft；未合并 main、未发布 npm，原开发工作区未被替换。
