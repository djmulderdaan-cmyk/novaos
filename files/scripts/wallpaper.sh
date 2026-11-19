#!/usr/bin/env bash
# Draait tijdens het bouwen: maakt RandomOS de standaard achtergrond in de
# KDE-bureaubladmodus (en op het vergrendelscherm).
#
# Hoe Bazzite (deck, KDE) het nu doet:
#   - /etc/xdg/kdeglobals kiest het globale thema com.valve.vapor.desktop.
#   - Dat thema heeft contents/plasmoidsetupscripts/org.kde.plasma.folder.js,
#     dat bij het aanmaken van het bureaublad Image=/usr/share/wallpapers/convergence.jxl zet.
#   - contents/defaults heeft geen [Wallpaper], dus de "standaard"-achtergrond
#     (o.a. vergrendelscherm, "Standaardwaarden herstellen") valt terug op Next.
# Wij passen precies die twee plekken aan, voor elk geinstalleerd globaal thema,
# zodat het ook blijft werken als Bazzite van thema wisselt.
# Bestaande gebruikers houden hun eigen keuze; nieuwe gebruikers/installaties krijgen RandomOS.
set -euxo pipefail

WP_NAME="RandomOS"
WP_PKG="/usr/share/wallpapers/${WP_NAME}"

# Het files-module moet het wallpaper-pakket al naar / hebben gekopieerd.
test -f "${WP_PKG}/metadata.json"
test -f "${WP_PKG}/contents/images/3840x2160.jpg"

shopt -s nullglob
changed=0

for lnf in /usr/share/plasma/look-and-feel/*/contents; do
    # 1. Bureaublad-opzetscript: vervang de afbeelding die Bazzite/Valve instelt.
    js="${lnf}/plasmoidsetupscripts/org.kde.plasma.folder.js"
    if [[ -f "${js}" ]] && grep -q 'writeConfig("Image"' "${js}"; then
        sed -i -E "s|writeConfig\(\"Image\",[[:space:]]*\"[^\"]*\"\)|writeConfig(\"Image\", \"${WP_PKG}/\")|" "${js}"
        changed=1
    fi

    # 2. Standaardachtergrond van het globale thema ([Wallpaper] Image=<pakketnaam>).
    defaults="${lnf}/defaults"
    if [[ -f "${defaults}" ]]; then
        if grep -q '^\[Wallpaper\]' "${defaults}"; then
            # Bestaande groep: Image-regel binnen [Wallpaper] vervangen of toevoegen.
            awk -v img="Image=${WP_NAME}" '
                /^\[/ { if (inwp && !done) { print img; done=1 } inwp = ($0 == "[Wallpaper]") }
                inwp && /^Image=/ { if (!done) { print img; done=1 } next }
                { print }
                END { if (inwp && !done) print img }
            ' "${defaults}" > "${defaults}.tmp"
            mv "${defaults}.tmp" "${defaults}"
        else
            printf '\n[Wallpaper]\nImage=%s\n' "${WP_NAME}" >> "${defaults}"
        fi
        changed=1
    fi
done

if [[ "${changed}" -eq 0 ]]; then
    echo "WAARSCHUWING: geen KDE look-and-feel pakketten gevonden; standaardachtergrond niet aangepast." >&2
fi

# 3. Vergrendelscherm expliciet instellen (zoals Bazzite dat op de desktop-variant doet).
LOCKRC="/etc/xdg/kscreenlockerrc"
if ! grep -q '^\[Greeter\]\[Wallpaper\]\[org.kde.image\]\[General\]' "${LOCKRC}" 2>/dev/null; then
    printf '\n[Greeter][Wallpaper][org.kde.image][General]\nImage=%s/\nPreviewImage=%s/\n' \
        "${WP_PKG}" "${WP_PKG}" >> "${LOCKRC}"
else
    sed -i -E "/^\[Greeter\]\[Wallpaper\]\[org.kde.image\]\[General\]/,/^\[/{s#^(Image|PreviewImage)=.*#\1=${WP_PKG}/#}" "${LOCKRC}"
fi

# Laat in de build-log zien wat er nu staat.
grep -H 'Image' /usr/share/plasma/look-and-feel/*/contents/plasmoidsetupscripts/org.kde.plasma.folder.js </dev/null || true
grep -H -A1 '^\[Wallpaper\]' /usr/share/plasma/look-and-feel/*/contents/defaults </dev/null || true
cat "${LOCKRC}"
