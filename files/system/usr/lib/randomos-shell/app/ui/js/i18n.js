// Vertalingen. De sleutel is altijd de originele Nederlandse tekst; ontbreekt een vertaling,
// dan zie je gewoon het Nederlands.
//
// Een taal toevoegen:
//   1. zet hem in LANGS hieronder (code, eigen naam, Nederlandse naam, locale)
//   2. geef elke regel in D een extra veld met die code, bv. it: '...'
//   3. voeg de Nederlandse naam (bv. 'Italiaans') als sleutel toe aan D
// I18N.missing('it') laat zien welke teksten nog geen vertaling hebben.
const I18N = (() => {
  const LANGS = {
    nl: { native: 'Nederlands', name: 'Nederlands', locale: 'nl-NL' },
    en: { native: 'English', name: 'Engels', locale: 'en-GB' },
  };

  const D = {
    // ---------------------------------------------------------------- talen
    'Nederlands': { en: 'Dutch' },
    'Engels': { en: 'English' },
    'Taal': { en: 'Language' },
    'Kies de taal van RandomOS. Wordt meteen toegepast.': { en: 'Choose the language for RandomOS. Applies instantly.' },
    'Automatisch (systeemtaal)': { en: 'Automatic (system language)' },
    'Nu: {lang}': { en: 'Now: {lang}' },
    'Taal: {lang}': { en: 'Language: {lang}' },

    // ---------------------------------------------------------------- tabbladen en vaste teksten
    'Home': { en: 'Home' },
    'Bibliotheek': { en: 'Library' },
    'Instellingen': { en: 'Settings' },
    'Spelen': { en: 'Play' },
    'Favoriet': { en: 'Favorite' },
    'Favoriet maken': { en: 'Add to favorites' },
    'Favorieten': { en: 'Favorites' },
    'Info': { en: 'Info' },
    'Verder spelen': { en: 'Continue playing' },
    'Je games': { en: 'Your games' },
    'Zoeken': { en: 'Search' },
    'Wifi': { en: 'Wi-Fi' },
    'Bluetooth': { en: 'Bluetooth' },
    'Eigen': { en: 'Custom' },
    'Speler': { en: 'Player' },

    // ---------------------------------------------------------------- tijd
    'Vandaag gespeeld': { en: 'Played today' },
    'Gisteren gespeeld': { en: 'Played yesterday' },
    '{n} dagen geleden': { en: '{n} days ago' },
    '1 week geleden': { en: '1 week ago' },
    '{n} weken geleden': { en: '{n} weeks ago' },
    '{n} min gespeeld': { en: '{n} min played' },
    '{n} uur gespeeld': { en: '{n} hours played' },
    'Goedenacht': { en: 'Good night' },
    'Goedemorgen': { en: 'Good morning' },
    'Goedemiddag': { en: 'Good afternoon' },
    'Goedenavond': { en: 'Good evening' },

    // ---------------------------------------------------------------- home & bibliotheek
    'Nog geen games': { en: 'No games yet' },
    'Installeer games via Steam, of voeg Epic- en GOG-games toe met Heroic in de bureaubladmodus. Ze verschijnen hier vanzelf.': { en: 'Install games through Steam, or add Epic and GOG games with Heroic in desktop mode. They’ll show up here automatically.' },
    'Steam openen': { en: 'Open Steam' },
    'FPS-limiet voor deze game': { en: 'FPS limit for this game' },
    'Standaard = je gewone instelling': { en: 'Default = your normal setting' },
    'Standaard': { en: 'Default' },
    'Hoeveel ruimte je games en apps innemen.': { en: 'How much space your games and apps use.' },
    '{free} vrij': { en: '{free} free' },
    '{used} van {size} gebruikt': { en: '{used} of {size} used' },
    'Je schijf is bijna vol. Verwijder games die je niet meer speelt.': { en: 'Your disk is almost full. Remove games you no longer play.' },
    'Grootste games': { en: 'Largest games' },
    'Games verwijderen via Steam': { en: 'Remove games in Steam' },
    'In Steam: game kiezen → tandwiel → Beheren → Verwijderen': { en: 'In Steam: pick a game → gear → Manage → Uninstall' },
    'FPS-limiet': { en: 'FPS limit' },
    'Lager = langer spelen op je batterij en een koelere laptop': { en: 'Lower = longer battery life and a cooler laptop' },
    'nog {n} min': { en: '{n} min left' },
    'nog {h}:{m} uur': { en: '{h}:{m} h left' },
    'Temperatuur': { en: 'Temperature' },
    '{done} van {total}': { en: '{done} of {total}' },
    '{n} downloads': { en: '{n} downloads' },
    'Downloaden… {pct}%': { en: 'Downloading… {pct}%' },
    'Er wordt niets gedownload.': { en: 'Nothing is downloading.' },
    'update': { en: 'update' },
    'Downloads': { en: 'Downloads' },
    '{title} is bijgewerkt': { en: '{title} has been updated' },
    '{title} is klaar om te spelen': { en: '{title} is ready to play' },
    'laadt': { en: 'charging' },
    'Screenshot maken': { en: 'Take screenshot' },
    'Van {title}, zonder dit menu erop': { en: 'Of {title}, without this menu on it' },
    'Screenshot opgeslagen in je album': { en: 'Screenshot saved to your album' },
    'Screenshot maken lukte niet': { en: 'Could not take a screenshot' },
    'Album': { en: 'Album' },
    'Je screenshots': { en: 'Your screenshots' },
    'Nog geen screenshots': { en: 'No screenshots yet' },
    'Druk tijdens een game op de Home-knop en kies "Screenshot maken" in het snelmenu.': { en: 'During a game, press the Home button and choose "Take screenshot" in the quick menu.' },
    '1 screenshot': { en: '1 screenshot' },
    '{n} screenshots': { en: '{n} screenshots' },
    'Screenshot verwijderen?': { en: 'Delete screenshot?' },
    'Dit kan niet ongedaan worden gemaakt.': { en: 'This cannot be undone.' },
    'Screenshot verwijderd': { en: 'Screenshot deleted' },
    'Vorige': { en: 'Previous' },
    'Volgende': { en: 'Next' },
    'Opslaan lukte niet': { en: 'Could not save it' },
    'rpm-ostree niet beschikbaar': { en: 'rpm-ostree is not available' },
    'App niet gevonden': { en: 'App not found' },
    'Niet gevonden': { en: 'Not found' },
    'Meest gespeeld': { en: 'Most played' },
    'Nu aan het spelen': { en: 'Now playing' },
    'Net begonnen': { en: 'Just started' },
    '{n} min': { en: '{n} min' },
    '{h} uur {m} min': { en: '{h} h {m} min' },
    'Slaaptimer': { en: 'Sleep timer' },
    'Slaapt om {time}': { en: 'Sleeps at {time}' },
    'Vanzelf slapen': { en: 'Sleep automatically' },
    '1u': { en: '1h' },
    '2u': { en: '2h' },
    'Verras me': { en: 'Surprise me' },
    'Een willekeurige game': { en: 'A random game' },
    'Tegel verwijderen?': { en: 'Remove tile?' },
    '{title} verdwijnt uit je bibliotheek. De game of app zelf blijft gewoon geïnstalleerd.': { en: '{title} will be removed from your library. The game or app itself stays installed.' },
    'Verwijderen': { en: 'Remove' },
    'Verwijderen lukte niet': { en: 'Could not remove it' },
    '{title} verwijderd': { en: '{title} removed' },
    'Apps toevoegen': { en: 'Add apps' },
    'Als tegel in je bibliotheek zetten': { en: 'Add as a tile to your library' },
    '{name} staat nu in je bibliotheek': { en: '{name} is now in your library' },
    'Toevoegen lukte niet': { en: 'Could not add it' },
    'Alles staat er al': { en: 'All set' },
    'Alle geïnstalleerde apps staan al in je bibliotheek.': { en: 'All installed apps are already in your library.' },
    'Totaal': { en: 'Total' },
    '{n} games gespeeld': { en: '{n} games played' },
    'Controller als toetsenbord: aan': { en: 'Controller as keyboard: on' },
    'Controller als toetsenbord: uit': { en: 'Controller as keyboard: off' },
    'Je controller werkt in deze game als toetsenbord en muis': { en: 'Your controller works as keyboard and mouse in this game' },
    'Controller-vertaling uit voor deze game': { en: 'Controller mapping off for this game' },
    'Nieuw in je bibliotheek: {name}': { en: 'New in your library: {name}' },
    'Prestatie-overlay': { en: 'Performance overlay' },
    'FPS-meter tijdens het gamen': { en: 'FPS counter while gaming' },
    'Uitgebreid': { en: 'Detailed' },
    'Prestaties': { en: 'Performance' },
    'Hervatten': { en: 'Resume' },
    'Game stoppen': { en: 'Quit game' },
    'Speelt nu. Druk kort op de Home-knop om te wisselen, houd hem ingedrukt om te stoppen.': { en: 'Playing now. Tap the Home button to switch, hold it to quit.' },
    'Er draait geen game': { en: 'No game is running' },
    'Winkel en downloads': { en: 'Store and downloads' },
    'Updates': { en: 'Updates' },
    'Updates zijn hier niet beschikbaar.': { en: 'Updates are not available here.' },
    'Versie {v}': { en: 'Version {v}' },
    'Herstarten om de update te installeren': { en: 'Restart to install the update' },
    'Versie {v} staat klaar': { en: 'Version {v} is ready' },
    'Nu herstarten?': { en: 'Restart now?' },
    'De laptop start opnieuw op met de nieuwe versie. Dat duurt ongeveer een minuut.': { en: 'The laptop will restart with the new version. This takes about a minute.' },
    'Herstarten': { en: 'Restart' },
    'Zoeken naar updates': { en: 'Check for updates' },
    'RandomOS zoekt ook elke dag automatisch': { en: 'RandomOS also checks automatically every day' },
    'Update beschikbaar': { en: 'Update available' },
    'Nu updaten': { en: 'Update now' },
    'Downloaden en klaarzetten; je kunt gewoon blijven spelen': { en: 'Download and prepare; you can keep playing' },
    'Update downloaden…': { en: 'Downloading update…' },
    'Update klaar! Herstart om hem te installeren.': { en: 'Update ready! Restart to install it.' },
    'Je hebt al de nieuwste versie': { en: 'You already have the latest version' },
    'Je hebt de nieuwste versie': { en: 'You have the latest version' },
    'Update mislukt': { en: 'Update failed' },
    'Geen toestemming om te updaten': { en: 'No permission to update' },
    'Geen toestemming om updates te zoeken': { en: 'No permission to check for updates' },
    'Zoeken mislukt': { en: 'Check failed' },
    'Kon de update niet starten': { en: 'Could not start the update' },
    'Terug naar vorige versie': { en: 'Go back to previous version' },
    'Als een update problemen geeft. Wordt actief na een herstart.': { en: 'If an update causes problems. Takes effect after a restart.' },
    'Vorige versie terugzetten?': { en: 'Restore previous version?' },
    'Na de volgende herstart start de laptop met de vorige versie van RandomOS.': { en: 'After the next restart the laptop starts with the previous version of RandomOS.' },
    'Terugzetten mislukt': { en: 'Restore failed' },
    'Vorige versie staat klaar. Herstart om terug te gaan.': { en: 'Previous version is ready. Restart to go back.' },
    'Update downloaden… {a} van {b}': { en: 'Downloading update… {a} of {b}' },
    'Update klaarzetten…': { en: 'Preparing update…' },
    'Er staat een update klaar. Herstart om hem te installeren.': { en: 'An update is ready. Restart to install it.' },
    'Log in bij Steam': { en: 'Sign in to Steam' },
    'Log één keer in bij Steam om je games te zien. Na het inloggen kom je vanzelf terug in RandomOS.': { en: 'Sign in to Steam once to see your games. After signing in you will return to RandomOS automatically.' },
    'Inloggen bij Steam': { en: 'Sign in to Steam' },
    'Steam-inlogscherm geopend. Druk op de Home-knop om terug te gaan.': { en: 'Steam sign-in opened. Press the Home button to go back.' },
    'Steam geopend. Druk op de Home-knop om terug te gaan.': { en: 'Steam opened. Press the Home button to go back.' },
    'Ingelogd bij Steam': { en: 'Signed in to Steam' },
    'Alle games': { en: 'All games' },
    '{n} geïnstalleerd': { en: '{n} installed' },
    'Alle': { en: 'All' },
    'Recent': { en: 'Recent' },
    'Niets gevonden': { en: 'Nothing found' },
    'Geen games in deze lijst': { en: 'No games in this list' },
    'Geen game met “{q}” in de naam.': { en: 'No game with “{q}” in its name.' },
    'Druk op X bij een game om hem favoriet te maken.': { en: 'Press X on a game to make it a favorite.' },
    'Probeer een ander filter.': { en: 'Try another filter.' },
    'Zoek in je bibliotheek': { en: 'Search your library' },
    'Naam van de game': { en: 'Game name' },
    '{title} is nu favoriet': { en: '{title} is now a favorite' },
    '{title} is geen favoriet meer': { en: '{title} is no longer a favorite' },
    '{title} verborgen': { en: '{title} hidden' },
    '{title} is weer zichtbaar': { en: '{title} is visible again' },
    'Naar links': { en: 'Scroll left' },
    'Naar rechts': { en: 'Scroll right' },

    // ---------------------------------------------------------------- game-details en starten
    'Laatst gespeeld': { en: 'Last played' },
    'Nog nooit': { en: 'Never' },
    'Speeltijd': { en: 'Play time' },
    'Grootte': { en: 'Size' },
    'Weer tonen': { en: 'Show again' },
    'Verbergen': { en: 'Hide' },
    'Sluiten': { en: 'Close' },
    '{title} draait nog': { en: '{title} is still running' },
    'Wordt gestart…': { en: 'Starting…' },
    'Stoppen': { en: 'Stop' },
    'Speelt nu. Houd de Home-knop ingedrukt om te stoppen.': { en: 'Now playing. Hold the Home button to stop.' },
    'Welkom terug': { en: 'Welcome back' },

    // ---------------------------------------------------------------- meldingen van het systeem
    'Verkeerd wachtwoord': { en: 'Wrong password' },
    'Verbinden mislukt': { en: 'Connection failed' },
    'Verbinden mislukt. Staat het apparaat in koppelmodus?': { en: 'Connection failed. Is the device in pairing mode?' },
    'Kon de game niet starten': { en: 'Couldn’t start the game' },
    'De game is niet gestart': { en: 'The game didn’t start' },
    'De game is niet gestart (Steam reageerde niet)': { en: 'The game didn’t start (Steam didn’t respond)' },
    'Game niet gevonden': { en: 'Game not found' },
    '{title} draait al': { en: '{title} is already running' },
    'Onbekende actie': { en: 'Unknown action' },
    'Mislukt': { en: 'Failed' },
    'Controller verbonden': { en: 'Controller connected' },
    'Controller losgekoppeld': { en: 'Controller disconnected' },
    'Demo: "{a}" zou nu uitgevoerd worden': { en: 'Demo: "{a}" would run now' },
    'Demo: Steam Big Picture zou nu openen': { en: 'Demo: Steam Big Picture would open now' },

    // ---------------------------------------------------------------- snelmenu en aan/uit
    'Batterij': { en: 'Battery' },
    '{n}% · laadt': { en: '{n}% · charging' },
    'Netstroom': { en: 'Plugged in' },
    'Niet verbonden': { en: 'Not connected' },
    'Uit': { en: 'Off' },
    'Volume': { en: 'Volume' },
    'Helderheid': { en: 'Brightness' },
    '{title} stoppen': { en: 'Stop {title}' },
    'Sluit de game die nu draait': { en: 'Close the game that’s running' },
    'Aan/uit': { en: 'Power' },
    'Aan/uit-menu': { en: 'Power menu' },
    'Slaapstand': { en: 'Sleep' },
    'Opnieuw opstarten': { en: 'Restart' },
    'Opnieuw opstarten…': { en: 'Restarting…' },
    'Uitzetten': { en: 'Shut down' },
    'Uitzetten…': { en: 'Shutting down…' },
    'Bureaubladmodus': { en: 'Desktop mode' },
    'Gewoon bureaublad met muis en toetsenbord': { en: 'Regular desktop with mouse and keyboard' },
    'Naar bureaublad…': { en: 'Switching to desktop…' },
    'Annuleren': { en: 'Cancel' },

    // ---------------------------------------------------------------- knophints
    'Kiezen': { en: 'Select' },
    'Ingedrukt: game stoppen': { en: 'Hold: stop game' },
    'Aanpassen': { en: 'Adjust' },
    'Terug': { en: 'Back' },
    'Openen': { en: 'Open' },
    'Snelmenu': { en: 'Quick menu' },

    // ---------------------------------------------------------------- sneltoetsen
    'Bewegen': { en: 'Move' },
    'Kiezen / spelen': { en: 'Select / play' },
    'Terug (of rechtermuisknop)': { en: 'Back (or right mouse button)' },
    'Home, Bibliotheek, Instellingen': { en: 'Home, Library, Settings' },
    'Vorig / volgend tabblad': { en: 'Previous / next tab' },
    'Zoeken in je bibliotheek (ook Ctrl+F)': { en: 'Search your library (or Ctrl+F)' },
    'Terug naar Home': { en: 'Back to Home' },
    'Dit overzicht': { en: 'This overview' },
    'Toetsenbord & muis': { en: 'Keyboard & mouse' },
    'Met de muis: wijs aan en klik. Scroll met het wiel door je games. Klik op de knoppen onderin, op de klok of op het wifi-icoon.': { en: 'With the mouse: point and click. Use the scroll wheel to browse your games. Click the buttons at the bottom, the clock or the Wi-Fi icon.' },
    'Begrepen': { en: 'Got it' },

    // ---------------------------------------------------------------- accentkleuren
    'Space-blauw': { en: 'Space blue' },
    'IJsblauw': { en: 'Ice blue' },
    'Paars': { en: 'Purple' },
    'Roze': { en: 'Pink' },
    'Rood': { en: 'Red' },
    'Oranje': { en: 'Orange' },
    'Geel': { en: 'Yellow' },
    'Groen': { en: 'Green' },
    'Turquoise': { en: 'Turquoise' },
    'Wit': { en: 'White' },

    // ---------------------------------------------------------------- thema's en geluidspakketten
    'Space': { en: 'Space' },
    'Middernacht': { en: 'Midnight' },
    'Aurora': { en: 'Aurora' },
    'Oceaan': { en: 'Ocean' },
    'Zonsondergang': { en: 'Sunset' },
    'Bos': { en: 'Forest' },
    'Snoep': { en: 'Candy' },
    'Gloed': { en: 'Ember' },
    'Zacht': { en: 'Soft' },
    'Rustige tikjes': { en: 'Gentle ticks' },
    'Retro': { en: 'Retro' },
    '8-bit piepjes': { en: '8-bit beeps' },
    'Ruimte': { en: 'Space' },
    'Sci-fi bliepjes': { en: 'Sci-fi bleeps' },
    'Bubbels': { en: 'Bubbles' },
    'Plopjes': { en: 'Little pops' },
    'Kristal': { en: 'Crystal' },
    'Glazen belletjes': { en: 'Glass chimes' },
    'Klik': { en: 'Click' },
    'Mechanische klikjes': { en: 'Mechanical clicks' },
    'Jouw bestanden': { en: 'Your files' },

    // ---------------------------------------------------------------- instellingen: categorieën
    'Uiterlijk': { en: 'Appearance' },
    'Effecten & geluid': { en: 'Effects & sound' },
    'Bediening': { en: 'Controls' },
    'Home & bibliotheek': { en: 'Home & library' },
    'Energie': { en: 'Energy' },
    'Geluid & scherm': { en: 'Sound & display' },
    'Games': { en: 'Games' },
    'Systeem': { en: 'System' },
    'Over RandomOS': { en: 'About RandomOS' },

    // ---------------------------------------------------------------- instellingen: uiterlijk
    'Maak RandomOS helemaal van jou.': { en: 'Make RandomOS truly yours.' },
    'Thema': { en: 'Theme' },
    'Thema: {name}': { en: 'Theme: {name}' },
    'Accentkleur': { en: 'Accent color' },
    'Accentkleur: {name}': { en: 'Accent color: {name}' },
    'Weergave': { en: 'Display' },
    'Achtergrond': { en: 'Background' },
    'Wat er achter het menu te zien is': { en: 'What’s shown behind the menu' },
    'Game-art': { en: 'Game art' },
    'Effen': { en: 'Plain' },
    'Tegels': { en: 'Tiles' },
    'Klein': { en: 'Small' },
    'Normaal': { en: 'Normal' },
    'Groot': { en: 'Large' },
    'Extra groot': { en: 'Extra large' },
    'Titels altijd tonen': { en: 'Always show titles' },
    'Naam onder elke game, niet alleen bij selectie': { en: 'Name under every game, not only when selected' },
    'Tekstgrootte': { en: 'Text size' },
    'Bovenbalk': { en: 'Top bar' },
    'Klok': { en: 'Clock' },
    '24 uur': { en: '24-hour' },
    '12 uur': { en: '12-hour' },
    'Datum tonen': { en: 'Show date' },
    'Batterijpercentage': { en: 'Battery percentage' },
    'Profiel': { en: 'Profile' },
    'Naam': { en: 'Name' },
    'Wordt rechtsboven en in de begroeting getoond': { en: 'Shown top right and in the greeting' },
    'Hoe heet je?': { en: 'What’s your name?' },
    'Begroeting op Home': { en: 'Greeting on Home' },
    '"Goedenavond, …" boven de game': { en: '"Good evening, …" above the game' },

    // ---------------------------------------------------------------- instellingen: effecten & geluid
    'Effecten': { en: 'Effects' },
    'Zwevende lichtjes': { en: 'Floating lights' },
    'Rustige deeltjes op de achtergrond': { en: 'Calm particles in the background' },
    'Opstartanimatie': { en: 'Startup animation' },
    'De astronaut bij het opstarten': { en: 'The astronaut at startup' },
    'Animaties beperken': { en: 'Reduce animations' },
    'Minder beweging in de menu’s': { en: 'Less motion in the menus' },
    'Prestatiemodus': { en: 'Performance mode' },
    'Geen vervaging, gloed of lichtjes. Handig op zwakkere laptops.': { en: 'No blur, glow or lights. Handy on weaker laptops.' },
    'Opstartanimatie bekijken': { en: 'Watch startup animation' },
    'Menugeluiden': { en: 'Menu sounds' },
    'Geluidseffecten': { en: 'Sound effects' },
    'Klikjes en tonen in de menu’s': { en: 'Clicks and tones in the menus' },
    'Volume menu': { en: 'Menu volume' },
    'Nog geen eigen geluiden gevonden. Zie de uitleg hieronder.': { en: 'No custom sounds found yet. See the instructions below.' },
    'Geluiden: {name}': { en: 'Sounds: {name}' },
    'Geluidspakket': { en: 'Sound pack' },
    'Eigen geluiden': { en: 'Custom sounds' },
    'Zet in de bureaubladmodus geluidsbestanden (.wav, .ogg, .mp3) in {dir} met deze namen: {names}. Bijvoorbeeld move.wav voor het geluid als je beweegt. Ontbreekt er een, dan gebruikt RandomOS het zachte geluid.': { en: 'In desktop mode, put sound files (.wav, .ogg, .mp3) in {dir} with these names: {names}. For example move.wav for the sound when you move. If one is missing, RandomOS uses the soft sound.' },
    'Eigen geluiden opnieuw laden': { en: 'Reload custom sounds' },
    '{n} gevonden': { en: '{n} found' },
    '{n} eigen geluiden geladen': { en: '{n} custom sounds loaded' },
    'Geen eigen geluiden gevonden': { en: 'No custom sounds found' },

    // ---------------------------------------------------------------- instellingen: bediening
    'Controller, toetsenbord en muis werken allemaal. Xbox, PlayStation, Nintendo en de meeste andere controllers werken direct.': { en: 'Controller, keyboard and mouse all work. Xbox, PlayStation, Nintendo and most other controllers work right away.' },
    'Knoppen': { en: 'Buttons' },
    'Knoppenstijl': { en: 'Button style' },
    'Welke knoppen op het scherm getoond worden': { en: 'Which buttons are shown on screen' },
    'Automatisch': { en: 'Automatic' },
    'Bevestigen en terug wisselen': { en: 'Swap confirm and back' },
    'Rechterknop kiest, onderste knop gaat terug (zoals bij Nintendo). Geldt ook in alle games.': { en: 'Right button selects, bottom button goes back (like Nintendo). Also applies in all games.' },
    'Gevoel': { en: 'Feel' },
    'Scrollsnelheid': { en: 'Scroll speed' },
    'Als je de stick of het pijltje ingedrukt houdt': { en: 'When you hold the stick or an arrow' },
    'Rustig': { en: 'Slow' },
    'Snel': { en: 'Fast' },
    'Trillen': { en: 'Vibration' },
    'Korte tik bij kiezen (als je controller dat kan)': { en: 'Short pulse when selecting (if your controller supports it)' },
    'Hulpmiddelen': { en: 'Tools' },
    'Controller testen': { en: 'Test controller' },
    'Zie live welke knoppen en sticks werken': { en: 'See live which buttons and sticks work' },
    'Draadloze controller koppelen': { en: 'Pair a wireless controller' },
    'Via Bluetooth': { en: 'Via Bluetooth' },
    'Sneltoetsen bekijken': { en: 'View shortcuts' },
    'Of druk op H': { en: 'Or press H' },

    // ---------------------------------------------------------------- instellingen: home & bibliotheek
    'Opstarten in': { en: 'Start in' },
    'Welk scherm je ziet na het aanzetten': { en: 'Which screen you see after turning on' },
    'Rij op Home': { en: 'Home row' },
    'Recent gespeeld': { en: 'Recently played' },
    'Favorieten eerst': { en: 'Favorites first' },
    'Verborgen games ({n})': { en: 'Hidden games ({n})' },
    'Kies om weer te tonen': { en: 'Select to show again' },
    'Geen verborgen games. Verberg een game via Info bij die game.': { en: 'No hidden games. Hide a game from its Info screen.' },

    // ---------------------------------------------------------------- instellingen: energie
    'Spaar je batterij als je even niet speelt.': { en: 'Save battery when you’re not playing.' },
    'Screensaver': { en: 'Screensaver' },
    'Na hoe lang niks doen': { en: 'After how long idle' },
    'Automatisch slapen': { en: 'Auto sleep' },
    'Niet tijdens het gamen': { en: 'Not while gaming' },
    'Nooit': { en: 'Never' },
    '1 uur': { en: '1 hour' },
    'Waarschuwing bij lage batterij': { en: 'Low battery warning' },
    'Bij 15% en 5%': { en: 'At 15% and 5%' },
    'Screensaver nu bekijken': { en: 'Preview screensaver' },

    // ---------------------------------------------------------------- instellingen: wifi & bluetooth
    'Netwerken zoeken…': { en: 'Searching for networks…' },
    'Verbonden met {name}': { en: 'Connected to {name}' },
    'Netwerken': { en: 'Networks' },
    'Geen netwerken gevonden': { en: 'No networks found' },
    'Verbonden': { en: 'Connected' },
    'Opgeslagen': { en: 'Saved' },
    'Wachtwoord voor {name}': { en: 'Password for {name}' },
    'Verbinden met {name}…': { en: 'Connecting to {name}…' },
    'Opnieuw zoeken': { en: 'Search again' },
    'Koppel draadloze controllers, koptelefoons en speakers.': { en: 'Pair wireless controllers, headphones and speakers.' },
    'Nog geen apparaten. Zet je apparaat in koppelmodus en kies "Zoeken".': { en: 'No devices yet. Put your device in pairing mode and choose "Search for devices".' },
    'Gekoppeld': { en: 'Paired' },
    'Nieuw apparaat': { en: 'New device' },
    '{name} losgekoppeld': { en: '{name} disconnected' },
    '{name} verbonden': { en: '{name} connected' },
    'Apparaten': { en: 'Devices' },
    'Koppelen': { en: 'Pairing' },
    'houd de koppelknop bovenop 3 sec ingedrukt.': { en: 'hold the pair button on top for 3 seconds.' },
    'houd PS + Share/Create ingedrukt tot het lampje knippert.': { en: 'hold PS + Share/Create until the light flashes.' },
    'Zoeken naar apparaten': { en: 'Search for devices' },
    'Duurt ongeveer 8 seconden': { en: 'Takes about 8 seconds' },
    'Zoeken…': { en: 'Searching…' },

    // ---------------------------------------------------------------- instellingen: geluid & scherm
    'Geluid': { en: 'Sound' },
    'Dempen': { en: 'Mute' },
    'Scherm': { en: 'Display' },
    'Geen geluid of scherm gevonden om te regelen.': { en: 'No sound or display found to control.' },

    // ---------------------------------------------------------------- instellingen: games
    '{n} games gevonden.': { en: '{n} games found.' },
    '{n} games gevonden': { en: '{n} games found' },
    'Bronnen': { en: 'Sources' },
    '1 game': { en: '1 game' },
    '{n} games': { en: '{n} games' },
    'Acties': { en: 'Actions' },
    'Bibliotheek vernieuwen': { en: 'Refresh library' },
    'Zoek opnieuw naar geïnstalleerde games': { en: 'Scan again for installed games' },
    'Steam Big Picture openen': { en: 'Open Steam Big Picture' },
    'Winkel, downloads en Steam-instellingen': { en: 'Store, downloads and Steam settings' },
    'Eigen games toevoegen': { en: 'Add your own games' },
    'Ga naar de bureaubladmodus en zet je games in {file}. Epic-, GOG- en Amazon-games uit Heroic verschijnen vanzelf.': { en: 'Go to desktop mode and add your games to {file}. Epic, GOG and Amazon games from Heroic show up automatically.' },

    // ---------------------------------------------------------------- instellingen: systeem
    'Processor': { en: 'Processor' },
    'Graphics': { en: 'Graphics' },
    'Geheugen': { en: 'Memory' },
    'Opslag': { en: 'Storage' },
    'Kernel': { en: 'Kernel' },
    'Image': { en: 'Image' },
    '{free} vrij van {total}': { en: '{free} free of {total}' },
    'Over dit apparaat': { en: 'About this device' },
    'Geavanceerd': { en: 'Advanced' },
    'Schakel naar het gewone bureaublad': { en: 'Switch to the regular desktop' },
    'Gewone Steam-interface gebruiken': { en: 'Use the regular Steam interface' },
    'Start Game Mode voortaan zonder RandomOS Shell. Terug via het bureaublad.': { en: 'Start Game Mode without RandomOS Shell from now on. Switch back via the desktop.' },
    'Steam-interface gebruiken?': { en: 'Use the Steam interface?' },
    'Game Mode start dan met de gewone Steam-interface. Je kunt terug via "RandomOS Shell weer gebruiken" in de bureaubladmodus.': { en: 'Game Mode will then start with the regular Steam interface. You can switch back via "RandomOS Shell weer gebruiken" in desktop mode.' },
    'Overschakelen': { en: 'Switch' },
    'RandomOS Shell herstarten': { en: 'Restart RandomOS Shell' },
    'Instellingen terugzetten': { en: 'Reset settings' },
    'Alles van de shell terug naar standaard (je games blijven)': { en: 'Reset everything in the shell to default (your games stay)' },
    'Alles terugzetten?': { en: 'Reset everything?' },
    'Thema, kleuren, controller- en energie-instellingen gaan terug naar standaard. Favorieten en verborgen games blijven.': { en: 'Theme, colors, controller and energy settings go back to default. Favorites and hidden games stay.' },
    'Terugzetten': { en: 'Reset' },
    'Instellingen teruggezet': { en: 'Settings reset' },

    // ---------------------------------------------------------------- instellingen: over
    'Een eigen console-OS, gebouwd op Bazzite en Fedora Linux. Games draaien via Steam en Proton; updates komen elke dag automatisch binnen.': { en: 'A console OS of its own, built on Bazzite and Fedora Linux. Games run through Steam and Proton; updates arrive automatically every day.' },
    'Tabblad wisselen': { en: 'Switch tab' },
    'Naar Home (ingedrukt houden tijdens een game: game stoppen)': { en: 'Go Home (hold during a game: stop game)' },

    // ---------------------------------------------------------------- screensaver, batterij, controllertest
    'Druk op een knop': { en: 'Press any button' },
    'Batterij bijna leeg ({n}%). Sluit je oplader aan!': { en: 'Battery almost empty ({n}%). Plug in your charger!' },
    'Batterij laag: {n}%': { en: 'Battery low: {n}%' },
    'Geen controller gevonden – druk op een knop': { en: 'No controller found – press a button' },
    'Controller': { en: 'Controller' },
    'Linkerstick': { en: 'Left stick' },
    'Rechterstick': { en: 'Right stick' },
    '2× snel drukken om te sluiten': { en: 'Press twice quickly to close' },

    // ---------------------------------------------------------------- schermtoetsenbord
    'Typ iets': { en: 'Type something' },
    'Toon': { en: 'Show' },
    'Verberg': { en: 'Hide' },
    'spatie': { en: 'space' },
    'Klaar': { en: 'Done' },
    'Wissen': { en: 'Delete' },
    'Spatie': { en: 'Space' },
  };

  const unknown = new Set(); // teksten die door t() gingen maar niet in D staan (handig bij testen)

  const api = {
    LANGS,
    D,
    unknown,
    lang: 'nl',
    locale: 'nl-NL',
    setting: 'auto',
    // 'auto' -> Nederlands als de systeemtaal Nederlands is, anders Engels
    resolve(code) {
      if (code && code !== 'auto' && LANGS[code]) return code;
      const sys = String((navigator.language || '')).slice(0, 2).toLowerCase();
      return sys === 'nl' ? 'nl' : 'en';
    },
    // Geeft true terug als de taal echt veranderde
    setLang(code) {
      const want = api.resolve(code);
      api.setting = code && LANGS[code] ? code : 'auto';
      const changed = want !== api.lang;
      api.lang = want;
      api.locale = LANGS[want].locale;
      document.documentElement.lang = want;
      return changed;
    },
    // Welke sleutels nog geen vertaling hebben voor een taal
    missing(code) { return Object.keys(D).filter((k) => !D[k][code]); },
  };
  return api;
})();

function t(key, vars) {
  if (typeof key !== 'string') return key;
  const e = I18N.D[key];
  if (!e && I18N.lang !== 'nl') I18N.unknown.add(key);
  let s = (I18N.lang !== 'nl' && e && e[I18N.lang]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

// Zoals t(), maar placeholders mogen ook elementen zijn (bv. een vetgedrukt pad).
// Geeft een lijst tekst/elementen terug om aan h() mee te geven.
function tx(key, vars = {}) {
  const e = I18N.D[key];
  const s = (I18N.lang !== 'nl' && e && e[I18N.lang]) || key;
  return s.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in vars ? vars[m[1]] : part;
  });
}

// Foutmeldingen uit de backend (Nederlands) vertalen, ook als er een gametitel in zit
function tErr(msg) {
  if (typeof msg !== 'string') return msg;
  if (I18N.D[msg]) return t(msg);
  const m = msg.match(/^(.+) draait al$/);
  if (m) return t('{title} draait al', { title: m[1] });
  return msg;
}

// Vaste teksten in index.html: <span data-i18n="Spelen">Spelen</span>
function applyStaticI18n(root = document) {
  $$('[data-i18n]', root).forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-title]', root).forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $$('[data-i18n-aria]', root).forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
