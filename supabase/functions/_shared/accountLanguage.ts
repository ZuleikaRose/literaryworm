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
