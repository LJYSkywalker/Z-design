import type {
  FinalizeAnthropicRequest,
  FinalizeProviderProtocol,
} from '@z-design/contracts';

import { effectiveMaxTokens } from '../state/maxTokens';
import type { ApiProtocol, AppConfig } from '../types';

const FINALIZE_PROTOCOLS = new Set<FinalizeProviderProtocol>([
  'anthropic',
  'openai',
  'azure',
  'google',
  'ollama',
  'glm',
]);

export interface FinalizeCredentialsMissingToast {
  message: string;
  details: string | null;
}

function resolveFinalizeProtocol(config: AppConfig): FinalizeProviderProtocol {
  const protocol = config.apiProtocol ?? 'glm';
  return FINALIZE_PROTOCOLS.has(protocol as FinalizeProviderProtocol)
    ? (protocol as FinalizeProviderProtocol)
    : 'glm';
}

function resolveByokFields(config: AppConfig, protocol: FinalizeProviderProtocol) {
  // apiProtocolConfigs is keyed by ApiProtocol ('glm' only); the finalize
  // protocol resolves to 'glm' under the GLM-only model, so cast for the
  // index lookup. Non-'glm' values (only reachable from a stale saved config)
  // simply miss the table and fall through to the top-level config fields.
  const saved = config.apiProtocolConfigs?.[protocol as ApiProtocol];
  return {
    apiKey: (saved?.apiKey ?? config.apiKey ?? '').trim(),
    baseUrl: (saved?.baseUrl ?? config.baseUrl ?? '').trim(),
    model: (saved?.model ?? config.model ?? '').trim(),
    apiVersion: (saved?.apiVersion ?? config.apiVersion ?? '').trim(),
  };
}

export function isFinalizeByokConfigured(config: AppConfig): boolean {
  const protocol = resolveFinalizeProtocol(config);
  const { apiKey, model } = resolveByokFields(config, protocol);
  return Boolean(apiKey && model);
}

export function buildFinalizeRequest(
  config: AppConfig,
): FinalizeAnthropicRequest | null {
  const protocol = resolveFinalizeProtocol(config);
  const { apiKey, baseUrl, model, apiVersion } = resolveByokFields(
    config,
    protocol,
  );
  if (!apiKey || !model) return null;

  return {
    protocol,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    model,
    maxTokens: effectiveMaxTokens(config),
    ...(protocol === 'azure' && apiVersion ? { apiVersion } : {}),
  };
}

export function buildFinalizeCredentialsMissingToast(
  config: AppConfig,
): FinalizeCredentialsMissingToast {
  if (config.mode === 'daemon') {
    return {
      message:
        'Finalize design package needs BYOK API settings — Local CLI login is used for chat only.',
      details:
        'Open Settings → BYOK to add an API key and model, or use Continue in CLI (⌘⇧K) to finalize manually.',
    };
  }

  return {
    message: 'Bad request — check the API key and model.',
    details: 'Open Settings → BYOK and verify your API key, base URL, and model.',
  };
}
