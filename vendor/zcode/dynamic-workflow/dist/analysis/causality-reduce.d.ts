/**
 * Type-aware transitive reduction over the happens-before relation. With one arrow
 * style on screen, reduction carries the whole burden of keeping the picture readable —
 * and it must stay TYPED even though rendering is not. A uniform reduction over the
 * untyped relation deletes the wrong arrows: in `planner-reviewer`, `scan → judge` is
 * the genuine data dependency and the incidental ordering path
 * `scan → plan → review → judge` transitively implies it, so a uniform pass would keep
 * the incidental chain and drop the meaningful edge.
 *
 * Precedence: `data` = `control` > `fifo` > `seq`.
 *
 * 修复记录
 *
 * 一、前向边的删边决策改为逐边对 SURVIVING 集判定。旧实现对 ORIGINAL 关系一次性批量
 * 删边，再用单调恢复环节补回「见证路径自身被删掉」的边——恢复一条边会重新给其他被删边
 * 提供见证，但没有任何一步再删它们，于是在带环输入上收敛到严重过度恢复的边集（真实症状：
 * jsonl-db 优化循环的图 66 条前向边里 55 条被其余边蕴含）。phase 1 的「一站点一步」规则
 * 让共享 helper（循环前后各调一次）产出双向前向边，环是常态而非异常，删边算法必须在环上
 * 保持无冗余。逐边对存活集判定后天然不需要恢复环节：每条被删的边在删除当刻都有存活见证，
 * 后删的边不会作废先前的删除——后删边自己的见证可以代入先前见证（kind 允许集沿
 * seq ⊇ fifo ⊇ data=control 单调收缩，代入后强度只增不减）。DAG 上与唯一的类型化传递
 * 归约逐边一致，只有带残环的图行为改变。
 *
 * 二、新增 carry 最小化（旧规则「carry 永不删」作废）。carry 边断言 A@k → B@k+1，而
 * 「k 轮内前向路径 → 恰好一跳 carry → k+1 轮内前向路径」的组合断言完全相同的事实，故有
 * 此见证的 carry 是纯冗余墨水（8 步循环体曾画出 19 条 back-edge，前向链 + 一条回边就说
 * 尽了）。逐跳按类型判强弱：见证的每一跳（carry 跳按其底层 kind，即回边被改型前的原始
 * kind）必须不弱于被删 carry 自己的底层 kind；恰好一跳 carry，两跳断言的是 k → k+2，
 * 严格更弱。与前向阶段同样逐边对存活集判定，互为见证的两条回边不会同时消失——闭合过环
 * 的循环仍然闭合。
 */
export type OrderKind = "data" | "control" | "fifo" | "seq" | "carry";
/**
 * Dedup precedence when several facts hold for one ordered pair — the same kind lattice
 * {@link JUSTIFIED_BY} reads, in the shape a dedup needs. Lives here rather than beside
 * either consumer because the step-level dedup and the phase quotient's must agree by
 * construction.
 */
export declare const KIND_RANK: Record<OrderKind, number>;
export interface ReducibleEdge {
    from: string;
    to: string;
    kind: OrderKind;
    /**
     * `carry` 边的底层 kind：回边在改型成 carry 之前原本的前向 kind。carry 最小化按它
     * 判断见证需要多强；缺席时按 hard（data）处理——宁多留一条回边，不误删数据事实。
     */
    carryOf?: Exclude<OrderKind, "carry">;
}
/**
 * Drop edges a strong-enough path of surviving edges already implies — forward edges
 * first (each decided against the surviving set, in input order), then `carry` edges
 * against the surviving result (one forward leg, exactly one carry hop, one forward
 * leg). Deterministic given input order; on a DAG the forward phase is the unique
 * typed transitive reduction, and on residual cycles (one step issued from several
 * call sites) both phases stay sound — every drop has a surviving witness — and
 * irredundant.
 */
export declare function reduceOrdering<E extends ReducibleEdge>(edges: readonly E[]): E[];
//# sourceMappingURL=causality-reduce.d.ts.map