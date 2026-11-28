// The note to a gift's buyer a few days before the day it starts, and the gift itself, emailed to
// its recipient when the buyer asked us to. Inline styles only (email clients drop <style>
// blocks), matching supabase/templates and the other emails. The buyer's reminder never has the
// code in it (they see it on the Gifts page, signed in); the recipient's email is the code. In the
// buyer's email language, or the recipient's when their address has an account (_shared/emailI18n.ts).

import { emailLocale, type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";

export interface Gift {
  id: string;
  /** A gift membership's plan and months; null for a gift card. */
  planId: "basic" | "standard" | "premium" | null;
  months: 1 | 3 | 6 | 12 | null;
  /** A gift card's credit in cents; null (or left out) for a gift membership. */
  creditCents?: number | null;
  voiceHours?: number | null;
  /** "YYYY-MM-DD": the first day it can be redeemed. */
  startsOn: string;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const PLAN_NAMES = { basic: "Basic", standard: "Standard", premium: "Premium" } as const;

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * "Sunday 14 March 2027": the day as written, whatever the time zone. Built from its parts, since
 * some ICU versions put a comma after the weekday (like meetingTime() in club-meetings).
 */
export function giftDay(startsOn: string, lang: EmailLanguage = "en"): string {
  if (lang !== "en") {
    return new Intl.DateTimeFormat(emailLocale(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${startsOn}T12:00:00Z`),
    );
  }
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).formatToParts(
    new Date(`${startsOn}T12:00:00Z`),
  );
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/** "3 months of Standard", or "a $50.00 gift card". Plan names stay as they are. */
export function giftWhat(gift: Pick<Gift, "planId" | "months" | "creditCents" | "voiceHours">, lang: EmailLanguage = "en"): string {
  const t = translator(lang);
  if (gift.voiceHours) return t("{n} hours of natural-voice reading", { n: gift.voiceHours });
  if (gift.creditCents) return t("a {amount} gift card", { amount: `$${(gift.creditCents / 100).toFixed(2)}` });
  const months = gift.months ?? 1;
  const plan = PLAN_NAMES[gift.planId ?? "basic"];
  if (months === 12) return t("a year of {plan}", { plan });
  if (months === 1) return t("1 month of {plan}", { plan });
  return t("{n} months of {plan}", { n: months, plan });
}

export function giftStartEmail(input: { to: string; name: string | null; gift: Gift; site: string; language?: EmailLanguage }): Email {
  const lang = input.language ?? "en";
  const t = translator(lang);
  const { gift } = input;
  const day = giftDay(gift.startsOn, lang);
  const what = giftWhat(gift, lang);
  const subject = t("Your LiteraryWorm gift starts on {day}", { day });
  const hello = input.name ? t("Hi {name},", { name: input.name }) : t("Hi,");
  const lead = t("The gift you bought, {what}, can be redeemed from {day}. If you haven't passed the code on yet, now's a good time.", { what, day });
  const page = `${input.site}/gifts`;
  const hint = t("Your gifts and their codes are on the Gifts page when you're signed in");
  const why = t("You're getting this because you bought a LiteraryWorm gift set to start on a later day. It's the only reminder we send about it.");
  const heading = t("Your gift starts soon");
  const starts = t("Starts {day}", { day });
  const button = t("See your gifts");
  const text = [hello, "", lead, "", `${hint}: ${page}`, "", why, "LiteraryWorm · https://www.literaryworm.com"].join("\n");

  const html = `<!doctype html>
<html ${htmlLang(lang)}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1e4cb;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(lead)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1e4cb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border:1px solid #e0d9cc;border-radius:14px;">
            <tr>
              <td style="padding:32px 32px 8px;${FONT}font-size:20px;font-weight:700;color:#1d1c1a;">
                Literary<span style="color:#a24e2f;">Worm</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;${FONT}color:#1d1c1a;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;border-bottom:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(what)}</div>
                      <div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(starts)}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(button)}</a>
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(hint)}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)}<br />
                LiteraryWorm · <a href="https://www.literaryworm.com" style="color:#a24e2f;">www.literaryworm.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
  return { to: input.to, subject, text, html };
}

