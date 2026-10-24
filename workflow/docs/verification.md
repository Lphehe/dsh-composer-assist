# 移植验收记录

## 0.3.1 历史基线：真实运行与界面

- GLM 路由下两个 DSH 子 Agent 并行执行；typed `submit_result` 及同 actor 后续 ask 完成，返回 7 / PROBE_OK / 8。
- 原生 actor 恢复实例 `7ee6d28a-01ed-4f2d-acaa-b40a94fa763d`：第一次 ask 完成后停在留白，停止、恢复、填入 `return 9;`，同一会话完成第二次 ask，最终 `{first:{value:7},second:{value:8},bonus:9}`。
- GUI 实例 `3a9b1583-baf9-4c0d-81af-618257999e3b`：分析、保存、确认运行，在纯输出命令中途停止；未知结果默认拦截，经面板明确重试后恢复，返回 `RECOVERY_OK`。
- 修订实例 `5115087e-21bc-4da2-b7c0-e7aac7b3954d`：关联原实例完成，最终结果包含 `amended:true`。Markdown 回执通过真实下载保存。
- 四种图分别渲染 4 / 2 / 8 / 2 个节点，未出现 NaN/Infinity 坐标；Escape 关闭后焦点回到工具栏。
- 桌面视口 2056×1100 下，弹层实际约 1042×682（含边框），居中；固定操作区可见；SSE 显示实时连接。预测和润色工具栏入口仍在。

## 自动与分发检查

- 原预测解析、学习和上下文降级自检通过；预测 Client 与原目录逐字一致。
- 编译 Worker 的响应性、超时、取消、Map 传输检查通过。
- DSH 驱动协议工具可见性、结构化正式提交、权限继承、用量统计和拥有资源清理检查通过。
- 原生命令守卫、参数引用、取消后后台作业清理、完整 spill 输出及上限检查通过。
- 真正上游引擎跨两个 Node 进程恢复，不重复已完成 ask；修订前缀、channels、留白、提问、报告超过 256 项、未知结果 accept/retry、产物检查通过。
- 模型工具无损 JSON 列表输出回归检查通过；模型自行 `resolve_hold` 被拒绝；旧诊断名只返回正常 help，不执行隐含流程。
- 全部检查入口为 `pnpm run selfcheck`。
- 上游核心共 1,983 项取得通过证据：初轮超时项单独提高时间上限重跑通过，并非声称单次全套零超时。上游运行器完整 98 项通过。
- pnpm 分发包包含当前导出、完整依赖及许可证，不含旧 Host 版本或临时探针；全新临时目录离线生产安装、Host 导入和持久恢复自检通过。

## 0.4.2 原生 Teams / 标准子代理实跑

安装当前 profile 返回 `application: applied`、版本 `0.4.2`。ZCode 代码随包内置，没有安装或启动外部 ZCode 应用。

本轮在用户明确授权后，通过正式 `zcode_workflow.amend` 产品接口实跑；不是开发子代理代跑，也不是自检桩结果。新版 GUI 点击及小屏验证另见限制，不与后端实跑混记。

### 并行、同成员续问、停止与恢复

- 运行：`75cec3cd-e8f4-4e58-b4b1-0d720680a26e` 曾以 `completed` 收口（事件 46），随后被下述新修订取代，因此历史行当前显示 `stopped/superseded`，不是运行失败。其完成结果包含 `initial:[{value:7},{value:9}]`、`permit:1`、`proof.sent:true`、`ack.seen:true`，`holds:[]`，无原生收口错误。
- 团队：`dwf-team-75cec3cd-e8f4-4e58-b4b1-0d720680a26e`；provider 为 `composer-workflow-75cec3cd-e8f4-4e58-b4b1-0d720680a26e`。
- 甲：`actor-9d3d1acba4904f11910cbfe9`，真实会话 `86f7df6e-3584-474f-985b-1cd9411c0910`；乙：`actor-2e37b7cfca7f66bf472164fc`，真实会话 `de37b670-8136-472f-9a58-f8d530f0a824`。
- 原生任务按团队隔离：`ask#1→task-2`、`ask#2→task-1`、`ask#3→task-3`、`ask#4→task-4`。前两次节点执行均早于第一次成功收口，证实实际重叠执行，而非只看到两个 running 标签。
- 事件 18 到达留白；事件 21 明确停止；事件 22 恢复同一运行；事件 27/28 的前两个结果为 `cached:true`，恢复时已记用量不变。填入纯常量后，甲、乙分别在原会话 ID 上完成第二次 ask，没有重复建成员。
- 甲实际调用成员发现、任务读取和 `send_message`，返回名册 `lead` 加两名上述成员及真实 task IDs；乙在后续 ask 返回收到标记。最终事件 46 为 `run-settled: completed`。
- 额外随机值/任务状态修订：`d831a135-db71-43dc-aa33-36b0b822e4b9` 最终 `completed`、`matched:true`、`holds:[]`，无收口错误。接收方提示中只含 `TEAM_NONCE_` 前缀，实际从收到的消息提取出完整随机 token `TEAM_NONCE_00baefee-c52f-4802-8dd9-0191795f3a3a`；脚本精确比较成功，排除复述提示词的假阳性。
- 新修订团队为 `dwf-team-d831a135-db71-43dc-aa33-36b0b822e4b9`；甲的新会话 `87ce90db-4f2f-4762-9445-ff2a91cf71b7`、乙的新会话 `332f6397-60ff-47af-a3dd-13fac1fc1b0a`，均不同于前驱。乙的就绪和接收 ask 使用同一新会话。
- 新修订事件 6/7 明确为 `cached:true`，`sourceSessionId` 指向前驱的甲/乙会话；不重复执行已完成的 7/9 前缀。实际执行的 `ask#3/#4/#5` 分别映射新团队 `task-1/2/3`。
- 接收方调用原生任务读取后返回 `completedTaskIds:[task-1,task-2]`、`inProgressTaskIds:[task-3]`：发送任务已完成，而接收方在提交自己结果之前仍为进行中。两项脚本断言均通过；最终事件 30 为 `run-settled: completed`。

