export const OPEN_DESIGN_HOST_GLOBAL = "__od__";
export const OPEN_DESIGN_HOST_VERSION = 2;

export const OPEN_DESIGN_HOST_CLIENT_TYPES = Object.freeze({
  DESKTOP: "desktop",
} as const);

export type ZDesignHostClientType =
  (typeof OPEN_DESIGN_HOST_CLIENT_TYPES)[keyof typeof OPEN_DESIGN_HOST_CLIENT_TYPES];

export type ZDesignHostClient = {
  // BCP-47 locale string (e.g. "zh-CN", "pt-BR") the host process read from
  // the OS at startup. The renderer uses this so the packaged desktop app
  // can follow the OS language even when Chromium's built-in
  // `navigator.language` would have defaulted to en-US.
  osLocale?: string;
  platform?: string;
  type: ZDesignHostClientType;
};

export type ZDesignHostFailure = {
  details?: unknown;
  ok: false;
  reason: string;
};

export type ZDesignHostActionResult =
  | { ok: true }
  | ZDesignHostFailure;

export type ZDesignHostProjectImportInit = {
  designSystemId?: string | null;
  name?: string;
  skillId?: string | null;
};

export type ZDesignHostProjectImportSuccess = {
  conversationId: string;
  entryFile: string | null;
  ok: true;
  projectId: string;
};

export type ZDesignHostProjectImportResult =
  | ZDesignHostProjectImportSuccess
  | {
      canceled: true;
      ok: false;
    }
  | ZDesignHostFailure;

export type ZDesignHostProjectReplaceWorkingDirSuccess = {
  baseDir: string;
  entryFile: string | null;
  ok: true;
};

export type ZDesignHostProjectReplaceWorkingDirResult =
  | ZDesignHostProjectReplaceWorkingDirSuccess
  | {
      canceled: true;
      ok: false;
    }
  | ZDesignHostFailure;

export type ZDesignHostPickWorkingDirSuccess = {
  baseDir: string;
  ok: true;
  // Single-use HMAC token (minted by the host main process for `baseDir`)
  // that the renderer threads into POST /api/projects/:id/working-dir once
  // the project exists. Lets the Home flow pick a folder before the project
  // is created without exposing the daemon's desktop-auth gate.
  token: string;
};

export type ZDesignHostPickWorkingDirResult =
  | ZDesignHostPickWorkingDirSuccess
  | {
      canceled: true;
      ok: false;
    }
  | ZDesignHostFailure;

export type ZDesignHostPdfPrintOptions = {
  deck?: boolean;
};

export type ZDesignHostCaptureClip = { x: number; y: number; width: number; height: number };
export type ZDesignHostCaptureOptions = { clip?: ZDesignHostCaptureClip };
export type ZDesignHostCaptureSuccess = { dataUrl: string; h: number; ok: true; w: number };
export type ZDesignHostCaptureResult = ZDesignHostCaptureSuccess | ZDesignHostFailure;

export type ZDesignHostBrowserClearDataOptions = {
  cookies?: boolean;
  storage?: boolean;
};

export const OPEN_DESIGN_HOST_UPDATER_ACTIONS = Object.freeze({
  CHECK: "check",
  DOWNLOAD: "download",
  INSTALL: "install",
  QUIT: "quit",
  STATUS: "status",
} as const);

export type ZDesignHostUpdaterAction =
  (typeof OPEN_DESIGN_HOST_UPDATER_ACTIONS)[keyof typeof OPEN_DESIGN_HOST_UPDATER_ACTIONS];
type ZDesignHostUpdaterStatusAction = Exclude<
  ZDesignHostUpdaterAction,
  typeof OPEN_DESIGN_HOST_UPDATER_ACTIONS.QUIT
>;

export const OPEN_DESIGN_HOST_UPDATER_STATES = Object.freeze({
  AVAILABLE: "available",
  CHECKING: "checking",
  DOWNLOADED: "downloaded",
  DOWNLOADING: "downloading",
  ERROR: "error",
  IDLE: "idle",
  INSTALLING: "installing",
  NOT_AVAILABLE: "not-available",
  UNSUPPORTED: "unsupported",
} as const);

