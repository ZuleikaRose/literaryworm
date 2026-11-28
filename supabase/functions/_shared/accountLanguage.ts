// The language to write an account's emails in (account_email_language() in the database). Any
// failure is English: an email is never held back for want of a language.
import { type EmailLanguage, emailLanguage } from "./emailI18n.ts";
import { serviceClient } from "./supabase.ts";

export async function accountLanguage(userId: string): Promise<EmailLanguage> {
  const { data, error } = await serviceClient().rpc("account_email_language", { p_user: userId });
  if (error) {
    console.error("emails: couldn't read the account's language:", error.message);
    return "en";
  }
  return emailLanguage(data);
}

/**
 * The language for each address in a batch (lower-cased address → language), one database call.
 * Addresses without an account, and any failure, are English.
 */
export async function addressLanguages(emails: string[]): Promise<(email: string) => EmailLanguage> {
  const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
  const found = new Map<string, EmailLanguage>();
  if (unique.length > 0) {
    const { data, error } = await serviceClient().rpc("email_languages", { p_emails: unique });
    if (error) console.error("emails: couldn't read the accounts' languages:", error.message);
    for (const row of (data ?? []) as { email: string; language: string }[]) found.set(row.email.toLowerCase(), emailLanguage(row.language));
  }
  return (email: string) => found.get(email.toLowerCase()) ?? "en";
}

/** A gift's buyer's language, for the gift emailed to its recipient. English on any failure. */
export async function giftBuyerLanguage(giftId: string): Promise<EmailLanguage> {
  const { data, error } = await serviceClient().rpc("gift_buyer_language", { p_gift: giftId });
  if (error) console.error("emails: couldn't read the gift buyer's language:", error.message);
  return emailLanguage(data);
}
