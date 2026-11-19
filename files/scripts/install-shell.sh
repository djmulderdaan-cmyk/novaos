#!/usr/bin/env bash
# Draait tijdens het bouwen: installeert Electron voor RandomOS Shell.
set -euxo pipefail

ELECTRON_VERSION=44.10.1
ELECTRON_SHA256=2be868b71b0aa71f30e6b5567a106a35a049385e963183c074aad1975ead5167
DEST=/usr/lib/randomos-shell/electron

curl -fsSL --retry 5 --retry-all-errors -o /tmp/electron.zip \
  "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-x64.zip"
echo "${ELECTRON_SHA256}  /tmp/electron.zip" | sha256sum -c -

rm -rf "$DEST" && mkdir -p "$DEST"
if command -v unzip >/dev/null; then
  unzip -q /tmp/electron.zip -d "$DEST"
else
  python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" /tmp/electron.zip "$DEST"
fi
rm -f /tmp/electron.zip

# rechten goed zetten (zip-uitpakken met python bewaart ze niet)
chmod 755 "$DEST/electron" "$DEST/chrome_crashpad_handler"
find "$DEST" -maxdepth 1 -name '*.so*' -exec chmod 755 {} +
chmod 4755 "$DEST/chrome-sandbox"
chmod 755 /usr/libexec/randomos/*

# alleen Nederlands en Engels bewaren (scheelt ~40 MB)
find "$DEST/locales" -name '*.pak' ! -name 'nl.pak' ! -name 'en-US.pak' -delete

echo "$ELECTRON_VERSION" > /usr/lib/randomos-shell/electron-version