export type ZDesignHostUpdaterState =
  (typeof OPEN_DESIGN_HOST_UPDATER_STATES)[keyof typeof OPEN_DESIGN_HOST_UPDATER_STATES];

export type ZDesignHostUpdaterMode = "js-incremental" | "package-launcher";
export type ZDesignHostUpdaterChannel = "beta" | "nightly" | "preview" | "stable";

export type ZDesignHostUpdaterActionOptions = {
  payload?: Record<string, unknown>;
};

export type ZDesignHostUpdaterCapabilitySet = {
  canApplyInPlace: boolean;
  canDownload: boolean;
  canOpenInstaller: boolean;
  requiresManualInstall: boolean;
};

export type ZDesignHostUpdaterPathSnapshot = {
  downloadRoot?: string;
  manifestPath?: string;
};

export type ZDesignHostUpdaterChecksumSnapshot = {
  algorithm: "sha256" | "sha512";
  url?: string;
  value?: string;
};

export type ZDesignHostUpdaterArtifactSnapshot = {
  name?: string;
  platformKey?: string;
  size?: number;
  type?: string;
  url: string;
};

export type ZDesignHostUpdaterProgressSnapshot = {
  receivedBytes: number;
  totalBytes?: number;
};

export type ZDesignHostUpdaterErrorSnapshot = {
  code: string;
  details?: unknown;
  message: string;
};

export type ZDesignHostUpdaterInstallResult = {
  activeVersion?: string;
  artifactPath?: string;
  dryRun?: boolean;
  helperLogPath?: string;
  launcherRuntimePath?: string;
  launchPath?: string;
  openedAt: string;
  path: string;
};

export type ZDesignHostUpdaterReleaseSnapshot = {
  arch: string;
  artifact: ZDesignHostUpdaterArtifactSnapshot;
  checksum: ZDesignHostUpdaterChecksumSnapshot;
  channel: ZDesignHostUpdaterChannel;
  downloadedAt: string;
  key: string;
  metadata?: Record<string, unknown>;
  path: string;
  platformKey: string;
  version: string;
};

export type ZDesignHostUpdaterIncomingSnapshot = {
  arch: string;
  artifact: ZDesignHostUpdaterArtifactSnapshot;
  channel: ZDesignHostUpdaterChannel;
  key?: string;
  metadata?: Record<string, unknown>;
  progress?: ZDesignHostUpdaterProgressSnapshot;
  startedAt: string;
  version: string;
};

export type ZDesignHostUpdaterCacheLifecycleTrigger = "cold-start" | "next-version-ready";

export type ZDesignHostUpdaterReleaseLifecycleState =
  | "cleanup-deferred"
  | "cleanup-removed"
  | "deprecated"
  | "retained"
  | "unknown";

export type ZDesignHostUpdaterCacheLifecycleSummary = {
  lastRunAt?: string;
  lastTrigger?: ZDesignHostUpdaterCacheLifecycleTrigger;
  platform: string;
  releases: {
    cleanupDeferred: number;
    cleanupRemoved: number;
    deprecated: number;
    errors: number;
    retained: number;
    total: number;
    unknown: number;
  };
};

export type ZDesignHostUpdaterCacheSnapshot = {
  lifecycle?: ZDesignHostUpdaterCacheLifecycleSummary;
};

export type ZDesignHostUpdaterStatusSnapshot = {
  active?: ZDesignHostUpdaterReleaseSnapshot;
  arch: string;
  artifact?: ZDesignHostUpdaterArtifactSnapshot;
  artifactUrl?: string;
  availableVersion?: string;
  cache?: ZDesignHostUpdaterCacheSnapshot;
  capabilities: ZDesignHostUpdaterCapabilitySet;
  channel: ZDesignHostUpdaterChannel;
  checksum?: ZDesignHostUpdaterChecksumSnapshot;
  currentVersion: string;
  downloadPath?: string;
  enabled: boolean;
  error?: ZDesignHostUpdaterErrorSnapshot;
  incoming?: ZDesignHostUpdaterIncomingSnapshot;
  installResult?: ZDesignHostUpdaterInstallResult;
  lastCheckedAt?: string;
  metadata?: Record<string, unknown>;
  mode: ZDesignHostUpdaterMode;
  paths?: ZDesignHostUpdaterPathSnapshot;
  platform: string;
  progress?: ZDesignHostUpdaterProgressSnapshot;
  state: ZDesignHostUpdaterState;
  supported: boolean;
};

