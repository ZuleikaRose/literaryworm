// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { emailLanguage } from "../_shared/emailI18n.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";

interface AlertRow {
  session_id: string;
  email: string;
  display_name: string | null;
  device: string;
  signed_in_at: string;
  language: string | null;
}

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("sign_in_alerts_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async claim(max) {
      const { data, error } = await serviceClient().rpc("claim_sign_in_alerts", { max_count: max });
      if (error) throw error;
      return (data as AlertRow[]).map((r) => ({ sessionId: r.session_id, email: r.email, name: r.display_name, device: r.device, signedInAt: r.signed_in_at, language: emailLanguage(r.language) }));
    },
    async release(sessionId) {
      const { error } = await serviceClient().rpc("release_sign_in_alert", { p_session: sessionId });
      if (error) throw error;
    },
    send: (email) => sendWithMailgun({ ...email, tag: "sign-in-alerts" }),
    siteOrigin: publicSiteOrigin(),
  })
);
