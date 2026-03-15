#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_HOME_DEFAULT="$(cd "$SOURCE_ROOT/../.." && pwd)"
USER_HOME_DEFAULT="$(cd "$OPENCLAW_HOME_DEFAULT/.." && pwd)"

export HOME="${HOME:-$USER_HOME_DEFAULT}"
LOCAL_SECRETS_SH="${OPENCLAW_LOCAL_SECRETS_SH:-$OPENCLAW_HOME_DEFAULT/scripts/load-local-secrets.sh}"
GATEWAY_SITE_GUARD="${OPENCLAW_GATEWAY_SITE_GUARD:-$OPENCLAW_HOME_DEFAULT/scripts/gateway-site-guard.sh}"
export PATH="$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/cert.pem}"
export NODE_USE_SYSTEM_CA="${NODE_USE_SYSTEM_CA:-1}"
export OPENCLAW_SOURCE_ROOT="${OPENCLAW_SOURCE_ROOT:-$SOURCE_ROOT}"
export OPENCLAW_RUNTIME_DIST="${OPENCLAW_RUNTIME_DIST:-$SOURCE_ROOT/dist}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$OPENCLAW_HOME_DEFAULT}"
export OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$OPENCLAW_HOME_DEFAULT/openclaw.json}"

if [[ -f "$LOCAL_SECRETS_SH" ]]; then
  # shellcheck source=/dev/null
  source "$LOCAL_SECRETS_SH"
fi

if [[ -x "$GATEWAY_SITE_GUARD" ]]; then
  "$GATEWAY_SITE_GUARD" >/dev/null
fi

log() {
  printf '[gateway-launch] %s\n' "$*" >&2
}

read_keychain_secret() {
  local service="$1"
  local account="$2"
  local login_keychain="$HOME/Library/Keychains/login.keychain-db"
  if ! command -v security >/dev/null 2>&1; then
    return 1
  fi
  if [[ -f "$login_keychain" ]]; then
    security find-generic-password -a "$account" -s "$service" -w "$login_keychain" 2>/dev/null || return 1
    return 0
  fi
  security find-generic-password -a "$account" -s "$service" -w 2>/dev/null || return 1
}

read_literal_gateway_token_from_config() {
  python3 - <<'PY' 2>/dev/null
import json
from pathlib import Path

cfg = Path.home() / ".openclaw" / "openclaw.json"
try:
    data = json.loads(cfg.read_text())
except Exception:
    print("")
    raise SystemExit(0)

token = (((data.get("gateway") or {}).get("auth") or {}).get("token") or "").strip()
if token.startswith("${") and token.endswith("}"):
    token = ""
print(token)
PY
}

load_infisical_export() {
  local client_id="${INFISICAL_CLIENT_ID:-}"
  local client_secret="${INFISICAL_CLIENT_SECRET:-${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET:-}}"
  local creds_file="$OPENCLAW_HOME_DEFAULT/.infisical-creds"

  if [[ -z "$client_id" || -z "$client_secret" ]] && [[ -f "$creds_file" ]]; then
    # shellcheck source=/dev/null
    source "$creds_file"
    client_id="${INFISICAL_CLIENT_ID:-}"
    client_secret="${INFISICAL_CLIENT_SECRET:-}"
  fi

  if [[ -z "$client_id" || -z "$client_secret" ]]; then
    client_id="$(read_keychain_secret "openclaw-gateway-prod-client-id" "infisical" || true)"
    client_secret="$(read_keychain_secret "openclaw-gateway-prod-client-secret" "infisical" || true)"
  fi

  if [[ -z "$client_id" || -z "$client_secret" ]]; then
    return 0
  fi

  if ! command -v infisical >/dev/null 2>&1; then
    log "WARN: infisical CLI not found; continuing without exported runtime secrets"
    return 0
  fi

  local token=""
  token="$(infisical login --method=universal-auth \
    --client-id="$client_id" \
    --client-secret="$client_secret" \
    --plain 2>/dev/null || true)"

  if [[ -z "$token" ]]; then
    log "WARN: Infisical auth failed; continuing with local fallbacks"
    return 0
  fi

  local export_payload=""
  export_payload="$(INFISICAL_TOKEN="$token" infisical export \
    --env=prod \
    --path=/openclaw \
    --projectId="304164c8-e792-4134-ad25-edf43a6e0e49" \
    --format=dotenv-export 2>/dev/null || true)"
  if [[ -n "$export_payload" ]]; then
    eval "$export_payload"
  fi
}

ensure_gateway_token() {
  if [[ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
    export GATEWAY_TOKEN="${GATEWAY_TOKEN:-$OPENCLAW_GATEWAY_TOKEN}"
    return 0
  fi

  local token=""
  token="$(read_keychain_secret "openclaw-gateway-token" "openclaw" || true)"
  if [[ -z "$token" ]]; then
    token="$(read_literal_gateway_token_from_config)"
  fi
  if [[ -z "$token" ]]; then
    log "ERROR: OPENCLAW_GATEWAY_TOKEN is unavailable from env, keychain, or config"
    exit 1
  fi

  export OPENCLAW_GATEWAY_TOKEN="$token"
  export GATEWAY_TOKEN="${GATEWAY_TOKEN:-$token}"
}

if [[ ! -x "$SOURCE_ROOT/openclaw.mjs" ]]; then
  log "ERROR: missing source runtime entrypoint at $SOURCE_ROOT/openclaw.mjs"
  exit 1
fi

load_infisical_export
ensure_gateway_token

if [[ $# -eq 0 || "${1:-}" != "gateway" ]]; then
  set -- gateway "$@"
fi

exec "$SOURCE_ROOT/openclaw.mjs" "$@"
