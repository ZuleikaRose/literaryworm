// What to show when an Edge Function refuses: the shape is { error: { code, message } } (see
// supabase/functions/_shared/http.ts). Kept apart from accountApi.ts so it can be tested on its own.

export interface FunctionErrorPayload {
  error?: { code?: string; message?: string };
}

/** The words for a few refusals, already translated by the caller. */
export interface FunctionErrorWords {
  wrongPassword: string;
  staffOnly: string;
  tooMany: string;
}

export function functionErrorMessage(status: number, payload: FunctionErrorPayload | null, fallback: string, words: FunctionErrorWords): string {
  const code = payload?.error?.code;
  // "forbidden" is only ever a refused account password; a missing staff role is "staff_only".
  if (code === "forbidden") return words.wrongPassword;
  if (code === "staff_only") return words.staffOnly;
  if (status === 429) return words.tooMany;
  return payload?.error?.message ?? fallback;
}
