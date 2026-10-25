# Fusion PR #16 实机验收记录（2026-10-26）

本轮基于 `96f78cea3725c4a090fdd6c1ee6c14951718ab63`，在 `feat/fusion-review-loop-20261025` 独立工作树修复并验收。结论：开发 bundle 可在当前 DSH 安装，真实 UI 检查通过；Fusion 真实多 Agent 修复闭环仍等待用户首次运行确认，不能据此发布或宣称全部验收完成。

## 环境与范围

- macOS；DSH Desktop runtime `0.2.1-rc.3`；Node `26.12.1`；pnpm `11.24.0`。
- 通过安装应用自带 CLI 创建专用 `fusion-pr16-20261026` Web Profile，原 desktop Profile 未替换、未重启。
- 在该 Profile 的原生插件管理 UI 从目录安装并启用；启用原生智能体团队后，输入框预测与动态工作流两个 Host 组件均显示运行中。
- 使用现有本机账号/模型配置。DSH Profile 默认仍共享用户级会话和凭据存储；本轮不是独立账号/独立凭据沙箱。截图前收起侧栏，避免显示其他会话信息。
- 测试会话 `fusion-pr16-acceptance-20261026`；独立测试项目仅包含简单加法实现、五个确定性断言和 `selfcheck` 脚本。初始执行真实失败：`0 !== 5`。
- 原 `zcode-dynamic-workflow` 工作区的已有未提交修改全部保留。本预览分支没有替换它，也没有将其中尚未提交的 decision、润色预览和预测工作流推荐链整包搬入；不能用本预览替换当前开发版后声称这些额外功能已保持一致。

## 本轮修复

1. 工作流 Host 不再硬依赖根级 Teams 才能加载；启动前从实际父会话检查执行能力，Teams/Subagents 从父会话作用域读取。
2. 恢复运行重新验证所有模型 pin 的当前授权，保留已固定的推理强度和输出上限。关闭模型选择后不再展示或自动选择残留的历史模型。
3. Reviewer 在自己的作用域使用原生工具模式，仍由只读白名单和宿主 guard 拒绝修改、Shell 与任意代码执行。
4. Fusion 每轮通过既有 `report` 持久记录测试退出码和 Review 反馈；运行中或停止后摘要可读取已完成证据，最终结果优先。
5. Fusion 七个表单字段纳入既有会话草稿缓存，收起或切换宿主页签不再丢失。
6. 修复输入预测置信度的单位和小数保存错误；修复中文/空格目录下打包自检的 URL 路径解码。
7. 提交三个实际构建产物；CI 构建后比较这些产物，防止仅重建而未提交更新仍然通过。

## 已执行验证

| 项目 | 结果与证据边界 |
| --- | --- |
| 锁文件依赖安装 | `pnpm install --frozen-lockfile` 通过 |
| 完整离线回归 | `pnpm run selfcheck` 通过：预测、Fusion 模板/编译/UI、原生驱动、world、journal/恢复、Host/插件、构建一致性 |
| 实际打包 | `pnpm pack --dry-run` 通过；`node scripts/preview-pack-selfcheck.mjs` 真实打包、解压并导入 Host，通过；不等于真实模型闭环 |
| 差异检查 | `git diff --check` 通过 |
| 独立代码审查 | 模型授权、pin 控制参数与 Fusion PTC 范围问题已修正，最终源码复核无剩余必须修复项 |
| 原生安装 | 专用 Profile 中两组件运行中，普通模型回复 READY 成功 |
| UI | 六组检查通过，见下表；未模拟已运行结果 |

输入预测的真实路由已额外验证：空草稿 `next` 请求返回 HTTP 200、`ok=true`、`reason=model-empty`；有明确修复意图的 `complete` 请求返回 HTTP 200、`ok=true`、7 字符非空补全。无明确下一条消息时允许无候选。这证明鉴权、真实模型请求与非空补全返回正常；尚未在浏览器里验证 Tab 接受这个候选。

## UI 实测

| 检查 | 实测结果 |
| --- | --- |
| 共存 | 真实工作流页签和输入预测按钮同时存在 |
| 输入校验 | 空任务禁用生成；`test;unsafe` 禁用生成；合法 `selfcheck` 可创建草稿 |
| 草稿保留 | task/name/三个角色模型/testScript/maxRounds 收起重开及对话页签往返后逐项一致 |
| 四种流程图 | 依赖图 8 节点/20 连线，执行顺序 6/8，控制流 11/13，阶段交接 5/3 |
| 状态与证据 | 草稿显示待确认，0 子代理、0 步骤、0 token、0 报告/产物；日志/结果空态正确，未伪造通过 |
| 明暗与尺寸 | light 1440、dark 900、dark 390 无页面级横向溢出；390 下画布局部可滚动，确认按钮在屏内 |
| 可访问性抽查 | 七个表单控件都有标签；真实 Tab 焦点轮廓 2px 可见；页面 alert 数为 0，事件错误抽查为空 |

截图均为已安装插件的真实页面，JPEG 捕获已无缩放重编码为 PNG。截图显示的是待确认草稿。

- [浅色 Fusion 配置表单](screenshots/pr16-20261026-form-light.png)
- [浅色 1440 流程画布](screenshots/pr16-20261026-draft-light-1440.png)
- [深色 900 流程画布](screenshots/pr16-20261026-draft-dark-900.png)
- [深色 390 窄窗口](screenshots/pr16-20261026-draft-mobile-390.png)

## 真实闭环的待确认对象

- 运行 ID：`b4629149-5739-4b1a-8906-d9285a7b62c4`。
- 名称：`Fusion PR16 real repair`；recipe `fusion.v1`；最多 2 轮；`pnpm run selfcheck`；测试超时 180000 ms。
- Lead/Sidekick/Reviewer 均继承该测试会话当前获准模型；没有新增或放宽模型授权。
- 为验证反馈，任务明确安排第一轮只实现有限非负数加法、不做参数校验；真实断言及独立 Reviewer 应产生反馈，再由第二轮修复负数与校验。测试和脚本禁止修改，禁止 commit/push/deploy。
- 尚未点击“确认并运行”。宿主明确将首次启动及未知副作用决策保留给用户；开发代理不能代替点击或直接调用 launch 伪装人工授权。
- 用户确认后还需记录真实 Actor 会话、每轮退出码、Review 阻断、修改 diff、最终五条断言及 Lead 签收。真实停止/恢复、未知结果处理和多提供方角色路由也仍需实测。

## 当前兼容限制与发布门禁

Fusion 的自动测试目前要求父会话为原生工具模式。PTC 在启动任何 Actor 前会得到明确错误；普通已有 PTC 工作流未被新增规则整体禁用。尚未实现跨 TypeScript/Python/REPL 的 PTC world.run 传输。

PR 保持 Draft；未合并 main，未发布 npm。真实 Fusion 闭环、停止恢复及剩余权限/预算验收通过后，仍须另获发布授权。
