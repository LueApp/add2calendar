export function t(key, substitutions, fallback = '') {
  const value = globalThis.chrome?.i18n?.getMessage?.(key, substitutions);
  return value || fallback || key;
}
