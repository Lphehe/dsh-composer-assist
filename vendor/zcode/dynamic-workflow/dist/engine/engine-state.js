/**
 * engine.ts 顶到 oxlint max-lines 上限（400 行），把引擎私有状态的显式接缝拆到本文件；
 * 公开面仍从 engine.ts 导出。
 *
 * WorkflowEngine 的几组方法（用户面产物、report、world 节点与导入缓存、run 结算）被拆成兄弟
 * 模块里的自由函数（engine-artifacts.ts / engine-report.ts / engine-world.ts / engine-settlement.ts）。
 * 它们不各自持有状态，而是经这张接缝读写引擎的私有字段：接缝由引擎在构造函数里用箭头闭包
 * 装配，字段本身仍是 private，所以引擎的公开面零变化；类上只留薄薄一层委托方法。
 *
 * 可变标量（报告计数、导入门）以「读方法 + 单向写方法」暴露，而不是 getter/setter——写法只有
 * 一种（计数只增、门只关），接缝面上就说清了这一点。
 */
export {};
