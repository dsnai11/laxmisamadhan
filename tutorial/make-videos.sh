#!/usr/bin/env bash
# Builds the full tutorial series. Expects the backend and frontend to be
# running against a DISPOSABLE database (it is wiped and re-seeded).
#   ./make-videos.sh            reset demo data, narrate, record all videos
#   ./make-videos.sh --keep-db  skip the database reset
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" != "--keep-db" ]]; then
  echo "Resetting demo database..."
  (cd ../backend && npx prisma db push --force-reset --skip-generate >/dev/null && npx tsx prisma/seed.ts >/dev/null)
fi

node setup.mjs
node record.mjs --export
python3 narrate.py
node record.mjs
bash concat.sh
