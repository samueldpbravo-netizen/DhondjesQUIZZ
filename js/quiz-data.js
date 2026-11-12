// ---------------------------------------------------------------
//  DE INHOUD VAN DE QUIZ
// ---------------------------------------------------------------
//  De quiz bestaat uit rondes. Elke ronde heeft een soort (kind):
//
//   'quiz'   gewone vragen (zie hieronder)
//   'whois'  Wie is het? Iedereen maakt een profiel (kleur, dier, eigenschappen, hint), de rest raadt wie het is.
//   'teams'  Teamspel: iedereen kiest een team, de host duidt het winnende team aan.
//   'hide'   Verstoppertje op de kaart.
//   'iq'     IQ-test: 5 minuten puzzels oplossen, alleen of in een groepje.
//            De puzzels zelf staan in js/iq-puzzles.js.
//
//  Punten tellen altijd bij; er gaan nooit punten af.
//
//  ---- Soorten vragen in een 'quiz'-ronde (type) ----
//
//   'choice'    meerkeuze
//               options: ['A', 'B', 'C', 'D'], correct: 1   (0 = eerste)
//
//   'text'      zelf typen; alle antwoorden verschijnen op het grote scherm
//               answers: ['Namen', 'Namur']   (alle goedgekeurde antwoorden;
//               hoofdletters, accenten en kleine typfouten maken niet uit)
//               scramble: 'PRETWANNE'         (optioneel: letterpuzzel)
//
//   'number'    een getal raden; hoe dichter, hoe meer punten
//               correct: 1830, tolerance: 50  (verder dan 50 ernaast = 0 punten)
//               unit: 'meter'                 (optioneel)
//
//   'location'  een plek aanduiden op de kaart
//               map: 'belgie' of 'europa', lat: 51.21, lon: 3.22, label: 'Brugge'
//
//   'order'     dingen in de juiste volgorde zetten
//               items: [...]  in de JUISTE volgorde (worden vanzelf door elkaar gehaald)
//               hint: 'van noord naar zuid'
//
//  Voor elke vraag:
//    text      de vraag
//    duration  aantal seconden (standaard 25)
//    media     optioneel: { type: 'image' | 'video' | 'audio', src: 'media/bestand.jpg' }
//
//  Dit bestand wordt alleen door het host-scherm geladen.
// ---------------------------------------------------------------

