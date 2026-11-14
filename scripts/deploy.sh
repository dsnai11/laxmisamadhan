#!/usr/bin/env bash
# Laxmi Samadhan — production deploy to AWS EC2.
#
# The server folder (/var/www/laxmisamadhan) is NOT a git clone, so this script
# copies files from your local, committed checkout. Every deploy backs up what it
# replaces first and can be rolled back.
#
# Usage:
#   scripts/deploy.sh status                     Server health + what is deployed
#   scripts/deploy.sh backend  [--dry-run] [--yes] [--apply-schema] [--allow-dirty]
#   scripts/deploy.sh frontend [--dry-run] [--yes] [--allow-dirty]
#   scripts/deploy.sh all      [same flags]      Backend, then frontend
#   scripts/deploy.sh backups                    List server-side deploy backups
#   scripts/deploy.sh rollback backend|frontend [BACKUP_NAME]   (default: newest)
#   scripts/deploy.sh ssh                        Open a shell on the server
#
# Env overrides: EC2_HOST, EC2_USER, EC2_KEY
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EC2_HOST="${EC2_HOST:-65.2.215.48}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY="${EC2_KEY:-$ROOT/laxmisamadhan.pem}"
APP_DIR="/var/www/laxmisamadhan"
BACKUP_DIR="$APP_DIR/backups"
PM2_APP="ticket-backend"
SITE_URL="https://laxmisamadhan.lifc.in"
KEEP_BACKUPS=10
# Pre-existing backend tsc errors as of 2026-11-14 (prod runs via tsx, which doesn't type-check).
# Deploys are blocked only if the count goes ABOVE this. Lower it as errors get fixed.
TSC_BASELINE=14

SSH_OPTS=(-i "$EC2_KEY" -o BatchMode=yes -o ConnectTimeout=12 -o ServerAliveInterval=20)
DRY_RUN=0; ASSUME_YES=0; APPLY_SCHEMA=0; ALLOW_DIRTY=0

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_bld=$'\033[1m'; c_off=$'\033[0m'
info() { echo "${c_bld}==>${c_off} $*"; }
ok()   { echo "${c_grn}✔${c_off} $*"; }
warn() { echo "${c_ylw}!${c_off} $*"; }
die()  { echo "${c_red}✘ $*${c_off}" >&2; exit 1; }

# -n: never read local stdin (otherwise ssh swallows input inside `while read` loops).
remote() { ssh -n "${SSH_OPTS[@]}" "$EC2_USER@$EC2_HOST" "$@"; }
ts() { date +%Y%m%d_%H%M%S; }

# Hash a file with CRLF normalised, so Windows-era copies compare equal to git.
lf_hash_local()  { tr -d '\r' < "$1" | shasum -a 256 | cut -d' ' -f1; }
lf_hash_remote() { remote "if [ -f '$1' ]; then tr -d '\r' < '$1' | sha256sum | cut -d' ' -f1; else echo missing; fi"; }

# Signature of what is actually installed per lockfile: package path + version only
# (ignores npm-version metadata noise such as "libc" fields).
LOCK_SIG_JS='const l=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const p=l.packages||{};console.log(Object.keys(p).sort().map(k=>k+"@"+(p[k].version||"")).join("\n"))'
lock_sig_local()  { node -e "$LOCK_SIG_JS" "$1" | shasum -a 256 | cut -d' ' -f1; }
lock_sig_remote() { remote "node -e '$LOCK_SIG_JS' '$1' 2>/dev/null | sha256sum | cut -d' ' -f1"; }

confirm() {
  [[ $ASSUME_YES -eq 1 ]] && return 0
  read -r -p "$1 [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || die "Aborted."
}

preflight() {
  [[ -f "$EC2_KEY" ]] || die "SSH key not found at $EC2_KEY"
  chmod 400 "$EC2_KEY" 2>/dev/null || true
  command -v rsync >/dev/null || die "rsync is required"
  info "Connecting to $EC2_USER@$EC2_HOST ..."
  if ! remote true 2>/dev/null; then
    die "Cannot SSH to $EC2_HOST. If you are on the office network, port 22 is blocked — switch to the mobile hotspot and retry."
  fi
  ok "SSH connection OK"
}

