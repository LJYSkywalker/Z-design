/**
 * GLM agentic runner — the design-capability core of the GLM-only adapter.
 *
 * GLM ships no Claude-Code-style agentic CLI, so to give it real design
 * capability (write HTML, iterate on artifacts, read project files) the
 * daemon itself drives a tool-use loop against Zhipu's OpenAI-compatible
 * `/api/paas/v4/chat/completions` endpoint. This module owns that loop.
 *
 * The loop mirrors the BYOK media tool loop in `chat-routes.ts`
 * (`runTurn` → `executeOneTool` → re-issue) but extends the tool set from
 * media-only (image/video/speech) to the design primitives a CLI agent
 * normally carries:
 *
 *   - write_file      write/create/overwrite a project file (HTML, CSS, JS…)
 *   - read_file       read an existing project file back
 *   - list_dir        list files in the project workspace
 *   - finalize_design publish a finished HTML artifact (manifest + title)
 *
 * Every tool writes through `writeProjectFile` / `readProjectFile` /
 * `listFiles`, so the project's chokidar watcher fires `file-changed` and
 * the web FileViewer iframe refreshes automatically — no separate
 * artifact-registration API is needed.
 *
 * Events emitted to the web (via `send`) match the vocabulary the CLI
 * adapters produce, so the chat UI, artifact parser, and FileViewer reuse
 * unchanged:
 *
 *   send('agent', { type: 'text_delta', delta })
 *   send('agent', { type: 'tool_use', id, name, input })
 *   send('agent', { type: 'tool_result', toolUseId, content, isError })
 *   send('agent', { type: 'usage', usage })
 *
 * The caller (the `glm-stream` branch in `startChatRun`) is responsible for
 * emitting `start` before invoking this runner and calling
 * `design.runs.finish(run, status, …)` after it resolves.
 */

import {
  listFiles,
  readProjectFile,
  writeProjectFile,
} from './projects.js';
import { GLM_DEFAULT_BASE_URL } from './runtimes/defs/glm.js';
import { createGlmStreamHandler } from './glm-stream.js';

// Hard ceiling on the number of model round-trips in a single run. Each
// round-trip is one completion call that may return text AND/OR tool calls.
// A well-behaved design turn is typically 2–6 round-trips (plan → write a
// few files → self-check → summary); 25 leaves generous headroom for
// iterative refinement without letting a degenerate loop pin the daemon.
const MAX_TOOL_ITERATIONS = 25;

// Single-request token ceiling. Zhipu models accept large outputs for full
// HTML pages; 16K matches the finalize-design BYOK default and keeps a
// runaway response from exhausting context on the next turn.
const DEFAULT_MAX_TOKENS = 16_000;

// Per-turn HTTP timeout for the upstream completion call. Long generations
// (a full multi-file prototype in one turn) routinely take a minute+, so we
// stay well above the default node fetch ceiling.
const UPSTREAM_TIMEOUT_MS = 180_000;

export type GlmAgentRunInput = {
  /** Zhipu API key. Required. */
  apiKey: string;
  /** Override base URL (private gateway); falls back to open.bigmodel.cn. */
  baseUrl?: string;
  /** Resolved model id (already sanitized upstream by resolveModelForAgent). */
  model: string;
  /** Fully composed system prompt (identity + discovery + design system +
   *  skill + deck framework). Built by composeSystemPrompt upstream. */
  systemPrompt: string;
  /** The user's current-turn request, already transcript-composed. */
  userMessage: string;
  /** Absolute projects root (RUNTIME_DATA_DIR/projects). */
  projectsRoot: string;
  /** Active project id; tools write/read inside this project's folder. */
  projectId: string;
  /** Optional project metadata (imported-folder projects use baseDir). */
  projectMetadata?: unknown;
  /** Optional max-tokens override. */
  maxTokens?: number;
  /** SSE-style event sink. `event` is the channel ('agent'), `data` carries
   *  the typed payload ({ type: 'text_delta' | 'tool_use' | … }). */
  send: (event: string, data: unknown) => void;
  /** AbortSignal tied to run cancellation. */
  signal?: AbortSignal;
};

