#!/usr/bin/env bash
# Draait tijdens het bouwen (in de cloud). Zet je eigen naam en opstartscherm aan.
set -euxo pipefail

OS_NAME="RandomOS"

# Naam in het opstartmenu (GRUB) en systeeminfo
sed -i "s/^PRETTY_NAME=.*/PRETTY_NAME=\"${OS_NAME}\"/" /usr/lib/os-release

# Plymouth-thema staat al op z'n plek (files/system), nu de initramfs opnieuw
# bouwen zodat het opstartscherm er ook echt in zit.
export DRACUT_NO_XATTR=1
KVER="$(ls /usr/lib/modules | sort -V | tail -n1)"
dracut --no-hostonly --kver "$KVER" --reproducible --zstd -v \
       --add ostree -f "/usr/lib/modules/${KVER}/initramfs.img"
chmod 0600 "/usr/lib/modules/${KVER}/initramfs.img"

# Automatische updates aan: elke dag op de achtergrond downloaden en klaarzetten.
# (Op deck-images regelt Steam dat normaal, maar RandomOS Shell vervangt de Steam-interface.)
systemctl enable uupd.timer || true
