import type { AppConfigPrefs } from '@z-design/contracts';
import { MEDIA_PROVIDERS } from '../media/models';
import type {
  ApiProtocol,
  AppConfig,
  MediaProviderCredentials,
  NotificationsConfig,
  OrbitConfig,
  PetConfig,
} from '../types';
import { resolveFixedOriginBaseUrl } from './apiProtocols';
import {
  DEFAULT_ACCENT_COLOR,
  normalizeAccentColor,
} from './appearance';
import {
  DEFAULT_FAILURE_SOUND_ID,
  DEFAULT_SUCCESS_SOUND_ID,
} from '../utils/notifications';
import { randomUUID } from '../utils/uuid';

const STORAGE_KEY = 'z-design:config';
const CONFIG_MIGRATION_VERSION = 2;
const LEGACY_DEFAULT_ACCENT_COLOR = '#c96442';

// Hatched out of the box, but tucked away — the user has to go through
// either the entry-view "adopt a pet" callout or Settings → Pets to
// summon them. Keeps the workspace quiet for first-run users.
// Both switches default off so first-run users are not greeted by a
// surprise sound or a permission prompt; they can opt in from Settings →
// Notifications when they want it.
export const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  soundEnabled: false,
  successSoundId: DEFAULT_SUCCESS_SOUND_ID,
  failureSoundId: DEFAULT_FAILURE_SOUND_ID,
  desktopEnabled: false,
};

export const DEFAULT_PET: PetConfig = {
  adopted: false,
  enabled: false,
  petId: 'mochi',
  custom: {
    name: 'Buddy',
    glyph: '🦄',
    accent: DEFAULT_ACCENT_COLOR,
    greeting: 'Hi! I am here whenever you need me.',
  },
};

export const DEFAULT_ORBIT: OrbitConfig = {
  enabled: false,
  time: '08:00',
  // Ship with the general-purpose Orbit briefing skill pre-selected so a
  // fresh install runs against a real adaptive template instead of the
  // bare built-in prompt. Users can clear it from Settings → Orbit to fall
  // back to the built-in prompt or pick another scenario === 'orbit' skill.
  templateSkillId: 'orbit-general',
};

export const DEFAULT_CONFIG: AppConfig = {
  mode: 'daemon',
  apiKey: '',
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  model: 'glm-5.2',
  // GLM is the sole BYOK protocol for Z-Design. apiProtocol is always 'glm';
  // the legacy baseUrl/model defaults pointed at Anthropic and are now the
  // Zhipu open platform. loadConfig() coerces any old saved protocol to
  // 'glm' via migration v2 (see loadConfig).
  apiProtocol: 'glm',
  apiVersion: '',
  apiProtocolConfigs: {},
  configMigrationVersion: CONFIG_MIGRATION_VERSION,
  apiProviderBaseUrl: 'https://api.anthropic.com',
  // GLM is the sole agent for GLM Design. Default to it explicitly so a fresh
  // install selects GLM without relying on first-available fallback. The
  // daemon's /api/agents also surfaces only GLM, so the agent picker has a
  // single option regardless.
  agentId: 'glm',
  skillId: null,
  designSystemId: null,
  onboardingCompleted: false,
  theme: 'system',
  accentColor: DEFAULT_ACCENT_COLOR,
  mediaProviders: {},
  composio: {},
  agentModels: {},
  agentCliEnv: {},
  agentCliEnvIntent: {},
  pet: DEFAULT_PET,
  notifications: DEFAULT_NOTIFICATIONS,
  orbit: DEFAULT_ORBIT,
  projectLocations: [],
  defaultProjectLocationId: 'default',
  // Telemetry defaults to ON so fresh-install users emit onboarding /
  // ui_click events from the first frame. The disclosure modal still
  // appears after `onboardingCompleted` flips, and Settings → Privacy
  // remains the one-click opt-out. Without these defaults the gate at
  // `daemon/src/analytics.ts` (`if (telemetry?.metrics !== true) return`)
  // dropped every event fired during onboarding because no consent
  // existed yet — observed live on the nightly.10 QA run, which left
  // zero `page_view pn=onboarding` rows on PostHog despite the user
  // completing the flow.
  telemetry: { metrics: true, content: true },
};

