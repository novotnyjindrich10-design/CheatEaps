/** Texty o zdrojích dat — bez importu katalogu / Pixabay knihovny. */
export const DATA_SOURCE_NOTES = [
  'Názvy a adresy pocházejí z oficiálních webů podniků a z OpenStreetMap (licence ODbL).',
  'Ilustrační fotografie pocházejí z Pixabay, Unsplash a Pexels, jsou uložené u nás a nejsou snímkem konkrétního podniku. U každé je autor a odkaz na zdroj. Fotografii z webu podniku ukazujeme jen tam, kde je její použití doložené.',
  'Ověřenou cenu uvádíme jen s odkazem na menu. Cenový filtr bere ověřenou cenu; u rozpětí musí do limitu vejít i horní mez.',
  'Přesná poloha se na náš server neposílá. Vzdálenost v katalogu je vzdušná čára spočítaná v prohlížeči. Podnik bez ověřené polohy ji nemá a bez polohy uživatele se číslo nezobrazí.',
  'Oficiální weby pocházejí z OpenStreetMap nebo z ručně ověřených záznamů, ne z katalogů.',
  'Otevírací dobu a telefon bereme z OpenStreetMap, pokud je zápis čitelný. Neověřujeme je nezávisle. Stav Otevřeno/Zavřeno ukazujeme jen u jednoduchých a spolehlivých zápisů (Europe/Prague); složité pravidla necháváme jako neznámá.',
  'Google hodnocení zobrazujeme jako ověřené pouze po ověření přes Places API. Bez tohoto ověření je u podniku jen odkaz na vyhledání v Mapách.',
  'Ověřené slevy jsou jen v kategorii Slevy po přihlášení. Podmínky a odkaz Ověřit nabídku jsou u konkrétní nabídky; kód uplatnění je až po přihlášení. Běžné výsledky ani detail podniku slevu nezobrazují.',
]

export const DEMO_DATA_NOTICE = DATA_SOURCE_NOTES.join(' ')
