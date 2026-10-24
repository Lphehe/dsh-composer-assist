/**
 * NDJSON 线协议（Boundary A 的传输编码）。
 *
 * 沙箱子进程与父进程 harness 之间通过 stdio 上的换行分隔 JSON 通信。本模块是**唯一真源**，
 * 描述每种消息的种类与字段；子进程源码（child-source.ts 的内嵌字符串）里以纯手写方式镜像这些
 * 形状——它无法 import 本模块（经 `toString()` 内嵌进入口文件运行），故两处必须一起改。父进程侧则直接
 * import 这些类型，保证桥接代码有严格类型。
 *
 * 方向约定：
 *   child → parent：create-actor（即发即忘）/ request（ask/world-read/publish-artifact/hole，需应答）/
 *                   event（log、report、declare-artifact）/ complete
 *   parent → child：response（应答 request，并搭载最新预算快照）
 *
 * 为何 create-actor 不走 request/response：Boundary A 要求 `createActor` **同步**返回句柄。子进程无法为同步返回等待一次 round-trip，故它同步造一个
 * child-local 句柄（`local#N`）并即发即忘一条 create-actor，父进程据 stdio 的 FIFO 顺序在处理
 * 任何引用该句柄的 ask 之前完成 local→engine ActorId 的映射（父进程的 create-actor 处理是纯同步的）。
 */
export {};
