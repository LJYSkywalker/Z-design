import { validateBaseUrl } from '@z-design/contracts/api/connectionTest';
import type { ApiProtocol, ProviderModelOption } from '../../types';

export type ByokDraftField = 'api_key' | 'base_url' | 'model';

export type ByokDraftIssueLevel = 'error' | 'warn';

export type ByokDraftIssueCode =
  | 'api_key_required'
  | 'api_key_extra_whitespace'
  | 'api_key_malformed'
  | 'api_key_wrong_protocol'
  | 'base_url_required'
  | 'base_url_invalid'
  | 'model_required';

export type ByokDraftAction =
  | 'focus_api_key'
  | 'focus_base_url'
  | 'focus_model'
  | 'select_provider';

export interface ByokDraftIssue {
  field: ByokDraftField;
  level: ByokDraftIssueLevel;
  code: ByokDraftIssueCode;
  message: string;
  action?: ByokDraftAction;
  detectedProtocol?: ApiProtocol;
}

export interface ByokDraftValidation {
  ok: boolean;
  issues: ByokDraftIssue[];
}

interface ValidateByokDraftOptions {
  requiresApiKey?: boolean;
  requireModel?: boolean;
  keyValidationBaseUrl?: string;
}

interface ByokDraftConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface NormalizedByokBaseUrl {
  value: string;
  changed: boolean;
  addedProtocol: boolean;
  addedOpenAiVersionPath: boolean;
}

export type ByokModelPreferenceSource =
  | 'explicit'
  | 'account'
  | 'provider_default'
  | 'empty';

export interface ByokModelPreference {
  model: string;
  source: ByokModelPreferenceSource;
}

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;

export function cleanByokApiKey(value: string): string {
  return value
    .replace(ZERO_WIDTH_CHARS, '')
    .replace(/[\r\n\t]+/g, '')
    .trim();
}

export function normalizeByokBaseUrl(
  value: string,
  protocol: ApiProtocol,
): NormalizedByokBaseUrl {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      value: '',
      changed: value !== '',
      addedProtocol: false,
      addedOpenAiVersionPath: false,
    };
  }

  const addedProtocol = !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withProtocol = addedProtocol ? `https://${trimmed}` : trimmed;
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, '');

  let normalized = withoutTrailingSlash;
  let addedOpenAiVersionPath = false;
  try {
    const parsed = new URL(withoutTrailingSlash);
    // GLM's canonical base already includes /api/paas/v4, so no version-path
    // normalization is needed; the openai-specific /v1 rewrite only applied to
    // api.openai.com and is no longer reachable (openai is not a protocol GLM
    // uses). Left as a no-op guard for safety.
    void parsed;
    void protocol;
  } catch {
    normalized = withoutTrailingSlash;
  }

  return {
    value: normalized,
    changed: normalized !== value,
    addedProtocol,
    addedOpenAiVersionPath,
  };
}

export function validateByokDraft(
  protocol: ApiProtocol,
  config: ByokDraftConfig,
  options: ValidateByokDraftOptions = {},
): ByokDraftValidation {
  const requiresApiKey = options.requiresApiKey ?? true;
  const requireModel = options.requireModel ?? true;
  const issues: ByokDraftIssue[] = [];
  const cleanedApiKey = cleanByokApiKey(config.apiKey);
  const baseUrl = config.baseUrl.trim();
  const model = config.model.trim();

  if (requiresApiKey && !cleanedApiKey) {
    issues.push({
      field: 'api_key',
      level: 'error',
      code: 'api_key_required',
      message: 'API key is required.',
      action: 'focus_api_key',
    });
  } else if (requiresApiKey) {
    if (cleanedApiKey !== config.apiKey) {
      issues.push({
        field: 'api_key',
        level: 'warn',
        code: 'api_key_extra_whitespace',
        message: 'API key contains extra whitespace.',
        action: 'focus_api_key',
      });
    }
    const keyIssue = validateApiKeyShape(
      protocol,
      cleanedApiKey,
      options.keyValidationBaseUrl?.trim() || baseUrl,
    );
    if (keyIssue) issues.push(keyIssue);
  }

  if (!baseUrl) {
    issues.push({
      field: 'base_url',
      level: 'error',
      code: 'base_url_required',
      message: 'Base URL is required.',
      action: 'focus_base_url',
    });
  } else if (validateBaseUrl(baseUrl).error) {
    issues.push({
      field: 'base_url',
      level: 'error',
      code: 'base_url_invalid',
      message: 'Base URL must be a valid public http:// or https:// URL.',
      action: 'focus_base_url',
    });
  }

  if (requireModel && !model) {
    issues.push({
      field: 'model',
      level: 'error',
      code: 'model_required',
      message: 'Model is required.',
      action: 'focus_model',
    });
  }

  return {
    ok: !issues.some((issue) => issue.level === 'error'),
    issues,
  };
}

export function blockingByokDraftIssues(
  validation: ByokDraftValidation,
): ByokDraftIssue[] {
  return validation.issues.filter((issue) => issue.level === 'error');
}

export function blockingByokDraftFields(
  validation: ByokDraftValidation,
): ByokDraftField[] {
  return Array.from(
    new Set(blockingByokDraftIssues(validation).map((issue) => issue.field)),
  );
}

export function resolveByokModelPreference({
  currentModel,
  accountModels,
  providerDefaultModel,
}: {
  currentModel: string;
  accountModels: readonly ProviderModelOption[];
  providerDefaultModel?: string;
}): ByokModelPreference {
  const explicit = currentModel.trim();
  if (explicit) return { model: explicit, source: 'explicit' };
  const account = accountModels.find((model) => model.id.trim());
  if (account) return { model: account.id, source: 'account' };
  const providerDefault = providerDefaultModel?.trim() ?? '';
  if (providerDefault) {
    return { model: providerDefault, source: 'provider_default' };
  }
  return { model: '', source: 'empty' };
}

function validateApiKeyShape(
  protocol: ApiProtocol,
  apiKey: string,
  baseUrl: string,
): ByokDraftIssue | null {
  if (!apiKey) return null;
  // GLM is the sole BYOK protocol. Zhipu (open.bigmodel.cn) issues JWT-style
  // API keys of the form `<id>.<secret>`. We don't hard-fail on shape — the
  // daemon's connection test is the real authority — but warn when a key
  // clearly belongs to a different vendor so the user notices a paste error.
  void protocol;
  if (isGlmFirstPartyBaseUrl(baseUrl) && !isGlmApiKeyShape(apiKey)) {
    return {
      field: 'api_key',
      level: 'warn',
      code: 'api_key_malformed',
      message:
        'This does not look like a Zhipu GLM API key (expected a "<id>.<secret>" JWT token). You can still save it and run a connection test.',
      action: 'focus_api_key',
    };
  }

  return null;
}

function detectByokApiKeyProtocol(_apiKey: string): ApiProtocol | null {
  // Only GLM is supported; treat any non-empty key as a GLM candidate. The
  // connection test validates it against open.bigmodel.cn at runtime.
  return null;
}

/** Zhipu (open.bigmodel.cn) API keys are JWT-style: `<id>.<secret>`. */
function isGlmApiKeyShape(apiKey: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(apiKey.trim());
}

function isGlmFirstPartyBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === 'open.bigmodel.cn';
  } catch {
    return false;
  }
}

function baseUrlHostname(baseUrl: string): string | undefined {
  const trimmed = baseUrl.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}
