import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { fileURLToPath } from 'node:url';

// 读取项目根目录 .env（前后端共用）；已存在的环境变量优先，不会覆盖
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  /* 根目录没有 .env 时沿用外部环境变量 */
}

// E2E_ENV=production 时测线上环境，否则测本地 dev
const isProd = process.env.E2E_ENV === 'production';

/* ------------------------------------------------------------------
 * CodeBuddy 网关适配
 *
 * baseURL 来源：本地 @tencent-ai/codebuddy-code 包
 *   product.json → endpoint = https://www.codebuddy.ai
 *   dist/codebuddy.js → 模型客户端 baseURL 拼接为 `${endpoint}/v2`
 *   国内账号走 www.codebuddy.cn（.ai 从国内网络不可达；401 即 host 不匹配）
 *
 * 该网关限制：仅接受流式请求，stream=false 会返回
 *   { code: 11101, msg: 'Non-stream chat request is currently not supported' }
 * 因此做双向适配：
 *   1. transformRequestBody：非流式调用改写为 stream=true，并打标记
 *   2. codebuddyFetch：带标记的请求把返回的 SSE 聚合成普通 chat.completion JSON
 * ------------------------------------------------------------------ */
const CODEBUDDY_BASE = process.env.CODEBUDDY_BASE_URL || 'https://www.codebuddy.cn/v2';
const AGGREGATE_FLAG = '__aggregate_sse';

/** 把 chat.completion.chunk 的 SSE 文本聚合成一次完整的 chat.completion 响应 */
function sseToCompletion(sse: string) {
  let id = 'chatcmpl-codebuddy';
  let model = '';
  let created = Math.floor(Date.now() / 1000);
  let content = '';
  let finishReason: string | null = null;
  let usage: unknown;
  const calls = new Map<number, { id?: string; name: string; args: string }>();

  for (const line of sse.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let chunk: any;
    try {
      chunk = JSON.parse(data);
    } catch {
      continue;
    }
    if (chunk.id) id = chunk.id;
    if (chunk.model) model = chunk.model;
    if (chunk.created) created = chunk.created;
    if (chunk.usage) usage = chunk.usage;

    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta || {};
    if (typeof delta.content === 'string') content += delta.content;
    for (const tc of delta.tool_calls || []) {
      const idx = typeof tc.index === 'number' ? tc.index : 0;
      const acc = calls.get(idx) || { name: '', args: '' };
      if (tc.id) acc.id = tc.id;
      // 网关会把 function.name 分片下发，需要拼接
      if (tc.function?.name) acc.name += tc.function.name;
      if (tc.function?.arguments) acc.args += tc.function.arguments;
      calls.set(idx, acc);
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  const toolCalls = [...calls.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, c], i) => ({
      id: c.id || `call_${i}`,
      type: 'function' as const,
      function: { name: c.name, arguments: c.args || '{}' },
    }));

  const message: Record<string, unknown> = { role: 'assistant', content: content || null };
  if (toolCalls.length) message.tool_calls = toolCalls;

  return {
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason || (toolCalls.length ? 'tool_calls' : 'stop'),
      },
    ],
    usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

/**
 * 来源标识（与本地 codebuddy CLI 一致，取自其 dist/codebuddy.js 常量）：
 *   Vo = "CLI" → X-IDE-Type；X-Product = CLI
 * 网关据此把请求识别为 CLI 端发起，便于配额/统计归因。
 */
const CLI_VERSION = process.env.CODEBUDDY_CLI_VERSION || '2.167.0';
const CLI_SOURCE_HEADERS: Record<string, string> = {
  'X-IDE-Type': 'CLI',
  'X-IDE-Name': 'CLI',
  'X-IDE-Version': CLI_VERSION,
  'X-Product-Version': CLI_VERSION,
  'X-Product': 'CLI',
};

/** 自定义 fetch：补 CLI 来源头、去掉内部标记，并在需要时把流式响应聚合为 JSON */
const codebuddyFetch = async (input: any, init: any) => {
  const raw = init?.body;
  if (typeof raw !== 'string') return fetch(input, init);

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return fetch(input, init);
  }

  const aggregate = body[AGGREGATE_FLAG] === true;
  delete body[AGGREGATE_FLAG];
  body.stream = true;

  // 补来源头：不覆盖调用方已设置的同名头，并给每次请求一个追踪 id
  const headers = new Headers(init?.headers as any);
  for (const [k, v] of Object.entries(CLI_SOURCE_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  if (!headers.has('X-Request-Id')) headers.set('X-Request-Id', crypto.randomUUID());

  const res = await fetch(input, { ...init, headers, body: JSON.stringify(body) });
  if (!aggregate || !res.ok) return res;

  const sse = await res.text();
  try {
    return new Response(JSON.stringify(sseToCompletion(sse)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return res;
  }
};

export default {
  agents: {
    default: {
      model: createOpenAICompatible({
        name: 'codebuddy',
        baseURL: CODEBUDDY_BASE,
        apiKey: process.env.CODEBUDDY_API_KEY,
        fetch: codebuddyFetch as any,
        // 网关仅支持流式：非流式调用改写为流式并打标记，由 codebuddyFetch 聚合回 JSON
        transformRequestBody: body => {
          const out: any = { ...body, stream: true };
          if (body.stream !== true) out[AGGREGATE_FLAG] = true;
          delete out.thinking;
          delete out.reasoning;
          delete out.reasoning_effort;
          return out;
        },
      }).chatModel(process.env.E2E_MODEL || 'deepseek-v4.1-flash'),
      system: 'You are a thorough QA agent. Verify every outcome.',
    },
  },
  targets: [{
    engine: web(),
    app: {
      url: isProd ? 'https://115.159.95.183:18000/' : 'http://localhost:5181/',
      // 由测试外部自行启动服务（根目录 npm run dev）
    },
  }],
} satisfies E2EConfig;
