export const PRODUCT_NAME = "Open Design";

export const INTERNAL_PACKAGES = [
  { directory: "packages/components", name: "@z-design/components" },
  { directory: "packages/contracts", name: "@z-design/contracts" },
  { directory: "packages/registry-protocol", name: "@z-design/registry-protocol" },
  { directory: "packages/sidecar-proto", name: "@z-design/sidecar-proto" },
  { directory: "packages/launcher-proto", name: "@z-design/launcher-proto" },
  { directory: "packages/sidecar", name: "@z-design/sidecar" },
  { directory: "packages/platform", name: "@z-design/platform" },
  { directory: "packages/download", name: "@z-design/download" },
  { directory: "packages/host", name: "@z-design/host" },
  { directory: "packages/agui-adapter", name: "@z-design/agui-adapter" },
  { directory: "packages/plugin-runtime", name: "@z-design/plugin-runtime" },
  { directory: "packages/diagnostics", name: "@z-design/diagnostics" },
  { directory: "apps/daemon", name: "@z-design/daemon" },
  { directory: "apps/web", name: "@z-design/web" },
  { directory: "apps/desktop", name: "@z-design/desktop" },
  { directory: "apps/packaged", name: "@z-design/packaged" },
] as const;

export const DESKTOP_LOG_ECHO_ENV = "ZD_DESKTOP_LOG_ECHO";
export const WEB_STANDALONE_HOOK_CONFIG_ENV = "ZD_TOOLS_PACK_WEB_STANDALONE_HOOK_CONFIG";
export const WEB_STANDALONE_RESOURCE_NAME = "open-design-web-standalone";
export const ELECTRON_BUILDER_ASAR = false;
export const ELECTRON_BUILDER_BUILD_DEPENDENCIES_FROM_SOURCE = false;
export const ELECTRON_REBUILD_MODE = "sequential" as const;
export const ELECTRON_REBUILD_NATIVE_MODULES = ["better-sqlite3"] as const;
export const ELECTRON_BUILDER_FILE_PATTERNS = [
  "**/*",
  "!**/node_modules/.bin",
  "!**/node_modules/electron{,/**/*}",
  "!**/*.map",
  "!**/*.tsbuildinfo",
  "!**/.next/cache",
  "!**/.next/cache/**",
  "!**/node_modules/better-sqlite3/build/Release/obj",
  "!**/node_modules/better-sqlite3/build/Release/obj/**",
  "!**/node_modules/better-sqlite3/deps",
  "!**/node_modules/better-sqlite3/deps/**",
] as const;
// Keep Electron native UI resources aligned with the Web UI locale set.
// Electron uses underscore-separated locale ids; its base "es" resource
// covers the app's es-ES dictionary.
export const MAC_ELECTRON_LANGUAGES = [
  "en",
  "de",
  "zh_CN",
  "zh_TW",
  "pt_BR",
  "es",
  "ru",
  "fa",
  "ar",
  "ja",
  "ko",
  "pl",
  "hu",
  "fr",
  "uk",
  "tr",
] as const;
