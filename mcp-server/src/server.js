import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isInitializeRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  validateDbResult,
  runFastScriptChain,
  runBalancedScriptChain,
  getGenerationStatus,
  getFinalShotlist
} from "./engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..");

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

function toUnicodeEscapedJson(value) {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7F]/g, (ch) => {
    const codePoint = ch.codePointAt(0);
    if (codePoint === undefined) {
      return ch;
    }

    if (codePoint <= 0xffff) {
      return `\\u${codePoint.toString(16).padStart(4, "0")}`;
    }

    const cp = codePoint - 0x10000;
    const high = 0xd800 + (cp >> 10);
    const low = 0xdc00 + (cp & 0x3ff);
    return `\\u${high.toString(16)}\\u${low.toString(16)}`;
  });
}

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

function compactJobResult(job, normalizedFrom) {
  return {
    scriptMarkdown: job?.scriptMarkdown ?? "",
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

function createMcpServer() {
  const server = new Server(
    {
      name: "creative-team-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const tools = [
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

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
        content: [{
          type: "text",
          text: job?.scriptMarkdown ?? ""
        }]
      };
    }

    if (name === "run_balanced_script_chain") {
      const normalized = normalizeDbResult(args);
      const job = runBalancedScriptChain(normalized.dbResult, workspaceRoot);
      return {
        content: [{
          type: "text",
          text: job?.scriptMarkdown ?? ""
        }]
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
  });

  return server;
}

const sessions = new Map();

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function getHeaderValue(req, headerName) {
  const value = req.headers[headerName];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isInitializePayload(body) {
  if (!body) return false;
  if (Array.isArray(body)) {
    return body.some((message) => isInitializeRequest(message));
  }
  return isInitializeRequest(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8").trim();
      if (!rawBody) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function createSessionEntry() {
  let transport;
  const server = createMcpServer();

  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
    },
    onsessionclosed: async (sessionId) => {
      const entry = sessions.get(sessionId);
      if (entry) {
        sessions.delete(sessionId);
        await entry.transport.close();
      }
    }
  });

  transport.onerror = (error) => {
    console.error("MCP transport error:", error);
  };

  await server.connect(transport);
  return { server, transport };
}

const host = process.env.MCP_HOST ?? "0.0.0.0";
const port = Number(process.env.MCP_PORT ?? process.env.PORT ?? 3001);

const httpServer = http.createServer(async (req, res) => {
  try {
    const requestPath = new URL(req.url ?? "/", `http://${host}:${port}`).pathname;

    if (requestPath === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        service: "creative-team-mcp",
        transport: "streamable-http"
      });
      return;
    }

    if (requestPath !== "/mcp") {
      jsonResponse(res, 404, { error: "Not found" });
      return;
    }

    let parsedBody;
    if (req.method === "POST") {
      try {
        parsedBody = await readJsonBody(req);
      } catch {
        jsonResponse(res, 400, {
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error: invalid JSON body"
          },
          id: null
        });
        return;
      }
    }

    const sessionId = getHeaderValue(req, "mcp-session-id");
    let entry = sessionId ? sessions.get(sessionId) : undefined;

    if (!entry) {
      if (req.method === "POST" && isInitializePayload(parsedBody)) {
        entry = await createSessionEntry();
      } else if (sessionId) {
        jsonResponse(res, 404, {
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found"
          },
          id: null
        });
        return;
      } else {
        jsonResponse(res, 400, {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Missing Mcp-Session-Id header"
          },
          id: null
        });
        return;
      }
    }

    await entry.transport.handleRequest(req, res, parsedBody);
  } catch (error) {
    console.error("HTTP server error:", error);
    if (!res.headersSent) {
      jsonResponse(res, 500, {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error"
        },
        id: null
      });
    } else {
      res.end();
    }
  }
});

httpServer.listen(port, host, () => {
  console.log(`creative-team-mcp listening on http://${host}:${port}/mcp`);
});

async function closeAllSessions() {
  const entries = Array.from(sessions.values());
  sessions.clear();
  await Promise.all(entries.map(async (entry) => {
    await entry.transport.close();
  }));
}

async function shutdown() {
  await closeAllSessions();
  httpServer.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