type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string };

type GlmCompletionTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

// ---------------------------------------------------------------------------
// Tool definitions — the design primitive vocabulary GLM drives.
// ---------------------------------------------------------------------------

const DESIGN_TOOLS: GlmCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create or overwrite a file in the active project workspace. Use this to write HTML, CSS, JS, or any text artifact. The file becomes immediately visible in the user\'s file panel and live preview. For HTML pages, write a complete <!doctype html> document. Paths are relative to the project root (e.g. "index.html", "css/styles.css").',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Project-relative file path, e.g. "index.html" or "assets/app.js".',
          },
          content: {
            type: 'string',
            description: 'The full file contents to write.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the current contents of an existing file in the project workspace. Use this to inspect or iterate on a file you or the user previously created.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Project-relative file path to read.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description:
        'List the files currently in the project workspace (newest first). Use this to see what already exists before writing or to confirm a file was created.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executors. Each returns a string the model sees as the tool result.
// ---------------------------------------------------------------------------

function summarizeFileList(files: unknown[]): string {
  if (!Array.isArray(files) || files.length === 0) {
    return 'The project workspace is currently empty.';
  }
  const lines = files.map((f) => {
    const name = (f as { name?: string })?.name ?? '?';
    const size = (f as { size?: number })?.size;
    return `- ${name}${typeof size === 'number' ? ` (${size} bytes)` : ''}`;
  });
  return `Project files (newest first):\n${lines.join('\n')}`;
}

async function executeWriteFile(
  args: { path?: unknown; content?: unknown },
  ctx: { projectsRoot: string; projectId: string; projectMetadata?: unknown },
): Promise<string> {
  const rel = typeof args.path === 'string' ? args.path.trim() : '';
  if (!rel) return 'Error: path is required.';
  const content = typeof args.content === 'string' ? args.content : '';
  try {
    await writeProjectFile(
      ctx.projectsRoot,
      ctx.projectId,
      rel,
      content,
      { overwrite: true },
      ctx.projectMetadata,
    );
    return `Wrote ${content.length} bytes to ${rel}. The file is now visible in the file panel and live preview.`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error writing ${rel}: ${msg}`;
  }
}

async function executeReadFile(
  args: { path?: unknown },
  ctx: { projectsRoot: string; projectId: string; projectMetadata?: unknown },
): Promise<string> {
  const rel = typeof args.path === 'string' ? args.path.trim() : '';
  if (!rel) return 'Error: path is required.';
  try {
    const result = await readProjectFile(
      ctx.projectsRoot,
      ctx.projectId,
      rel,
      ctx.projectMetadata,
    );
    return result.buffer.toString('utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error reading ${rel}: ${msg}`;
  }
}

async function executeListDir(
  ctx: { projectsRoot: string; projectId: string; projectMetadata?: unknown },
): Promise<string> {
  try {
    const files = await listFiles(
      ctx.projectsRoot,
      ctx.projectId,
      { metadata: ctx.projectMetadata },
    );
    return summarizeFileList(files);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error listing project files: ${msg}`;
  }
}

async function executeTool(
  name: string,
  rawArgs: string,
  ctx: { projectsRoot: string; projectId: string; projectMetadata?: unknown },
): Promise<{ content: string; isError: boolean }> {
  let args: Record<string, unknown> = {};
  if (typeof rawArgs === 'string' && rawArgs.trim()) {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return { content: `Error: tool arguments were not valid JSON: ${rawArgs.slice(0, 200)}`, isError: true };
    }
  }
  try {
    if (name === 'write_file') {
      return { content: await executeWriteFile(args as { path?: unknown; content?: unknown }, ctx), isError: false };
    }
    if (name === 'read_file') {
      return { content: await executeReadFile(args as { path?: unknown }, ctx), isError: false };
    }
    if (name === 'list_dir') {
      return { content: await executeListDir(ctx), isError: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Error executing ${name}: ${msg}`, isError: true };
  }
  return { content: `Error: unknown tool "${name}"`, isError: true };
}

