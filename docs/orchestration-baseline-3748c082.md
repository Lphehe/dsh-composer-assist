# 编排基线端到端验收

日期：2026-10-24（Asia/Shanghai）。本次测试现有 Agent 编排底座；不实施新的能力桥。

## 结论

**GLM 单 Agent 成功路径基线通过。** 静态分析、路由授权、用户首次启动、原生 Agent 调度、typed ask、schema 校验、脚本断言、检查点及报告均得到实际运行证据。该结论不是 OpenRouter 编排验收，也不是多模型／MCP／Classifier 能力桥已经实现。

## 实际运行

| 项目 | 结果 |
| --- | --- |
| Run ID | `3748c082-8e1c-4465-a594-0ca21f033ca9` |
| 名称 | 编排基线端到端验证（已授权 GLM） |
| 父会话 | `session-586f7c53-7aaa-4b09-b0e3-3f2dab7bb68a` |
| 路由及 Actor resolvedModel | `aggregate/glm-5-3-flash` |
| 结构 | 1 个阶段、1 个 Agent、1 个 typed ask，并发 1 |
| Actor 会话 | `26032622-3e84-4f5e-b847-afd23b8b806f` |
| 原生团队 | `dwf-team-3748c082-8e1c-4465-a594-0ca21f033ca9` |
| Ask 检查点 | `ask#1`／ordinal 1／`completed`，`messageBoundary: 9` |
| 结构化结果 | `{ "answer": 42, "marker": "ORCH_E2E_BASELINE_20261024" }` |
| Schema | answer 为 number、marker 为 string；两字段必需，不允许额外字段 |
| 脚本断言 | marker 精确匹配，answer 等于 17 + 25；不符则 throw |
| Report | 1 条，`passed: true`，模型、marker、answer 均匹配 |
| 最终状态 | `completed`；无 error、hold、question 或 hole |
| Agent 统计 | `turns: 1`、`tokens: 35109`、`toolCalls: 0`、`worldToolCalls: 0` |
| 执行耗时 | run-started 至 run-settled 为 12999 ms，约 13 秒，不含等待人类确认时间 |

模型路由由 routePin 和 Actor resolvedModel 双重核对，不只依赖脚本报告中的模型文字。工具计数按 journal 原值记录，不把 0 解读为 typed ask 没有内部提交。35109 是宿主统计的总 token；此次未拆分输入、缓存、推理或金额，不能称为全价收费 token，也不能与不同模型的直接调用作价格或性能等价比较。

## 完成与收口边界

- 事件依次出现 run-started、run-launched、actor-created、node-dispatched、node-settled(ok)、report 和 run-settled(completed)。
- siteStates 与持久 ask 节点均为 completed，结果与报告一致；未通过 resume／重启重新执行来验证结果复用。
- run-settled 时间为 `1792806203484`，完成后元数据 updatedAt 为 `1792806203553`；快照没有 NativeTeamError。
- 当前 [驱动收口实现](<../workflow/host/dsh-driver.js#L263-L275>) 等待 native.stop、任务结束及 native.dispose；[管理器](<../workflow/host/manager.js#L226-L235>) 等待 quiesce 后更新元数据，收口失败则记录 nativeTeamError。运行记录与这条成功收口路径相符。未把只发出停止请求当作已经停止，也未将历史 nativeTeam／nativeMember 映射当作活跃句柄。
- 本次属于接口级成功收口核对，未额外枚举 OS 进程／原生活跃句柄，未做清理失败故障注入。

## OpenRouter 的独立结论

同样的用例最初指定 `openrouter/qwen/qwen-2.5-7b-instruct`：分析通过，但 create 被拒绝，错误为“子代理模型 openrouter/qwen/qwen-2.5-7b-instruct 不在当前会话允许列表中”。没有启动 OpenRouter Agent 或发出该工作流的模型请求。

用户随后明确选择“先用已授权模型测编排基线”，因此本次才改为 GLM。未绕过允许列表、代替用户确认首次启动或暗中换模型。OpenRouter 经宿主直接 LLM 调用的独立成功证据见 [OpenRouter 原生链路验收](<openrouter-dsh-verification.md>)；它不能替代 OpenRouter 子代理／编排授权及实测。

## 后续与未测项

- 本次未修改编排源码、模型允许列表、默认模型或供应商配置；工作流脚本与检查点保存在现有运行 journal 中，本文件只记录验收。
- 可以以此作为能力桥实施前的成功路径基线；新 Interface、直接模型／结构化判断／原生 Classifier／MCP 接入仍按 [设计方案](<../DESIGN.md#L281>) 单独实施与验收。
- 未验并行多 Agent、跨模型数据依赖、MCP、外部写入／未知效果、stop／resume、amend、整宿主重启恢复或完整 GUI 视觉／无障碍。
- 若要把 OpenRouter 用于本编排入口，需要用户先在子代理模型设置中允许该模型，再单独准备并确认启动；不能把本次 GLM 结果标为 OpenRouter 编排通过。