function normalizeStoredAccentColor(value: unknown): string {
  const normalized = normalizeAccentColor(value);
  if (normalized === LEGACY_DEFAULT_ACCENT_COLOR) return DEFAULT_ACCENT_COLOR;
  return normalized ?? DEFAULT_ACCENT_COLOR;
}

/** Well-known providers with pre-filled base URLs. */
export interface KnownProvider {
  label: string;
  protocol: ApiProtocol;
  baseUrl: string;
  /** Default model to apply when the provider is selected. */
  model: string;
  /** Optional provider-specific model choices shown in Settings. */
  models?: string[];
  /** Some local/self-hosted endpoints do not require bearer credentials. */
  requiresApiKey?: boolean;
}

// GLM (Zhipu open platform) is the sole BYOK provider for Z-Design. The
// previous list carried 15 vendor presets across seven protocols; it now
// holds a single GLM entry pointing at open.bigmodel.cn's OpenAI-compatible
// /api/paas/v4 base. Model suggestions mirror the GLM runtime def's fallback
// list; users can type any id Zhipu exposes via the Custom picker.
export const KNOWN_PROVIDERS: KnownProvider[] = [
  {
    label: 'GLM (Zhipu)',
    protocol: 'glm',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    model: 'glm-5.2',
    models: [
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
  },
];

function normalizePet(input: Partial<PetConfig> | undefined): PetConfig {
  if (!input) return { ...DEFAULT_PET, custom: { ...DEFAULT_PET.custom } };
  // Merge stored values onto defaults so newly-added fields land safely
  // when an older config is rehydrated.
  return {
    ...DEFAULT_PET,
    ...input,
    custom: { ...DEFAULT_PET.custom, ...(input.custom ?? {}) },
  };
}

function normalizeNotifications(
  input: Partial<NotificationsConfig> | undefined,
): NotificationsConfig {
  return { ...DEFAULT_NOTIFICATIONS, ...(input ?? {}) };
}

function normalizeOrbit(input: Partial<OrbitConfig> | undefined): OrbitConfig {
  const time = typeof input?.time === 'string' && isValidOrbitTime(input.time)
    ? input.time
    : DEFAULT_ORBIT.time;
  return { ...DEFAULT_ORBIT, ...(input ?? {}), time };
}

function isValidOrbitTime(time: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function inferApiProtocol(_model: string, _baseUrl: string): ApiProtocol {
  // GLM is the sole BYOK protocol for Z-Design. This previously inspected
  // the base URL to pick among seven vendor protocols; it now always returns
  // 'glm'. Kept as a function because loadConfig's migration path still
  // calls it, and callers that derive a protocol from a model/URL keep a
  // stable seam if the protocol surface ever expands again.
  return 'glm';
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_CONFIG,
        pet: normalizePet(DEFAULT_PET),
        notifications: normalizeNotifications(DEFAULT_NOTIFICATIONS),
        orbit: normalizeOrbit(DEFAULT_ORBIT),
      };
    }
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    // Strip daemon-owned privacy fields if a stale localStorage payload
    // still carries them. Older builds wrote these to localStorage; we
    // now treat the daemon as authoritative so the user can rotate /
    // revoke without leaving residue in browser storage.
    for (const key of DAEMON_OWNED_KEYS) {
      delete (parsed as Record<string, unknown>)[key];
    }
    const parsedHasApiProtocol = Object.prototype.hasOwnProperty.call(
      parsed,
      'apiProtocol',
    );
    const merged: AppConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      apiProtocolConfigs: { ...(parsed.apiProtocolConfigs ?? {}) },
      mediaProviders: { ...(parsed.mediaProviders ?? {}) },
      composio: { ...(parsed.composio ?? {}) },
      agentModels: { ...(parsed.agentModels ?? {}) },
      agentCliEnv: { ...(parsed.agentCliEnv ?? {}) },
      agentCliEnvIntent: { ...(parsed.agentCliEnvIntent ?? {}) },
      accentColor: normalizeStoredAccentColor(parsed.accentColor),
      pet: normalizePet(parsed.pet),
      notifications: normalizeNotifications(parsed.notifications),
      orbit: normalizeOrbit(parsed.orbit),
    };

    // Migration v2: Z-Design ships GLM as the sole BYOK provider. Any saved
    // config carrying a legacy protocol literal (anthropic/openai/azure/google/
    // ollama/senseaudio/aihubmix) must be coerced to 'glm', or downstream
    // Record<ApiProtocol, X> lookups (DEFAULT_BASE_URL_BY_PROTOCOL, the model
    // list fetch, finalize request building) read `undefined` and crash at
    // runtime. This runs unconditionally for every config whose stored
    // migration version is below 2, including ones whose apiProtocol field
    // already exists — v1 only filled the field when it was absent, so an
    // existing-but-legacy value would otherwise leak through untouched. Also
    // drop any per-protocol config entry that isn't 'glm' (kept stale keys
    // would shadow the live GLM defaults) and reset the base URL/model to the
    // GLM defaults so the user isn't left pointed at a now-unsupported vendor.
    if ((parsed.configMigrationVersion ?? 0) < 2) {
      if (merged.apiProtocol !== 'glm') {
        merged.apiProtocol = 'glm';
        merged.baseUrl = 'https://open.bigmodel.cn/api/coding/paas/v4';
        merged.model = 'glm-5.2';
        merged.apiProviderBaseUrl = 'https://open.bigmodel.cn/api/coding/paas/v4';
        merged.apiProtocolConfigs = {};
      }
    }

    if (parsed.configMigrationVersion !== CONFIG_MIGRATION_VERSION) {
      // Migration v1: configs saved before apiProtocol existed need an explicit
      // protocol so old OpenAI-compatible endpoints keep routing correctly.
      // This is version-gated instead of only field-gated so a later imported
      // legacy config can be migrated when it is loaded.
      if (!parsedHasApiProtocol) {
        merged.apiProtocol = inferApiProtocol(merged.model, merged.baseUrl);
        // Also set apiProviderBaseUrl so setApiProtocol() can correctly identify
        // whether the user is on a known provider and switch defaults appropriately.
        // null means "custom/unknown provider" so the protocol switch won't override
        // their custom base URL. (The legacy Ollama base-URL normalization was
        // removed when the protocol surface collapsed to GLM-only.)
        const knownProvider = KNOWN_PROVIDERS.find(
          (p) => p.baseUrl === merged.baseUrl,
        );
        merged.apiProviderBaseUrl = knownProvider?.baseUrl ?? null;
      }
      merged.configMigrationVersion = CONFIG_MIGRATION_VERSION;
    }

    // Fixed-origin gateways (e.g. AIHubMix) hide the Base URL field, so a config
    // persisted before the origin was auto-resolved can carry an empty baseUrl.
    // Backfill it here so every consumer (Settings form, top-bar switcher, chat)
    // sees the canonical origin — an empty value otherwise blocks the live
    // model-list fetch and leaves only the static suggestion list.
    if (merged.apiProtocol) {
      merged.baseUrl = resolveFixedOriginBaseUrl(merged.apiProtocol, merged.baseUrl);
    }

    return merged;
  } catch {
    return {
      ...DEFAULT_CONFIG,
      pet: normalizePet(DEFAULT_PET),
      notifications: normalizeNotifications(DEFAULT_NOTIFICATIONS),
      orbit: normalizeOrbit(DEFAULT_ORBIT),
    };
  }
}

