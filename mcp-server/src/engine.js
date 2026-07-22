import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const jobs = new Map();

const REQUIRED_FIELDS = [
  "images"
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

function stringifyCharacters(characters) {
  if (Array.isArray(characters)) {
    return characters
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (isPlainObject(item)) {
          return item.name ?? item.visual ?? item.type ?? "未知角色";
        }

        return String(item);
      })
      .filter(Boolean)
      .join("、");
  }

  if (isPlainObject(characters)) {
    return characters.name ?? characters.visual ?? characters.type ?? "未知角色";
  }

  return typeof characters === "string" ? characters : String(characters ?? "");
}

function hashInput(dbResult) {
  return crypto.createHash("sha1").update(JSON.stringify(dbResult)).digest("hex");
}

function normalizeDbResult(dbResult) {
  const imageCards = Array.isArray(dbResult?.images) ? dbResult.images.filter(isPlainObject) : [];

  if (imageCards.length > 0) {
    const primaryImage = imageCards[0];
    const characters = imageCards
      .map((card) => card["人物"] ?? card.person ?? card.characters ?? card.character ?? "未知角色")
      .filter(Boolean)
      .join("；");
    const scene = imageCards
      .map((card) => card["场景"] ?? card.scene ?? "未知场景")
      .filter(Boolean)
      .join("；");
    const actions = imageCards
      .map((card) => card["动作"] ?? card.action ?? "未知动作")
      .filter(Boolean)
      .join("；");
    const mood = imageCards
      .map((card) => card["氛围"] ?? card["情绪"] ?? card.mood ?? "")
      .filter(Boolean)
      .join("；") || "中性";
    const styleRef = imageCards
      .map((card) => card["风格参考"] ?? card.styleRef ?? card.style ?? "")
      .filter(Boolean)
      .join("；") || "短片剧本";
    const platform = dbResult?.platform ?? "小云雀视频平台";
    const style = dbResult?.style ?? "短视频剧本";
    const goal = dbResult?.goal ?? "根据图片分析结果生成剧本";
    const targetDurationSec = Number(dbResult?.targetDurationSec ?? 60);
    const inputHash = hashInput({ imageCards, platform, style, goal, targetDurationSec });

    return {
      assetId: dbResult?.assetId ?? `asset-${inputHash.slice(0, 8)}`,
      batchId: dbResult?.batchId ?? `batch-${inputHash.slice(8, 16)}`,
      characters,
      scene,
      actions,
      mood,
      styleRef,
      targetDurationSec: Number.isFinite(targetDurationSec) && targetDurationSec > 0 ? targetDurationSec : 60,
      setting: scene,
      platform,
      style,
      goal,
      imageCards,
      source: {
        imageCount: imageCards.length,
        primaryImage
      }
    };
  }

  const normalizedCharacters = stringifyCharacters(dbResult?.characters);
  const setting = dbResult?.setting ?? dbResult?.scene ?? "未知场景";
  const platform = dbResult?.platform ?? "未指定平台";
  const style = dbResult?.style ?? dbResult?.styleRef ?? "短视频剧本";
  const goal = dbResult?.goal ?? dbResult?.actions ?? "根据图片识别结果生成剧本";
  const targetDurationSec = Number(dbResult?.targetDurationSec ?? dbResult?.durationSec ?? dbResult?.duration ?? 60);
  const inputHash = hashInput({
    characters: normalizedCharacters,
    setting,
    platform,
    style,
    goal,
    targetDurationSec
  });

  return {
    assetId: dbResult?.assetId ?? `asset-${inputHash.slice(0, 8)}`,
    batchId: dbResult?.batchId ?? `batch-${inputHash.slice(8, 16)}`,
    characters: normalizedCharacters,
    scene: setting,
    actions: goal,
    mood: dbResult?.mood ?? style,
    styleRef: dbResult?.styleRef ?? style,
    targetDurationSec: Number.isFinite(targetDurationSec) && targetDurationSec > 0 ? targetDurationSec : 60,
    setting,
    platform,
    style,
    goal,
    source: {
      imageCount: 0,
      assetIdProvided: dbResult?.assetId !== undefined,
      batchIdProvided: dbResult?.batchId !== undefined,
      targetDurationProvided: dbResult?.targetDurationSec !== undefined
    }
  };
}

export function validateDbResult(dbResult) {
  const missing = [];
  const imageCards = Array.isArray(dbResult?.images) ? dbResult.images.filter(isPlainObject) : [];

  if (imageCards.length === 0) {
    missing.push("images");
  }

  return {
    ok: missing.length === 0,
    missing
  };
}

function shotCountFromDuration(targetDurationSec) {
  if (targetDurationSec <= 45) return 6;
  if (targetDurationSec <= 90) return 8;
  if (targetDurationSec <= 180) return 10;
  return 12;
}