### 实跑发现并修复的问题

- `99f021aa-ec9d-464c-b09c-9de1aba698e2` 暴露成员 preset 重复挂载。原生管理器已完成成员 composition，驱动不再重复调用；回归桩加入单次挂载约束。
- `38e8b170-1b3d-4034-9e44-9db345e5c102` 暴露初始化 pre-step 拒绝会消费输入、导致首条消息持久确认等待。改为通过公开 `agent.inject` 保留原消息对象/ID，再结束空步骤；不调用模型。回归改成真实的“先 claim、后 pre-step、再提交用户消息”顺序。
- 原生源码独立只读审查确认：有待处理输入的空闲成员等待收件箱事件，不忙等、不自动唤醒模型；显式取消仍按原生语义清理。该开发审查不计作产品运行证据。
- 全套 `pnpm run selfcheck`、最终驱动回归、构建及 `git diff --check` 通过；覆盖恢复成员身份、纯缓存任务投影校准、结构化提交、模型/权限继承、容量拒绝和只清理拥有的激活。
- 分发归档 `dsh-composer-assist-0.4.2.tgz` 含 5,143 个成员，当前 Host/Worker、内置核心及 TypeScript 和许可检查通过，没有旧 Host 导出或运行库。在全新临时目录使用 `--offline --ignore-scripts --prod` 安装成功；Node 24.21.0 下 Host 导入与驱动回归通过，持久检查首次因冷分析 10 秒保护超时。用默认 Node 26.12.1 对同一已安装归档复验，跨进程 seed/resume 与 Host 检查通过；没有提高上限，不宣称不同 Node 环境单次全套零超时。该项为归档完成后的外部验收记录。

## 0.4.4 聊天摘要卡与原生侧栏（2026-10-23）

- 正式插件管理器安装到既有 desktop profile，返回 `application: applied`、版本 `0.4.4`。没有替换桌面应用、另开 Web 服务或启动新业务流程。
- 摘要卡接入独立 `zcode_workflow` ToolView；详情使用 `sidebarRightTabs` 与 `sidebarRight.openResource`，按父会话和运行 ID 形成资源地址，不覆盖原生 workflow 渲染器。
- 用户在原桌面实际点击入口，确认出现侧栏页签和工作流内容。随后读取实时辅助功能树，确认已有运行的摘要为“2 阶段 · 2 子代理”，阶段分别为 `2/2`、`3/3`，面板显示 `5/5` 与“实时连接”。这项由人工确认与真实控件证据共同支持，不以 Slot 注册代替交互验收。
- 用户随后在已完成实例中切换“流程图”和“结果与产物”，确认两处均正常显示。这是人工实机确认，不是模拟点击回执；本轮没有再次运行付费工作流。
- 同一归属校验接口读取真实运行 `d831a135-db71-43dc-aa33-36b0b822e4b9`：completed、5 个执行节点、1 条独立报告、0 产物；未为验收再调用付费模型。
- 实测发现 report/artifact 被混入状态汇总，导致 5 步误算 6 步并虚增“其他”。共享 Journal 查询改为与执行节点计数相同的 ask/world 类型；报告与产物原记录不变。既有 300 报告用例新增断言，修前失败 `301 !== 0`，修后完整 Host selfcheck 通过，证据目录 `/var/folders/qt/0lb8y6td72ldh4ccqgw8bthw0000gp/T/dsh-workflow-host-zZSZ65`。中间一次仍被既有 10 秒冷分析保护终止，没有提高上限。
- 预测原有 selfcheck、语法检查、正式 Client/Host/Worker 构建和 diff 空白检查通过。底层调度、模型权限与人类首次启动/未知结果门禁不变；停止恢复的真实执行证据仍是前节 0.4.2，不冒充本版重新执行。
- 原应用 `codesign --verify --deep --strict` 再次通过；误建的 `DSH-Web.command` 仍不存在。系统曾弹出既有 `setTypeOfService EINVAL` 错误，只关闭该信息框，没有修补、重签或重启应用。该错误继续留在 task-9。
- 原窗口曾最小化，后台 AXPress 回执不能算实际点击成功。恢复窗口后由用户实际点击确认；不强行收起用户随后主动打开的侧栏。
- 当前模型图像通道只交付图片元数据，独立图像审计也不能看到像素；没有宣称像素级复刻或凭图片完成颜色/溢出验收。小屏与整宿主重启仍未测试。

## 0.5.0 第二排工作流主视图（2026-10-23）

