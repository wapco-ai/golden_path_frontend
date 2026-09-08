export const DEFAULT_GUIDANCE_COVERAGE_RADIUS_M = 100;

// A stored radius (including the previous 10 m default) must survive editing.
export const coverageRadiusForForm = (value) => value ?? DEFAULT_GUIDANCE_COVERAGE_RADIUS_M;

// Mirrors the two-decimal metre column and the existing 100 m upper bound.
// Return null for incomplete input; never silently turn a blank input into a default.
export const parseCoverageRadius = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return null;
  const radius = Number(text);
  return Number.isFinite(radius) && radius >= 0.01 && radius <= 100 ? radius : null;
};
