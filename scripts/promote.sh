#!/usr/bin/env bash
# Promotes dev to main: the main site (www.literaryworm.com) deploys from main, so this is how a
# change that's been tested on dev reaches readers. See docs/releasing.md.
#
# It stops, changing nothing, unless all of these hold:
#   1. you're on dev, with no uncommitted changes to tracked files, and dev is pushed;
#   2. main hasn't moved on its own (dev contains it, so this is a fast-forward);
#   3. the build, lint, unit tests and end-to-end tests pass here;
#   4. GitHub's CI run for dev's latest commit finished green;
#   5. you confirm that any new migrations are applied to production (and functions deployed).
# Then it pushes dev to main. main is never checked out, so your working files aren't touched.
#
# Usage: scripts/promote.sh [--dry-run] [--yes]
#   --dry-run  run every check and say what would be promoted, but don't push (try this first)
#   --yes      answer the migrations question yes (only when you've applied them; for scripted runs)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/front_end/literaryworm_app"
ASSUME_YES=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=true ;;
    --dry-run) DRY_RUN=true ;;
    *) printf 'Unknown option: %s\nUsage: scripts/promote.sh [--dry-run] [--yes]\n' "$arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n== %s\n' "$1"; }
stop() { printf '\nStopped: %s\nNothing was promoted.\n' "$1" >&2; exit 1; }

cd "$ROOT"

step "1. On dev, everything committed and pushed"
branch="$(git branch --show-current)"
[[ "$branch" == "dev" ]] || stop "you're on '$branch'. Switch to dev (git checkout dev) and run this again."
# Hooks rewrite these folders on their own; they're never part of a release.
dirty="$(git status --porcelain --untracked-files=no -- . ':(exclude).cto-toolkit' ':(exclude)**/.cto-toolkit/**' ':(exclude)prompt-records')"
[[ -z "$dirty" ]] || stop "dev has uncommitted changes:
$dirty
Commit or stash them first."
git fetch --quiet origin
[[ "$(git rev-parse dev)" == "$(git rev-parse origin/dev)" ]] || stop "dev isn't the same as origin/dev. Push it (git push origin dev) and wait for CI."
sha="$(git rev-parse dev)"
echo "dev is at ${sha:0:7}: $(git log -1 --format=%s dev)"

step "2. main is behind dev (a fast-forward)"
git merge-base --is-ancestor origin/main dev || stop "main has commits dev doesn't. Bring them into dev first (git merge origin/main), test, and push."
ahead="$(git rev-list --count origin/main..dev)"
[[ "$ahead" -gt 0 ]] || stop "main already has everything on dev."
echo "$ahead commit(s) to promote:"
git log --oneline origin/main..dev | sed 's/^/  /'

step "3. Build, lint, unit tests and end-to-end tests"
cd "$APP"
npm run build
npm run lint
npm test
# The e2e tests serve the app on port 5199; free it first.
if command -v fuser >/dev/null; then fuser -k 5199/tcp >/dev/null 2>&1 || true; fi
npm run test:e2e
cd "$ROOT"

step "4. GitHub CI is green for ${sha:0:7}"
command -v gh >/dev/null || stop "the GitHub CLI (gh) isn't installed, so CI can't be checked."
ci="$(gh run list --branch dev --workflow CI --limit 20 --json headSha,status,conclusion \
  --jq "[.[] | select(.headSha == \"$sha\")][0] | \"\(.status) \(.conclusion)\"" 2>/dev/null || true)"
case "$ci" in
  "completed success") echo "CI passed for ${sha:0:7}." ;;
  "" | "null null") stop "no CI run for ${sha:0:7} yet. Wait for it to start (gh run list --branch dev)." ;;
  completed*) stop "CI for ${sha:0:7} finished as '${ci#completed }'. Fix it on dev first (gh run view)." ;;
  *) stop "CI for ${sha:0:7} is still running ('$ci'). Wait for it (gh run watch)." ;;
esac

step "5. Database and functions"
migrations="$(git diff --name-only --diff-filter=A origin/main..dev -- supabase/migrations)"
functions="$(git diff --name-only origin/main..dev -- supabase/functions | cut -d/ -f3 | sort -u | grep -v '^_shared$' || true)"
shared="$(git diff --name-only origin/main..dev -- supabase/functions/_shared)"
if [[ -z "$migrations" && -z "$functions" && -z "$shared" ]]; then
  echo "No new migrations or function changes."
else
  if [[ -n "$migrations" ]]; then
    echo "New migrations (apply each to the dev branch first, then production, one at a time):"
    echo "$migrations" | sed 's/^/  /'
  fi
  if [[ -n "$functions" ]]; then
    echo "Changed functions (deploy to production: supabase functions deploy <name>):"
    echo "$functions" | sed 's/^/  /'
  fi
  [[ -n "$shared" ]] && echo "supabase/functions/_shared changed: redeploy every function that imports what changed."
  if ! $ASSUME_YES && ! $DRY_RUN; then
    read -r -p "Are these applied to production and the functions deployed? Type yes to promote: " answer
    [[ "$answer" == "yes" ]] || stop "apply the migrations to production and deploy the functions first."
  fi
fi

if $DRY_RUN; then
  step "Dry run: every check passed"
  echo "Would push dev (${sha:0:7}) to main. Nothing was pushed. Run without --dry-run to promote."
  exit 0
fi

step "Promoting (target: main, which deploys www.literaryworm.com)"
git push origin dev:main
echo
echo "main is now ${sha:0:7}. Vercel deploys www.literaryworm.com from it in a minute or two."
echo "If you scheduled a maintenance notice for this, it ends on its own at the time you set (or delete it at /maintenance)."
