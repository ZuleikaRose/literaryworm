import { useActiveProfile, useStore } from "../store/context";
import type { Book } from "../types";
import { usesBackend } from "./backend";
import { naturalVoiceOffered } from "./naturalVoice";

/** Whether the active profile is offered natural voices for this book (a member's stored upload, not on Kids). */
export function useNaturalVoiceOffered(book: Book): boolean {
  const { state } = useStore();
  const profile = useActiveProfile();
  return naturalVoiceOffered({
    member: usesBackend && Boolean(state.account?.userId),
    ageRating: profile?.ageRating ?? null,
    uploadPath: book.upload?.path ?? null,
  });
}
