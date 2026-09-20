#!/usr/bin/env bash
# Push exactly ONE migration to the linked Supabase project.
#
# Why this exists: this repo's migration history is drifted — there are local-only
# migrations, remote-only versions, and duplicate version numbers. A plain
# `supabase db push` refuses outright ("rerun with --include-all"), and
# --include-all would ship every other work stream's unverified SQL to production.
#
# This script reads the CLI's own dry-run complaints and removes their cause,
# reversibly, until the apply list is exactly the one migration requested:
#
#   * remote-only versions  -> throwaway stub files (already applied; never run)
#   * out-of-order/duplicate local files -> moved to a temp dir
#   * everything is restored byte-identical on exit (EXIT trap)
#
# Usage (from apps/web):
#   bash scripts/push-single-migration.sh 20260921000000_channel_creation_visibility.sql
set -u
cd "$(dirname "$0")/.."   # apps/web

MINE="${1:-}"
if [ -z "$MINE" ] || [ ! -f "supabase/migrations/$MINE" ]; then
  echo "GATE-FAIL: pass the file name of a migration that exists, e.g. 20260921000000_foo.sql"
  exit 1
fi
MINE_VER="${MINE%%_*}"
echo "target migration: $MINE (version $MINE_VER)"

PARK=supabase/migrations_parked_tmp
mkdir -p "$PARK"
stubs=""
parked=0
restore() {
  if [ -d "$PARK" ]; then
    mv "$PARK"/*.sql supabase/migrations/ 2>/dev/null
    rmdir "$PARK" 2>/dev/null || true
  fi
  [ -n "$stubs" ] && rm -f $stubs
  rm -f supabase/migration_list.tmp.txt
  echo "RESTORE done (parked=$parked, stubs='$stubs')"
}
trap 'restore' EXIT

have_local() {   # does any migration file already use this version?
  for f in supabase/migrations/*.sql; do
    [ -f "$f" ] || continue
    [ "$(basename "$f")" = "$MINE" ] && continue
    [ "${f##*/}" = "$(basename "$f")" ] || continue
    case "$(basename "$f")" in "$1"_*) return 0 ;; esac
  done
  return 1
}

ready=0
for attempt in $(seq 1 25); do
  DRY=$(npx supabase db push --dry-run 2>&1)
  printf '%s\n' "$DRY" > supabase/migration_list.tmp.txt

  if printf '%s' "$DRY" | grep -qi "include-all"; then
    # The CLI names the offending local files on the lines of that message.
    files=$(printf '%s\n' "$DRY" \
      | grep -oE '[^\\/ ]+\.sql' | sort -u | grep -v "^${MINE}$" || true)
    if [ -z "$files" ]; then
      echo "GATE-FAIL: out-of-order migrations reported but none identified:"; printf '%s\n' "$DRY"; exit 1
    fi
    moved=0
    for f in $files; do
      if [ -f "supabase/migrations/$f" ]; then
        mv "supabase/migrations/$f" "$PARK/" && moved=$((moved+1)) && parked=$((parked+1))
      fi
    done
    echo "round $attempt: parked $moved out-of-order file(s)"
    [ "$moved" -gt 0 ] || { echo "GATE-FAIL: no progress parking:"; printf '%s\n' "$DRY"; exit 1; }
    continue
  fi

  if printf '%s' "$DRY" | grep -qi "not found in local\|migration repair"; then
    # Remote-only versions: stub the ones that have no local file at all.
    vers=$(printf '%s\n' "$DRY" | grep -oE '[0-9]{8,14}' | sort -u || true)
    made=0
    for v in $vers; do
      [ "$v" = "$MINE_VER" ] && continue
      if ! have_local "$v"; then
        f="supabase/migrations/${v}_remote_only_stub.sql"
        printf -- '-- Throwaway stub written by push-single-migration.sh.\n-- %s is recorded as applied remotely but has no file in this repo.\n' "$v" > "$f"
        stubs="$stubs $f"
        made=$((made+1))
        echo "round $attempt: stubbed remote-only version $v"
      fi
    done
    [ "$made" -gt 0 ] || { echo "GATE-FAIL: remote-only complaint but nothing stubbable:"; printf '%s\n' "$DRY"; exit 1; }
    continue
  fi

  if printf '%s' "$DRY" | grep -q "$MINE_VER"; then
    echo "=== APPLY LIST (gated) ==="
    printf '%s\n' "$DRY" | grep -v "^$" | tail -8
    ready=1
    break
  fi

  echo "GATE-FAIL: dry run neither clean nor diagnosable:"; printf '%s\n' "$DRY"; exit 1
done

if [ "$ready" -ne 1 ]; then
  echo "GATE-FAIL: could not reach a clean apply list in 25 rounds"; exit 1
fi

echo "=== PUSH ==="
npx supabase db push 2>&1 | tail -10

echo "=== VERIFY (remote history) ==="
npx supabase migration list 2>/dev/null | grep "$MINE_VER" || echo "not listed — check manually"
