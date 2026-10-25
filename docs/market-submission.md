# DSH 插件市场收录规范

来源：[awesome-dsh-plugin/contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)（2026-10-25 读取）。
本文件记录**投稿到 DSH 插件市场**的硬性要求与流程。本仓库自己的构建与验收规范见 [verification.md](verification.md)。

## 一、投稿方式：一个文件就是全部

市场列表数据在 `data/plugins/`，**一个插件一个 YAML 文件**，文件名 `<owner>__<repo>.yml`。

```yaml
url: https://github.com/owner/repo        # 必须与仓库完全一致
name: owner/repo                          # 列表里显示的链接文字
category: usage
description:
  en: One-line description ending with a period.
  zh: 一句话描述，以句号结尾。
```

- **两个 README 由脚本生成，不要手工编辑。** 条目文件永不冲突，生成的 README 行才冲突。
- 只有 `description.en` 必填；中文缺失由维护者补，不构成退回理由。
- 描述含 `: `（冒号+空格）**必须加引号**，否则 YAML 解析成嵌套键。
- monorepo 子包：`url` 指向子目录，`name` 用 `owner/repo#subname`，文件名 `owner__repo--packages-my-plugin.yml`。

## 二、准入门槛（CI 自动检查）

| 条件 | 说明 |
| --- | --- |
| `dsh.bundle.patch` 声明 | `package.json` 里**必须有** `dsh: { bundle: { patch: "./cordis.patch.yml" } }`，仓库根放同名 patch 文件 |
| 仅 `dsh.client` 不合格 | 最常见退回原因：只声明前端不是可安装的 bundle |
| 真实可用代码 | 占位仓库、纯 README、名称抢注不收 |
| 仓库创建满 1 天 | 过滤「PR 前几分钟才建仓」；未达标可完成后再提交，重新提交无影响 |
| 活跃维护 | 定期扫描归档/长期停更的条目并移除 |
| 加 `dsh-plugin` topic | 仓库设置里添加 |

完整 manifest 形态：

```jsonc
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },   // 必须
    "client": { "platform": "web" }                // 仅带前端 UI 时
  }
}
```

## 三、描述必须属实

描述被当作**对插件的声明**，会与代码核对。写「46 个工具、六大领域」就要真有其数；提到某命令或 API 就必须存在。
**夸大是让本来不错的插件被打回的主要原因。** 不写营销词。

## 四、分类选择

`agi` `ui` `usage` `theme` `model` `identity` `session` `memory` `tools` `wsl` `browser` `vision` `voice` `docs` `skill` `workflow` `git` `notify` `dev` `security` `remote` `market` `fun`

- **选贴合作品实际做的事**，不是希望它出现在哪里。
- 选得不准**不会被打回**，维护者直接改。不必纠结。
- 分类体系会演化：`usage`／`vision` 从 `ui`／`tools` 拆出，`security`／`browser`／`git`／`docs`／`remote`／`voice` 也都拆分而来。

## 五、评审看什么（人工）

CI 通过是**前置条件，不是结论**。维护者会读目标仓库，看：

1. 代码是否与条目声明一致（含描述里的数字、API 名）
2. 分类是否合理（不合理会直接改，不退回）
3. 是否真实可用代码，而非占位或空壳
4. 是否已被现有条目覆盖——同功能先到者留位，但那只是平局依据；**维护得更好或确有新增的分叉可以收录**。规则是谁更好，不是先来后到
5. 源码有无可疑之处（混淆、凭据外传、异常安装行为）。收录**不等于**安全审查
6. PR 是否动了无关条目——更新自己条目时**只改自己那一条**
7. 是否纯聚合包：只有依赖清单、自己不做事的不单独收录（「收插件，不收聚合包」）。自己合成配置、提供设置界面或运行时协调的，按普通插件审
8. 依赖是否指向原作者仓库或已发布的 npm 包；把他人插件重传到自己账号再依赖副本的，不予收录

## 六、提 PR 的实际步骤

本机 `gh` 已登录 `Lphehe`。外部贡献者**无推送权限**，必须 fork。

```bash
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone=false
git clone https://github.com/awesome-dsh-plugin/awesome-dsh-plugin.git repo
cd repo
# 写入 data/plugins/<owner>__<repo>.yml
git checkout -b add-<slug>
git remote add fork https://github.com/Lphehe/awesome-dsh-plugin.git
git push -u fork add-<slug>
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --head Lphehe:add-<slug> --base main --title "..." --body "..."
```

注意：fork 上已有同名分支时推送会被拒，换一个分支名即可（分支名带时间戳最省事）。

## 七、本插件当前状态

- 条目文件：`lphehe-bot__dsh-composer-assist.yml`，分类 `usage`
- PR：[#9243](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/9243)，`OPEN`，`mergeable`，CI 待跑
- 前置条件已核对：仓库创建于 2026-10-22、带 `dsh-plugin` topic、`dsh.bundle.patch` 已声明、npm 已发布、无重复条目
- 描述中 7 项功能声明（每轮预测／建议栏／多候选／输入补全／一键改写／Tab 接受／按会话保留）均已对照源码确认存在

审核由维护者人工进行，通常一天内。