interface PublicComposioConfigResponse {
  configured?: boolean;
  apiKeyTail?: string;
}

interface PublicMediaProviderConfigEntry {
  configured?: boolean;
  source?: string;
  apiKeyTail?: string;
  baseUrl?: string;
  model?: string;
}

interface PublicMediaProviderConfigResponse {
  providers?: Record<string, PublicMediaProviderConfigEntry>;
}

export type DaemonMediaProvidersFetchResult =
  | {
    status: 'ok';
    providers: AppConfig['mediaProviders'];
  }
  | {
    status: 'error';
  };

interface MediaProviderDaemonWriteEntry {
  apiKey?: string;
  preserveApiKey?: boolean;
  baseUrl?: string;
  model?: string;
}

interface MediaProviderDaemonWriteRequest {
  providers: Record<string, MediaProviderDaemonWriteEntry>;
  force: boolean;
}

function hasAnyDaemonManagedMediaProvider(
  providers: Record<string, MediaProviderCredentials> | null | undefined,
): boolean {
  if (!providers) return false;
  return Object.values(providers).some((entry) => isStoredMediaProviderEntryPresent(entry));
}

function hasRecoverableLocalMediaProviderFields(
  entry: MediaProviderCredentials | null | undefined,
): boolean {
  return Boolean(
    entry?.apiKey?.trim()
    || entry?.baseUrl?.trim()
    || entry?.model?.trim(),
  );
}

