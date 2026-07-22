import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TEMPLATE1_FIXED_SUFFIX = "老照片动态修复，轻微的胶片闪烁，温暖柔和的夕阳光线，画面有轻微呼吸感，4k，超高清";

const TEMPLATE1_SLOT_DEFINITIONS = [
  {
    slotNo: 1,
    title: "开场建立",
    targetDurationSec: 4,
    shotSize: "远景/全景",
    coreIntent: "建立温馨回忆和时间起点",
    visualFocus: "静态氛围被轻柔唤醒，整体从安静过渡到怀旧",
    camera: "镜头缓慢推进",
    atmosphere: "暖金色、柔光、轻微胶片感",
    keywordHints: ["童年", "幼年", "起点", "开始", "早年", "回忆", "旧照片", "生日", "家", "学校门口"]
  },
  {
    slotNo: 2,
    title: "成长转折",
    targetDurationSec: 5,
    shotSize: "中景",
    coreIntent: "突出成长变化与时间推进",
    visualFocus: "节奏由静转动，画面带出时间流动与成长感",
    camera: "轻微横移后缓慢前推",
    atmosphere: "清透、明亮、岁月流动感",
    keywordHints: ["成长", "长大", "变化", "校园", "毕业", "季节", "时间", "转折", "跑动", "成长系列"]
  },
  {
    slotNo: 3,
    title: "陪伴互动",
    targetDurationSec: 5,
    shotSize: "中近景",
    coreIntent: "表现陪伴、互动和情感靠近",
    visualFocus: "关系感逐渐升温，情绪更亲密柔和",
    camera: "稳定跟随并轻轻靠近",
    atmosphere: "治愈、亲密、柔和包裹感",
    keywordHints: ["家人", "朋友", "陪伴", "互动", "牵手", "拥抱", "聚会", "一起", "分享", "温暖"]
  },
  {
    slotNo: 4,
    title: "收束回望",
    targetDurationSec: 4,
    shotSize: "近景/特写",
    coreIntent: "完成情绪收尾和成长回望",
    visualFocus: "画面逐渐安静，留下回望与告别感",
    camera: "缓慢拉远并轻微停驻",
    atmosphere: "夕阳、回望、留白、感怀",
    keywordHints: ["结束", "回望", "毕业", "告别", "未来", "成年", "回家", "远方", "结尾", "片尾"]
  }
];

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function extractPromptText(sourcePrompt) {
  if (typeof sourcePrompt === "string") {
    return sourcePrompt;
  }

  if (!isPlainObject(sourcePrompt)) {
    return "";
  }

  return normalizeText(
    sourcePrompt.prompt ??
    sourcePrompt.text ??
    sourcePrompt.content ??
    sourcePrompt.description ??
    sourcePrompt.imagePrompt ??
    sourcePrompt.analysis ??
    sourcePrompt.value
  );
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function joinNonEmpty(parts, separator = "，") {
  return ensureArray(parts).map((item) => normalizeText(item)).filter(Boolean).join(separator);
}

function normalizeFromImageCards(imageCards) {
  return ensureArray(imageCards)
    .map((card, index) => {
      if (!isPlainObject(card)) {
        return undefined;
      }

      const sequence = Number(card.sequence ?? card.index ?? card.imageNo ?? index + 1);
      const title = normalizeText(card.title ?? card.name ?? card.imageId ?? `素材${index + 1}`) || `素材${index + 1}`;
      const promptText = joinNonEmpty([
        card.person,
        card.people,
        card.scene,
        card.action,
        card.mood,
        card.style,
        card.slotAffinity,
        joinNonEmpty(card.keywords, " "),
        joinNonEmpty(card.movableElements, " ")
      ], "；");

      return {
        index,
        sequence: Number.isFinite(sequence) ? sequence : index + 1,
        title,
        promptText,
        raw: card
      };
    })
    .filter((item) => item && item.promptText);
}

function normalizeTemplate1Sources(sourcePrompts) {
  return Array.isArray(sourcePrompts)
    ? sourcePrompts.map((sourcePrompt, index) => {
        const promptText = extractPromptText(sourcePrompt);
        const title = isPlainObject(sourcePrompt)
          ? normalizeText(sourcePrompt.title ?? sourcePrompt.name ?? sourcePrompt.imageId ?? `素材${index + 1}`)
          : `素材${index + 1}`;

        return {
          index,
          title,
          promptText,
          raw: sourcePrompt
        };
      }).filter((item) => item.promptText)
    : [];
}

function normalizeTemplate1Inputs(args) {
  const fromSourcePrompts = normalizeTemplate1Sources(args?.sourcePrompts);
  if (fromSourcePrompts.length > 0) {
    return fromSourcePrompts;
  }

  return normalizeFromImageCards(args?.imageCards);
}

function countKeywordHits(text, keywords) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return 0;
  }

  return keywords.reduce((score, keyword) => {
    if (!keyword) {
      return score;
    }

    return normalizedText.includes(keyword) ? score + 1 : score;
  }, 0);
}