export type ZDesignHostUpdaterResult =
  | { ok: true; status: ZDesignHostUpdaterStatusSnapshot }
  | ZDesignHostFailure;

export type ZDesignHostUpdaterStatusListener = (status: ZDesignHostUpdaterStatusSnapshot) => void;

export type ZDesignHostBridge = {
  browser: {
    clearData(options?: ZDesignHostBrowserClearDataOptions): Promise<ZDesignHostActionResult>;
  };
  capture: {
    page(options?: ZDesignHostCaptureOptions): Promise<ZDesignHostCaptureResult>;
  };
  client: ZDesignHostClient;
  pdf: {
    print(html: string, nonce?: string, options?: ZDesignHostPdfPrintOptions): Promise<ZDesignHostActionResult>;
  };
  pet: {
    setVisible(visible: boolean): void;
  };
  project: {
    pickAndImport(init?: ZDesignHostProjectImportInit): Promise<ZDesignHostProjectImportResult>;
    pickAndReplaceWorkingDir(projectId: string): Promise<ZDesignHostProjectReplaceWorkingDirResult>;
    // Optional so older host builds still satisfy the bridge shape; callers
    // must feature-detect before invoking.
    pickWorkingDir?(): Promise<ZDesignHostPickWorkingDirResult>;
  };
  shell: {
    openExternal(url: string): Promise<ZDesignHostActionResult>;
    openPath(projectId: string): Promise<ZDesignHostActionResult>;
  };
  updater: {
    check(options?: ZDesignHostUpdaterActionOptions): Promise<ZDesignHostUpdaterStatusSnapshot>;
    download(options?: ZDesignHostUpdaterActionOptions): Promise<ZDesignHostUpdaterStatusSnapshot>;
    install(options?: ZDesignHostUpdaterActionOptions): Promise<ZDesignHostUpdaterStatusSnapshot>;
    quit(options?: ZDesignHostUpdaterActionOptions): Promise<ZDesignHostActionResult>;
    status(options?: ZDesignHostUpdaterActionOptions): Promise<ZDesignHostUpdaterStatusSnapshot>;
    subscribe(listener: ZDesignHostUpdaterStatusListener): () => void;
  };
  version: typeof OPEN_DESIGN_HOST_VERSION;
};

