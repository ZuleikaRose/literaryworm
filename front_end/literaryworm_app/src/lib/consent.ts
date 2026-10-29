// Termly's consent banner is loaded by the first script in index.html. It only wires up
// `.termly-display-preferences` links that exist when it starts, and React renders the footer
// later, so the link opens the preferences itself through Termly's global.
declare global {
  interface Window {
    displayPreferenceModal?: () => void;
  }
}

/**
 * Spread onto an element that loads from another site and the app needs (Google Books covers), so
 * Termly's auto-blocking doesn't hold it back until the visitor consents. It sets no cookies of ours.
 * Put it before `src`: Termly decides as the address is set.
 */
export const ESSENTIAL = { "data-categories": "essential" } as const;

/** Opens Termly's consent preferences; returns false when Termly isn't loaded (blocked or offline). */
export function openConsentPreferences(): boolean {
  if (typeof window.displayPreferenceModal !== "function") return false;
  window.displayPreferenceModal();
  return true;
}
