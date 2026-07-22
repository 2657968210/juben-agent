# CDR Format — Creative Decision Record

CDRs live in `docs/cdr/` and use sequential numbering: `CDR-0001-slug.md`, `CDR-0002-slug.md`, etc.

Create the `docs/cdr/` directory lazily — only when the first CDR is needed.

## Template

```md
# CDR-NNNN: [Short title of the decision]

**状态：** ✅ 已确认 | 🔶 暂定
**决策日期：** [日期]
**影响范围：** [这个决策影响哪些方面：角色/世界观/视觉/叙事/...]

## 决策

[我们决定了什么，1-3句话]

## 理由

[为什么这样决定]

## 参考

[参考了什么作品/先例/讨论内容]

## 备选方案

[考虑过但未选择的方向，以及为什么不选]
```

That's it. A CDR can be a single paragraph. The value is in recording *that* a creative decision was made, *why*, and *what was rejected*.

## When to create a CDR

All three of these must be true:

1. **方向性** — 这个决策会显著影响后续创作方向（角色走向、视觉风格、叙事结构等）
2. **非显然** — 未来回看时会好奇"为什么这样选"（不是"当然应该这样"的决策）
3. **有取舍** — 存在其他合理选项，我们因为特定原因选了这个

If any of the three is missing, skip it.

### What qualifies

- **风格方向** — "视觉风格定为水墨风而非赛博朋克，因为..."
- **角色核心设定** — "主角的内在矛盾定为'责任vs自由'而非'正义vs邪恶'，因为..."
- **叙事结构** — "采用多视角轮换而非单一主角视角，因为..."
- **结局方向** — "结局定为开放式而非大团圆，因为..."
- **关键排除** — "明确不使用魔法体系，因为..." "明确不做喜剧，因为..."
- **参考作品锚定** — "基调参考《银翼杀手》而非《银翼杀手2049》，因为..."

### What doesn't qualify

- "章节标题叫什么" — 容易改，不影响方向
- "用哪个AI模型生成" — 技术实现，不是创意决策
- "这段对话怎么写" — 执行层面，不是方向层面

## Numbering

Scan `docs/cdr/` for the highest existing number and increment by one.

## Relationship to Creative Bible

CDRs are referenced from `docs/creative-bible.md` in the "Creative Decision Records" table. The creative bible links to CDRs for decisions that need more context than a one-liner.