export type ZDesignHostGlobalScope = Record<string, unknown> & {
  window?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function failure(reason: string, details?: unknown): ZDesignHostFailure {
  return {
    ...(details === undefined ? {} : { details }),
    ok: false,
    reason,
  };
}

function hasFunction(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "function";
}

export function isZDesignHostBridge(value: unknown): value is ZDesignHostBridge {
  if (!isRecord(value)) return false;
  if (value.version !== OPEN_DESIGN_HOST_VERSION) return false;
  const client = value.client;
  if (!isRecord(client) || client.type !== OPEN_DESIGN_HOST_CLIENT_TYPES.DESKTOP) return false;
  if (client.platform != null && typeof client.platform !== "string") return false;
  if (client.osLocale != null && typeof client.osLocale !== "string") return false;

  const shell = value.shell;
  if (!isRecord(shell) || !hasFunction(shell, "openExternal") || !hasFunction(shell, "openPath")) return false;

  const browser = value.browser;
  if (!isRecord(browser) || !hasFunction(browser, "clearData")) return false;

  const capture = value.capture;
  if (!isRecord(capture) || !hasFunction(capture, "page")) return false;

  const project = value.project;
  if (
    !isRecord(project) ||
    !hasFunction(project, "pickAndImport") ||
    !hasFunction(project, "pickAndReplaceWorkingDir")
  ) {
    return false;
  }

  const pdf = value.pdf;
  if (!isRecord(pdf) || !hasFunction(pdf, "print")) return false;

  const pet = value.pet;
  if (!isRecord(pet) || !hasFunction(pet, "setVisible")) return false;

  const updater = value.updater;
  if (
    !isRecord(updater) ||
    !hasFunction(updater, "status") ||
    !hasFunction(updater, "check") ||
    !hasFunction(updater, "download") ||
    !hasFunction(updater, "install") ||
    !hasFunction(updater, "quit") ||
    !hasFunction(updater, "subscribe")
  ) {
    return false;
  }

  return true;
}

/**
 * Converts a privileged host adapter's raw project-import result into the
 * host-owned renderer contract. The adapter may internally call daemon APIs,
 * but only project identifiers cross the host bridge.
 */
export function normalizeZDesignHostProjectImportResult(input: unknown): ZDesignHostProjectImportResult {
  if (!isRecord(input)) {
    return failure("desktop import returned an invalid response", input);
  }
  if (input.ok !== true) {
    if (input.canceled === true) return { canceled: true, ok: false };
    const reason = typeof input.reason === "string" && input.reason.length > 0
      ? input.reason
      : "unknown failure";
    return failure(reason, input.details);
  }

  const response = input.response;
  if (!isRecord(response)) {
    return failure("daemon import response was not an object", response);
  }
  const project = response.project;
  const rawProjectId = isRecord(project) ? project.id : null;
  const projectId = typeof rawProjectId === "string" ? rawProjectId : null;
  const conversationId = typeof response.conversationId === "string" ? response.conversationId : null;
  const entryFile =
    typeof response.entryFile === "string" || response.entryFile === null
      ? response.entryFile
      : undefined;
  if (projectId == null || conversationId == null || entryFile === undefined) {
    return failure("daemon import response did not include host project identifiers", response);
  }

  return {
    conversationId,
    entryFile,
    ok: true,
    projectId,
  };
}

export function normalizeZDesignHostProjectReplaceWorkingDirResult(
  input: unknown,
): ZDesignHostProjectReplaceWorkingDirResult {
  if (!isRecord(input)) {
    return failure("desktop working-dir replace returned an invalid response", input);
  }
  if (input.ok !== true) {
    if (input.canceled === true) return { canceled: true, ok: false };
    const reason = typeof input.reason === "string" && input.reason.length > 0
      ? input.reason
      : "unknown failure";
    return failure(reason, input.details);
  }

  const response = input.response;
  if (!isRecord(response)) {
    return failure("daemon working-dir response was not an object", response);
  }
  const baseDir = typeof response.baseDir === "string" ? response.baseDir : null;
  const entryFile = typeof response.entryFile === "string" ? response.entryFile : null;
  if (baseDir == null) {
    return failure("daemon working-dir response did not include baseDir", response);
  }

  return { baseDir, entryFile, ok: true };
}

export function normalizeZDesignHostPickWorkingDirResult(
  input: unknown,
): ZDesignHostPickWorkingDirResult {
  if (!isRecord(input)) {
    return failure("desktop working-dir pick returned an invalid response", input);
  }
  if (input.ok !== true) {
    if (input.canceled === true) return { canceled: true, ok: false };
    const reason = typeof input.reason === "string" && input.reason.length > 0
      ? input.reason
      : "unknown failure";
    return failure(reason, input.details);
  }
  const baseDir = typeof input.baseDir === "string" ? input.baseDir : null;
  const token = typeof input.token === "string" ? input.token : null;
  if (baseDir == null || token == null) {
    return failure("desktop working-dir pick did not include baseDir and token", input);
  }
  return { baseDir, ok: true, token };
}

function candidateFromScope(scope: ZDesignHostGlobalScope): unknown {
  if (OPEN_DESIGN_HOST_GLOBAL in scope) return scope[OPEN_DESIGN_HOST_GLOBAL];
  const windowValue = scope.window;
  if (isRecord(windowValue) && OPEN_DESIGN_HOST_GLOBAL in windowValue) {
    return windowValue[OPEN_DESIGN_HOST_GLOBAL];
  }
  return undefined;
}

export function getZDesignHost(scope: ZDesignHostGlobalScope = globalThis): ZDesignHostBridge | null {
  const candidate = candidateFromScope(scope);
  return isZDesignHostBridge(candidate) ? candidate : null;
}

export function isZDesignHostAvailable(scope: ZDesignHostGlobalScope = globalThis): boolean {
  return getZDesignHost(scope) != null;
}

export function detectZDesignHostClientType(scope: ZDesignHostGlobalScope = globalThis): ZDesignHostClientType | "web" {
  return getZDesignHost(scope)?.client.type ?? "web";
}

function unavailable(reason: string): ZDesignHostFailure {
  return failure(reason);
}

export async function openHostExternalUrl(url: string, scope: ZDesignHostGlobalScope = globalThis): Promise<ZDesignHostActionResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.shell.openExternal(url);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function openHostProjectPath(projectId: string, scope: ZDesignHostGlobalScope = globalThis): Promise<ZDesignHostActionResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.shell.openPath(projectId);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function clearHostBrowserData(
  options?: ZDesignHostBrowserClearDataOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostActionResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.browser.clearData(options);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function captureHostPage(
  options?: ZDesignHostCaptureOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostCaptureResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.capture.page(options);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function pickAndImportHostProject(
  init?: ZDesignHostProjectImportInit,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostProjectImportResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.project.pickAndImport(init);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function pickAndReplaceHostProjectWorkingDir(
  projectId: string,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostProjectReplaceWorkingDirResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.project.pickAndReplaceWorkingDir(projectId);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

// Picks a folder via the host's native dialog and returns the chosen path
// plus a single-use token, WITHOUT touching any project. The Home flow uses
// this to let the user choose a working directory before the project exists;
// the token is later spent on POST /api/projects/:id/working-dir.
export async function pickHostWorkingDir(
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostPickWorkingDirResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  if (typeof host.project.pickWorkingDir !== "function") {
    return unavailable("host build does not support pickWorkingDir");
  }
  try {
    return await host.project.pickWorkingDir();
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function printHostPdf(
  html: string,
  nonce?: string,
  options?: ZDesignHostPdfPrintOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostActionResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.pdf.print(html, nonce, options);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export function setHostPetVisible(visible: boolean, scope: ZDesignHostGlobalScope = globalThis): ZDesignHostActionResult {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    host.pet.setVisible(visible);
    return { ok: true };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

async function runHostUpdaterAction(
  action: ZDesignHostUpdaterStatusAction,
  options?: ZDesignHostUpdaterActionOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostUpdaterResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return {
      ok: true,
      status: await host.updater[action](options),
    };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function getHostUpdaterStatus(
  options?: ZDesignHostUpdaterActionOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostUpdaterResult> {
  return await runHostUpdaterAction(OPEN_DESIGN_HOST_UPDATER_ACTIONS.STATUS, options, scope);
}

export async function checkHostUpdater(
  options?: ZDesignHostUpdaterActionOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostUpdaterResult> {
  return await runHostUpdaterAction(OPEN_DESIGN_HOST_UPDATER_ACTIONS.CHECK, options, scope);
}

export async function downloadHostUpdater(
  options?: ZDesignHostUpdaterActionOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostUpdaterResult> {
  return await runHostUpdaterAction(OPEN_DESIGN_HOST_UPDATER_ACTIONS.DOWNLOAD, options, scope);
}

export async function installHostUpdater(
  options?: ZDesignHostUpdaterActionOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostUpdaterResult> {
  return await runHostUpdaterAction(OPEN_DESIGN_HOST_UPDATER_ACTIONS.INSTALL, options, scope);
}

export async function quitHostAfterUpdaterInstallerOpen(
  options?: ZDesignHostUpdaterActionOptions,
  scope: ZDesignHostGlobalScope = globalThis,
): Promise<ZDesignHostActionResult> {
  const host = getZDesignHost(scope);
  if (host == null) return unavailable("Open Design host is not available");
  try {
    return await host.updater.quit(options);
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export function subscribeHostUpdater(
  listener: ZDesignHostUpdaterStatusListener,
  scope: ZDesignHostGlobalScope = globalThis,
): () => void {
  const host = getZDesignHost(scope);
  if (host == null) return () => undefined;
  try {
    return host.updater.subscribe(listener);
  } catch {
    return () => undefined;
  }
}
