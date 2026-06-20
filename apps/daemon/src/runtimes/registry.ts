import { glmAgentDef } from './defs/glm.js';
import { readLocalAgentProfileDefs as readLocalAgentProfileDefsFromFile } from './local-profiles.js';
import type { RuntimeAgentDef } from './types.js';

// GLM is the sole built-in agent for GLM Design. The 23 legacy code-agent
// adapters (claude/codex/gemini/amr/qwen/...) were removed when the product
// narrowed to GLM-only. Their def files may still exist on disk for a short
// window but are no longer imported or registered, so `/api/agents` and the
// detection layer surface only GLM. The `glm-stream` branch in startChatRun
// routes GLM through the daemon-side agentic runner (no CLI spawn).
const BASE_AGENT_DEFS: RuntimeAgentDef[] = [
  glmAgentDef,
];

export function readLocalAgentProfileDefs(
  baseDefs: RuntimeAgentDef[] = BASE_AGENT_DEFS,
): RuntimeAgentDef[] {
  return readLocalAgentProfileDefsFromFile(baseDefs);
}

export const AGENT_DEFS: RuntimeAgentDef[] = [
  ...BASE_AGENT_DEFS,
  ...readLocalAgentProfileDefs(BASE_AGENT_DEFS),
];

const ids = new Set();
for (const def of AGENT_DEFS) {
  if (ids.has(def.id)) {
    throw new Error(`Duplicate agent definition id: ${def.id}`);
  }
  ids.add(def.id);
}

export function getAgentDef(id: string): RuntimeAgentDef | null {
  return AGENT_DEFS.find((a) => a.id === id) || null;
}
