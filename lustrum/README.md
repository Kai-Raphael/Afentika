# Lustrumspel

Speurtocht met QR-stickers, geheime opdrachten en stemrondes voor het dispuutsweekend.
Draait op dezelfde Cloudflare Pages + D1 setup als de rest van de site.

## Hoe het werkt

| Pad | Voor wie | Wat |
| --- | --- | --- |
| `/lustrum` | spelers | inloggen met spelerscode, rol, opdracht, punten, stemmen |
| `/lustrum/<slug>` | spelers | vraagpagina achter een QR-sticker, vraagt om de pincode van de sticker |
| `/lustrum/scorebord` | iedereen | ranglijst, ververst elke 15 seconden (handig op een tv) |
| `/lustrum/admin` | spelleider | stemrondes openen/sluiten, punten geven, spelers uitschakelen |

Beveiliging, kort:

- **Slugs** zijn 24 willekeurige tekens (~124 bits). Raden of bruteforcen is kansloos.
- **Pincode** (4 cijfers) staat als tekst op de sticker, niet in de QR. Een doorgestuurde link werkt dus niet zonder de sticker gezien te hebben.
- **Spelerscode** (6 tekens, in de brief) is nodig voor alles. Punten horen dus bij een persoon.
- **Rate limiting**: 10 foute spelerscodes per IP en 8 foute pincodes per speler per 15 minuten.
- **Pogingen**: standaard 3 antwoordpogingen per vraag per speler (`maxAttempts` per vraag aan te passen).
- Vraagteksten en antwoorden staan alleen in D1, nooit in `public/`. De HTML van een vraagpagina is voor elke slug hetzelfde.

De repo is publiek. Echte content en gegenereerde output (`lustrum/content/game.json`, `lustrum/out/`) staan daarom in `.gitignore`.

## Opzetten

```bash
npm install

# 1. Tabellen aanmaken (eenmalig)
npx wrangler d1 execute afentika-db --remote --file=lustrum/schema.sql

# 2. Admin-wachtwoord als secret (niet in code!)
npx wrangler pages secret put LUSTRUM_ADMIN_PASSWORD --project-name afentika-site

# 3. Content invullen: kopieer het voorbeeld of gebruik de aangeleverde game.json
cp lustrum/content/game.example.json lustrum/content/game.json

# 4. Codes, stickers, brieven en seed genereren
npm run lustrum:generate

# 5. Spelers en vragen uploaden (veilig om opnieuw te draaien)
npx wrangler d1 execute afentika-db --remote --file=lustrum/out/seed.sql
```

Daarna de site deployen zoals altijd (push naar `main`).

Open `lustrum/out/stickers.html` en `lustrum/out/brieven.html` in je browser en print ze.
`lustrum/out/spelleider.html` is je spiekbrief met alle antwoorden, pincodes en spelerscodes.

### Content aanpassen na het printen

`lustrum/out/assignments.json` onthoudt welke speler welke code, rol en opdracht heeft en welke vraag welke slug en pincode.
De generator vult alleen aan wat ontbreekt, dus je kunt vragen toevoegen of teksten verbeteren zonder dat al geprinte stickers of brieven ongeldig worden.
Wil je zelf een rol of opdracht aan iemand toewijzen, pas het dan in dat bestand aan en draai de generator opnieuw.

### Content-formaat

Zie `content/game.example.json`. Per vraag:

- `key`: stabiele id (a-z, 0-9, -)
- `title`, `body`: wat de speler ziet. `{anagram}` in de body wordt vervangen door de gehusselde `anagramOf`.
- `answers`: geaccepteerde antwoorden. Hoofdletters, accenten, leestekens, spaties en een lidwoord vooraan (de/het/een) worden genegeerd.
- `points`, optioneel `maxAttempts` (standaard 3) en `location` (alleen voor je spiekbrief).

Alles met `TODO` blokkeert de generator. Gebruik `--skip-todo` om die vragen tijdelijk over te slaan.

## Lokaal draaien

```bash
npx wrangler d1 execute afentika-db --local --file=lustrum/schema.sql
npx wrangler d1 execute afentika-db --local --file=lustrum/out/seed.sql
echo "LUSTRUM_ADMIN_PASSWORD=test" > .dev.vars
npx wrangler pages dev public
```

## Tests

```bash
npm test
```

De API-tests draaien de echte handlers tegen `schema.sql` in een in-memory SQLite (`test/d1.js` bootst D1 na).
