# Pi Agent & Chain 配置说明

本文档描述 `.pi/agent/` 目录下的工作流系统：创作生产（creative-team）。

---

## 📁 目录结构

```
.pi/agent/
├── agents/                      # Agent 配置
│   └── creative/               # 创作团队
│       ├── creative-director.md
│       ├── creative-editor.md
│       ├── creative-mystery-designer.md
│       ├── creative-producer.md
│       ├── creative-quality-inspector.md
│       ├── creative-script-expert.md
│       ├── creative-scriptwriter.md
│       ├── creative-worldbuilder.md
│       └── creative-writer.md
├── chains/                      # Chain 配置
│   ├── creative-stage-production.chain.json   # 创作生产链（8步完整质检闭环）
│   ├── creative-fast-script.chain.json         # 图片转短片剧本极速链（3步）
│   ├── creative-balanced-script.chain.json     # 图片转短片剧本平衡链（5步）
│   └── creative-full-work-finalization.chain.json  # 全书终检链（5步，强制运行）
├── skills/                      # Skill 配置
│   ├── creative-align/                        # 创意对齐
│   └── creative-workflow/                     # 创作工作流
└── README.md                    # 本文件
```

---

## 🎨 工作流：creative-team（创作生产）

**触发词**："写小说"、"拍短片"、"画漫画"、"创作故事"

支持模式：novel（小说）、film（影视）、comic（漫画）、generic（通用）

### Agent 角色

| Agent | 职责 | Package | 适用模式 |
|-------|------|---------|---------|
| creative-director | 创意总监，全局把控 | creative-team | 全部 |
| creative-worldbuilder | 世界观/角色/视觉设定 | creative-team | 全部 |
| creative-scriptwriter | 编剧/大纲/分镜 | creative-team | 全部 |
| creative-writer | 文本创作 | creative-team | novel |
| creative-producer | 视觉生产（生图/视频） | creative-team | film, comic |
| creative-editor | 内容审查（一致性/质量） | creative-team | 全部 |
| **creative-script-expert** | **剧本专家（对白/角色/逻辑审查）** | **creative-team** | **全部** |
| creative-quality-inspector | 品质定级与发布建议 | creative-team | 全部 |
| creative-mystery-designer | 推理小说专家（诡计/线索/嫌疑人） | creative-team | novel（推理子模式） |

### Chain 配置

| Chain | 用途 | 命令示例 |
|-------|------|---------|
| creative-stage-production.chain.json | 单阶段创作：8步完整质检闭环（创作→editor一审→script-expert对白审查→修改→editor二审→修改→editor终审→quality-inspector阶段定级） | `/run-chain creative.stage-production` |
| creative-full-work-finalization.chain.json | 全书终检链：5步强制运行（editor全书审校→script-expert全书对白审查→writer修复→editor复审→quality-inspector最终定级） | `/run-chain creative.full-work-finalization` |
| creative-fast-script.chain.json | 数据库结果转短片剧本极速版：3步（director定方向→scriptwriter出完整分镜稿→script-expert一次审查并同步优化） | `/run-chain creative.fast-script` |
| creative-balanced-script.chain.json | 数据库结果转短片剧本平衡版：5步（director→worldbuilder→scriptwriter→script-expert→editor终审） | `/run-chain creative.balanced-script` |

### 关键文档

- `docs/creative-bible.md` — 创意认知基准（所有决策的单一事实来源）
- `docs/cdr/` — Creative Decision Records（创意决策记录）
- `docs/character-profiles/` — 人物小传（每个有姓名角色一份，含心理弧线、知情范围、对白特征）
- `docs/worldbuilding.md` — 世界观设定
- `docs/characters.md` — 角色档案
- `docs/story-outline.md` / `docs/shot-list.md` / `docs/comic-script.md` — 结构文档（按模式）
- `chapters/` — 章节内容（novel）
- `assets/` — 视觉资产（film, comic）
- `reports/` — 审查报告、品质评估报告、终检报告

### 子模式：推理小说（Mystery）

**触发词**："推理小说"、"侦探"、"密室"、"阿加莎风格"、"本格推理"

推理小说在普通小说流程基础上，增加**阶段1.5：谜题设计**：

