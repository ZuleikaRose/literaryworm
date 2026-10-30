// The monthly What's new email: last month's major changes only, with a link to the page for
// everything else. Inline styles only (email clients drop <style> blocks), matching
// supabase/templates.

export interface Entry {
  kind: "feature" | "fix" | "update";
  title: string;
  body: string;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";
const KIND: Record<Entry["kind"], string> = { feature: "New", fix: "Fixed", update: "Updated" };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "October 2026" for the first day of a month (YYYY-MM-01). */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

export function whatsNewEmail(input: {
  to: string;
  name: string | null;
  month: string;
  entries: Entry[];
  site: string;
  /** The one-click unsubscribe page for this account. */
  unsubscribe: string;
}): Email {
  const when = monthName(input.month);
  const page = `${input.site}/whats-new`;
  const settings = `${input.site}/account#preferences`;
  const subject = `What's new in LiteraryWorm: ${when}`;
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const lead = `The biggest changes in ${when}.`;

  const text = [
    hello,
    "",
    lead,
    "",
    ...input.entries.flatMap((e) => [`${KIND[e.kind]}: ${e.title}`, e.body, ""]),
    `See everything that changed, including smaller fixes: ${page}`,
    "",
    `You're getting this because you turned on the monthly round-up. Unsubscribe in one click: ${input.unsubscribe}`,
    `Or change your email settings: ${settings}`,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const rows = input.entries
    .map(
      (e) => `<tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#a24e2f;">${KIND[e.kind]}</div>
                      <div style="margin-top:4px;font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(e.title)}</div>
                      <div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(e.body)}</div>
                    </td>
                  </tr>`,
    )
    .join("\n");

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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">What's new in ${escapeHtml(when)}</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">See everything that changed</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                You're getting this because you turned on the monthly round-up. <a href="${escapeHtml(input.unsubscribe)}" style="color:#a24e2f;">Unsubscribe in one click</a> or <a href="${escapeHtml(settings)}" style="color:#a24e2f;">change your email settings</a>.<br />
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