function scoreTemplate1PromptForSlot(promptText, slot) {
  const baseScore = countKeywordHits(promptText, slot.keywordHints);
  const text = normalizeText(promptText);
  const weightedBoost = ["温暖", "岁月", "成长", "怀旧", "回忆", "童年", "亲密", "告别", "时间", "校园"].reduce((score, keyword) => {
    return text.includes(keyword) ? score + 0.5 : score;
  }, 0);

  return baseScore * 3 + weightedBoost;
}

function buildTemplate1Prompt(slot, sourcePrompt, fixedSuffix) {
  const sourceText = normalizeText(sourcePrompt?.promptText ?? "");
  const tone = sourceText.includes("毕业") || sourceText.includes("告别")
    ? "情绪渐渐收束，保留回望感"
    : sourceText.includes("陪伴") || sourceText.includes("家人")
      ? "情绪更靠近，氛围更柔和"
      : sourceText.includes("成长") || sourceText.includes("长大")
        ? "节奏由静到动，成长感逐步增强"
        : sourceText.includes("童年") || sourceText.includes("回忆")
          ? "怀旧感慢慢浮现"
          : "情绪保持温暖克制";

  return `${slot.camera}，${slot.visualFocus}，${slot.atmosphere}，${tone}，${fixedSuffix}`;
}

function formatTemplate1Markdown(plan) {
  const lines = [];
  lines.push("# 儿童成长系列分镜提示词表");
  lines.push("");
  lines.push(`- 模版推荐：${plan.templateName}`);
  lines.push(`- 推荐理由：${plan.templateReason}`);
  lines.push(`- 生成规则：${plan.controlRules}`);
  lines.push(`- 固定后缀：${plan.fixedSuffix}`);
  lines.push("");
  lines.push("## 槽位表");
  lines.push("");
  lines.push("| 镜号 | 推荐时长(s) | 槽位核心意图 | 景别 | 匹配素材 | 匹配理由 | 图生视频提示词 |");
  lines.push("|------|------------|--------------|------|----------|----------|----------------|");

  for (const slot of plan.selectedSlots) {
    lines.push(`| ${slot.slotNo} | ${slot.targetDurationSec} | ${slot.coreIntent} | ${slot.shotSize} | ${slot.sourceTitle} | ${slot.matchReason} | ${slot.generatedPrompt} |`);
  }

  if (plan.unselectedPrompts.length > 0) {
    lines.push("");
    lines.push("## 未选素材");
    for (const item of plan.unselectedPrompts) {
      lines.push(`- ${item.title}: ${item.promptText}`);
    }
  }

  return lines.join("\n");
}

