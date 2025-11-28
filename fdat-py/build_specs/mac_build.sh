#!/bin/bash
# Run this script from fdat-py/build_specs/ or fdat-py/

# Ensure we are in fdat-py root
if [ -f "app.py" ]; then
    :
elif [ -f "../app.py" ]; then
    cd ..
else
    echo "Error: Could not find app.py. Please run from fdat-py/ or fdat-py/build_specs/"
    exit 1
fi

echo "Building FDAT for macOS..."

# Clean previous builds
rm -rf build dist

# Build with PyInstaller
# Note: --add-data separator is ':' on Unix
pyinstaller --noconfirm --clean \
    --name "FDAT" \
    --windowed \
    --icon "assets/assets/icon-128.png" \
    --add-data "assets:assets" \
    --hidden-import "lxml" \
    --hidden-import "lxml.etree" \
    --hidden-import "lxml._elementpath" \
    app.py

echo "Build complete. App is in dist/FDAT.app"

# Optional: Create DMG if create-dmg is installed
if command -v create-dmg &> /dev/null; then
    echo "Creating DMG..."
    create-dmg \
      --volname "FDAT Installer" \
      --volicon "assets/assets/icon-128.png" \
      --window-pos 200 120 \
      --window-size 800 400 \
      --icon-size 100 \
      --icon "FDAT.app" 200 190 \
      --hide-extension "FDAT.app" \
      --app-drop-link 600 185 \
      "dist/FDAT.dmg" \
      "dist/FDAT.app"
    echo "DMG created at dist/FDAT.dmg"
else
    echo "Skipping DMG creation (create-dmg not found)"
fi
