# OpenRouter 原生 DSH 链路验收

日期：2026-10-24（Asia/Shanghai）。范围：当前 desktop 宿主的原生 LLM 链路；不扩展编排层。

## 结果

**通过：DSH 配置／宿主凭据解析 → pi-ai 适配器 → 原生 LLM 流中间件 → OpenRouter 付费 Qwen → 最终文本与用量。** 本次没有用 curl／自写 HTTP 请求冒充内部链路。

| 字段 | 实际结果 |
| --- | --- |
| provider | `openrouter` |
| model | `qwen/qwen-2.5-7b-instruct` |
| 调用入口 | 宿主 `llm.prepareCall()`，再调用该单次句柄的 `stream()` |
| 提示词 | `Reply only with OK.` |
| 控制 | `maxTokens: 128`，`temperature: 0`，测试时自动重试为 0 |
| 最终回复 | `OK` |
| 完成原因 | `{ "kind": "stop" }`，恰好一次结束事件 |
| 耗时 | 1045 ms |
| 原生流中间件派发 | 1 次 |
| 宿主用量 | `inputTokens: 10`、`outputTokens: 2`、`cacheReadTokens: 24`、`totalTokens: 36` |
| 配置保护检查 | 其他供应商、默认模型和子代理选择设置的持久配置／选择快照比较通过 |

本次总量为 10 + 24 + 2 = 36，不能只把输入字段与输出字段相加后称为总量。宿主公开 `TokenUsage` 未提供费用金额；不能把此前 curl 测试的费用当成本次宿主调用费用。

## 实际改动

- pi-ai 适配器、`openrouter` 路由和 `OPENROUTER_API_KEY` 凭据引用在开始时已存在；宿主报告该引用已配置，来源为 `file`。本次未在探针中读取、重写或回显密钥值；认证由宿主适配器内部解析。
- 缺口是 OpenRouter 原有模型列表不含测试用的付费 Qwen。经 `configEditor.edit()` 追加该模型，模型数由 18 变为 19；保留原有模型字段和其他供应商配置，不手改 profile 文件。
- 验证期间将 OpenRouter 自动重试从 5 改为 0；验证完成后经同一宿主接口恢复为 5，重新检查 Qwen 仍在列表、路由已注册、凭据仍就绪。
- 未改变默认模型、子代理模型允许列表或 Composer／ZCode 编排源码。

## 验证入口与清理

为调用当前宿主公共 Service，安装了无依赖的临时 Host 探针。它只暴露固定状态检查、OpenRouter 配置、固定模型／提示词的单次验证和重试策略恢复；安装时不自动请求模型，不接收任意路由、提示词或密钥参数。

离线自检已覆盖：安装不发请求、严格 JSON 输出、保留其他模型字段、单次派发、错误不自动重试、取消、动态配置拒绝、重试恢复，以及持久配置保护。初版运行态配置比较曾失败并阻止模型调用；改为比较 `configEditor.configuration()` 提供的持久原始配置层后，幂等配置检查和真实调用检查通过。回归用例分别覆盖“运行态派生字段变化不应误报”和“真正持久配置变化必须报错”。

临时包 `@local/openrouter-dsh-probe-20261024` 与 `@local/openrouter-dsh-probe-20261024-v2` 均由 Plugin Manager 卸载并返回 `application: applied`。正式模型配置独立保存在原生 pi-ai 配置项中；卸载后原生 pi-ai 与凭据插件均仍为 `active`。卸载后又使用宿主已有 YAML 解析器核对 [desktop 配置](</Users/Admin/.dsh/profiles/desktop/cordis.patch.yml>)：Qwen 保留、模型数 19、凭据引用不变、重试为 5，并确认 profile 依赖和 bundle 列表不再含这两个探针包。本轮创建的 5 个临时源码／自检文件及其专属目录已清理。临时探针是已卸载的测试夹具，未增加图标、语言资源或业务界面，不作为长期功能交付。

后续目标状态收口：通用完成工具曾因附带编辑专用字段而拒绝请求，未把拒绝当作完成。复核本记录和现行落盘配置后，通过限定当前拥有者及固定目标 ID 的临时入口调用宿主公开 `goals.complete(agent, ref)`，实际返回 `phase: complete`、`activation: disarmed`。该临时入口经过身份／目标／阶段／参数及幂等自检，随后已由 Plugin Manager 卸载，4 个临时文件及专属目录均已清理。本次状态收口未新增模型调用、凭据访问或模型配置修改。

## 证据边界

- 这是原生 LLM 单次调用验收，不是聊天 GUI、完整 Agent 多轮、子代理选择或编排能力桥验收。
- 未进行宿主完整重启、并发压力、原生 Classifier、MCP 或未知外部写入恢复测试。
- 此前 curl 对付费 Qwen 已得到 HTTP 200／`OK`；免费 Liquid 已执行零价推理但因 16 token 上限没有最终文本；OpenAI 路由返回过 ToS 403。这些是不同模型与入口的独立结果，不能相互替代。
- 安装和卸载报告了另外三个插件告警：DeepSeek Account 的旧 `models` 配置、Codex Workflow 缺少 `webServer` 注入、可选 PowerShell PTY 重复注册。本任务未修复这些告警，也不以本次 OpenRouter 通过证明它们正常。

完整能力桥的实施仍按 [设计提案](<../DESIGN.md#L281>) 另行确认；本次只完成供应商先行接入与内部调用验证。
