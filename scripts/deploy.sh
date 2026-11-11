#!/usr/bin/env bash
set -euo pipefail

firebase_credentials="${GOOGLE_APPLICATION_CREDENTIALS:-}"
if [[ -z "$firebase_credentials" && -f "$HOME/.config/hemu/firebase/release-service-account.json" ]]; then
  firebase_credentials="$HOME/.config/hemu/firebase/release-service-account.json"
fi
if [[ -n "$firebase_credentials" && (! -f "$firebase_credentials" || ! -r "$firebase_credentials") ]]; then
  echo "Firebase credential file is missing or unreadable: $firebase_credentials" >&2
  exit 1
fi

env -u GOOGLE_APPLICATION_CREDENTIALS -u FIREBASE_TOKEN npm run build

if [[ -n "$firebase_credentials" ]]; then
  echo 'Deploying with Firebase service-account credentials.'
  exec env -u FIREBASE_TOKEN \
    XDG_CONFIG_HOME="$HOME/.config/hemu/firebase/cli" \
    GOOGLE_APPLICATION_CREDENTIALS="$firebase_credentials" \
    npx --yes firebase-tools@15.24.0 deploy --only hosting:public-site --project hemu-fd2f4 --non-interactive
fi
exec npx --yes firebase-tools@15.24.0 deploy --only hosting:public-site --project hemu-fd2f4 --non-interactive
