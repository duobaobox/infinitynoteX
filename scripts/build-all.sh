#!/usr/bin/env bash

# Electron multi-platform build helper for macOS host
# - Builds renderer/main once, then packages for selected platforms
# - On macOS, can build macOS, Windows, and Linux
# - If wine is missing, Windows nsis installer will be skipped; portable/zip will be built instead

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

COLOR_BLUE="\033[1;34m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_RESET="\033[0m"

info() { echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $*"; }
ok()   { echo -e "${COLOR_GREEN}[OK]${COLOR_RESET}   $*"; }
warn() { echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*"; }
err()  { echo -e "${COLOR_RED}[ERR]${COLOR_RESET}  $*"; }

usage() {
  cat <<'EOF'
Usage: bash scripts/build-all.sh [options]

Options:
  --all            Build macOS (x64,arm64) + Windows (x64) + Linux (x64)
  --mac            Build macOS (x64,arm64)
  --win            Build Windows (x64). Requires wine for NSIS; otherwise builds portable/zip
  --linux          Build Linux (x64)
  --skip-assets    Skip renderer/main build (tsc + vite). Use previously built artifacts
  --dry-run        Show the commands without executing electron-builder
  -h, --help       Show this help

Environment:
  BUILDER_EXTRA_FLAGS   Extra flags passed to electron-builder (e.g., "--publish never")

Notes:
  - Run on macOS to build all platforms. Other hosts may have limitations.
  - Outputs go to release/${version} as configured in electron-builder.json5
EOF
}

HOST_OS=$(uname -s || echo "")
if [[ "$HOST_OS" != "Darwin" ]]; then
  warn "This script is optimized for macOS. You are on: $HOST_OS"
fi

MODE="prompt"
SKIP_ASSETS=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) MODE="all"; shift ;;
    --mac) MODE="mac"; shift ;;
    --win) MODE="win"; shift ;;
    --linux) MODE="linux"; shift ;;
    --skip-assets) SKIP_ASSETS=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

prompt_mode() {
  echo "Select targets to build:"
  echo "  1) All (mac + win + linux)"
  echo "  2) macOS"
  echo "  3) Windows"
  echo "  4) Linux"
  read -r -p "Enter choice [1-4]: " choice
  case "$choice" in
    1) MODE="all" ;;
    2) MODE="mac" ;;
    3) MODE="win" ;;
    4) MODE="linux" ;;
    *) err "Invalid choice"; exit 1 ;;
  esac
}

if [[ "$MODE" == "prompt" ]]; then
  prompt_mode
fi

# Check dependencies
if ! command -v node >/dev/null 2>&1; then err "node not found"; exit 1; fi
if ! command -v npm >/dev/null 2>&1; then err "npm not found"; exit 1; fi

if ! npx --yes electron-builder -V >/dev/null 2>&1; then
  warn "electron-builder not found in local deps. Installing dev dependency may be required."
fi

# Assets build
if [[ $SKIP_ASSETS -eq 0 ]]; then
  info "Building renderer/main assets (tsc + vite)..."
  npm run -s assets || {
    warn "npm run assets failed or script missing. Falling back to tsc && vite build"
    npm run -s tsc || npx --yes tsc
    npx --yes vite build
  }
  ok "Assets built"
else
  info "Skipping assets build as requested"
fi

# Decide targets per mode
EB="npx --yes electron-builder"
EXTRA_FLAGS=${BUILDER_EXTRA_FLAGS:-}

run_builder() {
  local cmd="$1"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[dry-run] $cmd $EXTRA_FLAGS"
    return 0
  else
    set +e
    eval "$cmd $EXTRA_FLAGS"
    local code=$?
    set -e
    return $code
  fi
}

build_mac() {
  info "Packaging for macOS (x64, arm64)"
  if run_builder "$EB --mac --x64 --arm64"; then
    ok "macOS DMG build finished"
  else
    warn "macOS DMG failed, falling back to ZIP"
    if run_builder "$EB --mac zip --x64 --arm64"; then
      ok "macOS ZIP build finished"
    else
      err "macOS build failed (DMG and ZIP)"
      FAILED_TARGETS+=("macOS")
      return 0
    fi
  fi
}

build_win() {
  info "Packaging for Windows (x64)"
  if command -v wine >/dev/null 2>&1; then
    info "wine detected: building NSIS installer (default target)"
    if ! run_builder "$EB --win --x64"; then
      err "Windows NSIS build failed"
      FAILED_TARGETS+=("Windows")
      return 0
    fi
  else
    warn "wine not found. Building portable and zip instead of NSIS installer"
    if ! run_builder "$EB --win portable zip --x64"; then
      err "Windows portable/zip build failed"
      FAILED_TARGETS+=("Windows")
      return 0
    fi
  fi
  ok "Windows build finished"
}

build_linux() {
  info "Packaging for Linux (x64)"
  if run_builder "$EB --linux --x64"; then
    ok "Linux build finished"
  else
    warn "Linux build failed. Retrying with ELECTRON_MIRROR..."
    export ELECTRON_MIRROR=${ELECTRON_MIRROR:-"https://npmmirror.com/mirrors/electron/"}
    if run_builder "$EB --linux --x64"; then
      ok "Linux build finished (via mirror)"
    else
      err "Linux build failed after retry"
      FAILED_TARGETS+=("Linux")
      return 0
    fi
  fi
}

FAILED_TARGETS=()

case "$MODE" in
  all)
    build_mac || true
    build_win || true
    build_linux || true
    ;;
  mac)
    build_mac ;;
  win)
    build_win ;;
  linux)
    build_linux ;;
  *)
    err "Unknown mode: $MODE"; exit 1 ;;
esac

if [[ ${#FAILED_TARGETS[@]} -gt 0 ]]; then
  warn "Some targets failed: ${FAILED_TARGETS[*]}"
  warn "Others succeeded. Check release/<version> for artifacts."
  exit 1
fi

ok "All done. Artifacts are under release/<version>"
