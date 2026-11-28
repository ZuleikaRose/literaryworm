#!/usr/bin/env bash
# Puts the email-change templates (supabase/templates/email_change.html and
# email_changed_notification.html) and their subjects into a hosted project's Auth settings,
# through the Management API with the token in ~/.supabase/access-token. Nothing else changes.
#
#   supabase/set-email-change-templates.sh xjvisabdztxvnsglysdh   # the dev branch
#   supabase/set-email-change-templates.sh ldzdmrdvmacpudsbngvd   # production
set -euo pipefail
ref="${1:?usage: $0 <project ref>}"
here="$(cd "$(dirname "$0")" && pwd)"
token="$(cat "$HOME/.supabase/access-token")"
body="$(python3 - "$here/templates" <<'PY'
import json, sys
t = sys.argv[1]
print(json.dumps({
  "mailer_secure_email_change_enabled": True,
  "mailer_subjects_email_change": "Confirm the change of email address for LiteraryWorm",
  "mailer_templates_email_change_content": open(f"{t}/email_change.html").read(),
  "mailer_notifications_email_changed_enabled": True,
  "mailer_subjects_email_changed_notification": "Your LiteraryWorm email address was changed",
  "mailer_templates_email_changed_notification_content": open(f"{t}/email_changed_notification.html").read(),
}))
PY
)"
curl -sS --fail-with-body -X PATCH "https://api.supabase.com/v1/projects/$ref/config/auth" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$body" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("subject:", d["mailer_subjects_email_change"]); print("secure change:", d["mailer_secure_email_change_enabled"]); print("notification:", d["mailer_notifications_email_changed_enabled"])'
