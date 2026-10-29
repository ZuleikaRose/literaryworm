// POST /functions/v1/checkout — choose or change a plan.
// Requires a signed-in account (JWT). Subscriptions are never written from the
// browser; this function validates the choice and writes it with the service
// role. Payment isn't taken yet: when Stripe is added, this function creates
// the Checkout Session and a webhook writes the subscription instead.
//
// Admins are never billed: their membership is complimentary (the database
// makes it so from the admin role), so this function refuses to set up a plan
// for them, before anything else, and must never create a Checkout Session for them.
//
//   { planId: "basic" | "standard" | "premium", billingDay: 1-28, renewalTermsAccepted: true }

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { onlyKeys, parseInt } from "../_shared/validate.ts";

const METHODS = "POST";
const PLANS = ["basic", "standard", "premium"];

Deno.serve(async (req) => {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const user = await requireUser(req);
    await enforceRateLimit(`checkout:${user.id}`, 10, 60);
    const db = serviceClient();
    const { data: admin, error: roleError } = await db
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (admin) {
      throw new HttpError("bad_request", "Admin accounts have a complimentary membership and are never charged.");
    }
    const body = await readJsonBody(req);
    onlyKeys(body, ["planId", "billingDay", "renewalTermsAccepted"]);

    if (typeof body.planId !== "string" || !PLANS.includes(body.planId)) {
      throw new HttpError("bad_request", "Pick Basic, Standard or Premium.");
    }
    const billingDay = parseInt(body.billingDay, "billingDay", 1, 28);
    if (body.renewalTermsAccepted !== true) {
      throw new HttpError("bad_request", "Agree to the renewal terms to continue.");
    }

    const { data, error } = await db
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        plan_id: body.planId,
        billing_day: billingDay,
        status: "active",
        renewal_terms_accepted_at: new Date().toISOString(),
        cancel_at_period_end: false,
      }, { onConflict: "user_id" })
      .select("plan_id, status, billing_day")
      .single();
    if (error) throw error;
    return json(req, METHODS, data);
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
});
