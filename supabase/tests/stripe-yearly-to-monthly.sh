#!/bin/bash
# The yearly -> monthly switch on a Stripe test clock, with the same calls as scheduleMonthly() and
# releaseSchedule() in supabase/functions/_shared/stripe.ts and the app's own prices (Standard
# yearly, then Basic monthly, found by lookup key). Test mode only; deletes its test clock (and the
# customer and subscription on it) afterwards.
#
#   supabase/tests/stripe-yearly-to-monthly.sh            # the Stripe CLI's "sandbox" project
#   STRIPE_PROJECT=other supabase/tests/stripe-yearly-to-monthly.sh
#
# Takes a few minutes: the clock moves a year and a month in steps of at most 50 days.
set -uo pipefail
V="--stripe-version 2026-09-30.endive"
P="--project-name ${STRIPE_PROJECT:-sandbox}"
S() { stripe "$@" $P $V 2>/dev/null; }
die() { echo "FAIL: $*"; cleanup; exit 1; }
when() { date -u -d "@$1" +%Y-%m-%d; }

[ "$(S get /v1/balance | jq -r .livemode)" = "false" ] || { echo "Not test mode: stopping."; exit 1; }

cleanup() {
  [ -n "${CLOCK:-}" ] && S delete /v1/test_helpers/test_clocks/$CLOCK --confirm >/dev/null && echo "cleanup: test clock deleted (its customer and subscription go with it)"
}

# Moves the test clock to $1 in steps of at most 50 days (Stripe allows two billing intervals of
# the shortest price at a time, and the schedule's monthly phase counts), waiting after each.
advance_to() {
  local target=$1 at
  at=$(S get /v1/test_helpers/test_clocks/$CLOCK | jq -r .frozen_time)
  while (( at < target )); do
    at=$(( at + 50 * 86400 < target ? at + 50 * 86400 : target ))
    advance_step $at
  done
}

advance_step() {
  local out
  # The CLI prints a banner before the JSON: keep from the first "{" on.
  out=$(stripe post /v1/test_helpers/test_clocks/$CLOCK/advance -d frozen_time=$1 $P $V 2>&1 | sed -n '/^{/,$p')
  [ "$(jq -r '.status // empty' <<<"$out" 2>/dev/null)" = "advancing" ] || die "advancing the clock: $(jq -r '.error.message // .' <<<"$out" 2>/dev/null || echo "$out")"
  local c=""
  for i in $(seq 1 300); do
    sleep 2
    c=$(S get /v1/test_helpers/test_clocks/$CLOCK)
    [ "$(jq -r .status <<<"$c")" = "ready" ] && [ "$(jq -r .frozen_time <<<"$c")" = "$1" ] && return 0
    [ "$(jq -r .status <<<"$c")" = "internal_failure" ] && break
    (( i % 30 == 0 )) && echo "  clock after $((i * 2))s: $(jq -c '{status, frozen_time, status_details}' <<<"$c")"
  done
  die "test clock didn't finish advancing: $(jq -c '{status, frozen_time, status_details}' <<<"$c") (wanted $1)"
}

# scheduleMonthly(): schedule from the subscription, keep the year as phase one, one monthly phase, release.
schedule_monthly() {
  local sched start end
  sched=$(S post /v1/subscription_schedules -d from_subscription=$SUB) || die "creating schedule"
  SCHED=$(jq -r .id <<<"$sched")
  start=$(jq -r '.current_phase.start_date' <<<"$sched"); end=$(jq -r '.phases[0].end_date' <<<"$sched")
  S post /v1/subscription_schedules/$SCHED \
    -d end_behavior=release \
    -d "phases[0][items][0][price]=$YEARLY" -d "phases[0][items][0][quantity]=1" \
    -d "phases[0][start_date]=$start" -d "phases[0][end_date]=$end" \
    -d "phases[0][metadata][plan_id]=standard" -d "phases[0][metadata][interval]=year" -d "phases[0][metadata][switch_to_monthly]=basic" \
    -d "phases[0][proration_behavior]=none" \
    -d "phases[1][items][0][price]=$MONTHLY" -d "phases[1][items][0][quantity]=1" \
    -d "phases[1][duration][interval]=month" -d "phases[1][duration][interval_count]=1" \
    -d "phases[1][metadata][plan_id]=basic" -d "phases[1][metadata][interval]=month" -d "phases[1][metadata][switch_to_monthly]=" \
    -d "phases[1][proration_behavior]=none" >/dev/null || die "updating schedule phases"
  S post /v1/subscriptions/$SUB -d "metadata[switch_to_monthly]=basic" >/dev/null || die "setting the subscription's switch key"
}

