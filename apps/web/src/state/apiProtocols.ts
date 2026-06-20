// Shared metadata for the GLM (Zhipu open platform) BYOK protocol.
//
// Z-Design ships GLM as the sole provider. These tables previously carried
// per-vendor entries for seven protocols (anthropic/openai/azure/google/
// ollama/senseaudio/aihubmix); they now hold a single 'glm' entry each.
// `ApiProtocol` itself is the single-member union `'glm'`, so every
// `Record<ApiProtocol, X>` here must have exactly one key.
//
// The lists are hand-curated rather than auto-discovered: every option
// exposes a `model` string the daemon's OpenAI-compatible GLM route
// understands, so a new entry here implies the model id is valid against
// open.bigmodel.cn's `/api/paas/v4/chat/completions`.

import type { ApiProtocol } from '../types';

// Headline GLM checkpoints the BYOK model dropdown lists by default.
// `glm-5.2` leads as the recommended design model (strongest tool-calling,
// which matters for the agentic design loop). Users can type any id Zhipu
// exposes via the Custom picker.
export const SUGGESTED_MODELS_BY_PROTOCOL: Record<ApiProtocol, readonly string[]> = {
  glm: [
    'glm-5.2',
    'glm-5.1',
    'glm-4.6',
    'glm-4.5-air',
    'glm-4.5',
    'glm-4-plus',
    'glm-4-long',
    'glm-4v',
    'glm-4.5v',
  ],
};

// "Fast / cheap" model recommendation. Used by the memory extractor's
// auto-mode pill. glm-4.5-air is Zhipu's low-latency / low-cost lane.
export const FAST_MODEL_BY_PROTOCOL: Record<ApiProtocol, string> = {
  glm: 'glm-4.5-air',
};

export const API_PROTOCOL_TABS: ReadonlyArray<{
  id: ApiProtocol;
  title: string;
}> = [
  { id: 'glm', title: 'GLM' },
];

export const API_PROTOCOL_LABELS: Record<ApiProtocol, string> = {
  glm: 'GLM API',
};

export const API_KEY_PLACEHOLDERS: Record<ApiProtocol, string> = {
  glm: 'Zhipu API key (xxx.xxx)',
};

// Default base URL the daemon assumes when the user leaves the field blank.
// Kept here so the BYOK form can render it as a placeholder hint and keep the
// two surfaces (form vs. daemon) in sync. open.bigmodel.cn is Zhipu's open
// platform; the /api/paas/v4 path is the OpenAI-compatible base.
export const DEFAULT_BASE_URL_BY_PROTOCOL: Record<ApiProtocol, string> = {
  glm: 'https://open.bigmodel.cn/api/coding/paas/v4',
};

// Fixed-origin gateways: managed single-endpoint providers where the user only
// supplies an API key — the Base URL is implied, so the Settings form hides the
// field. GLM is one: its origin is always open.bigmodel.cn/api/paas/v4.
export const FIXED_ORIGIN_GATEWAYS: ReadonlySet<ApiProtocol> = new Set<ApiProtocol>([
  'glm',
]);

export function isFixedOriginGateway(protocol: ApiProtocol): boolean {
  return FIXED_ORIGIN_GATEWAYS.has(protocol);
}

// Resolve the effective base URL. Fixed-origin gateways always use their
// canonical origin: the field is hidden, so an empty stored value must not leak
// through and break URL-gated logic such as the live model-list fetch (which
// requires a valid base URL and otherwise silently shows only the static list).
// Idempotent for non-gateway protocols — returns their value unchanged.
export function resolveFixedOriginBaseUrl(
  protocol: ApiProtocol,
  baseUrl: string,
): string {
  return isFixedOriginGateway(protocol) ? DEFAULT_BASE_URL_BY_PROTOCOL[protocol] : baseUrl;
}