function isMarkerOnlyMediaProviderEntry(
  entry: MediaProviderCredentials | null | undefined,
): boolean {
  return isStoredMediaProviderEntryPresent(entry)
    && !hasRecoverableLocalMediaProviderFields(entry);
}

export function isStoredMediaProviderEntryPresent(
  entry: MediaProviderCredentials | null | undefined,
): boolean {
  return Boolean(
    entry?.apiKey?.trim()
    || entry?.baseUrl?.trim()
    || entry?.model?.trim()
    || entry?.apiKeyConfigured
    || entry?.apiKeyTail?.trim(),
  );
}

export function isStoredMediaProviderEntryEmpty(
  entry: MediaProviderCredentials | null | undefined,
): boolean {
  return !isStoredMediaProviderEntryPresent(entry);
}

function defaultBaseUrlForProvider(providerId: string): string {
  return MEDIA_PROVIDERS.find((provider) => provider.id === providerId)?.defaultBaseUrl ?? '';
}

export function buildMediaProvidersForDaemonSave(
  currentProviders: Record<string, MediaProviderCredentials> | undefined,
  daemonProviders: Record<string, MediaProviderCredentials> | null | undefined,
  options?: { force?: boolean },
): MediaProviderDaemonWriteRequest {
  const providers: Record<string, MediaProviderDaemonWriteEntry> = {};
  for (const [providerId, currentEntry] of Object.entries(currentProviders ?? {})) {
    const daemonEntry = daemonProviders?.[providerId];
    const apiKey = currentEntry?.apiKey?.trim() ?? '';
    const hasStoredKeyMarker = Boolean(
      currentEntry?.apiKeyTail?.trim()
      || daemonEntry?.apiKeyTail?.trim(),
    );
    const preserveApiKey = !apiKey && Boolean(
      currentEntry?.apiKeyConfigured
      && hasStoredKeyMarker,
    );
    const explicitBaseUrl =
      currentEntry?.baseUrl?.trim()
      || daemonEntry?.baseUrl?.trim()
      || '';
    const model = currentEntry?.model?.trim() || daemonEntry?.model?.trim() || '';
    if (!apiKey && !preserveApiKey && !explicitBaseUrl && !model) continue;
    const baseUrl = explicitBaseUrl || defaultBaseUrlForProvider(providerId);
    providers[providerId] = {
      ...(apiKey ? { apiKey } : {}),
      ...(preserveApiKey ? { preserveApiKey: true } : {}),
      ...(baseUrl ? { baseUrl } : {}),
      ...(model ? { model } : {}),
    };
  }
  return {
    providers,
    force: Boolean(options?.force),
  };
}

