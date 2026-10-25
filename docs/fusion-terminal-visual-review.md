# Fusion 动态终端拓扑 — UI 对照及验收

参考：[xsmryze 的 X 视频（约 36 秒）](https://x.com/xsmryze/status/2114092824190660727/video/1)，已逐帧检查。设计目标是「暗色终端状态板 + 实时节点流」而不是照抄宣传动画里的虚拟指标。

## 视频→真实 DSH UI 映射

| 视频布局 | 本 PR 界面 | 真实数据来源 |
| --- | --- | --- |
| 紫色 Opus 顾问栏 | 左侧 Lead/决策监督 | `run.actors`、节点状态、最终 `run.result.success` |
| 橙色 Sonnet 主节点 | Sidekick 实现节点 | 当前授权模型/原生 actor ask 状态 |
| 绿色 JEV fork | ZCode 确定性测试门禁 | `world.run` 退出码与报告；**不声称有 JEV 模型** |
| 蓝色 Haiku search/grep/audit | 规划/测试/审查阶段卡 | 实际 Lead、测试脚本、Reviewer |
| 回送主模型箭头 | 返回 Lead 最终签收 | 审查结果与 `result.success` |
| 底部滚动日志 | 最近 7 条事件 | 既有 SSE 推送的 `run.events` |
| 动态 Token/进度 | 实际 Token/运行轮数 | `spentTokens`、`reports[].item.rounds` |

**约束：** 不显示不存在的模型名称或顾问调用，不生成虚构日志、耗时、Token 或 JEV forks；未知值显示「—」或「尚无记录」。连线动画只有 `run.status === running` 时才运行，系统减少动画设置会停止动画。

## 预期使用

在 DSH 专用测试 Profile 安装 PR #18 所依赖的 PR #16 预览版，在有 Fusion run 时进入「工作流」。默认展示 **实时拓扑**，点击 **完整依赖图** 可恢复原有 ZCode 图（含节点可点选详情）；右下区域的「查看节点和日志」可以切换到完整执行证据。

现有非 Fusion 工作流继续使用原来的视图、操作入口和签名宿主权限。

## 必须完成的实机验收（未通过前 PR 保持 Draft）

1. 使用真实正在运行的 Fusion 任务核对 Lead、Sidekick、Reviewer 状态是否依次变更；不可只有假动画。
2. 任务停下或完成后动画必须停，SSE 断线不得显示虚构的完成态。
3. 真实失败测试需展示非零 exit，Reviewer 阻断不能显示成功。
4. 逐一检查 1440/900/390 宽度、浅/深宿主主题、键盘焦点、按钮操作、缩放与溢出；录像对照无严重布局差异。
5. 验证普通工作流、输入预测、Fusion 配置、停止/恢复仍正常；并将真实 DSH 截图附在 PR 中。

以上是源码与 CI 级别的改造目标，不表示已经完成 Mac DSH GUI 验收。