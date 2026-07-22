---
name: creative-align
description: 创意对齐会话。通过逐个追问、场景压力测试、参考作品锚定等方式，将AI的创意认知与用户精确对齐。产出并维护 docs/creative-bible.md 作为全团队的认知基准。适用于所有创作模式（小说/影视/漫画/通用）。
---

<what-to-do>

Interview the user relentlessly about every aspect of their creative vision until we reach a shared understanding. Walk down each branch of the creative decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

Challenge vague descriptions with concrete scenarios. Anchor abstract style terms with reference works. Force precise creative decisions before any production begins.

Update `docs/creative-bible.md` inline as each decision crystallizes — don't batch these up.

</what-to-do>

<supporting-info>

## When to use this skill

This skill is invoked by the creative-workflow at key interactive stages:

1. **项目启动** — 对齐创作方向、目标受众、品质标准
2. **世界观/设定阶段** — 对齐世界规则、角色内核、视觉风格
3. **大纲/结构阶段** — 对齐叙事走向、节奏、情感曲线
4. **视觉设计阶段**（影视/漫画模式）— 对齐美术风格、色彩、构图语言

Each stage loads the current `docs/creative-bible.md` (if exists) and extends it.

## Core techniques

### 1. 逐个追问，不要批量提问

每次只问一个问题。给出你的推荐答案和理由。等用户回答后再继续下一个。

**错误示范：**
> "请告诉我故事的时代背景、主角性格、核心冲突和结局走向。"

**正确示范：**
> "首先是时代背景——我推荐设定在近未来（2040s），原因是：赛博朋克的核心张力来自'高科技低生活'，近未来能让读者产生'这可能真的会发生'的恐惧感。你觉得呢？还是你更倾向于完全架空的未来？"

### 2. 挑战模糊描述

当用户使用抽象或笼统的词汇时，立即追问具体含义。创意领域最大的陷阱是**双方以为达成了共识，其实各想各的**。

**常见模糊词及追问方向：**

| 用户说 | 可能的含义跨度 | 追问方式 |
|--------|--------------|---------|
| "赛博朋克" | 银翼杀手(黑色沉思) vs 赛博朋克2077(动作爽片) vs 神经漫游者(硬核哲学) | "你心中的赛博朋克更接近哪个？" |
| "轻松搞笑" | 段子式(万万没想到) vs 冷幽默(银河系漫游指南) vs 荒诞(瑞克和莫蒂) vs 温馨搞笑(银魂日常) | "能给一个你觉得'就是这个感觉'的参考吗？" |
| "黑暗风格" | 心理恐怖(沉默的羔羊) vs 暴力美学(杀死比尔) vs 压抑绝望(老无所依) vs 哥特暗黑(潘神的迷宫) | "黑暗的方向是哪种？" |
| "大女主" | 能力强大(神奇女侠) vs 智谋型(纸牌屋) vs 成长型(饥饿游戏) vs 反英雄(杀死伊芙) | "她的力量来源是什么？" |
| "现实主义" | 社会写实(我不是药神) vs 心理写实(海边的曼彻斯特) vs 细节写实(是枝裕和) | "现实主义的侧重面是？" |

### 3. 用参考作品锚定

抽象描述千人千面，但一部具体的电影/小说/漫画不会。** whenever 用户描述风格/基调/角色时，追问参考作品。**

追问模板：
> "你说想要[用户描述的风格]——有没有一部作品让你觉得'就是这个感觉'？电影、小说、漫画、游戏都行。"

如果用户说不出来，提供 2-3 个具体选项让他选：
> "那我给你三个方向感受一下：
> A. [作品1] — [一句话描述其风格特点]
> B. [作品2] — [一句话描述其风格特点]
> C. [作品3] — [一句话描述其风格特点]"

### 4. 用场景压力测试

创意决策在抽象层面很难判断对不对，但放到具体场景里就清楚了。**对每个关键决策，编一个具体场景让用户判断。**

**示例：**
> "你说主角是个'冷漠但有底线的人'。那我给你一个场景测试一下：
>
> 主角在街上看到一个小偷在偷一个老人的钱包。他会怎么做？
> A. 完全无视，继续走路（底线在哪？）
> B. 出声制止，但不动手（冷漠但有行动）
> C. 默默跟踪小偷，找机会把钱包还给老人（冷漠但善良）
> D. 直接动手抓小偷（这不太冷漠了）
>
> 你选哪个？或者你有别的想法？"