export async function fetchComposioConfigFromDaemon(): Promise<AppConfig['composio'] | null> {
  try {
    const response = await fetch('/api/connectors/composio/config');
    if (!response.ok) return null;
    const payload = await response.json() as PublicComposioConfigResponse;
    return {
      apiKey: '',
      apiKeyConfigured: Boolean(payload.configured),
      apiKeyTail: payload.apiKeyTail ?? '',
    };
  } catch {
    return null;
  }
}

export async function fetchMediaProvidersFromDaemon(): Promise<DaemonMediaProvidersFetchResult> {
  try {
    const response = await fetch('/api/media/config');
    if (!response.ok) return { status: 'error' };
    const payload = await response.json() as PublicMediaProviderConfigResponse;
    const rawProviders = payload.providers ?? {};
    const providers: AppConfig['mediaProviders'] = {};
    for (const [providerId, entry] of Object.entries(rawProviders)) {
      providers[providerId] = {
        apiKey: '',
        apiKeyConfigured: Boolean(entry?.configured),
        apiKeyTail: entry?.apiKeyTail ?? '',
        baseUrl: entry?.baseUrl ?? '',
        ...(typeof entry?.source === 'string' && entry.source.trim()
          ? { source: entry.source.trim() }
          : {}),
        ...(typeof entry?.model === 'string' && entry.model.trim()
          ? { model: entry.model.trim() }
          : {}),
      };
    }
    return {
      status: 'ok',
      providers,
    };
  } catch {
    return { status: 'error' };
  }
}

