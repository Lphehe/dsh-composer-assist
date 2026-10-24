import { type WorldReadInput } from "./types.js";
/**
 * 把 `{op, args}` 压到 {@link WORLD_READ_INPUT_MAX_BYTES} 之内。
 *
 * 快路径：序列化后不超限即原样返回（实参保留原类型——`world.run` 的 opts 对象、`git.log`
 * 的数字都还是它们自己）。慢路径：每个实参换成字符串预览、至多 8 个，并置 `truncated`。
 * 不可序列化的实参（带环、BigInt）走同一条慢路径——它们在 journal 里本来也表示不了。
 */
export declare function boundWorldReadInput(op: string, args: readonly unknown[]): WorldReadInput;
//# sourceMappingURL=world-read-input.d.ts.map