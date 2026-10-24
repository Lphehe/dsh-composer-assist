/**
 * `@zcode/dynamic-workflow-runtime`：沙箱 harness。
 *
 * 对外暴露 harness 入口、线协议类型、入口文件的渲染与落盘（`renderChildEntry` /
 * `writeChildEntryFile`，测试与工具据此造出与生产同形的入口文件），以及子进程出口 `childMain`。
 * SEA 隐藏子命令（`__zcode-dwf-child`）不再 import 本包：入口文件自带 childMain，子命令只
 * `import()` 文件并调它的 `start`。
 */
export { runWorkflowScript, } from "./harness.js";
export { childMain, renderChildEntry, } from "./child-source.js";
export { childEntryFileName, fallbackWorkflowRunsDir, workflowRunsDir, writeChildEntryFile, } from "./child-entry-file.js";
