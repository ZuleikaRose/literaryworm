// POST /functions/v1/manage-profile — protected profile changes.
// Requires a signed-in account (JWT). Changes a child could use to get around
// a grown-up's settings re-check the account password first.
//
//   { action: "create_kids", name, avatar, dailyLimitMinutes, noticeVersion, password }
//   { action: "set_pin", profileId, pin | null, password }
//   { action: "set_daily_limit", profileId, dailyLimitMinutes | null, password }
//   { action: "delete", profileId, password }
//   { action: "unlock", profileId, password }
//   { action: "verify_pin", profileId, pin }

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { confirmPassword, requireUser, serviceClient } from "../_shared/supabase.ts";
import { onlyKeys, parseInt, parseText, parseUuid } from "../_shared/validate.ts";

const METHODS = "POST";
const DAILY_LIMITS = [30, 60, 90, 120, 180, 240];

function parsePin(raw: unknown, allowNull: boolean): string | null {
  if (raw === null && allowNull) return null;
  if (typeof raw !== "string" || !/^\d{4}$/.test(raw)) throw new HttpError("bad_request", "A PIN is 4 digits.");
  return raw;
}

function parseDailyLimit(raw: unknown): number | null {
  if (raw === null) return null;
  const minutes = parseInt(raw, "dailyLimitMinutes", 30, 240);
  if (!DAILY_LIMITS.includes(minutes)) throw new HttpError("bad_request", "Pick one of the daily limit options.");
  return minutes;
}

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "P0002" || /not found/i.test(error.message)) throw new HttpError("not_found", "Profile not found.");
  if (error.code === "23514" || error.code === "23505") throw new HttpError("bad_request", error.message);
  throw error;
}

Deno.serve(async (req) => {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const user = await requireUser(req);
    await enforceRateLimit(`manage-profile:${user.id}`, 20, 60);
    const body = await readJsonBody(req);
    const db = serviceClient();
    const action = body.action;

    if (action === "verify_pin") {
      onlyKeys(body, ["action", "profileId", "pin"]);
      const { data, error } = await db.rpc("verify_profile_pin", {
        p_account_id: user.id,
        p_profile_id: parseUuid(body.profileId, "profileId"),
        p_pin: parsePin(body.pin, false),
      });
      if (error) dbError(error);
      return json(req, METHODS, data);
    }

    // Everything else needs the account password again.
    const password = parseText(body.password, "password", 1, 128);
    if (!user.email) throw new HttpError("forbidden", "This account has no email address.");

    switch (action) {
      case "create_kids": {
        onlyKeys(body, ["action", "name", "avatar", "dailyLimitMinutes", "noticeVersion", "password"]);
        const args = {
          p_account_id: user.id,
          p_name: parseText(body.name, "name", 1, 20),
          p_avatar: parseInt(body.avatar, "avatar", 0, 5),
          p_daily_limit_minutes: parseDailyLimit(body.dailyLimitMinutes),
          p_notice_version: parseText(body.noticeVersion, "noticeVersion", 1, 40),
        };
        await confirmPassword(user.email, password);
        const { data, error } = await db.rpc("create_kids_profile", args);
        if (error) dbError(error);
        return json(req, METHODS, { id: data }, 201);
      }
      case "set_pin": {
        onlyKeys(body, ["action", "profileId", "pin", "password"]);
        const args = { p_account_id: user.id, p_profile_id: parseUuid(body.profileId, "profileId"), p_pin: parsePin(body.pin, true) };
        await confirmPassword(user.email, password);
        const { error } = await db.rpc("set_profile_pin", args);
        if (error) dbError(error);
        return json(req, METHODS, { ok: true });
      }
      case "unlock": {
        onlyKeys(body, ["action", "profileId", "password"]);
        const args = { p_account_id: user.id, p_profile_id: parseUuid(body.profileId, "profileId") };
        await confirmPassword(user.email, password);
        const { error } = await db.rpc("unlock_profile", args);
        if (error) dbError(error);
        return json(req, METHODS, { ok: true });
      }
      case "set_daily_limit": {
        onlyKeys(body, ["action", "profileId", "dailyLimitMinutes", "password"]);
        const profileId = parseUuid(body.profileId, "profileId");
        const minutes = parseDailyLimit(body.dailyLimitMinutes);
        await confirmPassword(user.email, password);
        const { data, error } = await db.from("reader_profiles").update({ daily_limit_minutes: minutes })
          .eq("id", profileId).eq("account_id", user.id).select("id");
        if (error) dbError(error);
        if (!data?.length) throw new HttpError("not_found", "Profile not found.");
        return json(req, METHODS, { ok: true });
      }
      case "delete": {
        onlyKeys(body, ["action", "profileId", "password"]);
        const profileId = parseUuid(body.profileId, "profileId");
        await confirmPassword(user.email, password);
        const { count } = await db.from("reader_profiles").select("id", { count: "exact", head: true })
          .eq("account_id", user.id);
        if ((count ?? 0) <= 1) throw new HttpError("bad_request", "An account keeps at least one profile.");
        const { data, error } = await db.from("reader_profiles").delete()
          .eq("id", profileId).eq("account_id", user.id).select("id");
        if (error) dbError(error);
        if (!data?.length) throw new HttpError("not_found", "Profile not found.");
        return json(req, METHODS, { ok: true });
      }
      default:
        throw new HttpError("bad_request", "Unknown action.");
    }
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
});
