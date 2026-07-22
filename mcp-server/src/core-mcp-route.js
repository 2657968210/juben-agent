import {
  validateDbResult,
  runFastScriptChain,
  runBalancedScriptChain,
  getGenerationStatus,
  getFinalShotlist
} from "./engine.js";

export const CORE_ROUTE_PATH = "/mcp";

const REQUIRED_DB_FIELDS = [
  "assetId",
  "batchId",
  "characters",
  "scene",
  "actions",
  "mood",
  "styleRef",
  "targetDurationSec"
];

const DB_RESULT_WRAPPER_KEYS = [
  "dbResult",
  "payload",
  "data",
  "body",
  "json",
  "result",
  "arguments",
  "params",
  "input",
  "fields",
  "content"
];

const IMAGE_ANALYSIS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    dbResult: {
      type: "object",
      properties: {
        images: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true
};

export const CORE_TOOLS = [
  {
    name: "validate_input_db_result",
    description: "Validate external DB structured analysis result for film-script-only workflow.",
    inputSchema: IMAGE_ANALYSIS_INPUT_SCHEMA
  },
  {
    name: "run_fast_script_chain",
    description: "Run 3-step fast-script chain using external DB result.",
    inputSchema: IMAGE_ANALYSIS_INPUT_SCHEMA
  },
  {
    name: "run_balanced_script_chain",
    description: "Run 5-step balanced-script chain using external DB result.",
    inputSchema: IMAGE_ANALYSIS_INPUT_SCHEMA
  },
  {
    name: "get_generation_status",
    description: "Get generation status by jobId.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" }
      },
      required: ["jobId"]
    }
  },
  {
    name: "get_final_shotlist",
    description: "Get final shot list by jobId.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" }
      },
      required: ["jobId"]
    }
  }
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasRequiredDbFields(candidate) {
  if (!isPlainObject(candidate)) {
    return false;
  }

  return REQUIRED_DB_FIELDS.some((field) => candidate[field] !== undefined);
}

function tryParseJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractDbResult(value, depth = 0, trail = []) {
  if (depth > 4) {
    return { candidate: undefined, trail };
  }

  const parsedValue = tryParseJson(value);
  if (hasRequiredDbFields(parsedValue)) {
    return { candidate: parsedValue, trail };
  }

  if (Array.isArray(parsedValue)) {
    for (let index = 0; index < parsedValue.length; index += 1) {
      const child = extractDbResult(parsedValue[index], depth + 1, trail.concat(`[${index}]`));
      if (child.candidate) {
        return child;
      }
    }
    return { candidate: undefined, trail };
  }

  if (!isPlainObject(parsedValue)) {
    return { candidate: undefined, trail };
  }

  for (const key of DB_RESULT_WRAPPER_KEYS) {
    if (parsedValue[key] !== undefined) {
      const child = extractDbResult(parsedValue[key], depth + 1, trail.concat(key));
      if (child.candidate) {
        return child;
      }
    }
  }

  for (const key of Object.keys(parsedValue)) {
    const child = extractDbResult(parsedValue[key], depth + 1, trail.concat(key));
    if (child.candidate) {
      return child;
    }
  }

  return { candidate: undefined, trail };
}

function normalizeDbResult(args) {
  if (Array.isArray(args?.dbResult?.images)) {
    return {
      dbResult: args.dbResult,
      source: "dbResult.images"
    };
  }

  const direct = extractDbResult(args?.dbResult);
  if (direct.candidate) {
    return {
      dbResult: direct.candidate,
      source: direct.trail.length ? `dbResult.${direct.trail.join(".")}` : "dbResult"
    };
  }

  const fallback = extractDbResult(args);
  if (fallback.candidate) {
    return {
      dbResult: fallback.candidate,
      source: fallback.trail.length ? fallback.trail.join(".") : "arguments"
    };
  }

  return {
    dbResult: isPlainObject(args?.dbResult) ? args.dbResult : {},
    source: "missing"
  };
}

function compactValidationResult(result, normalizedFrom) {
  return {
    ok: Boolean(result?.ok),
    missing: Array.isArray(result?.missing) ? result.missing : [],
    normalizedFrom
  };
}

function compactStatusResult(status) {
  return {
    found: Boolean(status?.found),
    jobId: status?.jobId,
    status: status?.status,
    profile: status?.profile,
    artifacts: status?.artifacts
  };
}

function compactShotlistResult(shotlist) {
  return {
    found: Boolean(shotlist?.found),
    jobId: shotlist?.jobId,
    profile: shotlist?.profile,
    shotList: shotlist?.shotList,
    shotlistPath: shotlist?.shotlistPath
  };
}

export async function handleCoreTool(name, args, context) {
  const { workspaceRoot, toUnicodeEscapedJson } = context;

  if (name === "validate_input_db_result") {
    const normalized = normalizeDbResult(args);
    const result = validateDbResult(normalized.dbResult);
    return {
      content: [{
        type: "text",
        text: toUnicodeEscapedJson(compactValidationResult(result, normalized.source))
      }]
    };
  }

  if (name === "run_fast_script_chain") {
    const normalized = normalizeDbResult(args);
    const job = runFastScriptChain(normalized.dbResult, workspaceRoot);
    return {
      content: [{ type: "text", text: job?.scriptMarkdown ?? "" }]
    };
  }

  if (name === "run_balanced_script_chain") {
    const normalized = normalizeDbResult(args);
    const job = runBalancedScriptChain(normalized.dbResult, workspaceRoot);
    return {
      content: [{ type: "text", text: job?.scriptMarkdown ?? "" }]
    };
  }

  if (name === "get_generation_status") {
    const status = getGenerationStatus(args?.jobId ?? "");
    return {
      content: [{ type: "text", text: toUnicodeEscapedJson(compactStatusResult(status)) }]
    };
  }

  if (name === "get_final_shotlist") {
    const shotlist = getFinalShotlist(args?.jobId ?? "");
    return {
      content: [{ type: "text", text: toUnicodeEscapedJson(compactShotlistResult(shotlist)) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}