- 按用户最终选择取消工作流右侧栏和输入框入口；完整入口为第二排“工作流”，聊天仅保留真实进度摘要。没有私改宿主状态或加入跨页跳转后备。
- 正式构建、完整 `pnpm run selfcheck` 与 `git diff --check` 通过；新增 UI 自检实际调用安装函数，断言仅注册 `conversation.view` 和 `tool.call.toolview`，并覆盖会话隔离、显式新建、列表外旧运行与编辑草稿恢复。它是源码级结构/状态检查，不冒充浏览器渲染。
- 机械样式检查结果为 `[]`。主区域继承 DSH 主题令牌，采用运行列表、紧凑指标、阶段时间线、真实 actor 身份和详情子页。未宣称像素级复刻。
- 插件管理器在既有 desktop profile 正常移除旧实例并安装 `0.5.0`，两步均返回 `application: applied`；运行记录没有删除，没有启动新业务或付费流程。其他插件的三条既有告警未处理。
- 当前宿主的实时 Slot 查询确认顺序：chat 0、trajectory 10、context 20、composer-assist-workflow 25、fleet 30；原有上下文与编队仍 active。
- 原桌面真实坐标点击后，“工作流”AXRadioButton 从 0 变 1，中间出现运行记录、编辑与运行、阶段进度、流程图、节点与日志、结果与产物和实时连接。已有验收运行名称出现在运行列表。单纯 AXPress 回执未切页，未将其算作通过。
- 后续图/结果自动复核因窗口标题变化、目标会话未在可访问列表中找到而停止；标题本身不作为会话归属证据。用户随后明确反馈布局与内容对应有问题，故 0.5.0 不算界面验收通过。其截图显示 205,176 Tokens、5/5，与原生接口运行 `8ebeb50c-f597-4bee-bc8a-59a5f84bfc4c` 一致；确认数据存在，呈现却暴露 a/b 变量标签、同名记录无 ID、身份配色不一致和多列大框挤压。切页草稿恢复仅取得源码自检证据；完整 GUI 输入、移动端、双主题与颜色/溢出检查未完成。
- 当前官方应用 `codesign --verify --deep --strict` 通过，未重签或修改应用包。观察到宿主进程/地址更换后重新查询了当前注册和窗口，不把失效后台作业当作验收证据；这不代表已完成运行中断的整宿主恢复验收。
- 未保存编辑状态仅保留在插件自己的会话内存中；切页可恢复，刷新或卸载前仍需主动保存。既有 `setTypeOfService EINVAL` 风险继续保留在 task-9。

## 0.5.1 截图反馈修正（2026-10-24）

- 用户提供 0.5.0 实际截图后，按可见问题修正：永久左侧运行大框改为顶部折叠记录区，去掉重复右侧代理栏与多层大框；主内容改为紧凑单列。记录与标题显示短 ID、完整 ID 提示和选中态，区分同名运行。
- 图与阶段不再将编译器变量 `a/b` 当显示名称，使用真实代理名和任务 site ID；任务副文案来自真实留存事件的 `instructionsHead`，缺失则不编造。徽标用 A1/A2 等稳定身份，颜色与列表顺序无关。真实报告数与产物数分别显示。
- 正常项目编译器回归修前明确失败：`actual ['a','b']`、`expected ['A','B']`；共享映射修正后通过，并覆盖阶段同名映射、真实指令和缺失指令空值。新增徽标稳定性断言通过。
- 正式构建、完整 `pnpm run selfcheck`、`git diff --check` 均通过，机械样式检查为 `[]`。没有新增依赖、模拟预览或付费运行，没有修改运行数据、原生权限和人类门禁；保留并发他线的包许可字段改动。
- 插件管理器移除旧加载实例并安装 `0.5.1`，两步均为 `application: applied`；原生列表回读仍保留原有 9 条记录。原桌面当前工作流选中态为 1，运行记录区实际矩形为 `(301,177,1152,37)`，证明已呈现为顶部折叠行而非旧侧栏，短 ID `8ebeb50c` 与图/结果子页签可见。官方签名与最终 diff 检查通过。
- 最后整轮任务/图/结果自动检查未完成：一次未找到阶段子页签，一次目标会话窗口不再活动，均退出而未误点或强行切会话；不将这些退出记录为通过，未生成新版截图。用户随后明确反馈“太丑了，一点设计感都没有”，因此 0.5.1 视觉验收不通过，进入完整界面构图重做，不再当作间距/边框微调。已有功能、数据与编译器回归证据保留，但不能冒充新版视觉通过。

## 0.6.0 图形工作台与独立设计复核（2026-10-24）

- 整版工作台完成并通过正常项目全部自检，管理器 `application: applied`。正式列表回读仍有原来9条记录，无新增付费运行。
- 原签名桌面取得2056×1211窗口（4336×2646截图）及840×900窄桌面（1772×1892截图），确认8ebeb50c和两个真实阶段。后续自动点击因安全边界停止，未把退出当通过；窄桌面不是移动端。
- 新鲜独立Codex设计复核打开两张图片，结论 **fix，不放行**：遗留无效右页签占位、source/join虚假待执行卡片、拓扑过宽及连线穿越、工具栏脱离首屏。用户截图为同样反证。完整判定保留在开发设计记录，不将0.6.0源码/构建绿灯当视觉通过。

## 0.6.1 单批结构修正（2026-10-24）

