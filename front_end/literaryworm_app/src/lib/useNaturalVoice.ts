import { DEMO_NATURAL_SAMPLE } from "../data/demoUploads";
import { useActiveProfile, useStore } from "../store/context";
import type { Book } from "../types";
import { usesBackend } from "./backend";
import { naturalVoiceOffered } from "./naturalVoice";

/**
 * Where this book's natural voices come from for the active profile: "member" (a member's stored
 * upload, voiced by the natural-voice function), "demo" (the demo's Frankenstein sample, recorded
 * in public/voices/demo), or null (not offered: other books, Kids profiles, the demo's other uploads).
 */
export function useNaturalVoice(book: Book): "member" | "demo" | null {
  const { state } = useStore();
  const profile = useActiveProfile();
  const ageRating = profile?.ageRating ?? null;
  if (naturalVoiceOffered({ member: usesBackend && Boolean(state.account?.userId), ageRating, uploadPath: book.upload?.path ?? null })) return "member";
  if (state.account?.isDemo && book.upload && book.id === DEMO_NATURAL_SAMPLE && ageRating !== null && ageRating !== "kids") return "demo";
  return null;
}
