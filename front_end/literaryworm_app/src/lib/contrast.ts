/**
 * High contrast: whether the device asks for more contrast (iOS and macOS Increase contrast,
 * Windows contrast themes), which turns the accessibility menu's High contrast on at the start,
 * and the WCAG contrast ratio its colours are checked against (tokens.css; contrast.test.ts).
 */

/** True when the device asks for more contrast, or forces its own colours. */
export function prefersMoreContrast(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-contrast: more)").matches || window.matchMedia("(forced-colors: active)").matches;
}

/** Relative luminance of a #rrggbb colour (WCAG 2.2). */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two #rrggbb colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
