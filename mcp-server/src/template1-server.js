import http from "node:http";
import crypto from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isInitializeRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { runTemplate1SlotPromptChain } from "./template1-engine.js";

const TEMPLATE1_SLOT_TABLE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    templateName: {
      type: "string",
      description: "模板名称，默认儿童成长系列"
    },
    fixedSuffix: {
      type: "string",
      description: "图生视频固定后缀，可选"
    },
    sourcePrompts: {
      type: "array",
      description: "7条图片分析提示词，可为字符串或对象",
      minItems: 4,
      maxItems: 7,
      items: {
        oneOf: [
          { type: "string" },
          {
            type: "object",
            properties: {
              title: { type: "string" },
              prompt: { type: "string" },
              text: { type: "string" },
              content: { type: "string" },
              description: { type: "string" }
            },
            additionalProperties: true
          }
        ]
      }
    },
    imageCards: {
      type: "array",
      description: "结构化图片分析卡，推荐7条",
      minItems: 4,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: true
      }
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

function createTemplate1McpServer(workspaceRoot) {
  const server = new Server(
    {
      name: "creative-team-template1-mcp",
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
      name: "generate_template1_slot_table_json",
      description: "Analyze seven image analysis cards and output the childhood-growth slot-table JSON.",
      inputSchema: TEMPLATE1_SLOT_TABLE_INPUT_SCHEMA
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "generate_template1_slot_table_json") {
      const job = runTemplate1SlotPromptChain(args ?? {}, workspaceRoot);
      return {
        content: [{
          type: "text",
          text: toUnicodeEscapedJson({
            ok: true,
            jobId: job.jobId,
            profile: job.profile,
            output: job.slotTableJson,
            artifacts: job.artifacts
          })
        }]
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

const workspaceRoot = process.cwd();

async function createSessionEntry() {
  let transport;
  const server = createTemplate1McpServer(workspaceRoot);

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
    console.error("Template1 MCP transport error:", error);
  };

  await server.connect(transport);
  return { server, transport };
}

const host = process.env.TEMPLATE1_MCP_HOST ?? process.env.MCP_HOST ?? "0.0.0.0";
const port = Number(process.env.TEMPLATE1_MCP_PORT ?? 3002);
const routePath = "/mcp";

const httpServer = http.createServer(async (req, res) => {
  try {
    const requestPath = new URL(req.url ?? "/", `http://${host}:${port}`).pathname;

    if (requestPath === "/health") {
      jsonResponse(res, 200, {
        ok: true,
        service: "creative-team-template1-mcp",
        transport: "streamable-http"
      });
      return;
    }

    if (requestPath !== routePath) {
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
    console.error("Template1 HTTP server error:", error);
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
  console.log(`creative-team-template1-mcp listening on http://${host}:${port}${routePath}`);
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