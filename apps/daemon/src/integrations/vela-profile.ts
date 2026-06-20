// @ts-nocheck
const AMR_PROFILE_ENV = 'OPEN_DESIGN_AMR_PROFILE';
const DEFAULT_PROFILE = 'prod';
const ALLOWED_PROFILES = new Set(['prod', 'test', 'local']);
export function resolveAmrProfile(env = process.env) {
    const raw = (env[AMR_PROFILE_ENV] || '').trim();
    if (!raw)
        return DEFAULT_PROFILE;
    if (ALLOWED_PROFILES.has(raw))
        return raw;
    console.warn(`[amr] invalid ${AMR_PROFILE_ENV}="${raw}"; falling back to ${DEFAULT_PROFILE}`);
    return DEFAULT_PROFILE;
}
export function amrVelaProfileEnv(env = process.env) {
    return { VELA_PROFILE: resolveAmrProfile(env) };
}