git_checks() {
  local paths=("$@")
  cd "$ROOT"
  local dirty
  dirty="$(git status --porcelain -- "${paths[@]}")"
  if [[ -n "$dirty" ]]; then
    if [[ $ALLOW_DIRTY -eq 1 ]]; then
      warn "Deploying UNCOMMITTED changes (--allow-dirty):"; echo "$dirty"
    else
      echo "$dirty"; die "Uncommitted changes in ${paths[*]}. Commit (and push) first, or pass --allow-dirty."
    fi
  fi
  git fetch -q origin main 2>/dev/null || warn "Could not fetch origin/main (offline?)"
  if git rev-parse -q --verify origin/main >/dev/null; then
    local ahead
    ahead="$(git rev-list --count origin/main..HEAD)"
    if [[ "$ahead" != "0" ]]; then
      warn "HEAD is $ahead commit(s) ahead of origin/main — not pushed to GitHub yet."
      confirm "Deploy anyway?"
    fi
  fi
  ok "Deploying commit $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
}

record_deploy() {
  local part="$1" sha msg
  sha="$(git -C "$ROOT" rev-parse --short HEAD)"
  msg="$(git -C "$ROOT" log -1 --format=%s | tr -d "'\"")"
  remote "echo '$(date -u +%FT%TZ) $part $sha $msg' | tee -a $APP_DIR/DEPLOY_LOG >/dev/null"
}

prune_backups() {
  local prefix="$1"
  remote "cd $BACKUP_DIR && ls -1t ${prefix}_* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f"
}

wait_healthy() {
  local i
  for i in $(seq 1 30); do
    if remote "curl -fs --max-time 3 http://127.0.0.1:3001/health >/dev/null"; then return 0; fi
    sleep 2
  done
  return 1
}

# Run a package's unit tests; abort the deploy on any failure. These tests lock in fixes that
# regressed before (assigner display, escalation repeats, employee-code lookup, ...).
run_tests() {
  local dir="$1" label="$2"
  info "Running $label tests ..."
  local out
  if ! out="$(cd "$ROOT/$dir" && npx vitest run 2>&1)"; then
    echo "$out" | grep -E "FAIL|×|AssertionError|Error:" | head -30
    die "$label tests failed — deploy aborted. Fix the failing tests first."
  fi
  ok "$label tests passed ($(echo "$out" | grep -oE 'Tests +[0-9]+ passed' | head -1 | tr -s ' '))"
}

# ---------------------------------------------------------------- backend
BACKEND_FILES=(src prisma/schema.prisma prisma/seed.ts prisma/seed_sla_policies.sql package.json package-lock.json tsconfig.json)