- 结构顶点88×32且无执行状态，任务卡248×112；保留原始节点/边/site及真实phase，layoutPhase只为空间分组。阶段任务数排除结构标记，局部列宽压缩并按测得宽度换行，固定身份/选择/操作/子视图工具栏；ResizeObserver回收与原人工门禁/执行链路保留。
- 正常真实编译器回归采用Promise.all汇合及两个阶段，旧模型先以任务计数 `[undefined,undefined]` 对 `[2,1]` 失败，修后通过；640宽度四图、节点不重叠、全部边保留及语义phase不伪造均覆盖。
- 正式build、完整selfcheck、diff检查和原应用codesign深度严格验证全部exit0；Host证据目录为 `/var/folders/qt/0lb8y6td72ldh4ccqgw8bthw0000gp/T/dsh-workflow-host-aatGi1`。管理器移除/安装均applied，版本0.6.1，安装日志operation-nDxlFQ。
- 遗留页签自动清理因对应运行不在当前原窗口而停止，未执行未知目标点击，不能声称已自动迁移/关闭；请用户仅关闭旧工作流页签并收起右栏，不影响其他原生页签。
- 用户已提供0.6.1完整桌面截图：旧右栏不再占位，顶部选择/操作/身份可见，两个阶段和5个实际任务进入同屏，结构标记不再假报待执行；仍有右侧大面积留白、绕行线束及“实时连接”换行。不能从图推定遗留tab已自动迁移或所有控件已实点。
- 最终图片仅在用户消息内可见；会话历史存储不可用，受当前窗口/范围保护的只读抓图亦停止，未改页面或尺寸，未造截图。**最终独立verdict与修正后窄桌面复验未完成，0.6.1视觉验收仍未放行**。编辑/保存/停止/恢复与human gate有代码/CLI及历史实跑证据，本轮未以新付费运行重验；本轮不再自动微调。

## 0.6.2 留白与连线收敛、规范目录迁移（2026-10-24）

- 用户在0.6.1实际图后明确授权“继续，只收敛留白与连线”。阶段取实际宽度，宽屏并排、空间不足换行；SVG安全双轴居中，溢出起点仍可达。共享graphEdgePoints用有序独立端口、短直角路径和避障通道替代旧内联曲线/三条共享轨道，全部原边、箭头和非精确虚线保留。
- 正常真实编译回归改为五ask、两个Promise.all、两个阶段；宽1600并排断言修前以y16对376失败，修后通过。640四图、节点不重叠、边数/真实phase/留存指令、正交路径不穿其他卡片、有序端口及真实循环/自连接通过。密图路由网格有quadratic shortcut说明，未宣称压力测试通过。
- 用户指定规范目录 `/Users/Admin/dsh插件`。全部源码worker及job停止后，Git正规移动工作树；迁前/后2569文件哈希及权限、HEAD f8280112、未提交清单一致。Git历史仍关联原Composer仓库，没有拆仓库或commit/push。
- 新目录正式build、完整selfcheck、diff及原应用严格深度codesign均exit0；Host证据目录 `/var/folders/qt/0lb8y6td72ldh4ccqgw8bthw0000gp/T/dsh-workflow-host-E2zEy7`。安装新路径首次包安装成功但Host应用失败，仍寻找旧绝对路径；核对真实package链接已指新根且配置无旧路径后，旧开发路径仅保留指向新根的symlink，非第二份源码。正常停用/启用bundle后0.6.2 applied，未重启桌面或其他任务。
- 新目录列表曾为空：现有父会话+cwd精确隔离过滤所致。只读归属检查确认原9条仍在旧范围；工作目录入口会规范化别名。用户明确授权9条目录归属迁移后，SQLite在线backup至 `/Users/Admin/.dsh/composer-assist/workflows/backups/workflow-before-cwd-20261024-9n0slrq3.sqlite`（600权限），先在内存真实副本验证同一迁移函数及重复0修改，再单事务更新9metadata/8持久run的cwd。所有ID/owner/其他字段与其余表双向EXCEPT一致、计数一致和quick_check通过；未改日志、结果、效果、原生映射或运行状态，未执行流程。正式list随后返回原9条。
- DESIGN.md及design.json仅同步本轮实际布局/路径事实，19原生/继承颜色、字体、节点尺寸、人工门禁不变。**0.6.2最终实际图、独立视觉verdict与窄桌面复验仍待完成**；不以CLI/安装/数据回读冒充视觉通过，亦未假称已登记GUI本地项目入口。
### 0.6.2 最终验收（2026-10-24 03:32–04:12，只读 GUI 复核）

本轮不重做开发、不启动任何付费流程；运行记录数保持 9 条，最新事件时间仍为 1792784480787，未产生新 run。

