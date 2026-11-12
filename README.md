# Groepsquiz

Een live quiz in de stijl van Kahoot: de host toont de vragen op een groot scherm,
spelers doen mee op hun eigen toestel met een spelcode.

## Bestanden

| Bestand | Wat het doet |
| --- | --- |
| `index.html` | Scherm voor spelers (meedoen, groep kiezen, antwoorden) |
| `host.html` | Scherm voor de host (lobby, groepen, rondes, ranglijst) |
| `js/quiz-data.js` | **De vragen**: levels > onderwerpen > vragen |
| `js/firebase-config.js` | **Je Firebase-gegevens** |
| `js/store.js` | Verbinding met Firebase (of demo-modus) |
| `js/host.js`, `js/player.js`, `js/common.js` | Spellogica |
| `css/style.css` | Opmaak |
| `media/` | Foto's, video's en geluid voor de vragen |
| `database.rules.json` | Regels voor de Firebase-database |

## Meteen testen (demo-modus, zonder Firebase)

Zolang `js/firebase-config.js` niet is ingevuld, werkt alles tussen tabbladen van
dezelfde browser.

1. Open `host.html` in een tabblad.
2. Open `index.html` in een paar andere tabbladen en doe mee met de code.
   Elk tabblad is een aparte speler.

Werkt het niet door dubbel te klikken op het bestand? Start dan een lokale server
in deze map (`python3 -m http.server`) en ga naar `http://localhost:8000/host.html`.

## Firebase koppelen (om echt online te spelen)

1. Ga naar <https://console.firebase.google.com> en maak een project.
2. Kies **Build > Realtime Database > Create database** (regio bv. `europe-west1`).
3. Open het tabblad **Rules**, plak de inhoud van `database.rules.json` en klik **Publish**.
4. Ga naar **Projectinstellingen > Jouw apps**, voeg een web-app (`</>`) toe en kopieer de `firebaseConfig`.
5. Plak die in `js/firebase-config.js` als `window.FIREBASE_CONFIG = { ... };`.
   Controleer dat `databaseURL` erin staat.

De oranje balk "Demo-modus" verdwijnt zodra de config is ingevuld.

> De regels in `database.rules.json` laten iedereen met een spelcode lezen en schrijven.
> Prima om te testen; later maken we dit strenger.

## Online zetten met GitHub Pages

1. Zet alle bestanden in een GitHub-repository (met `index.html` in de hoofdmap).
2. **Settings > Pages > Deploy from a branch**, kies `main` en `/ (root)`.
3. Spelers gaan naar `https://<gebruikersnaam>.github.io/<repo>/`,
   de host naar `.../host.html`.

## Vragen aanpassen

Alles staat in `js/quiz-data.js`. Een vraag ziet er zo uit:

```js
{
  text: 'Welke vorm zie je op de afbeelding?',
  media: { type: 'image', src: 'media/voorbeeld.svg' },   // optioneel: image, video of audio
  options: ['Vierkant', 'Ster', 'Cirkel', 'Driehoek'],    // 2 tot 4 antwoorden
  correct: 1,                                             // 0 = eerste antwoord
  duration: 15                                            // seconden (standaard 20)
}
```

## Spelregels

- Juist antwoord: 500 punten + tot 500 extra voor snelheid.
- Groepsscore = gemiddelde van de leden (eerlijk bij ongelijke groepen).
- Maximaal 50 spelers per spel (`MAX_PLAYERS` in `js/common.js`).