deploy_backend() {
  preflight
  git_checks backend
  cd "$ROOT/backend"

  info "Comparing backend with the server (line endings ignored) ..."
  local deps_changed=0 schema_changed=0
  [[ "$(lock_sig_local package-lock.json)" != "$(lock_sig_remote $APP_DIR/backend/package-lock.json)" ]] && deps_changed=1
  [[ "$(lf_hash_local package.json)" != "$(lf_hash_remote $APP_DIR/backend/package.json)" ]] && deps_changed=1
  [[ "$(lf_hash_local prisma/schema.prisma)" != "$(lf_hash_remote $APP_DIR/backend/prisma/schema.prisma)" ]] && schema_changed=1

  local changed
  changed="$(rsync -rcn --delete -e "ssh ${SSH_OPTS[*]}" --out-format='%i %n' ./src/ "$EC2_USER@$EC2_HOST:$APP_DIR/backend/src/" | grep -v '^\.d' || true)"
  # Drop files that only differ by CRLF.
  local real_changes=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local f="${line#* }"
    if [[ "$line" == \*deleting* ]]; then real_changes+="  delete  src/$f"$'\n'; continue; fi
    [[ -d "src/$f" ]] && continue
    if [[ "$(lf_hash_local "src/$f")" != "$(lf_hash_remote "$APP_DIR/backend/src/$f")" ]]; then
      real_changes+="  update  src/$f"$'\n'
    fi
  done <<< "$changed"

  echo "${c_bld}Code changes:${c_off}"; [[ -n "$real_changes" ]] && printf '%s' "$real_changes" || echo "  (none)"
  echo "${c_bld}Dependencies changed:${c_off} $([[ $deps_changed -eq 1 ]] && echo yes || echo no)"
  echo "${c_bld}Prisma schema changed:${c_off} $([[ $schema_changed -eq 1 ]] && echo yes || echo no)"

  if [[ -z "$real_changes" && $deps_changed -eq 0 && $schema_changed -eq 0 ]]; then
    ok "Server backend already matches this commit. Nothing to deploy."; return 0
  fi
  if [[ $schema_changed -eq 1 && $APPLY_SCHEMA -eq 0 ]]; then
    die "schema.prisma changed. Re-run with --apply-schema to take a pg_dump and run 'prisma db push' (aborts on data loss)."
  fi
  [[ $DRY_RUN -eq 1 ]] && { ok "Dry run — nothing changed on the server."; return 0; }

  [[ -d node_modules ]] || die "backend/node_modules missing — run 'npm install' in backend/ (tests must run before deploying)."
  run_tests backend Backend

  if [[ -d node_modules ]]; then
    info "Type-checking backend locally (tsc --noEmit) ..."
    local tsc_out tsc_count
    tsc_out="$(npx tsc --noEmit -p tsconfig.json 2>&1 || true)"
    tsc_count="$(grep -c 'error TS' <<< "$tsc_out" || true)"
    if (( tsc_count > TSC_BASELINE )); then
      grep 'error TS' <<< "$tsc_out"
      die "TypeScript errors rose from the baseline of $TSC_BASELINE to $tsc_count — fix the new ones before deploying."
    elif (( tsc_count > 0 )); then
      warn "Type-check: $tsc_count known pre-existing errors (baseline $TSC_BASELINE), no new ones."
    else
      ok "Type-check passed"
    fi
  else
    warn "backend/node_modules missing locally — skipping type-check (run 'npm install' in backend/ to enable)."
  fi

  confirm "Deploy backend to PRODUCTION ($EC2_HOST)?"

  local stamp; stamp="$(ts)"
  local bk="$BACKUP_DIR/backend_${stamp}.tar.gz"
  info "Backing up current backend → $bk"
  remote "mkdir -p $BACKUP_DIR && cd $APP_DIR/backend && tar -czf $bk --ignore-failed-read ${BACKEND_FILES[*]} 2>/dev/null; ls -lh $bk | awk '{print \$5}'"

  if [[ $schema_changed -eq 1 ]]; then
    local dump="$BACKUP_DIR/db_${stamp}.sql.gz"
    info "Dumping database → $dump"
    remote "sudo -u postgres pg_dump ticket_portal | gzip > /tmp/db_${stamp}.sql.gz && mv /tmp/db_${stamp}.sql.gz $dump && chmod 600 $dump && ls -lh $dump | awk '{print \$5}'"
  fi

  info "Uploading backend files ..."
  rsync -rlc --delete -e "ssh ${SSH_OPTS[*]}" ./src/ "$EC2_USER@$EC2_HOST:$APP_DIR/backend/src/"
  rsync -rlc -e "ssh ${SSH_OPTS[*]}" package.json package-lock.json tsconfig.json "$EC2_USER@$EC2_HOST:$APP_DIR/backend/"
  rsync -rlc -e "ssh ${SSH_OPTS[*]}" prisma/schema.prisma prisma/seed.ts prisma/seed_sla_policies.sql "$EC2_USER@$EC2_HOST:$APP_DIR/backend/prisma/"
  ok "Files uploaded"

  if [[ $deps_changed -eq 1 ]]; then
    info "Installing dependencies on server (npm install) ..."
    remote "cd $APP_DIR/backend && npm install --no-audit --no-fund 2>&1 | tail -5"
  fi
  if [[ $schema_changed -eq 1 ]]; then
    info "Applying schema (prisma db push) ..."
    remote "cd $APP_DIR/backend && npx prisma db push --skip-generate" || { warn "prisma db push failed — rolling back code."; restore_backend "backend_${stamp}.tar.gz"; die "Schema push failed. Database untouched or check $BACKUP_DIR/db_${stamp}.sql.gz"; }
  fi
  if [[ $deps_changed -eq 1 || $schema_changed -eq 1 ]]; then
    remote "cd $APP_DIR/backend && npx prisma generate 2>&1 | tail -2"
  fi

  info "Reloading pm2 ($PM2_APP) ..."
  remote "pm2 reload $PM2_APP --update-env >/dev/null && pm2 save >/dev/null"
  if wait_healthy; then
    ok "Backend healthy"
  else
    warn "Health check failed after deploy. Recent errors:"
    remote "pm2 logs $PM2_APP --lines 30 --nostream --err" || true
    warn "Rolling back backend to backend_${stamp}.tar.gz ..."
    restore_backend "backend_${stamp}.tar.gz"
    die "Deploy failed and was rolled back."
  fi
  record_deploy backend
  prune_backups backend
  smoke_test
}