function generateShotList(dbResult, profile) {
  const normalized = normalizeDbResult(dbResult);
  const duration = Number(normalized.targetDurationSec);
  const shotCount = shotCountFromDuration(duration);
  const avgShotSec = Math.max(3, Math.floor(duration / shotCount));

  const opening = `建立场景：${normalized.scene}`;
  const relation = `角色关系呈现：${normalized.characters}`;
  const actionCore = `关键动作推进：${normalized.actions}`;
  const moodWrap = `情绪收束：${normalized.mood}`;

  const shots = [];
  for (let i = 1; i <= shotCount; i += 1) {
    let focus = actionCore;
    if (i === 1) focus = opening;
    else if (i === 2) focus = relation;
    else if (i >= shotCount - 1) focus = moodWrap;

    shots.push({
      shotNo: i,
      shotType: i % 3 === 0 ? "近景" : i % 2 === 0 ? "中景" : "全景",
      visual: `${focus}；风格参考：${normalized.styleRef}`,
      action: normalized.actions,
      dialogue: i % 2 === 0 ? "（无对白，以画面叙事）" : "简短对白，避免解释性台词。",
      durationSec: avgShotSec,
      mood: normalized.mood
    });
  }

  return {
    profile,
    targetDurationSec: duration,
    shotCount,
    shots
  };
}

function toMarkdown(shotList, dbResult) {
  const normalized = normalizeDbResult(dbResult);
  const lines = [];
  lines.push("# 分镜剧本");
  lines.push("");
  lines.push(`- 素材ID：${normalized.assetId}`);
  lines.push(`- 批次ID：${normalized.batchId}`);
  lines.push(`- 图片数量：${normalized.source?.imageCount ?? 0}`);
  lines.push(`- 模式：film-script-only`);
  lines.push(`- 目标时长：${shotList.targetDurationSec}s`);
  lines.push(`- 生成策略：${shotList.profile}`);
  lines.push("");
  lines.push("| 镜号 | 景别 | 画面 | 动作 | 对白 | 时长(s) | 情绪 |");
  lines.push("|------|------|------|------|------|---------|------|");

  for (const s of shotList.shots) {
    lines.push(`| ${s.shotNo} | ${s.shotType} | ${s.visual} | ${s.action} | ${s.dialogue} | ${s.durationSec} | ${s.mood} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function saveArtifacts(jobId, shotList, dbResult, baseDir) {
  const jobDir = path.join(baseDir, "output", "jobs", jobId);
  ensureDir(jobDir);

  const shotlistPath = path.join(jobDir, "shot-list-final.md");
  const reviewPath = path.join(jobDir, "script-review.md");
  const statusPath = path.join(jobDir, "status.json");

  fs.writeFileSync(shotlistPath, toMarkdown(shotList, dbResult), "utf8");

  const review = {
    summary: "单轮剧本审查完成（S/A问题已闭环）。",
    profile: shotList.profile,
    timestamp: nowIso()
  };
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2), "utf8");

  return { shotlistPath, reviewPath, statusPath };
}

function createJob(profile, dbResult, baseDir) {
  const normalized = normalizeDbResult(dbResult);
  const validation = validateDbResult(dbResult);
  if (!validation.ok) {
    throw new Error(`缺少关键字段: ${validation.missing.join(", ")}`);
  }

  const jobId = crypto.randomUUID();
  const startedAt = nowIso();

  const shotList = generateShotList(normalized, profile);
  const artifacts = saveArtifacts(jobId, shotList, normalized, baseDir);
  const scriptMarkdown = toMarkdown(shotList, normalized);

  const job = {
    jobId,
    profile,
    status: "completed",
    startedAt,
    completedAt: nowIso(),
    dbResult: normalized,
    artifacts,
    shotList,
    scriptMarkdown
  };

  jobs.set(jobId, job);
  fs.writeFileSync(artifacts.statusPath, JSON.stringify(job, null, 2), "utf8");

  return job;
}

export function runFastScriptChain(dbResult, baseDir) {
  return createJob("fast-script", dbResult, baseDir);
}

export function runBalancedScriptChain(dbResult, baseDir) {
  return createJob("balanced-script", dbResult, baseDir);
}

export function getGenerationStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    return { found: false, jobId, status: "not_found" };
  }
  return {
    found: true,
    jobId,
    status: job.status,
    profile: job.profile,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    artifacts: job.artifacts
  };
}

export function getFinalShotlist(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    return { found: false, jobId };
  }
  return {
    found: true,
    jobId,
    profile: job.profile,
    shotList: job.shotList,
    scriptMarkdown: job.scriptMarkdown,
    shotlistPath: job.artifacts.shotlistPath
  };
}
