#!/usr/bin/env bash
set -Eeuo pipefail

required_vars=(
  COOLIFY_API_TOKEN
  COOLIFY_DEPLOY_URL
  COOLIFY_SMOKE_URL
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name is required" >&2
    exit 64
  fi
done

if [[ ! "$COOLIFY_DEPLOY_URL" =~ ^https://[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]/api/v1/deploy\?uuid=[A-Za-z0-9_-]+\&force=(true|false)$ ]]; then
  echo "COOLIFY_DEPLOY_URL must be an HTTPS Coolify deploy endpoint" >&2
  exit 64
fi

if [[ ! "$COOLIFY_SMOKE_URL" =~ ^https?://[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]]; then
  echo "COOLIFY_SMOKE_URL must be an HTTP(S) origin with no path" >&2
  exit 64
fi

for command in curl jq; do
  if ! command -v "$command" > /dev/null 2>&1; then
    echo "$command is required" >&2
    exit 69
  fi
done

timeout_seconds="${COOLIFY_DEPLOY_TIMEOUT_SECONDS:-900}"
poll_seconds="${COOLIFY_DEPLOY_POLL_SECONDS:-10}"

if [[ ! "$timeout_seconds" =~ ^[1-9][0-9]*$ || ! "$poll_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "Coolify timeout and poll interval must be positive integers" >&2
  exit 64
fi

auth_header="Authorization: Bearer $COOLIFY_API_TOKEN"
start_response="$(
  curl --fail-with-body --silent --show-error --retry 3 --retry-all-errors \
    --proto '=https' --tlsv1.2 \
    --header "$auth_header" \
    "$COOLIFY_DEPLOY_URL"
)"

if ! deployment_uuid="$(
  jq -er \
    '(
      .deployment_uuid //
      .deploymentUuid //
      .uuid //
      .deployments[0].deployment_uuid //
      .deployments[0].deploymentUuid //
      .deployments[0].uuid
    ) | strings | select(length > 0)' \
    <<< "$start_response"
)"; then
  echo "Coolify accepted the deploy request but returned no deployment UUID" >&2
  exit 65
fi

api_origin="${COOLIFY_DEPLOY_URL%%/api/v1/deploy*}"
deadline=$((SECONDS + timeout_seconds))
last_status=""

echo "Coolify deployment $deployment_uuid queued"

while ((SECONDS < deadline)); do
  deployment_response="$(
    curl --fail-with-body --silent --show-error --retry 3 --retry-all-errors \
      --proto '=https' --tlsv1.2 \
      --header "$auth_header" \
      "$api_origin/api/v1/deployments/$deployment_uuid"
  )"
  deployment_status="$(
    jq -er '(.status // .deployment.status) | strings | select(length > 0)' \
      <<< "$deployment_response"
  )"
  normalized_status="$(
    tr '[:upper:] -' '[:lower:]__' <<< "$deployment_status" | tr -d '\n'
  )"

  if [[ "$normalized_status" != "$last_status" ]]; then
    echo "Coolify deployment status: $normalized_status"
    last_status="$normalized_status"
  fi

  case "$normalized_status" in
    finished|completed|success|successful)
      curl --fail-with-body --silent --show-error --retry 10 \
        --retry-all-errors --retry-delay 2 \
        "$COOLIFY_SMOKE_URL/" > /dev/null
      echo "Coolify deployment $deployment_uuid completed and is reachable"
      exit 0
      ;;
    failed|cancelled|canceled|error)
      echo "Coolify deployment $deployment_uuid ended with status $normalized_status" >&2
      exit 1
      ;;
  esac

  sleep "$poll_seconds"
done

echo "Timed out after ${timeout_seconds}s waiting for Coolify deployment $deployment_uuid (last status: ${last_status:-unknown})" >&2
exit 1
