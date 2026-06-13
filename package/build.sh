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
tar czf "melody-player-1.0.0.tar.gz" \
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
echo "Source tarball: $SCRIPT_DIR/melody-player-1.0.0.tar.gz"
echo "Pacman package: $PROJECT_DIR/dist/Melody-1.0.0-x64.pacman"
echo ""
echo "To upload to AUR:"
echo "  1. Copy .SRCINFO and PKGBUILD to an AUR git repo"
echo "  2. Run: makepkg --printsrcinfo > .SRCINFO"
echo "  3. Commit and push: git add .SRCINFO PKGBUILD && git commit -m 'v1.0.0-2' && git push"
