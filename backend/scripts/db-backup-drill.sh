#!/usr/bin/env bash
# Backup/restore drill (docs/14 §6): dump a database, restore it into a scratch database, prove the data survived,
# then drop the scratch database and delete the dump. Local MySQL by default (scripts/local-mysql.sh).
#   scripts/db-backup-drill.sh [source_database]        (default: sailix)
# Environment: DRILL_MYSQL_ARGS  extra mysql/mysqldump connection args (default: local project MySQL as root via socket)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:-sailix}"
SCRATCH="${SRC}_restore_drill"
ARGS="${DRILL_MYSQL_ARGS:--uroot --socket=$ROOT/.local/mysql/mysql.sock}"
DIR="$(mktemp -d)"; chmod 700 "$DIR"   # the dump holds password hashes and encrypted tokens: private, short-lived
DUMP="$DIR/dump.sql"
trap 'rm -rf "$DIR"; mysql $ARGS -e "DROP DATABASE IF EXISTS \`$SCRATCH\`" 2>/dev/null || true' EXIT

counts() { # table<TAB>rows for every base table, plus a content checksum of the identity tables
  mysql $ARGS -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$1' AND table_type='BASE TABLE' ORDER BY 1" |
  while read -r t; do printf '%s\t%s\n' "$t" "$(mysql $ARGS -N -e "SELECT COUNT(*) FROM \`$1\`.\`$t\`")"; done
}
checksum() { mysql $ARGS -N -e "CHECKSUM TABLE \`$1\`.users, \`$1\`.memberships, \`$1\`.tenants, \`$1\`.module_links, \`$1\`.audit_logs" | awk '{print $1"\t"$2}' | sed "s/^$1\./T./"; }

echo "1/5 dump $SRC"
mysqldump $ARGS --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces "$SRC" > "$DUMP"
echo "    $(wc -c < "$DUMP" | tr -d ' ') bytes"

echo "2/5 restore into scratch database $SCRATCH"
mysql $ARGS -e "DROP DATABASE IF EXISTS \`$SCRATCH\`; CREATE DATABASE \`$SCRATCH\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
mysql $ARGS "$SCRATCH" < "$DUMP"

echo "3/5 compare row counts"
diff <(counts "$SRC") <(counts "$SCRATCH") && echo "    row counts identical ($(counts "$SRC" | wc -l | tr -d ' ') tables)"

echo "4/5 compare content checksums (users, memberships, tenants, module_links, audit_logs)"
diff <(checksum "$SRC") <(checksum "$SCRATCH") && echo "    checksums identical"

echo "5/5 schema migrations present in the restore"
mysql $ARGS -N -e "SELECT COUNT(*) FROM \`$SCRATCH\`.migrations" | sed 's/^/    migrations recorded: /'
echo "DRILL PASSED (scratch database and dump removed)"
