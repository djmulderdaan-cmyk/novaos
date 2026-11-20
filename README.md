# RandomOS

Een eigen console-achtig gaming-OS, gebouwd op [Bazzite](https://bazzite.gg) met [BlueBuild](https://blue-build.org).
Start op met een eigen opstartscherm (de astronaut 🚀🃏) en gaat dan meteen naar **RandomOS Shell**: een eigen console-menu dat je volledig met je controller bedient.

![Opstartscherm](preview-opstartscherm.png)

## Wat zit waar

| Bestand | Wat het doet |
|---|---|
| `recipes/recipe.yml` | Basis van je OS (Bazzite, Intel/AMD-graphics) → image `randomos` |
| `recipes/common.yml` | **Hier pas je je OS aan**: extra programma's, scripts |
| `files/system/` | Wordt 1-op-1 in het OS gekopieerd (opstartthema zit hier) |
| `files/scripts/branding.sh` | Zet je naam in het opstartmenu en activeert het opstartscherm |
| `files/scripts/install-shell.sh` | Installeert Electron (het venster waarin RandomOS Shell draait) |
| `files/system/usr/lib/randomos-shell/app/` | **RandomOS Shell**: de interface (`ui/`) en de koppeling met het systeem (`backend/`) |
| `files/system/etc/gamescope-session-plus/sessions.d/ogui-steam` | Laat Game Mode starten met RandomOS Shell |
| `assets/` | De astronaut (origineel + uitgeknipt) |
| `tools/cutout_mascot.py` | Knipt de astronaut uit zijn blauwe achtergrond |
| `tools/make_wallpaper.py` | Maakt de bureaublad-achtergrond met de astronaut |
| `tools/make_logo.py` | Maakt de plaatjes voor het opstartscherm opnieuw (andere naam/kleur) |
| `.github/workflows/build.yml` | Laat GitHub je OS elke dag automatisch bouwen |

---

## Stap 1 — Project op GitHub zetten

1. Maak een (gratis) account op github.com.
2. Maak een nieuwe **public** repository, bijvoorbeeld `novaos`.
3. Upload deze hele map (makkelijkst met **GitHub Desktop**: *Add existing repository* → *Publish*).

## Stap 2 — Ondertekeningssleutel maken (eenmalig)

Hiermee kan je laptop controleren dat updates echt van jou komen.

In PowerShell, in deze map:

```powershell
winget install sigstore.cosign
```

```powershell
$env:COSIGN_PASSWORD=""; cosign generate-key-pair
```

Je krijgt twee bestanden:
- `cosign.pub` → **wel** uploaden naar GitHub (hoort in de repo).
- `cosign.key` → **nooit** uploaden (staat al in `.gitignore`). Open hem in Kladblok, kopieer alles, en zet het op GitHub bij
  *Settings → Secrets and variables → Actions → New repository secret*, naam: `SIGNING_SECRET`.

Bewaar `cosign.key` ergens veilig.

## Stap 3 — Eerste build

- Push/upload `cosign.pub`. Op GitHub, tab **Actions**, zie je de build starten (±20–40 min).
- Als hij groen is: ga naar je profiel → **Packages** → `randomos` → *Package settings* → *Change visibility* → **Public**.

## Stap 4 — Installeren naast Windows

**Eerst in Windows:**
1. Backup van belangrijke bestanden.
2. BitLocker-herstelsleutel opzoeken: account.microsoft.com/devices/recoverykey
3. Snel opstarten uit: *Configuratiescherm → Energiebeheer → Wat de aan/uit-knoppen doen*.
4. *Schijfbeheer* → rechtsklik C: → **Volume verkleinen** (minstens 150 GB vrij).

**Dan:**
1. Download de Bazzite-ISO via bazzite.gg: kies **Intel/AMD**-graphics en de **Steam Gaming Mode**-variant (deck).
2. Zet hem op een USB-stick met Fedora Media Writer of Rufus.
3. Opstarten vanaf USB (F12/F2/Esc bij het opstarten), installeren op de **vrije ruimte**, *niet* "hele schijf wissen".
   Secure Boot mag aan blijven; volg de stap om de sleutel in te schrijven (wachtwoord: `universalblue`).

## Stap 5 — Overstappen naar RandomOS

In Bazzite: *Game Mode → Power → Switch to Desktop*, open **Konsole** en typ:

```bash
rpm-ostree rebase ostree-unverified-registry:ghcr.io/djmulderdaan-cmyk/randomos:latest
systemctl reboot
```

Na de herstart (je ziet nu het RandomOS-opstartscherm), nog één keer om updates ondertekend te maken:

```bash
rpm-ostree rebase ostree-image-signed:docker://ghcr.io/djmulderdaan-cmyk/randomos:latest
systemctl reboot
```

Klaar. Vanaf nu haalt je laptop automatisch jouw nieuwste versie binnen.

Iets stuk na een update? Kies in het opstartmenu de vorige versie, of typ `rpm-ostree rollback`.

---

## Games

- **Steam**: werkt direct in Game Mode.
- **Epic / GOG / Amazon**: installeer *Heroic Games Launcher* via de app-store in Desktop Mode.
- **Losse games (.exe)**: in Desktop Mode via Steam → *Een niet-Steam-game toevoegen* (zet Proton aan bij Compatibiliteit), dan staan ze ook in Game Mode.
- ❌ Game Pass/Xbox-app en games met kernel-anticheat (Valorant, Fortnite, CoD) → die speel je in Windows.

## Aanpassen

- **Programma toevoegen**: zet de naam onder `packages:` in `recipes/common.yml` en push. Na de volgende build heeft je laptop hem.
- **Andere naam of kleur**:
  ```powershell
  python tools/make_logo.py "MijnNaam" "#ff5a7a"
  ```
  en verander `OS_NAME` in `files/scripts/branding.sh`.
- **Andere mascotte**: vervang `assets/mascot-bron.png` en draai `python tools/cutout_mascot.py` en daarna `python tools/make_logo.py`.

---

## RandomOS Shell

Het hoofdmenu van RandomOS. Bediening:

| Knop (Xbox / PlayStation) | Doet |
|---|---|
| A / ✕ | Kiezen, spelen |
| B / ○ | Terug |
| X / □ | Favoriet maken |
| Y / △ | Snelmenu (volume, helderheid, batterij, wifi) |
| LB RB / L1 R1 | Tabblad wisselen (Home · Bibliotheek · Instellingen) |
| ☰ / Options | Aan/uit-menu (slaapstand, herstarten, uitzetten, bureaublad) |
| Xbox / PS-knop | Naar Home. **Ingedrukt houden tijdens een game: game stoppen** |

**Instellingen** (alles met de controller):
- **Uiterlijk:** 8 thema's, accentkleur, achtergrond (game-art / ruimte / effen), tegelgrootte, tekstgrootte, klok, datum, batterij-%
- **Effecten & geluid:** geluidspakketten (Zacht, Retro, Ruimte, Bubbels, Kristal, Klik) of **eigen geluiden**, menuvolume, animaties beperken, prestatiemodus
- **Controller:** knoppenstijl (Xbox / PlayStation / Nintendo), A/B wisselen, scrollsnelheid, trillen, testscherm
- **Home & bibliotheek:** starttabblad, favorieten eerst, verborgen games
- **Energie:** screensaver met zwevende astronaut, automatisch slapen, batterijwaarschuwing
- Wifi, Bluetooth (controllers koppelen), volume en helderheid, systeeminfo

**Toetsenbord & muis** werken ook overal:

| Toets | Doet |
|---|---|
| Pijltjes | Bewegen |
| Enter | Kiezen / spelen |
| Esc of rechtermuisknop | Terug |
| 1 / 2 / 3 | Home / Bibliotheek / Instellingen |
| Q / E | Vorig / volgend tabblad |
| / of Ctrl+F | Zoeken in je bibliotheek |
| F | Favoriet maken |
| Y | Snelmenu |
| M | Aan/uit-menu |
| H | Overzicht van alle sneltoetsen |

Met de muis: aanwijzen en klikken, scrollen door je games, schuifjes slepen, en klikken op de knoppen onderin, de klok of het wifi-icoon.
De knoppen onderin het scherm passen zich vanzelf aan: controllerknoppen als je een controller gebruikt, toetsen als je het toetsenbord gebruikt.

**Minecraft via Modrinth:** installeer de *Modrinth App* (app-winkel). Elke instance die je daarin maakt, verschijnt
in RandomOS als eigen tegel (grasblok + naam, of het eigen icoon van de instance) en start met één druk direct die instance.
Tip: installeer in Modrinth de mod **Controlify** voor controller-besturing en **Sodium** voor meer FPS.

**Taal:** Nederlands of English (of automatisch, op basis van je systeemtaal), in te stellen bij *Instellingen*.

**Eigen geluiden:** zet in de bureaubladmodus bestanden in `~/.config/randomos/sounds/` met deze namen:
`move` (bewegen), `select` (kiezen), `back` (terug), `tab`, `open`, `launch` (game starten), `boot` (opstarten).
Formaat `.wav`, `.ogg` of `.mp3`, max 3 MB. Kies daarna *Instellingen → Effecten & geluid → Eigen*.

**Prestaties:** zodra een game draait, "slaapt" de shell: hij tekent niks en leest de controller maar 8× per seconde uit.
Op een zwakkere laptop kun je in *Instellingen → Uiterlijk* de **Prestatiemodus** aanzetten (geen vervaging, gloed of lichtjes).

**Eigen games toevoegen** (in de bureaubladmodus): maak `~/.config/randomos/games.json`:

```json
[
  { "name": "Mijn game", "cmd": "/home/jij/Games/mijngame/start.sh", "cover": "~/Games/mijngame/cover.jpg" }
]
```

Epic-, GOG- en Amazon-games uit **Heroic** en al je **Steam**-games verschijnen vanzelf.

**Liever de gewone Steam-interface?** *Instellingen → Systeem → Gewone Steam-interface gebruiken*.
Terug naar RandomOS Shell: ga naar de bureaubladmodus en start **"RandomOS Shell weer gebruiken"** uit het menu.

**Gaat er iets mis?** Crasht de shell, dan start Game Mode automatisch met de gewone Steam-interface, dus je zit nooit vast.
Het logboek staat in `~/.local/state/randomos/shell.log`.

**Interface bekijken op Windows** (demo met nepdata):

```powershell
python -m http.server 8765 --directory files/system/usr/lib/randomos-shell/app/ui
```

en open `http://localhost:8765`. Toetsen: pijltjes, Enter (A), Esc (B), X, Y, Q/E (LB/RB), M (☰).
