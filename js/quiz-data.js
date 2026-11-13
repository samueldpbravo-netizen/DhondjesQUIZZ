// ---------------------------------------------------------------
//  DE INHOUD VAN DE QUIZ
// ---------------------------------------------------------------
//  De quiz bestaat uit rondes. Elke ronde heeft een soort (kind):
//
//   'quiz'   gewone vragen (zie hieronder)
//   'whois'  Wie is het? Iedereen maakt een profiel (kleur, dier, eigenschappen, hint), de rest raadt wie het is.
//   'teams'  Teamspel: iedereen kiest een team, de host duidt het winnende team aan.
//   'globe'  Ver van iedereen: kies een plek op de wereldbol, zo ver mogelijk van de rest.
//   'hide'   Verstoppertje op een kaart (staat niet meer in de lijst, maar werkt nog).
//   'iq'     IQ-test: 5 minuten puzzels oplossen, alleen of in een groepje.
//            De puzzels zelf staan in js/iq-puzzles.js.
//
//  Punten tellen altijd bij; er gaan nooit punten af.
//
//  Elke ronde kan een uitlegpagina krijgen die vóór de ronde op het grote scherm komt:
//    explain: ['Stap 1…', 'Stap 2…', 'Stap 3…']
//
//  ---- Vragen die zichzelf invullen (dynamic) ----
//  In een 'quiz'-ronde mag je in plaats van een gewone vraag ook dit zetten:
//    { dynamic: 'playerCount' }        hoeveel mensen zijn er ingelogd? (getal raden)
//    { dynamic: 'previousQuestion' }   wat was de vorige vraag? (meerkeuze)
//    { dynamic: 'leader' }             wie staat er nu op de eerste plaats? (meerkeuze)
//    { dynamic: 'teamWinner' }         welk team won het teamspel? (alleen als het gespeeld is)
//
//  ---- Soorten vragen in een 'quiz'-ronde (type) ----
//
//   'choice'    meerkeuze
//               options: ['A', 'B', 'C', 'D'], correct: 1   (0 = eerste)
//               allCorrect: true              (optioneel: elk antwoord telt als juist)
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
//    note      optioneel: een zinnetje dat na het antwoord groot op het scherm komt
//    media     optioneel: { type: 'image' | 'video' | 'audio', src: 'media/bestand.jpg' }
//
//  Dit bestand wordt alleen door het host-scherm geladen.
// ---------------------------------------------------------------