// ---------------------------------------------------------------------------
// Single upstream round-trip: POST a completion, stream events, collect any
// tool calls. Returns the assistant message to append + the tool calls (if
// any) for the next loop iteration.
// ---------------------------------------------------------------------------

type RoundTripResult =
  | { kind: 'text_end'; assistantMessage: OpenAiMessage }
  | {
      kind: 'tool_calls';
      assistantMessage: OpenAiMessage;
      toolCalls: Array<{ id: string; name: string; arguments: string }>;
    };

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : GLM_DEFAULT_BASE_URL);
  return raw.replace(/\/+$/, '');
}

// GLM Coding Plan enforces a per-5-hour request window (Lite≈80, Pro≈400,
// Max≈1600) and, per the official FAQ, has shown peak-hour concurrency 429s
// under load. The generic API tier also rate-limits. Rather than failing the
// whole design turn on a transient 429, we retry with exponential backoff,
// honoring Retry-After when Zhipu returns it. Non-429 errors (401, 5xx) are
// not retried here — 401 is a config problem and 5xx is surfaced for the
// caller to decide. The streaming body is only consumed once we have a 2xx
// response, so retries don't waste partial output.
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 1_500;

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1_000;
  const httpDate = Date.parse(header);
  if (Number.isFinite(httpDate)) return Math.max(0, httpDate - Date.now());
  return null;
}

async function fetchGlmCompletion(
  url: string,
  apiKey: string,
  payload: unknown,
  signal: AbortSignal,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal,
    });
    if (response.status !== 429) return response;
    // 429: back off and retry. Coding Plan's quota windows are long (hours),
    // so a retry only helps for the peak-concurrency flavor of 429, not the
    // exhausted-quota flavor — but retrying is cheap and the user-facing
    // alternative is a hard failure mid-design, so it's worth the few seconds.
    const fromHeader = retryAfterMs(response);
    const delay = fromHeader ?? RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
    lastError = new Error(
      `GLM upstream rate-limited (429).` +
      (attempt < MAX_RATE_LIMIT_RETRIES ? ` Retrying in ${Math.round(delay / 100) / 10}s…` : ' Quota window may be exhausted; check your GLM Coding Plan usage.'),
    );
    if (attempt < MAX_RATE_LIMIT_RETRIES) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, Math.min(delay, 30_000));
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Run was canceled.'));
        }, { once: true });
      });
    }
  }
  throw lastError ?? new Error('GLM upstream rate-limited (429).');
}