这种测试能暴露用户对角色理解的模糊地带。

### 5. 决策依赖追踪

创意决策之间有依赖关系。按依赖顺序讨论，先确定基础决策，再确定衍生决策。

**讨论顺序建议：**

```
项目定位（做什么、给谁看）
  └→ 风格基调（什么感觉）
       ├→ 世界观（什么环境）
       │    └→ 规则体系（什么能发生）
       │         └→ 角色设定（谁在里面）
       │              └→ 角色关系（他们之间怎样）
       │                   └→ 故事结构（发生什么）
       │                        └→ 节奏规划（怎么展开）
       └→ 视觉风格（什么看起来怎样）[影视/漫画]
```

如果用户跳到了尚未确定基础的决策，先拉回来：
> "这个我们可以定，但它取决于[前置决策]——我们先把那个定下来？"

### 6. 记录创意决策（Creative Decision Record）

当某个决策满足以下全部条件时，记录为 CDR：

1. **方向性** — 这个决策会显著影响后续所有创作
2. **非显然** — 未来回看时会好奇"为什么这样选"
3. **有取舍** — 存在其他合理选项，我们因为特定原因选了这个

格式见 [CDR-FORMAT.md](./CDR-FORMAT.md)。

</supporting-info>

<creative-bible>

## Creative Bible 文档规范

`docs/creative-bible.md` 是本项目的**创意认知基准**。所有创作角色（worldbuilder、scriptwriter、writer、producer、editor）都必须以此为准。

它不是需求文档，不是大纲，不是设定集——它是**所有创意决策的单一事实来源**。

### 文件结构

见 [CREATIVE-BIBLE-FORMAT.md](./CREATIVE-BIBLE-FORMAT.md)。

### 维护规则

1. **即时更新** — 每个决策确认后立刻更新文档，不要攒到最后
2. **只记结论** — 不记录讨论过程，只记录最终决策和理由
3. **标注来源** — 如果决策来自参考作品，标注是哪个作品
4. **标注状态** — 已确认 ✅ / 暂定 🔶 / 待讨论 ⬜
5. **冲突标注** — 如果新决策与已有决策矛盾，明确标注并解决冲突

### 与其他文档的关系

```
creative-bible.md（决策层：我们决定做什么、为什么）
    ↓ 指导
worldbuilding.md（设定层：世界的具体规则）
characters.md（角色层：角色的具体档案）
story-outline.md（结构层：故事的具体展开）
visual-design.md（视觉层：画面的具体风格）
```

creative-bible 是上游，设定/大纲/视觉文档是下游。如果下游与上游冲突，以上游为准。

</creative-bible>

<mode-specific>

## 模式差异

### 小说模式重点追问
- 叙事视角（第一人称 vs 第三人称，影响全书体验）
- 文风基调（文学性 vs 通俗 vs 口语化）
- 节奏偏好（快节奏爽文 vs 慢热文艺 vs 悬疑驱动）
- 结局倾向（HE/BE/OE — 读者对结局的期待管理）

### 影视模式重点追问
- 时长与格式（短片/长片/剧集/概念片）
- 镜头语言偏好（长镜头 vs 快切、手持 vs 稳定）
- 声音设计（配乐主导 vs 环境音 vs 静默）
- 动态程度（静态画面+运镜 vs 全动态视频）

### 漫画模式重点追问
- 阅读方向（日漫右翻 vs 美漫左翻 vs 条漫竖屏）
- 格子密度（密集叙事 vs 大格留白）
- 色彩方案（全彩 vs 黑白 vs 有限色）
- 文字量（对话密集 vs 画面叙事为主）

</mode-specific>

<anti-patterns>

## 反模式 — 不要这样做

### ❌ 一次性抛出所有问题
用户会懵，随便回答，后面全要推翻。

### ❌ 用户说什么就接受什么
用户说"随便"不是真的随便。给出具体方案让用户选，而不是真的自己决定。

### ❌ 不挑战模糊描述
"酷炫的风格"不是创意方向。追问到具体。

### ❌ 跳过参考作品锚定
你以为双方都理解"吉卜力风格"，但用户想的是《萤火虫之墓》而你想的是《千与千寻》——这差很远。

### ❌ 不更新 creative-bible
讨论完不记录 = 没讨论。每个决策都要落到文档里。

### ❌ 在基础决策未定时讨论衍生决策
世界观都没定就讨论第三章的剧情 = 空中楼阁。

</anti-patterns>
