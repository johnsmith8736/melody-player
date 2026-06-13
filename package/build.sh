#!/bin/bash
# Build script for melody-player AUR package
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building melody-player ==="

# Step 1: Ensure no personal data is packaged
rm -f "$PROJECT_DIR/state.json"
rm -f "$SCRIPT_DIR"/melody-player-*.tar.gz
rm -f "$SCRIPT_DIR"/melody-player-*.pkg.tar.zst
rm -f "$SCRIPT_DIR"/Melody-*.pacman

# Step 2: Build the pacman package with electron-builder
echo "Building with electron-builder..."
cd "$PROJECT_DIR"
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dist

# Step 3: Create the source tarball for AUR
echo "Creating source tarball..."
cd "$SCRIPT_DIR"
PKGVER=$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
tar czf "melody-player-${PKGVER}.tar.gz" \
    -C "$PROJECT_DIR" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='state.json' \
    --exclude='playlist' \
    --exclude='package' \
    --exclude='.git' \
    index.html styles.css app.js main.js preload.js \
    icon.png package.json

echo ""
echo "=== Done ==="
echo "Source tarball: $SCRIPT_DIR/melody-player-${PKGVER}.tar.gz"
echo "Pacman package: $PROJECT_DIR/dist/Melody-${PKGVER}-x64.pacman"
