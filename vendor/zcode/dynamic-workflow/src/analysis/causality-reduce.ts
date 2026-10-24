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
export const KIND_RANK: Record<OrderKind, number> = {
  carry: 0,
  control: 4,
  data: 3,
  fifo: 2,
  seq: 1,
};


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

/** Kinds a justifying path may consist of, per the kind of the edge under test. */
const JUSTIFIED_BY: Partial<Record<OrderKind, ReadonlySet<OrderKind>>> = {
  // A hard dependency yields only to a path of hard dependencies. `data` and `control`
  // are both non-removable — no refactoring can make a consumer precede its producer,
  // or a guarded step precede its guard — so either one justifies either one. What this
  // does NOT yield to is `seq`/`fifo`: those are incidental serialization the reader is
  // meant to be able to delete mentally, and the constraint must survive that deletion.
  // This is what kills the phantom producer→sink edges the actor projection emitted
  // through relays, and what keeps `scan → judge` alive against the incidental
  // `scan → plan → review → judge`.
  //
  // Bug: `data` originally yielded to `data` alone, which kept every data fact that a
  // control edge already implied. In a refine-until-approved loop that is most of the
  // picture — `initial plan → revision` reads as a second arrow on top of
  // `initial plan → initial review → (guards) → revision`, saying nothing the chain
  // did not. Ordering-redundant arrows are pure ink here, because the renderer draws
  // every kind identically; a data edge earns its place only by asserting an order no
  // hard path already asserts.
  control: new Set<OrderKind>(["data", "control"]),
  data: new Set<OrderKind>(["data", "control"]),
  // FIFO yields to a real dependency or to another FIFO hop (a same-actor chain
  // already implies its own transitive closure), but never to bare serialization.
  // For example, `assess → refine → wrap up` already implies `assess → wrap up`.
  fifo: new Set<OrderKind>(["data", "control", "fifo"]),
  // Pure serialization yields to any ordering at all.
  seq: new Set<OrderKind>(["data", "control", "fifo", "seq"]),
};

/** carry 边的底层 kind；缺席按 hard 处理（见 {@link ReducibleEdge.carryOf}）。 */
const underlyingOf = (edge: ReducibleEdge): Exclude<OrderKind, "carry"> =>
  edge.carryOf ?? "data";

/**
 * Drop edges a strong-enough path of surviving edges already implies — forward edges
 * first (each decided against the surviving set, in input order), then `carry` edges
 * against the surviving result (one forward leg, exactly one carry hop, one forward
 * leg). Deterministic given input order; on a DAG the forward phase is the unique
 * typed transitive reduction, and on residual cycles (one step issued from several
 * call sites) both phases stay sound — every drop has a surviving witness — and
 * irredundant.
 */
export function reduceOrdering<E extends ReducibleEdge>(edges: readonly E[]): E[] {
  const dropped = new Set<E>();
  const forward = edges.filter((edge) => edge.kind !== "carry");
  const carries = edges.filter((edge) => edge.kind === "carry");

  const outgoing = new Map<string, E[]>();
  for (const edge of forward) {
    const list = outgoing.get(edge.from);
    if (list === undefined) outgoing.set(edge.from, [edge]);
    else list.push(edge);
  }

  /**
   * Is `to` reachable from `from` over surviving `allowed`-kind forward edges without
   * using any direct `from → to` hop? Any such path has length ≥ 2, which is exactly
   * the reduction condition. Cycle-safe: the visited set bounds the walk.
   *
   * Deliberately certainty-BLIND. A certainty-aware variant (an unconditional ordering
   * may only yield to an unconditional path) is strictly sounder per-execution, and was
   * tried: it restores an edge from every ancestor of the returned artifact in 30 corpus
   * fixtures, because a path through any conditional step stops justifying anything.
   * That is precisely the phantom producer→sink noise the design exists to remove, and
   * the reader is not doing per-execution case analysis — they read a chain as a chain.
   * Certainty stays a model-only property of the surviving edges.
   */
  const reaches = (from: string, to: string, allowed: ReadonlySet<OrderKind>): boolean => {
    const seen = new Set<string>([from]);
    const stack: string[] = [];
    for (const edge of outgoing.get(from) ?? []) {
      if (edge.to === to || !allowed.has(edge.kind) || dropped.has(edge)) continue;
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        stack.push(edge.to);
      }
    }
    while (stack.length > 0) {
      const node = stack.pop() as string;
      for (const edge of outgoing.get(node) ?? []) {
        if (!allowed.has(edge.kind) || dropped.has(edge)) continue;
        if (edge.to === to) return true;
        if (!seen.has(edge.to)) {
          seen.add(edge.to);
          stack.push(edge.to);
        }
      }
    }
    return false;
  };

  for (const edge of forward) {
    const allowed = JUSTIFIED_BY[edge.kind];
    if (allowed === undefined) continue; // defensive: `carry` is already filtered out
    if (edge.from === edge.to) continue;
    if (reaches(edge.from, edge.to, allowed)) dropped.add(edge);
  }

  const carryOutgoing = new Map<string, E[]>();
  for (const edge of carries) {
    const list = carryOutgoing.get(edge.from);
    if (list === undefined) carryOutgoing.set(edge.from, [edge]);
    else list.push(edge);
  }

  /**
   * Does a surviving composition `forward* → one carry hop → forward*` (every hop of
   * an `allowed` kind, the carry hop judged by its underlying kind) connect `from` to
   * `to` without using `candidate` itself? Two-state walk: state 1 is "the carry hop
   * is spent". Parallel edges cannot occur (facts are deduped per ordered pair before
   * back-edge typing), so any witness found here has length ≥ 2 by construction.
   */
  const carryWitness = (candidate: E, allowed: ReadonlySet<OrderKind>): boolean => {
    const seen = new Set<string>([`${candidate.from} 0`]);
    const stack: [string, 0 | 1][] = [[candidate.from, 0]];
    while (stack.length > 0) {
      const [node, spent] = stack.pop() as [string, 0 | 1];
      const push = (next: string, state: 0 | 1): boolean => {
        if (state === 1 && next === candidate.to) return true;
        const key = `${next} ${state}`;
        if (!seen.has(key)) {
          seen.add(key);
          stack.push([next, state]);
        }
        return false;
      };
      for (const edge of outgoing.get(node) ?? []) {
        if (!allowed.has(edge.kind) || dropped.has(edge)) continue;
        if (push(edge.to, spent)) return true;
      }
      if (spent === 1) continue;
      for (const edge of carryOutgoing.get(node) ?? []) {
        if (edge === candidate || dropped.has(edge) || !allowed.has(underlyingOf(edge))) continue;
        if (push(edge.to, 1)) return true;
      }
    }
    return false;
  };

  for (const edge of carries) {
    const allowed = JUSTIFIED_BY[underlyingOf(edge)];
    if (allowed === undefined) continue;
    if (carryWitness(edge, allowed)) dropped.add(edge);
  }

  return edges.filter((edge) => !dropped.has(edge));
}
