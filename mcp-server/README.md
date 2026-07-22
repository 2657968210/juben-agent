# creative-team-mcp

This MCP server exposes database-result driven tools for the creative-team workflow.

## Tools

1. validate_input_db_result
2. run_fast_script_chain
3. run_balanced_script_chain
4. get_generation_status
5. get_final_shotlist
6. run_template1_slot_prompt_chain

## Required DB fields

The current workflow accepts a structured `dbResult.images` array. Each item should contain image-level fields such as:

- 人物
- 场景
- 动作
- 氛围
- 风格参考

## Run

```bash
cd mcp-server
npm install
npm start
```

Server endpoint:

```text
http://127.0.0.1:3001/mcp
http://127.0.0.1:3001/mcp-template1
```

`/mcp-template1` 面向“儿童成长系列分镜槽位表”场景，输入 7 条来源提示词后，自动选出 4 条并生成适合下游图生视频的槽位提示词。

## MCP client config (HTTP)

```json
{
  "mcpServers": {
    "creative-team": {
      "url": "http://127.0.0.1:3001/mcp"
    },
    "creative-team-template1": {
      "url": "http://127.0.0.1:3001/mcp-template1"
    }
  }
}
```

## n8n input format

MCP tool arguments must be an object, not an array.

If n8n upstream returns:

```json
[
  {
    "dbResult": {
      "images": [
        {
          "人物": "...",
          "场景": "...",
          "动作": "...",
          "氛围": "...",
          "风格参考": "..."
        }
      ]
    },
    "tool": "..."
  }
]
```

Pass the first item as an object before calling the MCP tool, for example:

```json
{
  "dbResult": {
    "images": [
      {
        "人物": "...",
        "场景": "...",
        "动作": "...",
        "氛围": "...",
        "风格参考": "..."
      }
    ]
  }
}
```

In n8n, the simplest mapping is usually to pass the first item only, for example `{{$json[0].dbResult}}` or a Code node that returns `{ dbResult: $input.first().json.dbResult }`.

For this project, the image-to-script flow follows the compressed 3-step path from the client brief:

1. creative-director: set the short-film direction from the extracted image information.
2. creative-scriptwriter: turn the extracted image information into a full shot-based script.
3. creative-script-expert: do one lightweight logic and dialogue pass.

## Template1 workflow

Use this tool when you already have 7 条素材提示词，且识图结果会在上游模块生成。

```json
{
  "templateName": "儿童成长系列",
  "sourcePrompts": [
    { "title": "素材1", "prompt": "..." },
    { "title": "素材2", "prompt": "..." },
    { "title": "素材3", "prompt": "..." },
    { "title": "素材4", "prompt": "..." },
    { "title": "素材5", "prompt": "..." },
    { "title": "素材6", "prompt": "..." },
    { "title": "素材7", "prompt": "..." }
  ]
}
```

The tool returns:

- 模版推荐与理由
- 分镜控制规则
- 4 条匹配到槽位表的最终提示词
- 未选中的素材列表

## Output artifacts

Generated artifacts are written to:

- output/jobs/<jobId>/shot-list-final.md
- output/jobs/<jobId>/script-review.md
- output/jobs/<jobId>/status.json
- output/jobs/<jobId>/template1-slot-prompts.md
- output/jobs/<jobId>/template1-slot-prompts.json
