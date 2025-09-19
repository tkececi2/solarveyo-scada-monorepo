#!/usr/bin/env bash
set -euo pipefail

echo "[Appflow] Installing dependencies"
npm ci

echo "[Appflow] Building web assets"
npm run build

echo "[Appflow] Syncing Capacitor iOS project"
npx cap sync ios

# Place Firebase iOS plist if provided via environment
if [[ -n "${GOOGLE_SERVICE_INFO_PLIST_BASE64:-}" ]]; then
  echo "[Appflow] Writing GoogleService-Info.plist from base64"
  mkdir -p ios/App/App
  echo "$GOOGLE_SERVICE_INFO_PLIST_BASE64" | base64 --decode > ios/App/App/GoogleService-Info.plist
fi

# Generate iOS icons/splash if resources exist
if [[ -f resources/icon.png || -f resources/splash.png ]]; then
  echo "[Appflow] Generating iOS icons/splash from resources/"
  npx @capacitor/assets generate ios --android false || true
fi

# Optional: allow HTTP during development if explicitly enabled
if [[ "${IOS_ALLOW_HTTP:-false}" == "true" ]]; then
  echo "[Appflow] Allowing HTTP traffic via ATS exceptions (Info.plist)"
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" ios/App/App/Info.plist || true
  /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsArbitraryLoads bool true" ios/App/App/Info.plist || true
fi

echo "[Appflow] Build script completed"