sub_state() {
  S get /v1/subscriptions/$SUB | jq -r '"  price \(.items.data[0].price.unit_amount)/\(.items.data[0].price.recurring.interval), period ends \(.items.data[0].current_period_end), schedule=\(.schedule // "none"), switch_to_monthly=\(.metadata.switch_to_monthly // "none"), status=\(.status)"' \
    | sed -E "s/ends ([0-9]+)/ends \$(date -u -d @\1 +%Y-%m-%d)/" | while read -r l; do eval "echo \"$l\""; done
}

echo "== setup"
price_for() { S get /v1/prices -d "lookup_keys[]=$1" | jq -r '.data[0].id // empty'; }
YEARLY=$(price_for literaryworm_standard_yearly); MONTHLY=$(price_for literaryworm_basic_monthly)
[ -n "$YEARLY" ] && [ -n "$MONTHLY" ] || { echo "The prices literaryworm_standard_yearly and literaryworm_basic_monthly aren't in this account."; exit 1; }
NOW=$(date +%s)
CLOCK=$(S post /v1/test_helpers/test_clocks -d frozen_time=$NOW -d "name=switch test" | jq -r .id)
CUS=$(S post /v1/customers -d test_clock=$CLOCK -d payment_method=pm_card_visa -d "invoice_settings[default_payment_method]=pm_card_visa" | jq -r .id)
SUB=$(S post /v1/subscriptions -d customer=$CUS -d "items[0][price]=$YEARLY" -d "metadata[plan_id]=standard" -d "metadata[interval]=year" | jq -r .id)
[ "$SUB" != "null" ] && [ -n "$SUB" ] || die "creating the yearly subscription"
echo "Standard yearly subscription made ($YEARLY), started $(when $NOW)"; sub_state

echo "== 1. choose monthly (scheduleMonthly)"
schedule_monthly
S get /v1/subscription_schedules/$SCHED | jq -r '"  end_behavior=\(.end_behavior)", (.phases[] | "  phase: \(.start_date) to \(.end_date), price \(.items[0].price), switch_to_monthly=\(.metadata.switch_to_monthly // "unset")")' \
  | sed "s/$YEARLY/yearly/; s/$MONTHLY/monthly/"
sub_state

echo "== 2. cancelling straight away while scheduled (why cancel releases first)"
if S post /v1/subscriptions/$SUB -d cancel_at_period_end=true >/dev/null; then
  echo "  Stripe allowed it; undoing it for the rest of the test"
  S post /v1/subscriptions/$SUB -d cancel_at_period_end=false >/dev/null || die "undoing the cancel"
else
  echo "  Stripe refused it"
fi

echo "== 3. keep yearly billing (releaseSchedule)"
S post /v1/subscription_schedules/$SCHED/release >/dev/null || die "releasing"
S post /v1/subscriptions/$SUB -d "metadata[switch_to_monthly]=" >/dev/null || die "clearing the switch key"
sub_state

echo "== 4. choose monthly again, then fast-forward past the renewal"
schedule_monthly
END=$(S get /v1/subscriptions/$SUB | jq -r '.items.data[0].current_period_end')
advance_to $((END + 86400))
echo "  a day after the year ended ($(when $((END + 86400)))):"; sub_state
S get /v1/invoices -d subscription=$SUB -d limit=1 | jq -r '.data[0] | "  latest invoice: \(.amount_due) cents, \(.status), \(.lines.data[0].period.start | todate[:10]) to \(.lines.data[0].period.end | todate[:10])"'

echo "== 5. a month later: the schedule lets go, monthly carries on"
advance_to $((END + 33 * 86400))
sub_state
S get /v1/invoices -d subscription=$SUB -d limit=1 | jq -r '.data[0] | "  latest invoice: \(.amount_due) cents, \(.status), \(.lines.data[0].period.start | todate[:10]) to \(.lines.data[0].period.end | todate[:10])"'

echo "== cleanup"
cleanup
