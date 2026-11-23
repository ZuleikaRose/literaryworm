/**
 * Reads vercel.json's route patterns the way Vercel does, for the tests that check it
 * (canonicalHeaders.test.ts, crawling.test.ts). Only the shapes vercel.json uses: `:name(a|b)`,
 * `:name` (one path segment) and `/:name*` (any number of segments, or none).
 */
export interface VercelHas {
  type: string;
  key: string;
  /** A pattern the value must match in full; its named groups can be used in the destination. */
  value?: string;
}
export interface VercelHeaderRule {
  source: string;
  has?: VercelHas[];
  headers: { key: string; value: string }[];
}
export interface VercelRoute {
  source: string;
  destination: string;
}
export interface VercelConfig {
  cleanUrls?: boolean;
  trailingSlash?: boolean;
  redirects: (VercelRoute & { permanent: boolean; has?: VercelHas[] })[];
  rewrites: VercelRoute[];
  headers: VercelHeaderRule[];
}

export function compileSource(source: string): RegExp {
  const pattern = source
    .replace(/\/:(\w+)\*/g, "(?:/(?<$1>.*))?")
    .replace(/:(\w+)\(([^)]+)\)/g, "(?<$1>$2)")
    .replace(/:(\w+)(?![\w(>])/g, "(?<$1>[^/]+?)");
  return new RegExp(`^${pattern}$`);
}

/** The header values a rule set gives an address (path and optional query), with its :names filled in. */
export function headerValues(config: VercelConfig, address: string, key: string): string[] {
  const url = new URL(address, "https://www.literaryworm.com");
  return config.headers.flatMap((rule) => {
    const match = url.pathname.match(compileSource(rule.source));
    if (!match) return [];
    if (rule.has?.some((h) => h.type === "query" && !url.searchParams.has(h.key))) return [];
    return rule.headers
      .filter((h) => h.key === key)
      .map((h) => h.value.replace(/:(\w+)/g, (all, name: string) => match.groups?.[name] ?? all));
  });
}

/** Where the rewrites send a path, or null when none matches (Vercel then answers 404). */
export function rewriteFor(config: VercelConfig, path: string): string | null {
  const rule = config.rewrites.find((r) => compileSource(r.source).test(path));
  return rule?.destination ?? null;
}

/**
 * Where the redirects send an address (path and optional query), with its :names filled in from the
 * path and from `has` query patterns, or null when none matches. Vercel tries redirects before
 * anything else, in order.
 */
export function redirectFor(config: VercelConfig, address: string): string | null {
  const url = new URL(address, "https://www.literaryworm.com");
  for (const rule of config.redirects) {
    const match = url.pathname.match(compileSource(rule.source));
    if (!match) continue;
    const groups: Record<string, string> = { ...match.groups };
    const met = (rule.has ?? []).every((h) => {
      if (h.type !== "query") return false;
      const value = url.searchParams.get(h.key);
      if (value === null) return false;
      if (h.value === undefined) return true;
      const found = value.match(new RegExp(`^(?:${h.value})$`));
      Object.assign(groups, found?.groups);
      return Boolean(found);
    });
    if (met) return rule.destination.replace(/:(\w+)/g, (all, name: string) => groups[name] ?? all);
  }
  return null;
}
