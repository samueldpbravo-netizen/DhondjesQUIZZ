// ---------------------------------------------------------------
//  DE INHOUD VAN DE QUIZ
// ---------------------------------------------------------------
//  Structuur:  quiz  >  levels  >  onderwerpen  >  vragen
//
//  Elke vraag:
//    text      de vraag
//    options   2 tot 4 antwoorden
//    correct   index van het juiste antwoord (0 = eerste)
//    duration  aantal seconden (optioneel, standaard 20)
//    media     optioneel: { type: 'image' | 'video' | 'audio', src: 'media/bestand.jpg' }
//              Zet de bestanden in de map "media".
//
//  Dit bestand wordt alleen door het host-scherm geladen.
// ---------------------------------------------------------------

window.QUIZ = {
  title: 'Mijn Groepsquiz',
  levels: [
    {
      id: 'level1',
      name: 'Level 1 – Makkelijk',
      topics: [
        {
          id: 'algemeen',
          name: 'Algemene kennis',
          questions: [
            {
              text: 'Hoeveel dagen heeft een schrikkeljaar?',
              options: ['364', '365', '366', '367'],
              correct: 2,
              duration: 15
            },
            {
              text: 'Welke vorm zie je op de afbeelding?',
              media: { type: 'image', src: 'media/voorbeeld.svg' },
              options: ['Vierkant', 'Ster', 'Cirkel', 'Driehoek'],
              correct: 1,
              duration: 15
            },
            {
              text: 'Wat is de hoofdstad van België?',
              options: ['Antwerpen', 'Gent', 'Brussel', 'Luik'],
              correct: 2,
              duration: 15
            }
          ]
        },
        {
          id: 'dieren',
          name: 'Dieren',
          questions: [
            {
              text: 'Welk dier is het grootste op aarde?',
              options: ['Olifant', 'Blauwe vinvis', 'Giraf', 'Witte haai'],
              correct: 1
            },
            {
              text: 'Hoeveel poten heeft een spin?',
              options: ['6', '8', '10', '12'],
              correct: 1
            },
            {
              text: 'Een pinguïn kan vliegen.',
              options: ['Waar', 'Niet waar'],
              correct: 1,
              duration: 10
            }
          ]
        }
      ]
    },
    {
      id: 'level2',
      name: 'Level 2 – Moeilijk',
      topics: [
        {
          id: 'wetenschap',
          name: 'Wetenschap',
          questions: [
            {
              text: 'Wat is het chemische symbool voor goud?',
              options: ['Go', 'Ag', 'Au', 'Gd'],
              correct: 2
            },
            {
              text: 'Welke planeet staat het dichtst bij de zon?',
              options: ['Venus', 'Mars', 'Aarde', 'Mercurius'],
              correct: 3
            },
            {
              text: 'Hoeveel botten heeft een volwassen mens ongeveer?',
              options: ['106', '206', '306', '406'],
              correct: 1
            }
          ]
        },
        {
          id: 'geschiedenis',
          name: 'Geschiedenis',
          questions: [
            {
              text: 'In welk jaar viel de Berlijnse Muur?',
              options: ['1979', '1985', '1989', '1991'],
              correct: 2
            },
            {
              text: 'Wie schilderde de Mona Lisa?',
              options: ['Michelangelo', 'Leonardo da Vinci', 'Rembrandt', 'Picasso'],
              correct: 1
            }
            // Voorbeeld met video:
            // {
            //   text: 'Wat gebeurt er in deze video?',
            //   media: { type: 'video', src: 'media/mijn-video.mp4' },
            //   options: ['A', 'B', 'C', 'D'],
            //   correct: 0,
            //   duration: 30
            // }
          ]
        }
      ]
    }
  ]
};
