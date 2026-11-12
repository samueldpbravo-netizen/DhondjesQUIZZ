# Dhondjes Quiz

Een live quiz in chaletstijl: de host toont de vragen op een groot scherm,
spelers doen mee op hun gsm met een code.

## Hoe het werkt

1. Open `host.html` op het toestel dat op het grote scherm getoond wordt en klik op **Open de quiz**
   (die klik zet ook het geluid aan).
2. Er verschijnt een code van 6 cijfers. Spelers gaan op hun gsm naar de site (`index.html`),
   geven eerst de code in en daarna hun naam.
3. De namen verschijnen op het grote scherm. Klik op een naam om ze te wijzigen of te verwijderen.
4. Klik op **Start**, kies een ronde en speel.

Per vraag: **Toon antwoord** → **Stand** → **Volgende vraag**.
Spatie, Enter of pijltje rechts doet hetzelfde als de knop rechtsonder.

## Bestanden

| Bestand | Wat het doet |
| --- | --- |
| `index.html` | Scherm voor spelers (gsm) |
| `host.html` | Het grote scherm van de host |
| `js/quiz-data.js` | **De vragen**, per ronde |
| `js/firebase-config.js` | **Je Firebase-gegevens** |
| `css/style.css` | Het thema (kleuren, plaketten, animaties) |
| `js/sfx.js`, `js/fx.js` | Geluidseffecten en visuele effecten |
| `js/host.js`, `js/player.js`, `js/common.js`, `js/store.js` | Spellogica en verbinding |
| `media/` | Foto's, video's en geluid voor de vragen |
| `media/maps/` | Kaarten voor de locatievragen |
| `database.rules.json` | Regels voor de Firebase-database |

## Achtergrondfoto

Zet je eigen foto in de map `media` met de naam **`achtergrond.jpg`**.
Ze wordt dan automatisch als achtergrond gebruikt op alle schermen.
Zonder foto zie je een getekende haardvuur-achtergrond.

## Soorten vragen

Alles staat in `js/quiz-data.js`; bovenaan dat bestand staat de volledige uitleg.

| type | Wat de speler doet |
| --- | --- |
| `choice` | Meerkeuze (2 tot 4 antwoorden) |
| `text` | Zelf typen; alle antwoorden verschijnen op het grote scherm. Met `scramble` wordt het een letterpuzzel. |
| `number` | Een getal raden; hoe dichter, hoe meer punten |
| `location` | Een plek aanduiden op de kaart (`belgie` of `europa`) |
| `order` | Dingen in de juiste volgorde zetten |

Elke vraag heeft een timer (`duration`, standaard 25 seconden) en kan een foto, video of
geluid tonen met `media: { type: 'image', src: 'media/foto.jpg' }`.

Bij getypte antwoorden kan de host na de onthulling op een antwoord klikken om het
toch goed (of fout) te rekenen.

## Punten

- Juist antwoord: 500 punten + tot 500 extra voor snelheid.
- Getal, locatie en volgorde geven ook punten als je er dichtbij zit.
- Groepsscore = gemiddelde van de leden (eerlijk bij ongelijke groepen).

## Testen zonder Firebase (demo-modus)

Zolang `js/firebase-config.js` niet is ingevuld, werkt alles tussen tabbladen van
dezelfde browser: open `host.html` in één tabblad en `index.html` in een paar andere.
Elk tabblad is een aparte speler.

## Firebase koppelen (om echt online te spelen)

1. Ga naar <https://console.firebase.google.com> en maak een project.
2. Kies **Build > Realtime Database > Create database** (regio bv. `europe-west1`).
3. Open het tabblad **Rules**, plak de inhoud van `database.rules.json` en klik **Publish**.
4. Ga naar **Projectinstellingen > Jouw apps**, voeg een web-app (`</>`) toe en kopieer de `firebaseConfig`.
5. Plak die in `js/firebase-config.js` als `window.FIREBASE_CONFIG = { ... };`.
   Controleer dat `databaseURL` erin staat.

> De regels in `database.rules.json` laten iedereen met een spelcode lezen en schrijven.
> Prima om te testen; later maken we dit strenger.

### Meer dan 99 spelers

Het gratis Firebase-plan (Spark) laat 100 toestellen tegelijk toe, de host inbegrepen.
Daarom staat de limiet op 99 spelers (`MAX_PLAYERS` in `js/common.js`).
Voor meer spelers schakel je het Firebase-project over naar het Blaze-plan en verhoog je dat getal.

## Online zetten met GitHub Pages

1. **Settings > Pages > Deploy from a branch**, kies `main` en `/ (root)`.
2. Spelers gaan naar `https://<gebruikersnaam>.github.io/<repo>/`,
   de host naar `.../host.html`.

## De zes rondes

Alle instellingen (tijden, punten) staan in `js/quiz-data.js`.

| Ronde | Hoe het werkt |
| --- | --- |
| 1. Algemene kennis | 15 vragen, max. 600 punten per vraag |
| 2. Jong & online | 15 vragen over games, platformen en memes, max. 700 punten per vraag |
| 3. Wie is het? | Iedereen maakt op zijn gsm een profiel: lievelingskleur (zelf te mengen), lievelingsdier, tot 4 eigenschappen en een kleine hint. Niets daarvan is zichtbaar op het grote scherm. De helft van de spelers komt aan bod: hun profiel verschijnt en de rest kiest wie het is. Wie geraden moet worden, krijgt voor dat profiel geen punten. |
| 4. Teamspel | Iedereen kiest team 1 of team 2. Jullie spelen het spel in het echt; de host klikt daarna op het winnende team. Winnaars 3000 punten, verliezers 1000. |
| 5. Verstoppertje | Iedereen tikt een verstopplek aan op de kaart. Daarna 5 minuten zoeken: tik waar je iemand vermoedt. 200 punten per gevonden persoon. |
| 6. IQ-test | Spelers vormen groepjes van max. 3 (of spelen alleen). 5 minuten, 50 puzzels, overslaan mag. Iedereen puzzelt op zijn eigen gsm en krijgt het gemiddelde van zijn groepje. |

Punten tellen altijd bij; er gaan nooit punten af.

### Eigen kaart voor Verstoppertje

Zet een afbeelding van het gebied (bv. een schermafbeelding van Google Maps) in de map `media`
met de naam **`gebied.jpg`**. Zolang die er niet is, wordt de kaart van België gebruikt.

### IQ-puzzels aanpassen

De 50 puzzels staan in `js/iq-puzzles.js`, met bovenaan de uitleg per soort
(getallenreeks, denkvraag, meerkeuze, woordpuzzel, mini-sudoku, blokken slepen, figuren).
