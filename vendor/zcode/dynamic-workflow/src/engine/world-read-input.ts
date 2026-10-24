// ============================================================
// world-read / world-run 节点的有界输入
// ============================================================
// `inputHash` 只回答「同一个输入吗」；工作区 transcript 要回答「输入是什么」。这里把
// `{op, args}` 压进 4 KB：绝大多数输入（一个路径、一个 pattern、一条 argv）远小于上限，
// 原样落库；只有 `world.run("node", ["-e", <一大段代码>])` 这类才会被截。截断是**逐项的
// 字符串预览**而不是整体丢弃——审计面上「跑了 node -e …（被截）」比一个 NULL 有用得多。

import { WORLD_READ_INPUT_MAX_BYTES, type WorldReadInput } from "./types.js";

/** 单个实参在截断模式下保留的最大字符数：4 KB 均分给至多 8 个实参，再留序列化开销。 */
const TRUNCATED_ARG_MAX_CHARS = 400;
const MAX_ARGS_KEPT = 8;

/** UTF-8 字节数。用 `TextEncoder` 而不是 `Buffer`：本包保持零 node 内建依赖（engine.ts 同一条纪律）。 */
function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** 一个实参的字符串预览：字符串原样，其余 JSON；超长切尾加省略号。 */
function previewArg(value: unknown): string {
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value) ?? String(value);
    } catch {
      text = String(value);
    }
  }
  return text.length > TRUNCATED_ARG_MAX_CHARS
    ? `${text.slice(0, TRUNCATED_ARG_MAX_CHARS)}…`
    : text;
}

/**
 * 把 `{op, args}` 压到 {@link WORLD_READ_INPUT_MAX_BYTES} 之内。
 *
 * 快路径：序列化后不超限即原样返回（实参保留原类型——`world.run` 的 opts 对象、`git.log`
 * 的数字都还是它们自己）。慢路径：每个实参换成字符串预览、至多 8 个，并置 `truncated`。
 * 不可序列化的实参（带环、BigInt）走同一条慢路径——它们在 journal 里本来也表示不了。
 */
export function boundWorldReadInput(op: string, args: readonly unknown[]): WorldReadInput {
  const plain: WorldReadInput = { op, args: [...args] };
  try {
    const text = JSON.stringify(plain);
    if (text !== undefined && utf8Length(text) <= WORLD_READ_INPUT_MAX_BYTES) return plain;
  } catch {
    // 落到下面的预览路径。
  }
  return {
    op,
    args: args.slice(0, MAX_ARGS_KEPT).map(previewArg),
    truncated: true,
  };
}
