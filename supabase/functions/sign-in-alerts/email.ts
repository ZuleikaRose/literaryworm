// The log-in alert: an email a few minutes after a new log-in to the account, naming the browser
// and device and the time, with what to do if it wasn't the member. Inline styles only, matching
// supabase/templates and the other emails. A security email: no unsubscribe link, but the member
// can turn these off in Account → Sign-in, which the footer says.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Alert {
  sessionId: string;
  email: string;
  name: string | null;
  /** The browser's user agent, as Supabase Auth recorded it. */
  device: string;
  /** ISO time of the log-in. */
  signedInAt: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * "Chrome on Windows": the same names as the app's device list (deviceLabel() in
 * src/lib/devicesApi.ts), so the email and Where you're logged in agree.
 */
export function deviceLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "A browser";
  const system = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X/.test(userAgent)
            ? "Mac"
            : /CrOS/.test(userAgent)
              ? "Chromebook"
              : /Linux/.test(userAgent)
                ? "Linux"
                : "";
  if (!userAgent.trim()) return "An unknown browser or app";
  return system ? `${browser} on ${system}` : browser;
}

/** "Friday 27 November 2026 at 14:05 UTC", built from its parts (ICU versions differ on commas). */
export function loginTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")} at ${part("hour")}:${part("minute")} UTC`;
}

export function signInAlertEmail(input: { alert: Alert; site: string }): Email {
  const { alert } = input;
  const device = deviceLabel(alert.device);
  const when = loginTime(alert.signedInAt);
  const subject = "New log-in to your LiteraryWorm account";
  const hello = alert.name ? `Hi ${alert.name},` : "Hi,";
  const lead = "Someone just logged in to your LiteraryWorm account.";
  const wasYou = "If this was you, there's nothing to do.";
  const notYou =
    "If it wasn't, change your password now, then choose Log out on every other device. Both are in Account → Sign-in. If you use two-step sign-in, your code stops anyone who only has your password.";
  const page = `${input.site}/account#sign-in`;
  const why = "We email you about every new log-in to your account. You can turn these emails off in Account → Sign-in.";
  const text = [hello, "", lead, "", `${device}`, when, "", wasYou, "", notYou, page, "", why, "LiteraryWorm · https://www.literaryworm.com"].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1e4cb;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(`${device}, ${when}`)}</div>
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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">New log-in to your account</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;border-bottom:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(device)}</div>
                      <div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(when)}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(wasYou)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(notYou)}</p>
                <p style="margin:0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Go to Sign-in</a>
                </p>
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
  return { to: alert.email, subject, text, html };
}
