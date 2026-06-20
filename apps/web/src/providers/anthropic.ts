/**
 * Thin wrapper over @anthropic-ai/sdk. Minimal analog of
 * packages/providers/src/index.ts in the reference repo.
 *
 * Runs in the browser with dangerouslyAllowBrowser — this is a BYOK local-
 * first tool, so the key is the user's and never leaves their machine. If
 * you later move to a server-hosted build, drop that flag and proxy through
 * your own backend.
 */
import Anthropic from '@anthropic-ai/sdk';
import { effectiveMaxTokens } from '../state/maxTokens';
import type { AppConfig, ChatMessage } from '../types';
import { streamMessageAnthropicProxy } from './anthropic-compatible';
import type { ProxyContext } from './api-proxy';
import { streamMessageAzure } from './azure-compatible';
import { streamMessageGoogle } from './google-compatible';
import { streamMessageOllama } from './ollama-compatible';
import { isOpenAICompatible, streamMessageOpenAI } from './openai-compatible';
import { streamMessageSenseAudio } from './senseaudio-compatible';
import { streamMessageAIHubMix } from './aihubmix-compatible';
import { usesAnthropicProxy } from '../utils/apiProtocol';

// Re-export for convenience
export { isOpenAICompatible } from './openai-compatible';

export interface StreamHandlers {
  onDelta: (textDelta: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

export function makeClient(cfg: AppConfig): Anthropic {
  return new Anthropic({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseUrl || undefined,
    dangerouslyAllowBrowser: true,
  });
}

export async function streamMessage(
  cfg: AppConfig,
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers,
  // Only the senseaudio / aihubmix branches read `context.projectId`
  // today (so the daemon-side `generate_image` tool can write into the
  // active project's folder). Other branches accept and ignore — keeping the
  // signature uniform means the single call site in ProjectView passes
  // the same shape regardless of protocol.
  context?: ProxyContext,
): Promise<void> {
  // GLM is the sole BYOK protocol and is OpenAI-compatible, so every BYOK
  // chat stream routes through the OpenAI streamer. The legacy per-vendor
  // branches (azure/ollama/google/senseaudio/aihubmix/anthropic-proxy) are
  // unreachable under the GLM-only model and were removed. `context` is
  // still threaded for signature parity with the OpenAI streamer.
  void context;
  return streamMessageOpenAI(cfg, system, history, signal, handlers);
}