restore_backend() {
  local name="$1"
  remote "test -f $BACKUP_DIR/$name" || die "Backup $name not found"
  remote "cd $APP_DIR/backend && rm -rf src && tar -xzf $BACKUP_DIR/$name && npx prisma generate >/dev/null 2>&1; pm2 reload $PM2_APP --update-env >/dev/null"
  if wait_healthy; then ok "Backend restored from $name and healthy"; else die "Backend still unhealthy after restore — check 'pm2 logs $PM2_APP'"; fi
}

# ---------------------------------------------------------------- frontend
deploy_frontend() {
  preflight
  git_checks frontend
  cd "$ROOT/frontend"

  # The frontend is installed with pnpm (same as CI); frontend/package-lock.json is incomplete.
  local PNPM=(npx -y pnpm@9)
  command -v pnpm >/dev/null && PNPM=(pnpm)
  if [[ ! -x node_modules/.bin/vite ]]; then
    info "Installing frontend dependencies locally (pnpm, as in CI) ..."
    rm -rf node_modules
    "${PNPM[@]}" install --ignore-workspace --shamefully-hoist --config.node-linker=hoisted
  fi
  run_tests frontend Frontend
  info "Building frontend (VITE_API_URL=/api/v1) ..."
  rm -rf dist
  VITE_API_URL=/api/v1 "${PNPM[@]}" run build
  [[ -f dist/index.html ]] || die "Build produced no dist/index.html"
  ok "Build complete ($(du -sh dist | cut -f1))"

  [[ $DRY_RUN -eq 1 ]] && { ok "Dry run — built locally, nothing uploaded."; return 0; }
  confirm "Deploy frontend to PRODUCTION ($SITE_URL)?"

  local stamp; stamp="$(ts)"
  local tarball="/tmp/laxmi_dist_${stamp}.tar.gz"
  COPYFILE_DISABLE=1 tar --no-xattrs -czf "$tarball" -C dist .
  info "Uploading build ..."
  scp -q "${SSH_OPTS[@]}" "$tarball" "$EC2_USER@$EC2_HOST:/tmp/dist_${stamp}.tar.gz"
  rm -f "$tarball"

  info "Swapping in new build (old one → $BACKUP_DIR/frontend_${stamp}.tar.gz) ..."
  remote "set -e
    mkdir -p $BACKUP_DIR
    sudo tar -czf $BACKUP_DIR/frontend_${stamp}.tar.gz -C $APP_DIR/frontend/dist .
    sudo rm -rf $APP_DIR/frontend/dist.new && sudo mkdir -p $APP_DIR/frontend/dist.new
    sudo tar -xzf /tmp/dist_${stamp}.tar.gz -C $APP_DIR/frontend/dist.new
    sudo find $APP_DIR/frontend/dist.new -type d -exec chmod 755 {} +
    sudo find $APP_DIR/frontend/dist.new -type f -exec chmod 644 {} +
    sudo mv $APP_DIR/frontend/dist $APP_DIR/frontend/dist.old && sudo mv $APP_DIR/frontend/dist.new $APP_DIR/frontend/dist
    sudo rm -rf $APP_DIR/frontend/dist.old /tmp/dist_${stamp}.tar.gz"
  ok "Frontend swapped"
  record_deploy frontend
  prune_backups frontend
  smoke_test
}

