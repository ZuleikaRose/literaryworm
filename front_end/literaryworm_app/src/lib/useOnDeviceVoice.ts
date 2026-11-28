import { useStore } from "../store/context";
import type { Book } from "../types";
import { usesBackend } from "./backend";
import { onDeviceOffered } from "./onDeviceVoice";

/** Whether the on-device natural voices are offered for `book` (members, English books; lib/onDeviceVoice.ts). */
export function useOnDeviceVoice(book: Book): boolean {
  const { state } = useStore();
  const member = usesBackend && Boolean(state.account?.userId) && !state.account?.isDemo;
  return onDeviceOffered({ member, language: book.language });
}