window.QUIZ = {
  title: 'Dhondjes Quiz',
  subtitle: 'Familieweekend bij de Schone Schaapjes in Staden',
  rounds: [
    // ===================== RONDE 1 =====================
    {
      id: 'algemeen',
      kind: 'quiz',
      name: 'Algemene kennis',
      explain: [
        'Op het grote scherm verschijnt een vraag. Antwoord op je gsm.',
        'Soms kies je een antwoord, soms typ je, duid je een plek aan of zet je dingen in volgorde.',
        'Juist én snel? Dan krijg je de meeste punten!'
      ],
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
      explain: [
        'Games, memes en platformen: dit is de ronde van de jeugd.',
        'Oma en opa mogen gokken. Of stiekem naar de kleinkinderen kijken.',
        'Juist én snel? Dan krijg je de meeste punten!'
      ],
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
        },
        {
          type: 'choice',
          text: 'Wie speelt de meesterdief Assane Diop in de Netflix-serie "Lupin"?',
          options: ['Omar Sy', 'Idris Elba', 'Vincent Cassel', 'Matthias Schoenaerts'],
          correct: 0,
          duration: 20
        }
      ]
    },

    // ===================== RONDE 3 =====================
    {
      id: 'wieishet',
      kind: 'whois',
      name: 'Wie is het?',
      explain: [
        'Maak op je gsm een profiel: je lievelingskleur, je lievelingsdier, wat bij je past en een kleine hint.',
        'De helft van de profielen komt op het grote scherm. Iedereen raadt: wie is dit?',
        'Goed geraden geeft punten. Is het jouw profiel? Sst… laat niets merken!'
      ],
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
      explain: [
        'Kies op je gsm: team 1 of team 2.',
        'We spelen samen een spel in het echt. Doe je best voor je team!',
        'Het winnende team krijgt 3000 punten per persoon, het andere team 1000.'
      ],
      desc: 'Kies team 1 of team 2',
      teamNames: ['Team 1', 'Team 2'],
      winPoints: 3000,
      losePoints: 1000
    },

    // ===================== RONDE 5 =====================
    {
      id: 'wereldbol',
      kind: 'globe',
      name: 'Ver van iedereen',
      desc: 'Kies een plek op de wereldbol',
      explain: [
        'Draai de wereldbol op je gsm en tik op een plek op het land. Water telt niet!',
        'Het doel: zo ver mogelijk van alle anderen zitten. Waar zou niemand anders kiezen?',
        'Wie het verst van zijn dichtste buur zit, krijgt de meeste punten.'
      ],
      seconds: 60,
      maxPoints: 2000 // voor wie het verst van iedereen zit; de rest krijgt naar verhouding
    },

    // ===================== RONDE 6 =====================
    // Heb je wel opgelet dit weekend? Vul hier zelf vragen bij over wat er gebeurd is.
    // De feiten over de hoeve komen van toeristische websites: kijk ze ter plaatse even na.
    {
      id: 'opgelet',
      kind: 'quiz',
      name: 'Heb je wel opgelet?',
      maxPoints: 1000,
      explain: [
        'Deze ronde gaat over dit weekend zelf: de plek, de mensen en wat er gebeurd is.',
        'Wie overal bij was en goed oplette, heeft nu een voordeel.',
        'Juist én snel? Dan krijg je de meeste punten!'
      ],
      questions: [
        {
          type: 'choice',
          text: 'Wat is de officiële naam van de vakantiehoeve waar we logeren?',
          options: ['De Schone Schaapjes', 'Open Huis', "'t Schaapshof", 'Hoeve De Doontjes'],
          correct: 1,
          duration: 20
        },
        { dynamic: 'playerCount' },
        {
          type: 'location',
          text: 'Waar ligt Staden?',
          map: 'belgie',
          lat: 50.975,
          lon: 3.014,
          label: 'Staden',
          duration: 25
        },
        {
          type: 'choice',
          text: 'Wat kun je op deze hoeve NIET doen?',
          options: ['Zwemmen in een vijver', 'Vissen', 'Skiën', 'Wandelen in de boomgaard'],
          correct: 2,
          duration: 20
        },
        { dynamic: 'previousQuestion' },
        {
          type: 'number',
          text: 'Hoeveel mensen kunnen er op deze hoeve in totaal blijven slapen?',
          correct: 60,
          tolerance: 40,
          duration: 20
        },
        {
          type: 'choice',
          text: 'In welk tv-programma was deze hoeve te zien?',
          options: ['Boer zkt Vrouw', 'Met Vier in Bed', 'Komen Eten', 'Huizenjagers'],
          correct: 1,
          duration: 20
        },
        { dynamic: 'teamWinner' },
        {
          type: 'text',
          text: 'In welke straat ligt de hoeve?',
          answers: ['Ieperstraat', 'Ieperstraat 157', 'Ieper straat'],
          duration: 30
        },
        { dynamic: 'leader' },
        {
          type: 'choice',
          text: 'Tot wanneer duurt dit familieweekend?',
          options: ['Zaterdagavond', 'Zondagmiddag', 'Zondagavond', 'Maandagochtend'],
          correct: 1,
          duration: 15
        }

        // ---- Vul hier zelf aan met wat er dit weekend gebeurd is. Voorbeelden: ----
        // {
        //   type: 'number',
        //   text: 'Hoeveel mensen zijn er dit weekend in totaal?',
        //   correct: 48,
        //   tolerance: 15
        // },
        // {
        //   type: 'choice',
        //   text: 'Wat aten we vrijdagavond?',
        //   options: ['Spaghetti', 'Frietjes', 'Barbecue', 'Pizza'],
        //   correct: 0
        // },
        // {
        //   type: 'text',
        //   text: 'Wie viel er zaterdag in de vijver?',
        //   answers: ['Jos']
        // }
      ]
    },

    // ===================== RONDE 7 =====================
    // Ken je de familie wel goed? Deze ronde verschijnt als "binnenkort" tot er vragen in staan.
    {
      id: 'familie',
      kind: 'quiz',
      name: 'Ken je de familie?',
      maxPoints: 1000,
      explain: [
        'Deze ronde gaat over de familie zelf: grappige verhalen en weetjes.',
        'Wie kent de Dhondjes (en de Segers, de Pereira\'s en alle anderen) het best?',
        'Juist én snel? Dan krijg je de meeste punten!'
      ],
      questions: [
        {
          type: 'choice',
          text: 'Wie zette ooit een zak chips in de koelkast?',
          options: ['Bart', 'Wim', 'Robin', 'Sergio'],
          correct: 1,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Wie vergat op een familiefeest zijn eigen leeftijd?',
          options: ['Wim', 'Osvaldo', 'Bart', 'Jasper'],
          correct: 2,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Welk huisdier komt het meest voor in de familie?',
          options: ['Kat', 'Konijn', 'Goudvis', 'Hond'],
          correct: 3,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Welke twee hebben een gigantisch hoog schaak-elo?',
          options: ['Wim en Bart', 'Jasper en Lore', 'Sergio en Osvaldo', 'Isaac en Hasse'],
          correct: 2,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Welke sport doet Nathan?',
          options: ['Basket', 'Handbal', 'Dansen', 'Kickboksen'],
          correct: 3,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Waar of niet waar: Aaron heeft ooit geprobeerd een basketbal op te eten.',
          options: ['Waar', 'Niet waar'],
          correct: 1,
          duration: 15,
          note: 'Niet waar… voor zover we weten.'
        },
        {
          type: 'choice',
          text: 'Welke sport doen Jasper en Lore?',
          options: ['Handbal', 'Basket', 'Kickboksen', 'Volleybal'],
          correct: 0,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Wie van deze vier doet GEEN basket?',
          options: ['Isaac', 'Hasse', 'Robin', 'Freki'],
          correct: 2,
          duration: 20,
          note: 'Robin danst!'
        },
        {
          type: 'choice',
          text: 'Wie zwemt er ondersteboven?',
          options: ['Camil', 'Ines', 'Aaron', 'Lore'],
          correct: 0,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Waar of niet waar: Ines deed een backflip van een gebouw van 4 verdiepingen.',
          options: ['Waar', 'Niet waar'],
          correct: 1,
          duration: 15,
          note: 'Niet waar. Niet thuis proberen!'
        },
        {
          type: 'choice',
          text: 'Wie heeft de luidste scheten van de familie?',
          options: ['Samuel', 'Nathan', 'Jasper', 'Isaac'],
          correct: 2,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Wie maakt elk jaar de familiequiz?',
          options: ['Nathan', 'Samuel', 'Robin', 'Wim'],
          correct: 1,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Wanneer werd deze quiz gemaakt?',
          options: ['In de zomervakantie', 'Een maand geleden', 'Vorig jaar al', 'Vandaag, tussen school en het vertrek naar hier'],
          correct: 3,
          duration: 20
        },
        {
          type: 'choice',
          text: 'Welke sport doet Samuel tegenwoordig?',
          options: ['Basket', 'Geen enkele meer', 'Kickboksen', 'Handbal'],
          correct: 1,
          duration: 15
        },
        {
          type: 'choice',
          text: 'Wat is de achternaam van Sergio en Osvaldo?',
          options: ['Pereira', 'Segers', 'Felipe', 'Dhondt'],
          correct: 2,
          duration: 20
        },
        {
          // Elk antwoord telt als juist; daarna komt de opdracht groot op het scherm.
          type: 'choice',
          text: 'De quizmaster heeft dringend een assistent nodig. Wie wordt het?',
          options: ['Hasse', 'Hasse', 'Hasse', 'Zeker en vast Hasse'],
          correct: 0,
          allCorrect: true,
          duration: 15,
          note: 'Hasse, kom maar naar voren! Jij bent vanaf nu de assistent van de quizmaster.'
        },
        {
          type: 'choice',
          text: 'Eerlijk zeggen: hoe leuk is deze quiz?',
          options: ['Superleuk', 'Megaleuk', 'De beste ooit', 'Alle drie tegelijk'],
          correct: 3,
          allCorrect: true,
          duration: 15,
          note: 'Juist antwoord. Bedankt, Samuel!'
        }
      ]
    },

    // ===================== RONDE 8 =====================
    {
      id: 'iqtest',
      kind: 'iq',
      name: 'IQ-test',
      explain: [
        'Vorm een groepje van maximaal 3, of speel alleen. Vraag iemand via je gsm.',
        'Je krijgt 5 minuten en 50 puzzels. Kun je er eentje niet? Sla ze over!',
        'Iedereen puzzelt op zijn eigen gsm. Je krijgt het gemiddelde van je groepje.'
      ],
      desc: '5 minuten puzzelen, alleen of in een groepje',
      seconds: 300,
      groupMax: 3
    }
  ]
};
