import { DEFAULT_MODEL_OPTION } from './shared.js';
import type { RuntimeAgentDef } from '../types.js';

// GLM (智谱开放平台 / Zhipu AI open platform).
//
// Unlike every other adapter in this folder, the GLM runtime does NOT shell
// out to an external code-agent CLI. GLM ships no Claude-Code-style agentic
// CLI today, so to give GLM real design capability (write HTML, run skills,
// iterate on artifacts) the daemon itself drives a tool-use loop against
// Zhipu's OpenAI-compatible chat-completions API (open.bigmodel.cn).
// `server.ts` recognizes `streamFormat: 'glm-stream'` and short-circuits the
// spawn pipeline, handing the turn over to the in-process GLM agent runner
// (see `apps/daemon/src/glm-agent-runner.ts`) which:
//
//   1. reuses `composeSystemPrompt` so GLM inherits the same identity,
//      discovery, design-system, skill, and deck-framework prompt stack as
//      every CLI agent;
//   2. calls `/api/paas/v4/chat/completions` with a `tools` array the daemon
//      executes locally (write_file / read_file / list_dir / finalize_design
//      + the existing BYOK media tools);
//   3. emits the standard `text_delta` / `tool_use` / `tool_result` /
//      `usage` event vocabulary the web UI already renders for CLI agents.
//
// `bin` / `versionArgs` are kept only because the detection layer and
// `/api/agents` shape expect a non-empty `bin` to mark an agent "available";
// the GLM runner bypasses binary resolution entirely (the `glm-stream`
// branch in `startChatRun` returns before `resolveAgentLaunch` matters), so
// the value here is a label, not a real executable.

// Zhipu open-platform base URLs. Z-Design supports BOTH access tiers:
//
//   - GLM Coding Plan: the subscription tier for agentic coding tools. Its
//     requests MUST hit the `/api/coding/paas/v4` endpoint — pointing a
//     coding-plan key at the generic endpoint silently falls back to
//     metered billing (and gets rate-limited hard), which is exactly the
//     429 symptom we saw in smoke testing.
//   - Generic API: the metered (pay-as-you-go) tier at `/api/paas/v4`.
//
// Both speak the identical OpenAI-compatible chat-completions shape, so the
// only difference is the path segment. The default is the coding-plan endpoint
// because that's the dominant Z-Design use case; users on the metered tier (or
// a private gateway) override via the `GLM_BASE_URL` Settings env field, which
// is allowlisted in app-config.ts. Trailing slash stripped at call time.
export const GLM_CODING_PLAN_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';
export const GLM_GENERIC_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
export const GLM_DEFAULT_BASE_URL = GLM_CODING_PLAN_BASE_URL;

// The headline Zhipu flagship models exposed on open.bigmodel.cn today.
// `glm-5.2` is the current flagship and the recommended default for design
// work (strongest tool-calling + reasoning, which matters for the agentic
// design loop). The glm-4.x entries are kept as fallbacks for cost-sensitive
// or long-context workloads. Users can type any model id Zhipu exposes via
// the "Custom" picker (supportsCustomModel defaults to true).
const GLM_FALLBACK_MODELS = [
  DEFAULT_MODEL_OPTION,
  { id: 'glm-5.2', label: 'glm-5.2 (flagship, recommended)' },
  { id: 'glm-5.1', label: 'glm-5.1' },
  { id: 'glm-4.6', label: 'glm-4.6' },
  { id: 'glm-4.5-air', label: 'glm-4.5-air (fast / low cost)' },
  { id: 'glm-4.5', label: 'glm-4.5' },
  { id: 'glm-4-plus', label: 'glm-4-plus' },
  { id: 'glm-4-long', label: 'glm-4-long (long context)' },
  { id: 'glm-4v', label: 'glm-4v (vision)' },
  { id: 'glm-4.5v', label: 'glm-4.5v (vision)' },
];

export const glmAgentDef = {
    id: 'glm',
    name: 'GLM',
    // Label-only bin. The `glm-stream` branch in startChatRun never resolves
    // or spawns this; it routes to the in-process HTTP runner instead.
    bin: 'glm',
    versionArgs: ['--version'],
    fallbackModels: GLM_FALLBACK_MODELS,
    // buildArgs is unused for glm-stream (no CLI to build args for), but the
    // type requires it and a couple of defensive call sites read it. Return an
    // empty argv so any stray invocation is a harmless no-op.
    buildArgs: () => [],
    streamFormat: 'glm-stream',
    supportsImagePaths: true,
    // Let users override the model id freely — Zhipu's catalog rotates faster
    // than this fallback list, and `glm-4.5v` / experimental ids should be
    // typable without a code change.
    supportsCustomModel: true,
    installUrl: 'https://open.bigmodel.cn',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
} satisfies RuntimeAgentDef;
