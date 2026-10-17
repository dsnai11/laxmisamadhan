#!/usr/bin/env bash
# Builds the full tutorial series. Expects the backend and frontend to be
# running against a DISPOSABLE database (it is wiped and re-seeded).
#   ./make-videos.sh                  English
#   ./make-videos.sh --lang hi        Hindi (captions + narration from i18n/hi.json)
#   ./make-videos.sh --keep-db        skip the database reset
set -euo pipefail
cd "$(dirname "$0")"

LANG_CODE=en
RESET_DB=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang) LANG_CODE="$2"; shift 2 ;;
    --keep-db) RESET_DB=0; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ $RESET_DB == 1 ]]; then
  echo "Resetting demo database..."
  (cd ../backend && npx prisma db push --force-reset --skip-generate >/dev/null && npx tsx prisma/seed.ts >/dev/null)
fi

node setup.mjs
node record.mjs --export --lang "$LANG_CODE"
python3 narrate.py --lang "$LANG_CODE"
node record.mjs --lang "$LANG_CODE"
bash concat.sh "$LANG_CODE"