- 实际画布已取得（docs/evidence-0.6.2/）：第二排「工作流」页签内为中央流程画布主区域，非表单/列表。运行选择器、新建/编辑脚本/保存流程/断点恢复/确认并运行、实时连接、指标行（2 子代理 · 5/5 已完成/已创建步骤 · 205,176 Tokens · 1 渐进报告 · 0 产物）均在第一屏可达。
- 阶段并排与居中为实测几何，非目测：面板 (305,136,1720,796)，图形区 (545,425,1240,369)，左留白 240px、右留白 240px，差值 0px。两阶段为同一行并排（「并行固定结果」2 任务、「修订消息验收」3 任务）。
- 窄桌面 840×900（首次取得，交接待核项关闭）：两阶段在同一 X 起点换行堆叠，「并行固定结果」(76,340,521,337)、「修订消息验收」(76,700,681,240)；图形区 (69,324,696,616) 完整落在面板内，工具栏 缩小/100%/放大/适应窗口/100% 仍在首屏，无横向溢出。这不是移动端，移动端仍未测。
- 四种图各自渲染且互不相同（md5 各不相同）：依赖图、执行顺序、控制流（含 入口/阶段/输出 结构标记）、阶段交接（phase#1:actor#1、phase#2:actor#2 真实阶段归属）。此前一轮「四图逐字节相同」是裁切区域与坐标点击错位造成的采样错误，已作废，不作缺陷。
- 四个子视图均可用：流程图（8 节点 · 16 连接）、阶段进度（两阶段分组与 0/2、0/0 计数）、节点与日志（真实事件流 run-started/run-launched/actor-created/phase-entered/node-queued）、结果与产物（该 run 真实为空，显示「尚无结果或产物」）。
- 数据真实性对齐：界面 205,176 Tokens / 5 ask / 1 report / 0 artifact / 2 actor 与 SQLite 逐项一致（tokens 205176、nodes 6 = 5 ask + 1 report、artifacts 0、actors 2）；cwd /Users/Admin/dsh插件，parentSessionId 为原会话 session-b2cbdaed…。
- 主题适配只能作源码级确认：workflow/client 下 ui.js、graph.js、artifact.js、navigation.js 无任何硬编码十六进制色，仅用 10 个 --dsw-alias-* 宿主令牌；当前宿主 ui-theme 配置为 preference: light，深色实景本轮未取得，保持未知。
- 原应用 codesign --verify --deep --strict exit 0；未改、未重签应用包。仓库 HEAD 仍 f828011，未提交/未推送，未改动任何 WIP。

**本轮新发现的真实缺陷（未修，按「不重做开发」留待决定）**：已停止（stopped）的运行，其被取消的 ask 节点在画布上仍显示「运行中」。store 中 3 条 run 共 5 个 ask 节点处于 status=running（38e8b170 2 个、b8a13eba 2 个、99f021aa 1 个），而事件日志已记录对应 node-settled{cancelled}。根因在 vendor 上游：scheduler.js 的 abortInFlight 只发取消事件、不写回节点行；putNode 仅由准入(running)、成功(completed)、失败(failed) 三处调用，取消路径缺一笔。客户端 nodeState() 据节点行判 running 优先，故显示为运行中。影响面为展示真实性（PRODUCT.md 要求「状态真实」），不影响执行，也不影响 resume（recordedAsks 只按 kind 计数，restoreFromJournal 只读 completed 判定产物）。


### 宿主 setTypeOfService EINVAL 弹窗定位（2026-10-24，非本插件）

宿主反复弹出“A JavaScript error occurred in the main process / setTypeOfService EINVAL”。已确认与本插件无关，是上游 Node/undici 缺陷：

- 宿主为 Electron 44.7.0、内置 Node 24.21.0。逐字节核对该二进制：writeH1 内为无保护的 socket.setTypeOfService(request.typeOfService)（未加 try/catch），而同目录 DSH 自带的 undici 副本有 QoS marking 守卫；fetch 走的是内置那份，故守卫无效。
- 上游已定位并在 undici 8.8.0 修复（nodejs/undici#5544 → PR #5547），但 7.x 分支未 backport，Node 24 LTS 仍带 7.x（nodejs/undici#6075）。macOS 上套接字状态不好时 setsockopt 返回 EINVAL，抛错发生在 socket I/O 回调内，不进入 fetch 的 promise，故 try/catch 接不住，成为 main process 未捕获异常。
- 本地曾多次尝试复现（死口代理、keep-alive 拆除、IPv6、autoSelectFamily、真实应用环境 40 次并发）均未复现，与时序竞态的上游描述一致，不能据此宣称已复现该崩溃。
- 仅做安全降险：**.zshrc 与 .bash_profile 各残留两行硬编码 export ALL_PROXY=socks5://127.0.0.1:10020 / :10021**，指向早已关闭的端口（10021 CLOSED，系统代理实为 7900），会在每次登录注入死代理。已删除这四行（备份为 ~/.zshrc.bak-before-stale-proxy-20261024T051850、~/.bash_profile.bak-before-stale-proxy-20261024T051850），并 `zsh -n` / `bash -n` 语法校验通过；新 shell 不再注入 ALL_PROXY。未改 launchctl 现有值、未改系统代理、未改应用包。
- 未修的边界：正在运行的宿主进程仍持有启动时的旧环境（ps 可见 ALL_PROXY=socks5://127.0.0.1:10021），需重启宿主才清除；真正的崩溃修复仍依赖上游发布含 backport 的 Node 或换 Electron 大版本。

## 0.6.4 取消节点状态显示修复（2026-10-24）