function createTemplate1Plan(args) {
  const templateName = normalizeText(args?.templateName) || "儿童成长系列";
  const fixedSuffix = normalizeText(args?.fixedSuffix) || TEMPLATE1_FIXED_SUFFIX;
  const sourcePrompts = normalizeTemplate1Inputs(args);

  if (sourcePrompts.length < 4) {
    throw new Error("至少需要 4 条可用提示词，建议传入完整 7 条素材提示词");
  }

  const matchedSlots = TEMPLATE1_SLOT_DEFINITIONS.map((slot) => {
    const ranked = sourcePrompts
      .map((sourcePrompt) => ({
        sourcePrompt,
        score: scoreTemplate1PromptForSlot(sourcePrompt.promptText, slot)
      }))
      .sort((left, right) => right.score - left.score || left.sourcePrompt.index - right.sourcePrompt.index);

    return {
      slot,
      ranked
    };
  });

  const selectedSourceIndexes = new Set();
  const selectedSlots = [];

  for (const entry of matchedSlots) {
    const best = entry.ranked.find((candidate) => !selectedSourceIndexes.has(candidate.sourcePrompt.index)) ?? entry.ranked[0];
    if (!best) {
      continue;
    }

    selectedSourceIndexes.add(best.sourcePrompt.index);
    const generatedPrompt = buildTemplate1Prompt(entry.slot, best.sourcePrompt, fixedSuffix);
    const matchKeywords = entry.slot.keywordHints.filter((keyword) => best.sourcePrompt.promptText.includes(keyword)).slice(0, 3);

    selectedSlots.push({
      slotNo: entry.slot.slotNo,
      title: entry.slot.title,
      targetDurationSec: entry.slot.targetDurationSec,
      coreIntent: entry.slot.coreIntent,
      shotSize: entry.slot.shotSize,
      visualFocus: entry.slot.visualFocus,
      sourceIndex: best.sourcePrompt.sequence ?? best.sourcePrompt.index + 1,
      sourceTitle: best.sourcePrompt.title,
      sourcePrompt: best.sourcePrompt.promptText,
      matchScore: Number(best.score.toFixed(1)),
      matchReason: matchKeywords.length > 0 ? `命中关键词：${matchKeywords.join("、")}` : "与槽位的成长/情绪节奏最接近",
      generatedPrompt
    });
  }

  selectedSlots.sort((left, right) => left.slotNo - right.slotNo);

  const unselectedPrompts = sourcePrompts.filter((item) => !selectedSourceIndexes.has(item.index)).map((item) => ({
    index: item.sequence ?? item.index + 1,
    title: item.title,
    promptText: item.promptText
  }));

  return {
    templateName,
    templateReason: "素材呈现明显的成长、怀旧、陪伴与时间流动特征，适合用儿童成长系列的四段式情绪槽位来承载。",
    controlRules: "只输出动态增量，不写画面中已有的人或物；提示词固定按【动态控制】+【氛围渲染】+【运镜】+【固定后缀】组织。",
    fixedSuffix,
    sourcePrompts: sourcePrompts.map((item) => ({
      index: item.sequence ?? item.index + 1,
      title: item.title,
      promptText: item.promptText
    })),
    selectedSlots,
    unselectedPrompts
  };
}

function toTemplate1SlotTableJson(plan) {
  return {
    template: {
      templateName: plan.templateName,
      templateReason: plan.templateReason
    },
    controlRules: {
      strategy: "7选4槽位匹配，按情绪节奏组织镜头",
      promptFormula: "动态控制 + 氛围渲染 + 运镜 + 固定后缀",
      fixedSuffix: plan.fixedSuffix,
      constraints: [
        "不直写画面里已有的人或物",
        "只写动态增量",
        "优先匹配儿童成长系列情绪线"
      ]
    },
    slotTable: plan.selectedSlots.map((slot) => ({
      shotNo: slot.slotNo,
      recommendedDurationSec: slot.targetDurationSec,
      slotCoreIntent: slot.coreIntent,
      shotSize: slot.shotSize,
      visualContentFocus: slot.visualFocus,
      imageSourceIndex: slot.sourceIndex,
      imageSourceTitle: slot.sourceTitle,
      matchReason: slot.matchReason,
      imageToVideoPrompt: slot.generatedPrompt
    })),
    unselectedSources: plan.unselectedPrompts,
    sourceSummary: {
      inputCount: plan.sourcePrompts.length,
      selectedCount: plan.selectedSlots.length,
      unselectedCount: plan.unselectedPrompts.length
    }
  };
}

function saveTemplate1Artifacts(jobId, plan, slotTableJson, baseDir) {
  const jobDir = path.join(baseDir, "output", "jobs", jobId);
  ensureDir(jobDir);

  const markdownPath = path.join(jobDir, "template1-slot-prompts.md");
  const jsonPath = path.join(jobDir, "template1-slot-table.json");
  const statusPath = path.join(jobDir, "status.json");

  fs.writeFileSync(markdownPath, formatTemplate1Markdown(plan), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(slotTableJson, null, 2), "utf8");

  return { markdownPath, jsonPath, statusPath };
}

export function runTemplate1SlotPromptChain(args, baseDir) {
  const plan = createTemplate1Plan(args);
  const slotTableJson = toTemplate1SlotTableJson(plan);
  const jobId = crypto.randomUUID();
  const startedAt = nowIso();
  const artifacts = saveTemplate1Artifacts(jobId, plan, slotTableJson, baseDir);

  const job = {
    jobId,
    kind: "template1",
    profile: "template1-slot-prompts",
    status: "completed",
    startedAt,
    completedAt: nowIso(),
    template1Plan: plan,
    slotTableJson,
    artifacts
  };

  fs.writeFileSync(artifacts.statusPath, JSON.stringify(job, null, 2), "utf8");

  return job;
}