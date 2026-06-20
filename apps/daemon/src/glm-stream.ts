/**
 * GLM (Zhipu open platform) stream parser.
 *
 * Zhipu's `/api/paas/v4/chat/completions` endpoint is wire-compatible with
 * the OpenAI chat-completions SSE format: a sequence of
 * `data: {choices:[{delta:{content?,tool_calls?},finish_reason?}]}` frames
 * terminated by `data: [DONE]`. This module consumes that byte stream and
 * emits the same compact event vocabulary the web UI already renders for CLI
 * agents:
 *
 *   - text_delta : { delta }                    — assistant text chunk
 *   - tool_input_delta : { id, name, delta }    — streaming tool args JSON
 *   - tool_use : { id, name, input }            — a complete tool call
 *   - usage : { usage }                         — token totals for the turn
 *
 * The caller (glm-agent-runner.ts) is responsible for emitting `tool_result`
 * after it executes each tool locally, and for re-issuing the completion to
 * drive the next loop iteration. This parser only translates ONE upstream
 * HTTP streaming response into structured events.
 *
 * Tool-call accumulation follows the OpenAI delta convention: each tool_call
 * carries an `index` (slot key), the `id` and `function.name` arrive once at
 * the start of the slot, and `function.arguments` arrives as a concatenated
 * JSON string across multiple deltas. We buffer per-slot and hand the parsed
 * `input` object to the caller once the slot's arguments look complete.
 */

export type GlmStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_input_delta'; id: string; name: string; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'usage'; usage: unknown }
  | { type: 'raw'; line: string };

export type GlmEventSink = (event: GlmStreamEvent) => void;

type AccumulatedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

type GlmStreamHandlerOptions = {
  onUsage?: (usage: unknown) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createGlmStreamHandler(
  onEvent: GlmEventSink,
  options: GlmStreamHandlerOptions = {},
) {
  let buffer = '';
  // Per-slot tool-call accumulator, keyed by the OpenAI `index` field. Parallel
  // tool calls are rare from GLM but the protocol allows them, so we keep one
  // entry per index rather than a single slot.
  const accum: Record<number, AccumulatedToolCall> = {};
  let turnDone = false;

  function tryEmitToolCalls(): void {
    const indices = Object.keys(accum)
      .map(Number)
      .sort((a, b) => a - b);
    for (const idx of indices) {
      const slot = accum[idx];
      if (!slot) continue;
      let input: unknown = {};
      const raw = slot.arguments.trim();
      if (raw) {
        try {
          input = JSON.parse(raw);
        } catch {
          // Malformed/partial JSON — surface the raw string so the runner can
          // decide whether to retry or report. A well-formed tool call from a
          // cooperative model parses cleanly; a truncated stream is the usual
          // culprit and the caller will re-issue on the next chunk anyway.
          input = { __raw: raw };
        }
      }
      onEvent({
        type: 'tool_use',
        id: slot.id || `call_${idx}`,
        name: slot.name || '',
        input,
      });
      delete accum[idx];
    }
  }

  function handleData(data: unknown): void {
    if (!isRecord(data)) return;
    const choices = data.choices;
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        if (!isRecord(choice)) continue;
        const delta = choice.delta;
        if (isRecord(delta)) {
          if (typeof delta.content === 'string' && delta.content) {
            onEvent({ type: 'text_delta', delta: delta.content });
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              if (!isRecord(tc)) continue;
              const idx = typeof tc.index === 'number' ? tc.index : 0;
              if (!accum[idx]) {
                accum[idx] = { id: '', name: '', arguments: '' };
              }
              const slot = accum[idx]!;
              const fn = isRecord(tc.function) ? tc.function : {};
              if (typeof tc.id === 'string' && tc.id) slot.id = tc.id;
              if (typeof fn.name === 'string' && fn.name) slot.name = fn.name;
              if (typeof fn.arguments === 'string' && fn.arguments) {
                slot.arguments += fn.arguments;
                onEvent({
                  type: 'tool_input_delta',
                  id: slot.id || `call_${idx}`,
                  name: slot.name || '',
                  delta: fn.arguments,
                });
              }
            }
          }
        }
      }
    }
    // Zhipu (like OpenAI) surfaces usage on the final frame when
    // `stream_options: { include_usage: true }` is set.
    if (isRecord(data.usage)) {
      onEvent({ type: 'usage', usage: data.usage });
      options.onUsage?.(data.usage);
    }
  }

  function feed(chunk: string): void {
    buffer += chunk;
    // SSE frames are separated by a blank line (`\n\n`). Within a frame the
    // payload follows `data: `.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      consumeFrame(frame);
    }
  }

  function consumeFrame(frame: string): void {
    const lines = frame.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '').trim();
      if (!line) continue;
      // We only care about `data:` lines. Zhipu also emits `:`-prefixed
      // keepalive comments and occasionally `event:` lines; ignore both.
      if (!line.startsWith('data:')) {
        // Keep non-data lines observable for debugging unexpected shapes.
        if (!line.startsWith(':') && !line.startsWith('event:')) {
          onEvent({ type: 'raw', line });
        }
        continue;
      }
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        turnDone = true;
        tryEmitToolCalls();
        continue;
      }
      let data: unknown;
      try {
        data = JSON.parse(payload);
      } catch {
        onEvent({ type: 'raw', line: payload });
        continue;
      }
      handleData(data);
    }
  }

  function flush(): void {
    const remaining = buffer.trim();
    buffer = '';
    if (remaining) {
      consumeFrame(remaining);
    }
    // A graceful close without `[DONE]` still needs to emit any tool calls
    // that were mid-flight when the stream ended.
    if (!turnDone) {
      tryEmitToolCalls();
      turnDone = true;
    }
  }

  return { feed, flush };
}