window.QUIZ = {
  title: 'Dhondjes Quiz',
  rounds: [
    // ===================== RONDE 1 =====================
    {
      id: 'algemeen',
      kind: 'quiz',
      name: 'Algemene kennis',
      maxPoints: 600, // per vraag; bewust iets minder dan de familiespelletjes
      questions: [
        {
          type: 'choice',
          text: 'Hoeveel provincies telt België?',
          options: ['8', '9', '10', '11'],
          correct: 2,
          duration: 20
        },
        {
          type: 'text',
          text: 'Wat is de hoofdstad van Wallonië?',
          answers: ['Namen', 'Namur'],
          duration: 30
        },
        {
          type: 'location',
          text: 'Waar ligt Brugge?',
          map: 'belgie',
          lat: 51.2093,
          lon: 3.2247,
          label: 'Brugge',
          duration: 25
        },
        {
          type: 'number',
          text: 'In welk jaar werd België onafhankelijk?',
          correct: 1830,
          tolerance: 50,
          duration: 25
        },
        {
          type: 'choice',
          text: 'Welke Belgische striptekenaar bedacht Kuifje?',
          options: ['Willy Vandersteen', 'Hergé', 'Peyo', 'Morris'],
          correct: 1,
          duration: 20
        },
        {
          type: 'text',
          text: 'Hoe heet het beroemde plassende beeldje in Brussel?',
          answers: ['Manneken Pis', 'Manneke Pis', 'Mannekenpis', 'Mannekepis'],
          duration: 30
        },
        {
          type: 'order',
          text: 'Zet deze steden in de juiste volgorde.',
          hint: 'van noord naar zuid',
          items: ['Antwerpen', 'Brussel', 'Namen', 'Aarlen'],
          duration: 35
        },
        {
          type: 'number',
          text: 'Hoeveel bollen heeft het Atomium?',
          correct: 9,
          tolerance: 5,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Welke taal is géén officiële taal van België?',
          options: ['Nederlands', 'Duits', 'Engels', 'Frans'],
          correct: 2,
          duration: 20
        },
        {
          type: 'location',
          text: 'Waar ligt Rome?',
          map: 'europa',
          lat: 41.9028,
          lon: 12.4964,
          label: 'Rome',
          duration: 25
        },
        {
          type: 'text',
          text: 'Welke Belgische wielrenner kreeg de bijnaam "De Kannibaal"?',
          answers: ['Eddy Merckx', 'Merckx', 'Eddie Merckx', 'Eddy Merkx', 'Merkx'],
          duration: 30
        },
        {
          type: 'location',
          text: 'Waar ligt het hoogste punt van België?',
          map: 'belgie',
          lat: 50.5014,
          lon: 6.0931,
          label: 'Signaal van Botrange (694 m)',
          duration: 25
        },
        {
          type: 'text',
          text: 'Letterpuzzel: welke Belgische stad zit hier verstopt?',
          scramble: 'PRETWANNE',
          answers: ['Antwerpen'],
          duration: 40
        },
        {
          type: 'choice',
          text: 'Welke Belgische schilder maakte "Ceci n\'est pas une pipe"?',
          options: ['Peter Paul Rubens', 'James Ensor', 'René Magritte', 'Jan van Eyck'],
          correct: 2,
          duration: 20
        },
        {
          type: 'order',
          text: 'Zet deze gebeurtenissen in de juiste volgorde.',
          hint: 'van oud naar nieuw',
          items: ['Slag bij Waterloo', 'België wordt onafhankelijk', 'Expo 58 in Brussel', 'Eerste eurobiljetten'],
          duration: 40
        }
      ]
    },

    // ===================== RONDE 2 =====================
    {
      id: 'jeugd',
      kind: 'quiz',
      name: 'Jong & online',
      maxPoints: 700,
      questions: [
        {
          type: 'choice',
          text: 'Welke van deze games is het meest verkocht?',
          options: ['Grand Theft Auto V', 'Minecraft', 'Red Dead Redemption 2', 'Mario Kart 8'],
          correct: 1,
          duration: 20
        },
        {
          type: 'text',
          text: 'In welke game zoek je de "impostor" op een ruimteschip?',
          answers: ['Among Us', 'Amongus'],
          duration: 30
        },
        {
          type: 'choice',
          text: 'Wat betekent "GG" op het einde van een game?',
          options: ['Ga gauw', 'Good game', 'Geen genade', 'Get good'],
          correct: 1,
          duration: 15
        },
        {
          type: 'order',
          text: 'Welk platform bestond het eerst?',
          hint: 'van oud naar nieuw',
          items: ['YouTube', 'Instagram', 'Snapchat', 'TikTok'],
          duration: 35
        },
        {
          type: 'choice',
          text: 'Hoe heet het geld in Fortnite?',
          options: ['Robux', 'Minecoins', 'V-Bucks', 'Gems'],
          correct: 2,
          duration: 15
        },
        {
          type: 'text',
          text: 'Raad de game:  🍄 👨‍🔧 🏰 👸',
          answers: ['Super Mario', 'Mario', 'Super Mario Bros', 'Mario Bros'],
          duration: 30
        },
        {
          type: 'choice',
          text: 'Welk YouTube-kanaal heeft de meeste abonnees ter wereld?',
          options: ['PewDiePie', 'T-Series', 'MrBeast', 'Cocomelon'],
          correct: 2,
          duration: 20
        },
        {
          type: 'number',
          text: 'In welk jaar kwam Fortnite Battle Royale uit?',
          correct: 2017,
          tolerance: 5,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Iemand heeft veel "rizz". Wat heeft die persoon?',
          options: ['Veel charme om iemand te versieren', 'Veel slaap nodig', 'Veel volgers', 'Veel geluk bij het gamen'],
          correct: 0,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Op welk platform begon "Skibidi Toilet"?',
          options: ['TikTok', 'Twitch', 'Snapchat', 'YouTube'],
          correct: 3,
          duration: 20
        },
        {
          type: 'order',
          text: 'Welke game kwam het eerst uit?',
          hint: 'van oud naar nieuw',
          items: ['Minecraft', 'Grand Theft Auto V', 'Fortnite', 'Among Us'],
          duration: 35
        },
        {
          type: 'choice',
          text: 'Jongeren roepen "six-seven!" (6-7). Wat betekent het?',
          options: ['Een cheatcode in Roblox', 'Eigenlijk niets, het is gewoon een meme', 'Een score in EA FC', 'Het is tijd om te eten'],
          correct: 1,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Welke "Italian brainrot"-figuur is een ballerina met een kopje koffie als hoofd?',
          options: ['Tralalero Tralala', 'Tung Tung Tung Sahur', 'Ballerina Cappuccina', 'Bombardiro Crocodilo'],
          correct: 2,
          duration: 20
        },
        {
          type: 'number',
          text: 'Hoeveel spelers starten in één klassieke match van Fortnite Battle Royale?',
          correct: 100,
          tolerance: 60,
          duration: 20
        },
        {
          type: 'text',
          text: 'Op welk gameplatform betaal je met Robux?',
          answers: ['Roblox'],
          duration: 25
        }
      ]
    },

    // ===================== RONDE 3 =====================
    {
      id: 'wieishet',
      kind: 'whois',
      name: 'Wie is het?',
      desc: 'Maak een mysterieus profiel van jezelf',
      // Eigenschappen die spelers kunnen aanzetten (ze kiezen er hoogstens maxTraits)
      traits: ['Sportief', 'Creatief', 'Jong', 'Oud', 'Grappig', 'Rustig', 'Luid', 'Slim', 'Koppig', 'Zoetekauw',
        'Vroege vogel', 'Nachtuil', 'Muzikaal', 'Gamer', 'Avontuurlijk', 'Huismus', 'Keukenprins(es)', 'Dierenvriend'],
      maxTraits: 4,
      writeSeconds: 120, // tijd om je profiel in te vullen
      guessSeconds: 20, // tijd om te raden, per hint
      share: 0.5, // de helft van de spelers komt aan bod
      totalPoints: 12000, // samen te verdienen over alle hints (per hint max. 1000)
      wrongShare: 0.1 // fout geraden: 10% van de punten als troost
    },

    // ===================== RONDE 4 =====================
    {
      id: 'teamspel',
      kind: 'teams',
      name: 'Teamspel',
      desc: 'Kies team 1 of team 2',
      teamNames: ['Team 1', 'Team 2'],
      winPoints: 3000,
      losePoints: 1000
    },

    // ===================== RONDE 5 =====================
    {
      id: 'verstoppertje',
      kind: 'hide',
      name: 'Verstoppertje',
      desc: 'Verstop je op de kaart en zoek de anderen',
      map: 'media/gebied.jpg', // zet hier je eigen kaart (bv. een schermafbeelding van Google Maps)
      placeSeconds: 60, // tijd om je te verstoppen
      seekSeconds: 300, // tijd om te zoeken (5 minuten)
      findPoints: 200, // per gevonden persoon
      radius: 4 // hoe dicht je moet tikken, in % van de kaartbreedte
    },

    // ===================== RONDE 6 =====================
    {
      id: 'iqtest',
      kind: 'iq',
      name: 'IQ-test',
      desc: '5 minuten puzzelen, alleen of in een groepje',
      seconds: 300,
      groupMax: 3
    }
  ]
};