- 仅修复 ask 状态展示：pageNodes 与 siteStates 共用按 run/site/ordinal 查询的显示状态。最新节点生命周期事件为 cancelled 时显示取消；父运行已 stopped 而无取消事件时显示停止。新的 queued/dispatched 事件清除旧取消显示，completed/failed 记录不受影响。画布、阶段及分页复用现有「已停止」文案，无布局改动。
- 更正前节诊断：未完成 ask 的 running 行是 resume 重新派发所需的检查点，不能直接改成失败/取消终态。原 5 个节点并非都有取消事件：38e8b170 与 b8a13eba 的 4 个节点有明确 cancelled；99f021aa 的 ask#2 先随 run errored，后被 superseded，没有取消事件。本次只投影显示，不改 vendor 调度、持久节点或历史事件。
- 在现有 Host selfcheck 加入停止后的节点/站点/阶段/分页断言，修前明确失败 actual running / expected cancelled，修后通过；原跨进程 seed/resume 仍证明已完成 ask 不重跑。另覆盖同 site 不同 ordinal、取消事件早于最近 1000 条日志、恢复后 queued/dispatched、无取消事件的 stopped run、报告分页及 completed 优先。
- 原父会话的 3 条运行、5 个节点以源码中的同一 SQL 展示表达式及 nodeState 只读验证通过：4 cancelled + 1 stopped，均不再显示 running，底层仍保留 running 检查点。
- 最终构建（node scripts/build-client.mjs）、完整 pnpm run selfcheck、git diff --check 及原应用 codesign 深度严格验证均 exit 0。Host 自检证据目录为 /var/folders/qt/0lb8y6td72ldh4ccqgw8bthw0000gp/T/dsh-workflow-host-XTSUPZ。正式管理器按移除登记/重新安装加载 0.6.4，返回 application: applied（operation-dsNK6r）；Host 注册及安装导出已核对。7 张历史表的逐表内容指纹与安装前完全一致，仍为 9 run / 33 node / 207 event，未启动付费流程或重跑历史。
- 首次修复轮当时未做实时桌面点击（未找到 orca CLI）；之后用户授权的本机原窗口补验见下节。既有移动端、深色、整宿主重启恢复边界不变；样式扫描的两条既有字号/圆角 advisory 不在本次修改范围，未处理。未提交或推送。

### 0.6.4 本机真实 GUI 补验（2026-10-24）

使用原签名 DeepSeek Harness 应用（PID 13673、窗口 74349、2056×1210），通过 macOS 原生辅助功能读取控件、CGEvent 真实鼠标/键盘操作及原窗口截图取证。未启用替代服务器、浏览器或离线假页面，本轮没有修改应用代码、构建或重新安装。

原记录 GUI 入口为「查找 ZCode 的 work 相关模块」。在其运行选择器逐项匹配短 ID，未改变 owner/cwd/会话映射。新会话「读取交接继续最终验收」的空菜单不代表原历史丢失。正式会话工具的跨工作区查询被拒后停止该路径，没有改读私有会话/代理日志；以下是用户授权的实际工作流界面证据。

| 原运行 | 画布节点 | 实际标签 | 截图 |
| --- | --- | --- | --- |
| b8a13eba | ask#1、ask#2 | 两个均「已停止」 | [02](<evidence-0.6.4/02-b8a13eba.png>) |
| 38e8b170 | ask#1、ask#2 | 两个均「已停止」 | [03](<evidence-0.6.4/03-38e8b170.png>) |
| 99f021aa | ask#2 | 「已停止」 | [04](<evidence-0.6.4/04-99f021aa.png>) |

- 状态没有一律改成停止：99f021aa 的 ask#1 仍为「失败」，原后续未执行节点仍为「待执行」；已完成样本 8ebeb50c 的五个 ask 均为「已完成」，指标仍为 5/5、205,176 Tokens。
- 四图通过实际鼠标切换，渲染节点控件/边标签分别为依赖图 8/16、执行顺序 5/6、控制流 10/9、阶段交接 4/2；对应 [05](<evidence-0.6.4/05-completed-graph.png>)、[06](<evidence-0.6.4/06-completed-graph.png>)、[07](<evidence-0.6.4/07-completed-graph.png>)、[08](<evidence-0.6.4/08-completed-graph.png>)。
- [阶段进度](<evidence-0.6.4/09-phase-progress.png>) 显示「并行固定结果」2/2、「修订消息验收」3/3；[节点与日志](<evidence-0.6.4/10-nodes-and-log.png>) 显示 5 个节点计数及真实 run-started、node-settled、run-settled 等事件。节点 ID 文本在该列表的 AX 树中未直接提供，因此不靠此列表证明五个目标节点状态；五节点结论来自上表画布按钮的完整可访问标签。
- [结果与产物页](<evidence-0.6.4/11-results.png>) 实际显示「最终结果」「渐进报告」；[缩放](<evidence-0.6.4/12-zoom.png>) 从 100% 到 115%，再通过原始大小恢复 100%。[脚本编辑器](<evidence-0.6.4/13-script-editor.png>) 展开后读取到 2127 字符脚本及 2 字符 args，未输入任何文本，已收起；点击真实 ask#1 打开 [节点详情](<evidence-0.6.4/14-node-detail.png>)，确认该节点和已完成状态。
- 交互成功以最终可见的选择器、页面短 ID、节点标签及图区域为准，不以 AXPress 返回 0 当成功。初期控件尚未渲染、菜单未选中及不支持聚焦导致的自动化守卫失败，没有被算成产品失败或通过，也没有因此改代码。
- 已观察恢复原 b8a13eba 选择及两个停止节点的 [最终画布](<evidence-0.6.4/15-restored-b8a13eba.png>)；探索时切换过的两个会话已回到对话页签，随后切回首次完整控件快照中的活动会话「研究 pi 项目代码仓库」，窗口尺寸未改。
- [机器核验记录](<evidence-0.6.4/acceptance-check.json>) 校验了五节点标签、保留的完成/失败状态、四图、阶段/日志/结果/缩放/编辑器/详情及正式截图 02–15 的 PNG 与 SHA256。01 是新会话入口定位截图，不作节点通过证据。最终七表内容指纹与修复安装前完全一致：9 run、13 actor、33 node、207 event、76 document、4 effect、2 artifact；原应用 codesign 深度严格检查和 git diff --check 均通过。
- 边界：本次覆盖的非付费界面交互未发现回归。未点击启动、停止、恢复、修订、保存、分析、预测/润色或发送，不能将这轮验收说成执行/写入路径或所有模型供应商的端到端重跑；非空产物下载、移动端、深色及整宿主重启恢复未重验。未改会话历史、业务数据或其他功能代码。