restore_frontend() {
  local name="$1"
  remote "test -f $BACKUP_DIR/$name" || die "Backup $name not found"
  remote "set -e
    sudo rm -rf $APP_DIR/frontend/dist.new && sudo mkdir -p $APP_DIR/frontend/dist.new
    sudo tar -xzf $BACKUP_DIR/$name -C $APP_DIR/frontend/dist.new
    sudo mv $APP_DIR/frontend/dist $APP_DIR/frontend/dist.old && sudo mv $APP_DIR/frontend/dist.new $APP_DIR/frontend/dist
    sudo rm -rf $APP_DIR/frontend/dist.old"
  ok "Frontend restored from $name"
}

# ---------------------------------------------------------------- checks
smoke_test() {
  info "Smoke test ..."
  local code entry
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SITE_URL/")"
  [[ "$code" == "200" ]] && ok "Site $SITE_URL → 200" || warn "Site returned $code"
  entry="$(curl -s --max-time 10 "$SITE_URL/" | grep -oE '/assets/index-[^"]+\.js' | head -1)"
  if [[ -n "$entry" ]]; then
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SITE_URL$entry")"
    [[ "$code" == "200" ]] && ok "Entry bundle $entry → 200" || warn "Entry bundle returned $code"
  fi
  if curl -s --max-time 10 "$SITE_URL/api/v1" | grep -q '"online"'; then ok "API $SITE_URL/api/v1 → online"; else warn "API did not report online"; fi
  echo "Manual check: log in as raiser, agent and admin; create a ticket with an attachment; open the profile page."
}

status() {
  preflight
  remote "echo; echo '--- pm2'; pm2 describe $PM2_APP | grep -E 'status|uptime|restarts|memory' | sed 's/│//g;s/  */ /g'
    echo '--- health'; curl -fsS --max-time 3 http://127.0.0.1:3001/health || echo 'UNHEALTHY'
    echo; echo '--- last deploys'; tail -n 5 $APP_DIR/DEPLOY_LOG 2>/dev/null || echo '(no DEPLOY_LOG yet)'
    echo '--- resources'; free -h | sed -n 2p; df -h / | tail -1
    echo '--- latest DB backup'; sudo ls -t /var/backups/laxmisamadhan 2>/dev/null | head -1"
  smoke_test
}

list_backups() { preflight; remote "ls -lht $BACKUP_DIR 2>/dev/null || echo 'No deploy backups yet.'"; }

rollback() {
  local part="${1:-}" name="${2:-}"
  [[ "$part" == "backend" || "$part" == "frontend" ]] || die "Usage: deploy.sh rollback backend|frontend [BACKUP_NAME]"
  preflight
  if [[ -z "$name" ]]; then name="$(remote "cd $BACKUP_DIR 2>/dev/null && ls -1t ${part}_* 2>/dev/null | head -1")"; fi
  [[ -n "$name" ]] || die "No $part backups found in $BACKUP_DIR"
  confirm "Restore $part from $name on PRODUCTION?"
  if [[ "$part" == "backend" ]]; then restore_backend "$name"; else restore_frontend "$name"; fi
  remote "echo '$(date -u +%FT%TZ) $part ROLLBACK $name' >> $APP_DIR/DEPLOY_LOG"
  smoke_test
}

# ---------------------------------------------------------------- main
cmd="${1:-}"; shift || true
args=()
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --apply-schema) APPLY_SCHEMA=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    *) args+=("$a") ;;
  esac
done

case "$cmd" in
  status)   status ;;
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend; deploy_frontend ;;
  backups)  list_backups ;;
  rollback) rollback "${args[@]:-}" ;;
  ssh)      exec ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" ;;
  *) sed -n '2,19p' "$0"; exit 1 ;;
esac