async function runOneTurn(
  input: GlmAgentRunInput,
  messages: OpenAiMessage[],
): Promise<RoundTripResult> {
  const url = `${normalizeBaseUrl(input.baseUrl)}/chat/completions`;
  const payload = {
    model: input.model,
    messages,
    max_tokens: input.maxTokens && input.maxTokens > 0 ? input.maxTokens : DEFAULT_MAX_TOKENS,
    stream: true,
    stream_options: { include_usage: true },
    tools: DESIGN_TOOLS,
    tool_choice: 'auto',
  };

  // Compose a per-turn abort signal that fires on EITHER the run-level cancel
  // signal OR the upstream timeout, so a hung GLM connection can't pin the
  // daemon indefinitely. The timeout covers the whole streaming duration
  // (headers + body), not just the initial request — a model that opens the
  // connection then stalls mid-stream must still be reaped.
  const timeoutController = new AbortController();
  const timeoutTimer = setTimeout(
    () => timeoutController.abort(),
    UPSTREAM_TIMEOUT_MS,
  );
  const combinedSignal = input.signal
    ? AbortSignal.any([input.signal, timeoutController.signal])
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetchGlmCompletion(url, input.apiKey, payload, combinedSignal);

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      const redacted = errText.replace(/Bearer [A-Za-z0-9_.\-+/=]+/g, 'Bearer [REDACTED]');
      throw new Error(
        `GLM upstream error ${response.status}: ${redacted.slice(0, 500)}` +
        (response.status === 401 ? ' (check the GLM API key in Settings)' : '') +
        (response.status === 403 ? ' (the key may not be authorized for this model/endpoint — if you are on GLM Coding Plan, make sure the base URL is the coding endpoint)' : ''),
      );
    }

    // Accumulated text + tool calls for this turn. We forward text deltas to
    // the UI live (so the user sees streaming), and collect tool calls during
    // flush (the stream parser emits a `tool_use` event per call once the
    // arguments JSON is complete) to return for local execution.
    let textBuffer = '';
    const collectedToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    let lastUsage: unknown = null;

    const handler = createGlmStreamHandler((ev) => {
      if (ev.type === 'text_delta') {
        textBuffer += ev.delta;
        input.send('agent', { type: 'text_delta', delta: ev.delta });
      } else if (ev.type === 'usage') {
        lastUsage = ev.usage;
      } else if (ev.type === 'tool_use') {
        // Reconstruct the arguments string: `input` is the parsed object (or
        // { __raw } when JSON was malformed). Re-serialize so the appended
        // assistant.tool_calls stays wire-faithful for the next turn.
        const inputObj = ev.input as Record<string, unknown>;
        const argsStr =
          inputObj && typeof inputObj === 'object' && '__raw' in inputObj
            ? String((inputObj as { __raw: unknown }).__raw)
            : JSON.stringify(inputObj ?? {});
        collectedToolCalls.push({ id: ev.id, name: ev.name, arguments: argsStr });
      }
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) handler.feed(chunk);
      }
      handler.flush();
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
    }

    if (lastUsage) {
      input.send('agent', { type: 'usage', usage: lastUsage });
    }

    if (collectedToolCalls.length > 0) {
      const assistantMessage: OpenAiMessage = {
        role: 'assistant',
        content: textBuffer || null,
        tool_calls: collectedToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      return { kind: 'tool_calls', assistantMessage, toolCalls: collectedToolCalls };
    }

    return {
      kind: 'text_end',
      assistantMessage: { role: 'assistant', content: textBuffer || '' },
    };
  } finally {
    // Clear the timeout regardless of how the turn ended (success, upstream
    // error, abort) so a dangling timer never fires after the run resolves.
    clearTimeout(timeoutTimer);
  }
}

// ---------------------------------------------------------------------------
// Public entry: drives the full agentic loop for one chat run.
// ---------------------------------------------------------------------------

export async function runGlmAgent(input: GlmAgentRunInput): Promise<void> {
  if (!input.apiKey) {
    throw new Error('GLM API key is missing. Configure it in Settings → Local CLI (GLM_API_KEY) or provider credentials.');
  }
  if (!input.model) {
    throw new Error('GLM model is not selected.');
  }

  const ctx = {
    projectsRoot: input.projectsRoot,
    projectId: input.projectId,
    projectMetadata: input.projectMetadata,
  };

  const messages: OpenAiMessage[] = [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: input.userMessage },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    if (input.signal?.aborted) {
      throw new Error('Run was canceled.');
    }

    const result = await runOneTurn(input, messages);
    messages.push(result.assistantMessage);

    if (result.kind === 'text_end') {
      // Model finished without requesting more tools — the design turn is
      // complete. Any trailing assistant text was already streamed live.
      return;
    }

    // tool_calls: surface each call to the UI, execute locally, feed the
    // result back as a `role: 'tool'` message, then loop for the model's
    // next response.
    for (const call of result.toolCalls) {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(call.arguments || '{}');
      } catch {
        parsedInput = { __raw: call.arguments };
      }
      input.send('agent', {
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: parsedInput,
      });

      const exec = await executeTool(call.name, call.arguments, ctx);
      input.send('agent', {
        type: 'tool_result',
        toolUseId: call.id,
        content: exec.content,
        isError: exec.isError,
      });

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: exec.content,
      });
    }
    // Loop continues: re-issue the completion with the tool results so the
    // model can react (write another file, self-check, or finish with text).
  }

  // Hit the iteration ceiling. Emit a final note rather than looping forever;
  // the work already done (files written, text streamed) is preserved.
  input.send('agent', {
    type: 'text_delta',
    delta: '\n\n*(Reached the maximum number of tool iterations. Finalizing the work done so far.)*',
  });
}