### 0.6.4 客户端整体UI整改（2026-10-24，本轮）

用户明确不接受旧版表单式工作流界面，并指出Tab没有可见反馈。本轮是已授权的整体UI整改；旧轮GUI功能覆盖不等于用户视觉接受。只更新客户端，保持现有包版本、运行层与编译器产物，未重新开发执行链路、修改owner/cwd或重跑产品工作流。

- 根因是独立`editorOpen`始终把大表单放在各Tab之前，内容变化藏在下方。现统一为五个互斥视图；默认画布，脚本配置独立工作面；桌面脚本/配置双列、窄屏重排，顶部唯一保存/生命周期操作，原始数据折叠保留，人工问题/留白/未知效果处理器保留在共享层。
- 实际注册组件回归覆盖默认画布、五Tab、键盘环绕/Home/End、修饰键不劫持、草稿往返及空预览指令说明。API、启动、参数校验、会话选择及三类人工干预处理器与基线一致。完整selfcheck（含恢复与产物新鲜度）、diff及原App深度严格签名检查通过。
- 定点构建客户端后，只对`include:composer-assist`执行停用/恢复启用，最后enabled/applied；未管理重载工作流Host。管理器同时报告的账户模型配置、另一个codex-workflow注入及重复PTY三项既有警告未在本轮处理。共享目录其它会话的打包/运行层提交均保留，未回退或混为UI成果，未提交/推送。
- 最终客户端SHA256为`eed0664790ae6163b09aebc811b40b59117dbdc087ee048f0c8b9fbd08fe1e93`，Host为`e85aaa429deeb1b4a8af1160970d30f7064601f8705d2cb7f26ed3773503775f`，编译器为`09b2a74173d4b8f4bc045a966c2578912940553447c6143e7a3419181dd5781d`。

### 恢复可用：两个真实缺陷（2026-10-24 下午）

面板一度整页报 `Unexpected token 'o', "not found" is not valid JSON`，两个独立原因都已定位并修复，均为环境/契约问题而非样式问题：

1. **运行产物与磁盘不一致**：应用15:53启动，`dist/*.js`在15:56被并发会话重写，运行中的Host加载了构建中途产物，工作流路由未注册，请求返回纯文本`not found`而被客户端当JSON解析。重建产物并重载工作流Host入口后恢复。
2. **`agentTeams`硬性注入**：`workflow/plugin.js`的`inject`包含`agentTeams`，而desktop profile的`agent-teams`条目是`disabled: true`，入口永久停在`pending (waiting for service: agentTeams)`，整个面板不可加载。改为运行期惰性获取（`createNativeTeam`缺该服务时本就抛明确错误），面板可正常加载，启用Teams后原生成员能力不受影响。

修复后完整`pnpm run selfcheck`、产物新鲜度、`git diff --check`、原应用深度严格签名检查均通过。

现场实测（原签名App PID1732、窗口2056×1211、GUI端口56598）：

| 实测项目 | 结果及证据 |
| --- | --- |
| 五视图互斥 | 逐个点击流程图/阶段进度/节点与日志/结果与产物/脚本与配置，选中态与内容真实切换；脚本页textarea由1增至3、其余视图为1。见[流程图](</Users/Admin/dsh插件/docs/evidence-ui-20261024/2026-10-24-tab-流程图.png>)、[脚本与配置](</Users/Admin/dsh插件/docs/evidence-ui-20261024/2026-10-24-tab-脚本与配置.png>)。 |
| 首屏画布 | 流程图首屏直接呈现画布、四类图与指标，编辑器不再挡住内容。 |
| 脚本工作台 | 左代码右设置，底部为分析/启动/修订；顶部仅保留新建、保存、生命周期操作。 |
| 历史数据 | 七表未变：10 run /14 actor /35 node /217 event /83 document /4 effect /2 artifact，无活动运行；99f021aa ask#2→stopped、38e8b170与b8a13eba各两节点→cancelled，99f021aa ask#1保留failed，原始running检查点未改写。 |

仍未覆盖：移动端、深色、付费执行/写入、所有供应商及整宿主重启恢复；未点击运行、保存、停止、恢复、修订或模型调用，未启动付费流程，未改owner/cwd。共享目录中`client.js`另有其它会话进行中的“接受预测后保留”改动（约280行），本轮未回退、未提交，`dist`按当前全部源码一致重建因而包含该改动，提交前需各自负责人确认归属。未提交或推送。视觉最终由用户判定。