export async function syncComposioConfigToDaemon(
  config: AppConfig['composio'] | undefined,
): Promise<boolean> {
  const apiKey = config?.apiKey ?? '';
  const payload = {
    ...(apiKey.trim() || !config?.apiKeyConfigured ? { apiKey } : {}),
  };
  try {
    const response = await fetch('/api/connectors/composio/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Privacy-sensitive fields the user can revoke. We deliberately keep
// these out of localStorage so the daemon remains the single source of
// truth: clearing app-config.json (or rotating via "Delete my data")
// fully resets the install identity, with no residual cohort key
// silently sitting in browser storage where the user can't see it.
const DAEMON_OWNED_KEYS = new Set<keyof AppConfig>([
  'installationId',
  'telemetry',
  'privacyDecisionAt',
]);

const AGENT_CLI_SECRET_ENV_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CODEX_API_KEY',
  'OPENAI_API_KEY',
]);

function sanitizeAgentCliEnv(agentCliEnv: AppConfig['agentCliEnv']): AppConfig['agentCliEnv'] {
  if (!agentCliEnv) return agentCliEnv;
  const sanitized: NonNullable<AppConfig['agentCliEnv']> = {};
  for (const [agentId, env] of Object.entries(agentCliEnv)) {
    const safeEnv = Object.fromEntries(
      Object.entries(env ?? {}).filter(([key]) => !AGENT_CLI_SECRET_ENV_KEYS.has(key)),
    );
    sanitized[agentId] = safeEnv;
  }
  return sanitized;
}

export function saveConfig(config: AppConfig): void {
  const sanitized: AppConfig = { ...config, agentCliEnv: sanitizeAgentCliEnv(config.agentCliEnv) };
  for (const key of DAEMON_OWNED_KEYS) {
    delete (sanitized as unknown as Record<string, unknown>)[key];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function mergeDaemonConfig(
  localConfig: AppConfig,
  daemonConfig: AppConfigPrefs | null,
): AppConfig {
  const next = { ...localConfig };
  if (!daemonConfig) return next;

  if (daemonConfig.onboardingCompleted != null) {
    next.onboardingCompleted = daemonConfig.onboardingCompleted;
  }
  if (daemonConfig.agentId !== undefined) {
    next.agentId = daemonConfig.agentId;
  }
  if (daemonConfig.skillId !== undefined) {
    next.skillId = daemonConfig.skillId;
  }
  if (daemonConfig.designSystemId !== undefined) {
    next.designSystemId = daemonConfig.designSystemId;
  }
  if (daemonConfig.agentModels) {
    next.agentModels = {
      ...(next.agentModels ?? {}),
      ...daemonConfig.agentModels,
    };
  }
  next.agentCliEnv = daemonConfig.agentCliEnv ?? {};
  next.agentCliEnvIntent = daemonConfig.agentCliEnvIntent ?? {};
  if (daemonConfig.disabledSkills !== undefined) {
    next.disabledSkills = daemonConfig.disabledSkills;
  }
  if (daemonConfig.disabledDesignSystems !== undefined) {
    next.disabledDesignSystems = daemonConfig.disabledDesignSystems;
  }
  if (daemonConfig.orbit !== undefined) {
    next.orbit = normalizeOrbit(daemonConfig.orbit);
  }
  if (daemonConfig.installationId !== undefined) {
    next.installationId = daemonConfig.installationId;
  }
  if (daemonConfig.telemetry !== undefined) {
    next.telemetry = { ...daemonConfig.telemetry };
  }
  if (daemonConfig.privacyDecisionAt !== undefined) {
    next.privacyDecisionAt = daemonConfig.privacyDecisionAt;
  } else if (
    daemonConfig.installationId !== undefined ||
    daemonConfig.telemetry !== undefined
  ) {
    // One-shot migration for configs created before privacyDecisionAt
    // existed. If the daemon already has an id or telemetry prefs, the user
    // has resolved the first-run prompt and should not see it again.
    next.privacyDecisionAt = Date.now();
  }
  // Default-on reporting. Unless the user has explicitly opted out
  // (Settings → "Don't share", which persists telemetry.metrics === false
  // together with installationId: null), an install reports with the
  // product's default telemetry channels on and carries a stable
  // installationId. This is the single source of the "Opted out" state:
  // previously an upgraded or never-prompted install could sit with
  // telemetry on but no id (the daemon ships a metrics+content default but
  // never mints an id), which the Settings → Privacy field rendered as
  // "Opted out" even though the user never declined. We mint the id and
  // keep the default channels on so the displayed state matches the product
  // default — the same metrics+content surface the first-run banner's "I
  // get it" opt-in enables (artifactManifest stays off, as it does there).
  // This does NOT override an explicit opt-out: metrics === false short-
  // circuits the whole block, and any channel the user already turned off
  // is preserved via the nullish-coalesce.
  const explicitlyOptedOut = next.telemetry?.metrics === false;
  if (!explicitlyOptedOut && !next.installationId) {
    next.installationId = randomUUID();
    next.telemetry = {
      metrics: true,
      content: next.telemetry?.content ?? true,
      artifactManifest: next.telemetry?.artifactManifest ?? false,
    };
  }
  if (daemonConfig.customInstructions !== undefined) {
    next.customInstructions = daemonConfig.customInstructions ?? undefined;
  }
  if (daemonConfig.projectLocations !== undefined) {
    next.projectLocations = daemonConfig.projectLocations;
  }
  if (daemonConfig.defaultProjectLocationId !== undefined) {
    next.defaultProjectLocationId = daemonConfig.defaultProjectLocationId ?? 'default';
  }
  return next;
}

export function mergeDaemonMediaProviders(
  localConfig: AppConfig,
  daemonProviders: AppConfig['mediaProviders'] | null,
  options?: {
    preserveLocalProviderIds?: ReadonlySet<string>;
  },
): AppConfig {
  if (daemonProviders == null) {
    return { ...localConfig };
  }

  if (!hasAnyDaemonManagedMediaProvider(daemonProviders)) {
    return {
      ...localConfig,
      mediaProviders: Object.fromEntries(
        Object.entries(localConfig.mediaProviders ?? {}).filter(([, entry]) => !isMarkerOnlyMediaProviderEntry(entry)),
      ),
    };
  }

  const mediaProviders = { ...(localConfig.mediaProviders ?? {}) };
  for (const [providerId, daemonEntry] of Object.entries(daemonProviders ?? {})) {
    if (!isStoredMediaProviderEntryPresent(daemonEntry)) continue;
    const localEntry = mediaProviders[providerId];
    const preserveLocalPendingEdit = Boolean(
      options?.preserveLocalProviderIds?.has(providerId)
      && hasRecoverableLocalMediaProviderFields(localEntry),
    );
    mediaProviders[providerId] = preserveLocalPendingEdit
      ? { ...daemonEntry, ...localEntry }
      : { ...daemonEntry };
  }

  return {
    ...localConfig,
    mediaProviders,
  };
}

export function hasAnyConfiguredProvider(
  providers: Record<string, MediaProviderCredentials> | undefined,
): boolean {
  if (!providers) return false;
  return Object.values(providers).some((entry) => isStoredMediaProviderEntryPresent(entry));
}

export function shouldSyncLocalMediaProvidersToDaemon(
  localProviders: Record<string, MediaProviderCredentials> | undefined,
  daemonProviders: Record<string, MediaProviderCredentials> | null | undefined,
): boolean {
  return daemonProviders != null
    && Object.values(localProviders ?? {}).some((entry) => hasRecoverableLocalMediaProviderFields(entry))
    && !hasAnyDaemonManagedMediaProvider(daemonProviders);
}

export async function syncMediaProvidersToDaemon(
  providers: Record<string, MediaProviderCredentials> | undefined,
  options?: {
    force?: boolean;
    daemonProviders?: Record<string, MediaProviderCredentials> | null;
    throwOnError?: boolean;
  },
): Promise<void> {
  if (!providers) return;
  try {
    const payload = buildMediaProvidersForDaemonSave(
      providers,
      options?.daemonProviders,
      { force: options?.force },
    );
    const response = await fetch('/api/media/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Failed to sync media config (${response.status})`);
  } catch {
    if (options?.throwOnError) throw new Error('Media config save failed');
    // Daemon offline; localStorage keeps the user's copy for the next save.
  }
}

export async function fetchDaemonConfig(): Promise<AppConfigPrefs | null> {
  try {
    const res = await fetch('/api/app-config');
    if (!res.ok) return null;
    const data = await res.json();
    return data?.config ?? null;
  } catch {
    return null;
  }
}

export async function syncConfigToDaemon(
  config: AppConfig,
  options?: { throwOnError?: boolean },
): Promise<void> {
  const prefs: AppConfigPrefs = {
    onboardingCompleted: config.onboardingCompleted,
    agentId: config.agentId,
    agentModels: config.agentModels,
    agentCliEnv: config.agentCliEnv,
    agentCliEnvIntent: config.agentCliEnvIntent,
    skillId: config.skillId,
    designSystemId: config.designSystemId,
    disabledSkills: config.disabledSkills,
    disabledDesignSystems: config.disabledDesignSystems,
    orbit: normalizeOrbit(config.orbit),
    installationId: config.installationId,
    telemetry: config.telemetry,
    privacyDecisionAt: config.privacyDecisionAt,
    customInstructions: config.customInstructions ?? null,
    projectLocations: config.projectLocations ?? [],
    defaultProjectLocationId: config.defaultProjectLocationId ?? 'default',
  };
  try {
    const response = await fetch('/api/app-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!response.ok) throw new Error(`Failed to sync app config (${response.status})`);
  } catch (error) {
    if (options?.throwOnError) throw error;
    // Daemon offline; localStorage keeps the user's copy for the next save.
  }
}
