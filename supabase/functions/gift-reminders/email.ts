// The note to a gift's buyer a few days before the day it starts. Inline styles only (email
// clients drop <style> blocks), matching supabase/templates and the other emails. The code itself
// isn't in it: the buyer sees it on the Gifts page, signed in.

export interface Gift {
  id: string;
  planId: "basic" | "standard" | "premium";
  months: 1 | 3 | 6 | 12;
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

/** "Sunday 14 March 2027": the day as written, whatever the time zone. */
export const giftDay = (startsOn: string) =>
  new Date(`${startsOn}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const length = (months: number) => (months === 12 ? "a year" : months === 1 ? "1 month" : `${months} months`);

export function giftStartEmail(input: { to: string; name: string | null; gift: Gift; site: string }): Email {
  const { gift } = input;
  const day = giftDay(gift.startsOn);
  const what = `${length(gift.months)} of ${PLAN_NAMES[gift.planId]}`;
  const subject = `Your LiteraryWorm gift starts on ${day}`;
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const lead = `The gift you bought, ${what}, can be redeemed from ${day}. If you haven't passed the code on yet, now's a good time.`;
  const page = `${input.site}/gifts`;
  const hint = "Your gifts and their codes are on the Gifts page when you're signed in";
  const why = "You're getting this because you bought a gift membership set to start on a later day. It's the only reminder we send about it.";
  const text = [hello, "", lead, "", `${hint}: ${page}`, "", why, "LiteraryWorm · https://www.literaryworm.com"].join("\n");

  const html = `<!doctype html>
<html lang="en">
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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Your gift starts soon</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;border-bottom:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(what)}</div>
                      <div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">Starts ${escapeHtml(day)}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">See your gifts</a>
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
