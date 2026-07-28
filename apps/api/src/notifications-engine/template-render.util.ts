/**
 * Minimal `{{variable}}` interpolation - looks up each key directly on the
 * flat payload object. No nested-path/helper support; templates are simple
 * on purpose (see spec's fixed template category list).
 */
export function renderTemplate(template: string, payload: unknown): string {
  const data =
    (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}) ?? {};
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
