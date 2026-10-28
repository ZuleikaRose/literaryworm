import type { LegalPage, LegalSection } from "../data/legal";
import { AccountError } from "./accountApi";
import { supabase } from "./supabase";

/**
 * The footer's legal pages, live from Supabase (legal_pages: anyone reads; editors and admins edit).
 * Every message here is shown to people as is.
 */

type Row = { slug: string; title: string; summary: string; sections: LegalSection[]; updated_at: string };

const toPage = (row: Row): LegalPage => ({
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  sections: row.sections.length ? row.sections : undefined,
  updated: row.updated_at,
});

/** The live pages in footer order, or null without a backend. Rejects if they can't load. */
export async function loadLegalPages(): Promise<LegalPage[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("legal_pages").select("slug, title, summary, sections, updated_at").order("position");
  if (error) throw new AccountError("We couldn't load the latest policies.");
  return (data as Row[]).map(toPage);
}

/** Saves an edited page (editors and admins only; the database keeps the version it replaces). Returns it as saved. */
export async function saveLegalPage(slug: string, edit: { title: string; summary: string; sections: LegalSection[] }): Promise<LegalPage> {
  if (!supabase) throw new AccountError("Editing policies needs the LiteraryWorm backend.");
  const { data, error } = await supabase
    .from("legal_pages")
    .update({ title: edit.title.trim(), summary: edit.summary.trim(), sections: edit.sections })
    .eq("slug", slug)
    .select("slug, title, summary, sections, updated_at")
    .maybeSingle();
  if (error) {
    if (error.code === "23514" || /section/i.test(error.message)) {
      throw new AccountError("Each section needs a heading (up to 120 characters) and at least one paragraph (up to 5000 characters each).");
    }
    throw new AccountError("We couldn't save the page. Try again.");
  }
  // RLS returns nothing when the account isn't an admin.
  if (!data) throw new AccountError("Only LiteraryWorm editors and admins can edit policies.");
  return toPage(data as Row);
}
