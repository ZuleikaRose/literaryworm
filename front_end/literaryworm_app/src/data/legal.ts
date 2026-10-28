import pages from "./legalPages.json";

/** The Children's Privacy Notice version a parent agrees to when creating a Kids profile. */
export const CHILDREN_NOTICE_VERSION = "2026-10";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalPage {
  slug: string;
  title: string;
  summary: string;
  /** The page in full, as sections; a page without them is a placeholder until legal provides copy. */
  sections?: LegalSection[];
  /** When the page last changed (ISO date or timestamp). */
  updated?: string;
}

/**
 * The footer's pages as built into the app (`legalPages.json`). The live copies are in Supabase
 * (`legal_pages`), where admins edit them (lib/useLegalPages.ts); these show until those load,
 * and whenever they can't (offline, the demo without a backend). `supabase/build-legal-seed.py`
 * turns this file into the database's first copy.
 */
export const legalPages: LegalPage[] = pages;

/** The same limits as the database. */
export const LEGAL_TITLE_MAX = 80;
export const LEGAL_SUMMARY_MAX = 600;
export const LEGAL_SECTIONS_MAX = 40;
export const LEGAL_HEADING_MAX = 120;
export const LEGAL_TEXT_MAX = 100_000;
