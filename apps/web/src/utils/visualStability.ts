export const VISUAL_STABILITY_STORAGE_KEY = 'z-design:visual-stability';

export function isVisualStabilityMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VISUAL_STABILITY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
