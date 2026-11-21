// Gratis Steam-games en demo's die je met één knop aan je bibliotheek toevoegt.
// Gecontroleerd in de Steam-winkel op 21-11-2026 (gratis en beschikbaar). Steam vraagt zelf
// nog om bevestiging voordat iets wordt toegevoegd of gedownload.
// pad: werkt goed met een controller (volgens Steam of bekend)
const CATALOG = [
  // ---- gratis games
  { appid: '2325290', name: 'Sky: Children of the Light', kind: 'free', genre: 'Avontuur, rustig', pad: true },
  { appid: '1276390', name: 'Bloons TD Battles 2', kind: 'free', genre: 'Torenverdediging' },
  { appid: '843380', name: 'Super Animal Royale', kind: 'free', genre: 'Battle royale met dieren', pad: true },
  { appid: '2328760', name: 'Pinball FX', kind: 'free', genre: 'Flipperkast', pad: true },
  { appid: '1782210', name: 'Crab Game', kind: 'free', genre: 'Minigames met vrienden' },
  { appid: '1625450', name: 'Muck', kind: 'free', genre: 'Overleven, bouwen' },
  { appid: '304930', name: 'Unturned', kind: 'free', genre: 'Overleven, open wereld' },
  { appid: '2767030', name: 'Marvel Rivals', kind: 'free', genre: 'Helden-shooter (12+)', pad: true },
  { appid: '2357570', name: 'Overwatch', kind: 'free', genre: 'Helden-shooter (12+)', pad: true },
  { appid: '236390', name: 'War Thunder', kind: 'free', genre: 'Tanks en vliegtuigen', pad: true },
  { appid: '444200', name: 'World of Tanks Blitz', kind: 'free', genre: 'Tanks' },
  { appid: '552990', name: 'World of Warships', kind: 'free', genre: 'Schepen' },
  { appid: '1568590', name: 'Goose Goose Duck', kind: 'free', genre: 'Wie is de verrader?', pad: true },
  { appid: '444090', name: 'Paladins', kind: 'free', genre: 'Helden-shooter', pad: true },
  { appid: '2437170', name: 'SMITE 2', kind: 'free', genre: 'Goden-arena', pad: true },
  { appid: '236110', name: 'Dungeon Defenders II', kind: 'free', genre: 'Torenverdediging + actie' },
  { appid: '304050', name: 'Trove', kind: 'free', genre: 'Blokjeswereld, avontuur' },
  { appid: '200210', name: 'Realm of the Mad God Exalt', kind: 'free', genre: 'Pixel-actie' },
  { appid: '1665460', name: 'eFootball', kind: 'free', genre: 'Voetbal' },
  { appid: '1449850', name: 'Yu-Gi-Oh! Master Duel', kind: 'free', genre: 'Kaartspel' },
  { appid: '1284410', name: 'GWENT', kind: 'free', genre: 'Kaartspel' },
  { appid: '380600', name: 'Fishing Planet', kind: 'free', genre: 'Vissen', pad: true },
  { appid: '1222670', name: 'De Sims 4', kind: 'free', genre: 'Levenssimulatie' },
  { appid: '291550', name: 'Brawlhalla', kind: 'free', genre: 'Vechtspel', pad: true },
  { appid: '1677740', name: 'Stumble Guys', kind: 'free', genre: 'Party-race', pad: true },
  { appid: '2225070', name: 'Trackmania', kind: 'free', genre: 'Racen', pad: true },
  { appid: '3354750', name: 'skate.', kind: 'free', genre: 'Skateboarden', pad: true },
  { appid: '440', name: 'Team Fortress 2', kind: 'free', genre: 'Shooter (12+)', pad: true },
  // ---- gratis demo's van betaalde games
  { appid: '2633700', name: 'PowerWash Simulator (demo)', kind: 'demo', genre: 'Schoonspuiten, rustig', pad: true },
  { appid: '1202910', name: 'Spiritfarer (demo)', kind: 'demo', genre: 'Avontuur, gezellig', pad: true },
  { appid: '1264380', name: 'Lonely Mountains: Downhill (demo)', kind: 'demo', genre: 'Mountainbiken', pad: true },
  { appid: '1763200', name: 'Bread & Fred (demo)', kind: 'demo', genre: 'Klimmen met z\'n tweeën', pad: true },
  { appid: '1930750', name: 'shapez (demo)', kind: 'demo', genre: 'Fabrieken bouwen' },
  { appid: '1650980', name: 'Dome Keeper (demo)', kind: 'demo', genre: 'Graven en verdedigen', pad: true },
  { appid: '1400860', name: 'Against the Storm (demo)', kind: 'demo', genre: 'Stad bouwen' },
  { appid: '2728410', name: 'Ace Attorney Investigations (demo)', kind: 'demo', genre: 'Detective' },
  { appid: '3273240', name: 'DYNASTY WARRIORS: ORIGINS (demo)', kind: 'demo', genre: 'Actie (12+)', pad: true },
  { appid: '3358440', name: 'Persona 3 Reload (demo)', kind: 'demo', genre: 'RPG (12+)', pad: true },
];

module.exports = { CATALOG };
