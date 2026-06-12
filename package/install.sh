#!/bin/bash
# Quick install script for local testing

set -e

APP_NAME="melody-player"
INSTALL_DIR="/opt/$APP_NAME"
BIN_DIR="/usr/local/bin"

echo "Installing $APP_NAME..."

# Check for electron
if ! command -v electron37 &> /dev/null; then
    echo "ERROR: electron37 is required but not found."
    echo "Install it with: yay -S electron37  (AUR)"
    exit 1
fi

# Create install directory
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$BIN_DIR"

# Copy app files
sudo cp -r ../index.html ../styles.css ../app.js ../main.js ../preload.js ../package.json "$INSTALL_DIR/"
sudo cp ../icon.png "$INSTALL_DIR/"

# Create launcher
sudo tee "$BIN_DIR/$APP_NAME" > /dev/null << EOF
#!/bin/bash
exec electron37 $INSTALL_DIR "\$@"
EOF
sudo chmod +x "$BIN_DIR/$APP_NAME"

# Create .desktop file
sudo tee /usr/share/applications/$APP_NAME.desktop > /dev/null << EOF
[Desktop Entry]
Name=Melody
Comment=Modern Spotify-inspired music player
Exec=$APP_NAME %U
Icon=$INSTALL_DIR/icon.png
Terminal=false
Type=Application
Categories=Audio;Music;Player;
MimeType=audio/mpeg;audio/x-wav;audio/ogg;audio/flac;
EOF

echo "✓ Installed to $INSTALL_DIR"
echo "✓ Launcher: $BIN_DIR/$APP_NAME"
echo "✓ Desktop entry: /usr/share/applications/$APP_NAME.desktop"
echo ""
echo "Run with: $APP_NAME"
echo "Or find it in your application menu."