```
阶段1：设定 → 阶段1.5：谜题设计 → 阶段2：大纲 → 阶段3：创作
```

**专属 Agent**：
- **creative-mystery-designer** — 推理小说专家
  - 设计核心诡计（密室/不可能犯罪）
  - 构建嫌疑人矩阵（动机/机会/不在场证明/红鲱鱼）
  - 规划线索地图（真线索 vs 误导）
  - 设计推理路径（侦探+读者双路径）

**专属产出**：
- `docs/mystery-core.md` — 谜题核心（诡计+解答+公平性声明）
- `docs/suspect-matrix.md` — 嫌疑人矩阵（5人：头号嫌疑/真凶/意外人选/清白）
- `docs/clue-map.md` — 线索地图（真线索C-01 + 红鲱鱼R-01 + 埋设计划）
- `docs/deduction-path.md` — 推理路径（章节节点+误导高潮+解答）

**审查特殊维度**：
- 线索公平性（Fair Play）
- 红鲱鱼效果
- 推理一致性
- 公平性红线（无隐藏线索/凶手前文未出现）

### Skill 依赖

- **creative-workflow** — 主工作流编排
- **creative-align** — 创意对齐（创作领域）

---

## ⚡ 快速使用

### 创作场景

```bash
# 小说创作
加载 creative-workflow 技能
说："写一部赛博朋克风格的长篇小说"

# 影视创作（需配备生图/生视频模型）
加载 creative-workflow 技能
说："拍一个3分钟的科幻短片"

# 漫画创作
加载 creative-workflow 技能
说："创作一个日漫风格的条漫"

# 直接调用 chain（不推荐，缺少交互确认）
/run-chain creative.stage-production
```

### 数据库结果转短片剧本（客户场景）

```bash
# 1) 加载主技能
/load-skill creative-workflow

# 2) 输入外部数据库结构化结果 + 指定精简流程
拍一个1分钟短片，film模式。
数据库结果：
【外部图片分析结果（数据库）】
素材ID：img_batch_001
批次ID：batch_20260710
人物：2人，年轻情侣，关系亲密，情绪轻松
场景：郊外草坡，傍晚，暖金色夕阳
动作：并肩而坐，递花，微笑对视
氛围：治愈、浪漫
风格参考：写实电影感，暖调柔光

要求：
1. 只输出短片分镜剧本，不生成视觉素材
2. 压缩流程，跳过多轮复审和品质定级
3. 输出镜号、画面、对白、时长

# 3) 可直接跑精简 chain
/run-chain creative.fast-script
# 或
/run-chain creative.balanced-script
```

> 说明：本 agent 不负责图片识别，默认读取外部系统产出的结构化数据库结果后进入剧本链路；若需求仅为剧本初稿，可跳过 producer 和 quality-inspector。

---

## 🛠️ 扩展开发

### 添加新 Agent

1. 在 `agents/<package>/` 目录下创建 `<agent-name>.md`
2. 遵循 frontmatter 格式：`name`, `description`, `package`, `tools`
3. 引用时使用 `<package>.<agent-name>`

### 添加新 Chain

1. 在 `chains/` 目录下创建 `<name>.chain.json` 或 `<name>.chain.md`
2. 定义 `name`, `package`, `description`, `chain` 步骤
3. 每个步骤指定 `agent`（格式：`package.agent-name`）

### 添加新 Skill

1. 在 `skills/<skill-name>/` 目录下创建 `SKILL.md`
2. 可选添加配套文档（如 `*-FORMAT.md`）
3. 由主agent在适当时机加载执行

---

## 🐛 故障排查

### Agent 不识别

检查 `package` 声明是否正确，以及文件路径是否符合 `agents/<package>/<name>.md`。

### Chain 执行失败

检查每个步骤的 `agent` 引用格式是否为 `package.agent-name`。

### Skill 不生效

确认主agent正确加载了 skill（通过触发词或 `/load-skill` 命令）。

---

## 📝 版本历史

- **2026-06-23** — 新增 creative-team
- **2026-07-10** — 新增数据库结果转短片剧本精简链（3步极速版 / 5步平衡版）

---

如有问题，检查各工作流的 SKILL.md 获取详细使用说明。
