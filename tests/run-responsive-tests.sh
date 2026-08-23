#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
chrome_bin=${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
test_url="file://${repo_dir}/tests/responsive-layout.html"
stderr_file="${TMPDIR:-/tmp}/averis-responsive-chrome.$$.log"
trap 'rm -f "$stderr_file"' EXIT

if [ ! -x "$chrome_bin" ]; then
  echo "Chrome executable not found: $chrome_bin" >&2
  exit 2
fi

if ! output=$(
  "$chrome_bin" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --allow-file-access-from-files \
    --virtual-time-budget=10000 \
    --dump-dom \
    "$test_url" 2>"$stderr_file"
); then
  cat "$stderr_file" >&2
  echo "Chrome could not run the responsive layout checks." >&2
  exit 1
fi

printf '%s\n' "$output" | tr '<' '\n<' | sed -n 's/^li data-result="\([^"]*\)">\([^<]*\).*/\1: \2/p'

case "$output" in
  *'data-status="passed"'*) exit 0 ;;
  *)
    echo "Responsive layout checks failed." >&2
    exit 1
    ;;
esac
