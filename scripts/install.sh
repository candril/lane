#!/usr/bin/env bash
set -euo pipefail

# lane installer
#   curl -fsSL https://raw.githubusercontent.com/candril/lane/main/scripts/install.sh | bash
#
# Environment:
#   LANE_INSTALL_DIR  where the binary goes (default /usr/local/bin)
#   LANE_VERSION      a specific version, e.g. 0.1.0 (default: latest release)

REPO="candril/lane"
INSTALL_DIR="${LANE_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="lane"

case "$(uname -s)" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux" ;;
  *)
    echo "Error: unsupported operating system $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64)  ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "Error: unsupported architecture $(uname -m)" >&2
    exit 1
    ;;
esac

ASSET="lane-${OS}-${ARCH}.gz"

echo "lane installer"
echo "  OS:      ${OS}"
echo "  Arch:    ${ARCH}"
echo "  Install: ${INSTALL_DIR}/${BINARY_NAME}"
echo

if [ -n "${LANE_VERSION:-}" ]; then
  TAG="v${LANE_VERSION#v}"
  echo "Installing ${TAG}..."
else
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
  if [ -z "$TAG" ]; then
    echo "Error: could not determine the latest release" >&2
    exit 1
  fi
  echo "Latest release: ${TAG}"
fi

BASE="https://github.com/${REPO}/releases/download/${TAG}"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

echo "Downloading ${ASSET}..."
curl -fsSL -o "$ASSET" "${BASE}/${ASSET}"
curl -fsSL -o SHA256SUMS "${BASE}/SHA256SUMS"

echo "Verifying checksum..."
if command -v sha256sum >/dev/null 2>&1; then
  grep " ${ASSET}\$" SHA256SUMS | sha256sum -c --quiet
elif command -v shasum >/dev/null 2>&1; then
  grep " ${ASSET}\$" SHA256SUMS | shasum -a 256 -c --quiet
else
  echo "Warning: neither sha256sum nor shasum found, skipping verification" >&2
fi

echo "Installing..."
gunzip "$ASSET"
chmod +x "lane-${OS}-${ARCH}"

if [ -w "$INSTALL_DIR" ]; then
  mv "lane-${OS}-${ARCH}" "${INSTALL_DIR}/${BINARY_NAME}"
else
  echo "(${INSTALL_DIR} is not writable — using sudo)"
  sudo mv "lane-${OS}-${ARCH}" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo
echo "lane ${TAG} installed to ${INSTALL_DIR}/${BINARY_NAME}"
echo "Try it offline first:  lane --mock"
echo "Then set JIRA_API_TOKEN and add a board to ~/.config/lane/config.toml."
