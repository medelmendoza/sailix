#!/usr/bin/env bash
# Project-local MySQL for development/tests (data in backend/.local/mysql, git-ignored, port 3308).
# Usage: scripts/local-mysql.sh {init|start|stop|status|shell|reset}
# Dev-only credentials (see .env.example / phpunit.xml): user "sailix", databases "sailix" and "sailix_test".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/.local/mysql"
SOCK="$DIR/mysql.sock"
PORT="${LOCAL_MYSQL_PORT:-3308}"
BASEDIR="${MYSQL_BASEDIR:-$(brew --prefix mysql 2>/dev/null || echo /usr/local)}"
DEV_PASSWORD="${LOCAL_DB_PASSWORD:-local-dev-only}"

root_sql() { mysql -uroot --socket="$SOCK" "$@"; }

case "${1:-}" in
  init)
    [ -d "$DIR/data" ] && { echo "already initialised: $DIR/data"; exit 0; }
    mkdir -p "$DIR"
    mysqld --no-defaults --initialize-insecure --datadir="$DIR/data" --basedir="$BASEDIR" >"$DIR/init.log" 2>&1
    "$0" start
    root_sql -e "CREATE DATABASE IF NOT EXISTS sailix CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
                 CREATE DATABASE IF NOT EXISTS sailix_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
                 CREATE USER IF NOT EXISTS 'sailix'@'127.0.0.1' IDENTIFIED BY '$DEV_PASSWORD';
                 CREATE USER IF NOT EXISTS 'sailix'@'localhost' IDENTIFIED BY '$DEV_PASSWORD';
                 GRANT ALL ON sailix.* TO 'sailix'@'127.0.0.1'; GRANT ALL ON sailix_test.* TO 'sailix'@'127.0.0.1';
                 GRANT ALL ON sailix.* TO 'sailix'@'localhost'; GRANT ALL ON sailix_test.* TO 'sailix'@'localhost';"
    echo "initialised on 127.0.0.1:$PORT"
    ;;
  start)
    if root_sql -e 'select 1' >/dev/null 2>&1; then echo "already running"; exit 0; fi
    nohup mysqld --no-defaults --datadir="$DIR/data" --basedir="$BASEDIR" --port="$PORT" \
      --bind-address=127.0.0.1 --socket="$SOCK" --mysqlx=OFF --pid-file="$DIR/mysql.pid" \
      --log-error="$DIR/error.log" >/dev/null 2>&1 &
    for _ in $(seq 1 60); do root_sql -e 'select 1' >/dev/null 2>&1 && { echo "running on 127.0.0.1:$PORT"; exit 0; }; sleep 1; done
    echo "failed to start; see $DIR/error.log" >&2; exit 1
    ;;
  stop)   root_sql -e 'SHUTDOWN' 2>/dev/null && echo stopped || echo "not running" ;;
  status) root_sql -e 'select version() as version' 2>/dev/null || echo "not running" ;;
  shell)  mysql -usailix -p"$DEV_PASSWORD" -h127.0.0.1 -P"$PORT" sailix ;;
  reset)  "$0" stop || true; rm -rf "$DIR/data"; "$0" init ;;
  *) sed -n '2,4p' "$0"; exit 2 ;;
esac
