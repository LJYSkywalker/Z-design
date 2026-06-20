import type { ApiProtocol, AppConfig } from '../types';

// GLM is the sole BYOK provider for Z-Design. These tables previously held
// per-vendor entries for seven protocols; they now hold a single 'glm' entry.
const API_PROTOCOL_LABELS: Record<ApiProtocol, string> = {
  glm: 'GLM API',
};

const API_PROTOCOL_AGENT_IDS: Record<ApiProtocol, string> = {
  glm: 'glm-api',
};

export function apiProtocolLabel(protocol: ApiProtocol | undefined): string {
  // `protocol` is optional purely to keep call sites that pass a possibly-
  // undefined value compiling; GLM is the only real protocol, so the default
  // is 'glm'.
  return API_PROTOCOL_LABELS[protocol ?? 'glm'];
}

export function apiProtocolModelLabel(
  protocol: ApiProtocol | undefined,
  model: string,
): string {
  const label = apiProtocolLabel(protocol);
  const trimmed = model.trim();
  return trimmed ? `${label} · ${trimmed}` : label;
}

export function apiProtocolAgentId(protocol: ApiProtocol | undefined): string {
  return API_PROTOCOL_AGENT_IDS[protocol ?? 'glm'];
}

// Whether the chat runtime should reach the daemon's Anthropic /v1/messages
// proxy. GLM is OpenAI-compatible and never uses the Anthropic proxy, so this
// is always false under the GLM-only model. Kept as a function (rather than a
// constant) because call sites still branch on its boolean return.
export function usesAnthropicProxy(_cfg: AppConfig): boolean {
  return false;
}

export function isAnthropicSupportedImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return /\.(jpe?g|png|gif|webp)$/.test(lower);
}
