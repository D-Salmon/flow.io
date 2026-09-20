#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python_bin="${FLOW_PYTHON:-}"
if [[ -z "$python_bin" ]]; then
  python_bin="$(command -v python3 || command -v python || true)"
fi
if [[ -z "$python_bin" ]]; then
  echo "Python 3 is required (set FLOW_PYTHON when it is not on PATH)" >&2
  exit 1
fi
cfgdocs_env="${PIOENV:-Waveshare-ESP32-S3}"

if [[ -f "scripts/generate_config_docs.py" ]]; then
  PIOENV="$cfgdocs_env" "$python_bin" scripts/generate_config_docs.py
fi

if [[ -f "scripts/generate_cfgdoc_chunks.py" ]]; then
  PIOENV="$cfgdocs_env" "$python_bin" scripts/generate_cfgdoc_chunks.py
fi

FLOW_RUNTIMEUI_WRITE_JSON=1 "$python_bin" scripts/generate_runtimeui_manifest.py

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to minify the embedded web interface" >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo "Web minifier dependencies are missing; run: pnpm install --frozen-lockfile" >&2
  exit 1
fi
node scripts/minify_web_assets.cjs
node scripts/check_minified_web_assets.cjs

if [[ -d "data/wc" ]]; then
  while IFS= read -r -d '' file; do
    gzip -n -9 -c "$file" > "${file}.gz"
  done < <(find "data/wc" -type f -name '*.j' -print0)
fi

rm -f \
  "data/webinterface/cfgdocs.json" \
  "data/webinterface/cfgmods.json" \
  "data/webinterface/cfgdocs.jz" \
  "data/webinterface/cfgmods.jz"
