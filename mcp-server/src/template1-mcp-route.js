import { runTemplate1SlotPromptChain } from "./template1-engine.js";

export const TEMPLATE1_ROUTE_PATH = "/mcp-template1";

export const TEMPLATE1_SLOT_TABLE_INPUT_SCHEMA = {
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

export const TEMPLATE1_TOOLS = [
  {
    name: "generate_template1_slot_table_json",
    description: "Analyze seven image analysis cards and output the childhood-growth slot-table JSON.",
    inputSchema: TEMPLATE1_SLOT_TABLE_INPUT_SCHEMA
  }
];

export async function handleTemplate1Tool(name, args, context) {
  const { workspaceRoot, toUnicodeEscapedJson } = context;

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
}