/** A gift to email to its recipient (what claim_gift_deliveries() returns). */
export interface Delivery {
  gift: Omit<Gift, "startsOn"> & { code: string; startsOn: string | null };
  to: string;
  /** What the buyer wrote, if anything. */
  message: string | null;
  /** The buyer's display name; null when they have none (or deleted their account). */
  from: string | null;
  /** LiteraryWorm books that come with it, added to the library when it's redeemed. */
  books?: { title: string; author: string }[];
  /** The language to write it in: the recipient's if their address has an account, else the buyer's. */
  language?: EmailLanguage;
}

/** ABCD-EFGH-JKLM-NPQR, as the app shows codes (formatGiftCode() in src/lib/gifts.ts). */
export const formatGiftCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;

export function giftDeliveryEmail(input: { delivery: Delivery; site: string; language?: EmailLanguage }): Email {
  const lang = input.language ?? input.delivery.language ?? "en";
  const t = translator(lang);
  const { gift, message, from } = input.delivery;
  const books = input.delivery.books ?? [];
  const booksLead = books.length === 1
    ? t("It comes with a book, waiting in your library when you redeem it:")
    : t("It comes with these books, waiting in your library when you redeem it:");
  const what = giftWhat(gift, lang);
  const subject = from ? t("A LiteraryWorm gift from {from}", { from }) : t("You've been sent a LiteraryWorm gift");
  const lead = from
    ? t("{from} sent you {what} on LiteraryWorm: ebooks and audiobooks, with a profile for everyone at home.", { from, what })
    : t("Someone sent you {what} on LiteraryWorm: ebooks and audiobooks, with a profile for everyone at home.", { what });
  const code = formatGiftCode(gift.code);
  const page = `${input.site}/gifts?code=${gift.code}`;
  const hint = t("Sign in or create an account, then enter the code on the Gifts page or in Account. It doesn't expire");
  const why = from
    ? t(
      "You're getting this because {from} bought you a LiteraryWorm gift and asked us to email it to you. We don't keep your address once this is sent, and we won't email you again unless you sign up.",
      { from },
    )
    : t(
      "You're getting this because someone bought you a LiteraryWorm gift and asked us to email it to you. We don't keep your address once this is sent, and we won't email you again unless you sign up.",
    );
  const hi = t("Hi,");
  const wrote = from ? t("{from} wrote:", { from }) : t("They wrote:");
  const byAuthor = (author: string) => t("by {author}", { author });
  const yourCode = t("Your code");
  const heading = t("A gift for you");
  const button = t("Redeem your gift");
  const text = [
    hi,
    "",
    lead,
    ...(message ? ["", wrote, message] : []),
    ...(books.length ? ["", booksLead, ...books.map((b) => `- ${b.title}, ${byAuthor(b.author)}`)] : []),
    "",
    `${yourCode}: ${code}`,
    "",
    `${hint}: ${page}`,
    "",
    why,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const quote = message
    ? `<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #a24e2f;background:#f1e4cb;font-size:16px;line-height:1.55;white-space:pre-line;">${escapeHtml(message)}</p>`
    : "";
  const html = `<!doctype html>
<html ${htmlLang(lang)}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1e4cb;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(lead)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1e4cb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border:1px solid #e0d9cc;border-radius:14px;">
            <tr>
              <td style="padding:32px 32px 8px;${FONT}font-size:20px;font-weight:700;color:#1d1c1a;">
                Literary<span style="color:#a24e2f;">Worm</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;${FONT}color:#1d1c1a;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hi)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                ${quote}
                ${
    books.length
      ? `<p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(booksLead)}</p><ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.55;">${books
        .map((b) => `<li><strong>${escapeHtml(b.title)}</strong> <span style="color:#5b5750;">${escapeHtml(byAuthor(b.author))}</span></li>`)
        .join("")}</ul>`
      : ""
  }
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;border-bottom:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:15px;color:#3d3a35;">${escapeHtml(yourCode)}</div>
                      <div style="margin-top:4px;font-size:22px;font-weight:700;letter-spacing:1px;color:#1d1c1a;font-family:Consolas,'Courier New',monospace;">${escapeHtml(code)}</div>
                      <div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(what)}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(button)}</a>
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(hint)}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)}<br />
                LiteraryWorm · <a href="https://www.literaryworm.com" style="color:#a24e2f;">www.literaryworm.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
  return { to: input.delivery.to, subject, text, html };
}
