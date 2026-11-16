import { CATALOG } from "../_shared/catalog.ts";
import { publicSiteOrigin } from "../_shared/mailgun.ts";
import { isOpenLibraryId } from "../_shared/openLibrary.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { confirmPassword, requireUser, serviceClient } from "../_shared/supabase.ts";
import { type Config, type Deps, handle, type Store } from "./handler.ts";
import type { Data, LibraryRow, ProfileStats } from "./tools.ts";

/**
 * Where this function is reached. In production the site serves it (vercel.json sends /mcp and the
 * two /.well-known addresses here), so the MCP_SITE setting names the site and the issuer is its
 * origin. Without it (the dev branch) the function's own address is used. The consent page is on
 * that site, or, for a copy of the site that isn't the one in MCP_SITE or ALLOWED_ORIGINS' www
 * address (the dev preview), on MCP_CONSENT_ORIGIN.
 */
function config(): Config {
  const clean = (name: string) => Deno.env.get(name)?.trim().replace(/\/$/, "") || undefined;
  const site = clean("MCP_SITE");
  const consentUrl = `${clean("MCP_CONSENT_ORIGIN") ?? site ?? publicSiteOrigin()}/oauth/consent`;
  if (site) return { issuer: site, base: `${site}/mcp`, consentUrl };
  const base = `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/mcp`;
  return { issuer: base, base, consentUrl };
}

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function store(): Store {
  const db = serviceClient();
  return {
    async createClient(name, redirectUris) {
      const row = must(await db.from("connected_app_clients").insert({ name, redirect_uris: redirectUris }).select("id").single());
      return row!.id as string;
    },
    async getClient(id) {
      const row = must(await db.from("connected_app_clients").select("id, name, redirect_uris").eq("id", id).maybeSingle());
      return row ? { id: row.id, name: row.name, redirectUris: row.redirect_uris } : null;
    },
    async createRequest(r) {
      const row = must(
        await db
          .from("connected_app_requests")
          .insert({ client_id: r.clientId, redirect_uri: r.redirectUri, code_challenge: r.codeChallenge, state: r.state })
          .select("id")
          .single(),
      );
      return row!.id as string;
    },
    async pendingRequest(id, now) {
      const row = must(
        await db
          .from("connected_app_requests")
          .select("id, redirect_uri, state, connected_app_clients(name)")
          .eq("id", id)
          .is("user_id", null)
          .gt("expires_at", now)
          .maybeSingle(),
      ) as { id: string; redirect_uri: string; state: string | null; connected_app_clients: { name: string } | { name: string }[] | null } | null;
      if (!row) return null;
      const client = Array.isArray(row.connected_app_clients) ? row.connected_app_clients[0] : row.connected_app_clients;
      return { id: row.id, clientName: client?.name ?? "An app", redirectUri: row.redirect_uri, state: row.state };
    },
    async approveRequest(id, userId, codeHash, now, expiresAt) {
      const rows = must(
        await db
          .from("connected_app_requests")
          .update({ user_id: userId, code_hash: codeHash, expires_at: expiresAt })
          .eq("id", id)
          .is("user_id", null)
          .gt("expires_at", now)
          .select("id"),
      );
      return (rows ?? []).length === 1;
    },
    async deleteRequest(id) {
      must(await db.from("connected_app_requests").delete().eq("id", id).is("user_id", null));
    },
    async takeCode(codeHash) {
      const rows = must(
        await db.from("connected_app_requests").delete().eq("code_hash", codeHash).select("client_id, redirect_uri, code_challenge, user_id, expires_at"),
      );
      const row = rows?.[0];
      return row ? { clientId: row.client_id, redirectUri: row.redirect_uri, codeChallenge: row.code_challenge, userId: row.user_id, expiresAt: row.expires_at } : null;
    },
    async countApps(userId) {
      const { count, error } = await db.from("connected_apps").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async createApp(userId, clientId, t) {
      must(
        await db.from("connected_apps").insert({
          user_id: userId,
          client_id: clientId,
          access_hash: t.accessHash,
          access_expires_at: t.accessExpiresAt,
          refresh_hash: t.refreshHash,
          refresh_expires_at: t.refreshExpiresAt,
        }),
      );
    },
    async rotateApp(refreshHash, clientId, now, t) {
      const rows = must(
        await db
          .from("connected_apps")
          .update({ access_hash: t.accessHash, access_expires_at: t.accessExpiresAt, refresh_hash: t.refreshHash, refresh_expires_at: t.refreshExpiresAt, last_used_at: now })
          .eq("refresh_hash", refreshHash)
          .eq("client_id", clientId)
          .gt("refresh_expires_at", now)
          .select("id"),
      );
      return (rows ?? []).length === 1;
    },
    async appByAccess(accessHash) {
      const row = must(await db.from("connected_apps").select("id, user_id, access_expires_at, last_used_at").eq("access_hash", accessHash).maybeSingle());
      return row ? { id: row.id, userId: row.user_id, accessExpiresAt: row.access_expires_at, lastUsedAt: row.last_used_at } : null;
    },
    async touchApp(id, now) {
      must(await db.from("connected_apps").update({ last_used_at: now }).eq("id", id));
    },
    async revoke(tokenHash) {
      must(await db.from("connected_apps").delete().or(`access_hash.eq.${tokenHash},refresh_hash.eq.${tokenHash}`));
    },
    async listApps(userId) {
      const rows = must(
        await db.from("connected_apps").select("id, created_at, last_used_at, connected_app_clients(name)").eq("user_id", userId).order("created_at", { ascending: false }),
      ) as { id: string; created_at: string; last_used_at: string | null; connected_app_clients: { name: string } | { name: string }[] | null }[] | null;
      return (rows ?? []).map((r) => {
        const client = Array.isArray(r.connected_app_clients) ? r.connected_app_clients[0] : r.connected_app_clients;
        return { id: r.id, name: client?.name ?? "An app", createdAt: r.created_at, lastUsedAt: r.last_used_at };
      });
    },
    async removeApp(userId, id) {
      const rows = must(await db.from("connected_apps").delete().eq("id", id).eq("user_id", userId).select("id"));
      return (rows ?? []).length === 1;
    },
  };
}

function data(): Data {
  const db = serviceClient();
  return {
    async plans() {
      const rows = must(
        await db.from("plans").select("id, name, price_cents, yearly_price_cents, currency, max_profiles, audio_hours, download_devices, summary").order("sort_order"),
      );
      return (rows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.price_cents,
        yearlyPriceCents: p.yearly_price_cents,
        currency: p.currency,
        maxProfiles: p.max_profiles,
        audioHours: p.audio_hours,
        downloadDevices: p.download_devices,
        summary: p.summary,
      }));
    },
    async whatsNew(limit) {
      const rows = must(
        await db.from("changelog_entries").select("released_on, kind, title, body, major").order("released_on", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
      );
      return (rows ?? []).map((e) => ({ releasedOn: e.released_on, kind: e.kind, title: e.title, body: e.body, major: e.major }));
    },
    async library(userId) {
      const [items, progress, uploads] = await Promise.all([
        db.from("library_items").select("volume_id, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
        db.from("reading_progress").select("volume_id, format, position, finished, updated_at").eq("user_id", userId).limit(1000),
        db.from("uploaded_books").select("id, title, author").eq("user_id", userId).limit(1000),
      ]);
      const places = new Map((must(progress) ?? []).map((p) => [p.volume_id as string, p]));
      const own = new Map((must(uploads) ?? []).map((u) => [u.id as string, u]));
      const rows = must(items) ?? [];
      // Google Books and Open Library titles: named only while we may keep their details (the cache's own rule).
      const others = rows.map((r) => r.volume_id as string).filter((id) => !CATALOG[id] && !own.has(id));
      const kept = new Map<string, { title?: string; authors?: string[] }>();
      if (others.length > 0) {
        const cached = await db.from("google_books_volumes").select("id, detail").in("id", others).gt("expires_at", new Date().toISOString());
        if (cached.error) console.warn("mcp: couldn't read kept book details:", cached.error.message);
        for (const c of cached.data ?? []) kept.set(c.id, c.detail ?? {});
      }
      return rows.map((r): LibraryRow => {
        const id = r.volume_id as string;
        const place = places.get(id);
        const catalog = CATALOG[id];
        const upload = own.get(id);
        const detail = kept.get(id);
        return {
          id,
          title: catalog?.title ?? upload?.title ?? detail?.title ?? null,
          author: catalog?.author ?? upload?.author ?? detail?.authors?.join(", ") ?? null,
          source: catalog ? "literaryworm" : upload ? "upload" : isOpenLibraryId(id) ? "open_library" : "google_books",
          status: r.status,
          addedAt: r.created_at,
          progress: place ? { format: place.format, percent: Math.round(Number(place.position) * 100), finished: place.finished, updatedAt: place.updated_at } : null,
        };
      });
    },
    async highlights(userId, bookId, limit) {
      let query = db.from("highlights").select("volume_id, chapter_index, quote, note, color, created_at").eq("user_id", userId);
      if (bookId) query = query.eq("volume_id", bookId);
      const rows = must(await query.order("created_at", { ascending: false }).limit(limit));
      return (rows ?? []).map((h) => ({ bookId: h.volume_id, chapter: h.chapter_index + 1, quote: h.quote, note: h.note, color: h.color, createdAt: h.created_at }));
    },
    async kidsBooks(userId) {
      const kids = must(await db.from("reader_profiles").select("id").eq("account_id", userId).eq("age_rating", "kids")) ?? [];
      if (kids.length === 0) return [];
      const days = must(
        await db.from("book_reading_days").select("volume_id").eq("user_id", userId).in("profile_id", kids.map((k) => k.id)).limit(20000),
      ) ?? [];
      return [...new Set(days.map((d) => d.volume_id as string))];
    },
    async stats(userId, since) {
      // Kids profiles are left out here, in the query, so their reading time never leaves the database.
      const profiles = must(await db.from("reader_profiles").select("id, name").eq("account_id", userId).neq("age_rating", "kids").order("created_at")) ?? [];
      if (profiles.length === 0) return [];
      const days = must(
        await db
          .from("reading_days")
          .select("profile_id, minutes, listening_minutes, books_finished")
          .eq("user_id", userId)
          .in("profile_id", profiles.map((p) => p.id))
          .gte("day", since)
          .limit(10000),
      ) ?? [];
      return profiles.map((p): ProfileStats => {
        const mine = days.filter((d) => d.profile_id === p.id);
        return {
          profile: p.name,
          minutes: mine.reduce((n, d) => n + d.minutes, 0),
          listeningMinutes: mine.reduce((n, d) => n + d.listening_minutes, 0),
          daysRead: mine.filter((d) => d.minutes > 0).length,
          booksFinished: mine.reduce((n, d) => n + d.books_finished, 0),
        };
      });
    },
  };
}

Deno.serve((req) => {
  const deps: Deps = {
    store: store(),
    data: data(),
    config: config(),
    requireUser,
    confirmPassword,
    rateLimit: enforceRateLimit,
  };
  return handle(req, deps);
});
