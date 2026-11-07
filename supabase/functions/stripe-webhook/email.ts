// The note when a membership payment fails (invoice.payment_failed, first attempt only): what to
// do, and that natural voices pause until a payment goes through. Inline styles only, matching the
// other emails. A one-off note about the member's own billing, so it has no unsubscribe link.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function paymentFailedEmail(input: { to: string; name: string | null; site: string }): Email {
  const subject = "Your LiteraryWorm payment didn't go through";
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const lead =
    "We couldn't take your latest membership payment. Your card may have expired, or your bank may have declined it. Stripe will try again over the next few days.";
  const action = "To keep your membership, update your payment method in Account → Plan and billing.";
  const voices = "Natural voices for your uploads are paused until a payment goes through. Everything else, your library, profiles and progress included, stays as it is.";
  const page = `${input.site}/account#plan`;
  const why = "You're getting this because a payment for your LiteraryWorm membership failed. We send it once for each failed payment.";
  const text = [hello, "", lead, "", `${action} ${page}`, "", voices, "", why, "LiteraryWorm · https://www.literaryworm.com"].join("\n");

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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Your payment didn't go through</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 12px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <p style="margin:0 0 12px;font-size:16px;line-height:1.55;">${escapeHtml(action)}</p>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Update your payment method</a>
                </p>
                <p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(voices)}</p>
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
