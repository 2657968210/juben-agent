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
  CORE_ROUTE_PATH,
  CORE_TOOLS,
  handleCoreTool
} from "./core-mcp-route.js";
import {
  TEMPLATE1_ROUTE_PATH,
  TEMPLATE1_TOOLS,
  handleTemplate1Tool
} from "./template1-mcp-route.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..");

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

const ROUTE_DEFINITIONS = {
  [CORE_ROUTE_PATH]: {
    serverName: "creative-team-mcp",
    tools: CORE_TOOLS,
    handleTool: (name, args) => handleCoreTool(name, args, {
      workspaceRoot,
      toUnicodeEscapedJson
    })
  },
  [TEMPLATE1_ROUTE_PATH]: {
    serverName: "creative-team-template1-mcp",
    tools: TEMPLATE1_TOOLS,
    handleTool: (name, args) => handleTemplate1Tool(name, args, {
      workspaceRoot,
      toUnicodeEscapedJson
    })
  }
};

function createMcpServer(routeDefinition) {
  const server = new Server(
    {
      name: routeDefinition.serverName,
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: routeDefinition.tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return routeDefinition.handleTool(name, args);
  });

  return server;
}

const sessionsByPath = new Map(Object.keys(ROUTE_DEFINITIONS).map((routePath) => [routePath, new Map()]));

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

async function createSessionEntry(routePath) {
  let transport;
  const routeDefinition = ROUTE_DEFINITIONS[routePath];
  if (!routeDefinition) {
    throw new Error(`Unknown MCP route: ${routePath}`);
  }

  const server = createMcpServer(routeDefinition);
  const sessions = sessionsByPath.get(routePath);

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

    const routeDefinition = ROUTE_DEFINITIONS[requestPath];
    if (!routeDefinition) {
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

    const sessions = sessionsByPath.get(requestPath);
    const sessionId = getHeaderValue(req, "mcp-session-id");
    let entry = sessionId ? sessions.get(sessionId) : undefined;

    if (!entry) {
      if (req.method === "POST" && isInitializePayload(parsedBody)) {
        entry = await createSessionEntry(requestPath);
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
  console.log(`creative-team-mcp listening on http://${host}:${port}/mcp and http://${host}:${port}/mcp-template1`);
});

async function closeAllSessions() {
  const entries = Array.from(sessionsByPath.values()).flatMap((sessionMap) => Array.from(sessionMap.values()));
  for (const sessionMap of sessionsByPath.values()) {
    sessionMap.clear();
  }
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