独立现场验收使用原签名App PID63192、窗口83041，直接查看真实截图像素与AX状态，无替代页面、服务器或伪造数据。首版整改客户端无需刷新即出现五Tab；最终只补了空预览详情的缺值说明，后续复核另记。

| 实测项目 | 结果及证据 |
| --- | --- |
| 默认画布/五Tab | [更新前](</Users/Admin/dsh插件/docs/evidence-ui-20261024/before-ui.png>)大编辑器；[更新后工作台](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-workbench.png>)不再挂表单。四个非脚本页textarea均为0，脚本页为2；所有Tab点击、Home/End及左右键实际选中/焦点变化已核对。 |
| 脚本配置/草稿 | [宽屏双列](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-script.png>)，选择器实测360px；469字符脚本与2字符args往返哈希不变，匹配更新前私有备份，无自定义内容丢弃。 |
| 免费预览/四图 | 点击一次静态分析回画布，[真实编译预览](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-graph.png>)为4节点/4边；四类图选择状态互斥，100%→115%→100%，阶段为调查/复核、均待执行，未创建运行。 |
| 阶段/详情/结果 | [阶段](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-phases.png>)、ask预览跳详情及[结果空态](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-results.png>)已核对。首轮发现无已保留指令时详情空白，已补诚实缺值说明并加先红后绿回归，不编造动态输入；首轮旧详情图仅作问题证据。 |
| 窄桌面 | 真实840×900的[脚本配置](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-script-narrow.png>)与[画布](</Users/Admin/dsh插件/docs/evidence-ui-20261024/after-graph-narrow.png>)未见明显裁切，工具栏、设置、底部操作可见。因设置均容纳，未实际触发溢出滚动。 |
| 原归属历史 | 通过公开侧栏进入原会话，未绕owner/cwd。[b8a13eba](</Users/Admin/dsh插件/docs/evidence-ui-20261024/history-stopped.png>)两已创建ask显示已停止、三未创建仍待执行；[8ebeb50c结果](</Users/Admin/dsh插件/docs/evidence-ui-20261024/history-completed-results.png>)已完成5/5，真实最终结果与1条报告保留。完成图有一张加载中快照，不作完成图通过证据。 |

[独立现场原始记录](</Users/Admin/dsh插件/docs/evidence-ui-20261024/live-acceptance.json>)保留真实结果与初轮问题，不回改成全通过。另两条停止历史未逐一打开；使用当前只读正式库与未改的共享状态helper核对[五停止/五完成](</Users/Admin/dsh插件/docs/evidence-ui-20261024/legacy-status-check.json>)：4 cancelled+1 stopped，五原始running恢复检查点不变，此项不冒充新GUI逐条覆盖。

本轮基线已是10 run /14 actor /35 node /217 event /83 document /4 effect /2 artifact，不沿用上轮9条数量；[七表指纹](</Users/Admin/dsh插件/docs/evidence-ui-20261024/integrity-after-client.json>)一致。没有点击运行、保存、停止、恢复、修订或模型调用，静态编译不属于真实执行验收。移动端、深色、付费执行/写入/所有供应商及整宿主重启恢复未重验；视觉最终由用户判定。窗口/起始会话恢复与最终缺值说明截图由后续小范围复核记录，不以初轮2×1px尺寸差宣称完全还原。

## 已知验证限制与运行风险

- 0.3.1 小屏验证曾因测试浏览器页面无响应而未完成；本轮宿主重启后，Ego 任务空间 18 在当前地址仍显示认证提示，刷新后也未进入应用，因此 **0.4.2 手机溢出、按钮遮挡和 GUI 启动未实测通过**。Client Slot 查询只确认入口已注册，不能代替真实 DOM/点击验证；旧版桌面证据也不能冒充新版小屏证据。
- 本轮原生恢复实测是同一 Host 中的停止、受管冷激活和同 ID 恢复，未强制重启整个 DSH 宿主。Journal 跨进程恢复另有自动检查，不能把它说成原生适配已做完整宿主重启测试。
- 曾有一次冷分析触发 10 秒上限；确认发生在修订写入之前，极小只读分析成功后同脚本通过。没有放宽 Worker 资源上限，也没有自动重发已启动的运行。
- 原生消息通过无唤醒的持久收件箱停放；异步边界上新到消息可能排在重新停放的旧消息前，不提供严格 FIFO。显式停止按原生取消语义丢弃未处理输入；单纯 interrupt 才保留它们。
- 成员按实际执行的 ask 按需建立。全为缓存的 actor 不会凭空生成新成员；要向该 actor 发送原生消息，应先让它执行一次明确的就绪 ask。原生任务同样映射实际执行的 ask，而不是另建一套缓存节点调度器。
- 通用会话历史工具拒绝读取产品协调会话/子会话，未通过其他路径读取私有日志。上述产品证据来自校验父会话归属的正式工作流接口和产品队友实际调用的原生成员/任务工具。
- 未测试每个模型供应商。Raccoon 登录态在验收时过期；GLM 真正调用已通过。主会话曾选中未注册的 `magpie-responses`，切换有效 Codex 路由后正常；这与工作流脚本失败不同。
- 自检桩不能替代所有原生场景，故以上真实 DSH 调用和界面记录单列。
- 外部写操作不存在通用 exactly-once 保证；未知结果必须先人工核实，不能因为任务停止就认定未发生。
- 未提交或推送 Git；当前安装绑定移植工作树，请保留该目录。原目录中的既有改动未被覆盖。
