/**
 * Reads vercel.json's route patterns the way Vercel does, for the tests that check it
 * (canonicalHeaders.test.ts, crawling.test.ts). Only the shapes vercel.json uses: `:name(a|b)`,
 * `:name` (one path segment) and `/:name*` (any number of segments, or none).
 */
export interface VercelHas {
  type: string;
  key: string;
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
  redirects: (VercelRoute & { permanent: boolean })[];
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
