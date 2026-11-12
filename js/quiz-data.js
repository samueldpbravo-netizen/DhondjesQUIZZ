// ---------------------------------------------------------------
//  DE INHOUD VAN DE QUIZ
// ---------------------------------------------------------------
//  De quiz bestaat uit rondes; elke ronde heeft vragen.
//
//  Soorten vragen (type):
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
    {
      id: 'algemeen',
      name: 'Algemene kennis',
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
          type: 'choice',
          text: 'Welke planeet is de grootste van ons zonnestelsel?',
          options: ['Saturnus', 'Aarde', 'Neptunus', 'Jupiter'],
          correct: 3,
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
          type: 'choice',
          text: 'Wat is de chemische formule van water?',
          options: ['CO₂', 'H₂O', 'O₂', 'NaCl'],
          correct: 1,
          duration: 20
        },
        {
          type: 'text',
          text: 'Welke Belgische wielrenner kreeg de bijnaam "De Kannibaal"?',
          answers: ['Eddy Merckx', 'Merckx', 'Eddie Merckx', 'Eddy Merkx', 'Merkx'],
          duration: 30
        },
        {
          type: 'number',
          text: 'Hoeveel kilometer lang is de Belgische kust ongeveer?',
          correct: 67,
          tolerance: 40,
          unit: 'km',
          duration: 25
        },
        {
          type: 'choice',
          text: 'Welke stad staat bekend als de diamanthoofdstad van de wereld?',
          options: ['Antwerpen', 'Brussel', 'Gent', 'Luik'],
          correct: 0,
          duration: 20
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
          type: 'choice',
          text: 'Waar of niet waar: een tomaat is een vrucht.',
          options: ['Waar', 'Niet waar'],
          correct: 0,
          duration: 15
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
    {
      id: 'familie',
      name: 'Familie',
      questions: [
        // Hier komen de familievragen.
      ]
    },
    {
      id: 'special',
      name: 'Special Round',
      questions: [
        // Hier komen de puzzels, spelletjes en grappige video's.
      ]
    }
  ]
};
