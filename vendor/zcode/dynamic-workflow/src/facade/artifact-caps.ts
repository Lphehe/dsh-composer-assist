/**
 * 产物（artifact）的上限常量。
 *
 * ⚠ 术语：这里的 artifact 是**用户面产物**——脚本经 `artifact.*` 发布给用户看的文件 /
 * markdown / 预置看板，不是引擎内部那个 artifact（`RunSettlement.artifact`、
 * `analysis/artifact-types.ts` 的类型化输出值，那是给模型看的顶层返回值）。
 *
 * 与 `report-caps.ts` / `world-read-caps.ts` 同样自成一个模块，理由也一样：这批数字的
 * **执行侧是分裂的**——id 数、版本数由引擎核心执行（它才知道 journal 里这个 id 已经有几版），
 * 字节数与文本长度由 driver 执行（只有它读得到文件、写得进 store）。放进任一侧的模块都会让
 * 读者以为它们由同一侧强制；而数字是契约这一点两侧相同，所以它们必须住在纯包里、有名字，
 * 让引擎测试与 driver 测试断言同一份常量而不是各抄一份。
 *
 * 溢出的策略**按成员族分裂**（错误码）：内容成员（`file` / `markdown`）返回
 * promise，脚本有处可 catch，所以超限是**节点级拒绝**（`ArtifactTooLarge` /
 * `ArtifactVersionCapExceeded` / `ArtifactCapExceeded`）；预置成员返回 void，没有拒绝通道，
 * 所以同样的上限在那一族是 failRun。与 world-read / report 的分界同一条论证。
 */

/** 产物的数量、体积与文本上限。数字即契约（见本模块顶部）。 */
export const ARTIFACT_CAPS = {
  /** 一个 run 内最多能有几个不同的产物 id。 */
  maxArtifactsPerRun: 32,
  /** 单个 id 最多能发布几版（内容成员每次成功发布 = 一版）。 */
  maxVersionsPerArtifact: 16,
  /** `artifact.file` 的最大字节数（与 PROTOCOL_V4_LIMITS.attachmentMaxBytes 同值）。 */
  maxFileBytes: 20 * 1024 * 1024,
  /** `artifact.markdown` 的最大字节数（UTF-8）。 */
  maxMarkdownBytes: 256 * 1024,
  /** `opts.title` 的最大字符数。 */
  maxTitleLength: 120,
  /** `opts.description` 的最大字符数。 */
  maxDescriptionLength: 500,
  /** 预置 spec 规范化 JSON 后的最大字节数。 */
  maxSpecSerializedBytes: 8 * 1024,
  /** 产物 id 的最大字符数。 */
  maxIdLength: 64,
} as const;

/**
 * 合法产物 id 的字符集：`[A-Za-z0-9_.-]`，非空。
 *
 * 为什么这么窄：id 是**跨面身份**——journal 的 `dwf_node.artifact_id` 列、store 的
 * `toolCallId`、v4 查询的 params、侧板 tab 的键，都拿它当键。斜杠、空格、百分号在其中任一处
 * 都会变成一次转义争议，而一个转义争议在四处各解决一次就是四个答案。
 *
 * 无 `g` 标志：带 `g` 的正则在 `test` 之间保留 `lastIndex`，同一个 id 连测两次会得到不同答案。
 */
export const ARTIFACT_ID_PATTERN = /^[A-Za-z0-9_.-]+$/;
