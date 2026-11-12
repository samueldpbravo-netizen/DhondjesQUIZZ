// ---------------------------------------------------------------
//  DE 50 PUZZELS VAN DE IQ-TEST
// ---------------------------------------------------------------
//  p = punten voor een juiste oplossing (100 makkelijk, 200 gemiddeld, 300 moeilijk)
//
//  Soorten (t):
//   'num'     een getal intypen          a: het juiste getal, seq: optionele reeks
//   'choice'  meerkeuze (1 poging)       o: [antwoorden], a: index van het juiste (0 = eerste)
//   'text'    een woord intypen          a: [goedgekeurde antwoorden], big: letters in het groot
//   'sudoku'  mini-sudoku 4x4            g: opgave (punt = leeg), s: oplossing
//   'sort'    blokken slepen             items: in de JUISTE volgorde
//   'matrix'  welke figuur ontbreekt?    cells: 8 figuren, o: 4 keuzes, a: index van de juiste
//             figuur = vorm + aantal: c = cirkel, s = vierkant, t = driehoek (bv. 't3')
//             of een pijl met draaiing: 'a0' (omhoog), 'a90', 'a180', 'a270'
// ---------------------------------------------------------------

window.IQ_PUZZLES = [
  // ----- Getallenreeksen -----
  { t: 'num', q: 'Welk getal volgt?', seq: '2 · 4 · 8 · 16 · ?', a: 32, p: 100 },
  { t: 'num', q: 'Welk getal volgt?', seq: '1 · 1 · 2 · 3 · 5 · 8 · ?', a: 13, p: 100 },
  { t: 'num', q: 'Welk getal volgt?', seq: '1 · 4 · 9 · 16 · 25 · ?', a: 36, p: 100 },
  { t: 'num', q: 'Welk getal volgt?', seq: '81 · 27 · 9 · 3 · ?', a: 1, p: 100 },
  { t: 'num', q: 'Welk getal volgt?', seq: '3 · 6 · 11 · 18 · 27 · ?', a: 38, p: 200 },
  { t: 'num', q: 'Welk getal volgt?', seq: '2 · 6 · 12 · 20 · 30 · ?', a: 42, p: 200 },
  { t: 'num', q: 'Welk getal volgt?', seq: '1 · 2 · 6 · 24 · 120 · ?', a: 720, p: 200 },
  { t: 'num', q: 'Welk getal volgt?', seq: '2 · 3 · 5 · 7 · 11 · 13 · ?', a: 17, p: 200 },
  { t: 'num', q: 'Welk getal volgt?', seq: '1 · 3 · 7 · 15 · 31 · ?', a: 63, p: 200 },
  { t: 'num', q: 'Welk getal volgt?', seq: '5 · 10 · 8 · 16 · 14 · 28 · ?', a: 26, p: 300 },
  { t: 'num', q: 'Welk getal volgt?', seq: '100 · 96 · 88 · 76 · 60 · ?', a: 40, p: 300 },
  { t: 'num', q: 'Welk getal volgt?', seq: '4 · 9 · 19 · 39 · 79 · ?', a: 159, p: 300 },

  // ----- Denkvragen met een getal -----
  { t: 'num', q: 'Een knuppel en een bal kosten samen € 1,10. De knuppel kost € 1 meer dan de bal. Hoeveel cent kost de bal?', a: 5, p: 200 },
  { t: 'num', q: '5 machines maken in 5 minuten 5 dingen. Hoeveel minuten hebben 100 machines nodig voor 100 dingen?', a: 5, p: 200 },
  { t: 'num', q: 'Een waterlelie verdubbelt elke dag. Na 48 dagen is de vijver vol. Na hoeveel dagen was hij halfvol?', a: 47, p: 200 },
  { t: 'num', q: 'Ik heb 6 eieren. Ik breek er 2, bak er 2 en eet er 2 op. Hoeveel eieren heb ik minstens nog?', a: 4, p: 200 },
  { t: 'num', q: 'Een boer heeft 17 schapen. Alle schapen behalve 9 lopen weg. Hoeveel heeft hij er nog?', a: 9, p: 100 },
  { t: 'num', q: 'Een vader is 4 keer zo oud als zijn zoon. Over 20 jaar is hij nog maar 2 keer zo oud. Hoe oud is de zoon nu?', a: 10, p: 300 },
  { t: 'num', q: 'Hoeveel keer schrijf je het cijfer 9 als je alle getallen van 1 tot en met 100 opschrijft?', a: 20, p: 300 },
  { t: 'num', q: 'Hoeveel vierkanten (van alle groottes) zitten er in een rooster van 3 op 3 vakjes?', a: 14, p: 300 },
  { t: 'num', q: 'Een slak zit onderaan een put van 10 meter. Elke dag klimt ze 3 meter, elke nacht zakt ze 2 meter. Op de hoeveelste dag is ze boven?', a: 8, p: 300 },
  { t: 'num', q: '3 katten vangen 3 muizen in 3 minuten. Hoeveel katten heb je nodig om 100 muizen te vangen in 100 minuten?', a: 3, p: 300 },

  // ----- Meerkeuze -----
  { t: 'choice', q: 'Welke hoort er niet bij?', o: ['Appel', 'Peer', 'Wortel', 'Banaan'], a: 2, p: 100 },
  { t: 'choice', q: 'Hand staat tot handschoen zoals voet staat tot…', o: ['Been', 'Sok', 'Teen', 'Veter'], a: 1, p: 100 },
  { t: 'choice', q: 'Boek staat tot lezen zoals vork staat tot…', o: ['Keuken', 'Mes', 'Eten', 'Bord'], a: 2, p: 100 },
  { t: 'choice', q: 'Welk getal hoort er niet bij?', o: ['9', '16', '25', '32'], a: 3, p: 200 },
  { t: 'choice', q: 'Welk getal hoort er niet bij?', o: ['3', '5', '9', '11'], a: 2, p: 200 },
  { t: 'choice', q: 'Alle Bloeps zijn Flurks. Sommige Flurks zijn Zips. Wat is dan zeker waar?', o: ['Alle Bloeps zijn Zips', 'Sommige Bloeps zijn Zips', 'Alle Bloeps zijn Flurks', 'Geen enkele Bloep is een Zip'], a: 2, p: 200 },
  { t: 'choice', q: 'Eergisteren was het maandag. Welke dag is het overmorgen?', o: ['Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'], a: 1, p: 200 },
  { t: 'choice', q: 'Anna is groter dan Bert. Carla is kleiner dan Bert. Dirk is groter dan Anna. Wie is de kleinste?', o: ['Anna', 'Bert', 'Carla', 'Dirk'], a: 2, p: 200 },
  { t: 'choice', q: 'Je loopt een wedstrijd en haalt de tweede in. Op welke plaats loop je nu?', o: ['Eerste', 'Tweede', 'Derde', 'Laatste'], a: 1, p: 200 },
  { t: 'choice', q: 'Welke letter volgt?  A · C · F · J · ?', o: ['M', 'N', 'O', 'P'], a: 2, p: 200 },
  { t: 'choice', q: 'Een klok in de spiegel lijkt 3 uur aan te wijzen. Hoe laat is het echt?', o: ['3 uur', '6 uur', '9 uur', '12 uur'], a: 2, p: 200 },
  { t: 'choice', q: 'Een klok slaat 6 uur in 5 seconden. Hoeveel seconden duurt het om 12 uur te slaan?', o: ['10', '11', '12', '6'], a: 1, p: 300 },
  { t: 'choice', q: 'Welke letter volgt?  M · D · W · D · V · Z · ?', o: ['M', 'D', 'W', 'Z'], a: 3, p: 300 },

  // ----- Woordpuzzels -----
  { t: 'text', q: 'Maak een woord van deze letters.', big: 'LEPAP', a: ['appel'], p: 100 },
  { t: 'text', q: 'Maak een woord van deze letters.', big: 'DEACOLOCH', a: ['chocolade'], p: 200 },
  { t: 'text', q: 'Raadsel: wat wordt natter naarmate het meer droogt?', a: ['handdoek', 'een handdoek', 'de handdoek', 'doek'], p: 200 },
  { t: 'text', q: 'Welk woord wordt korter als je er twee letters aan toevoegt?', a: ['kort'], p: 300 },

  // ----- Mini-sudoku -----
  { t: 'sudoku', g: '...41.3..3..41..', s: '3214143223414123', p: 300 },
  { t: 'sudoku', g: '.2..3.4.2..1.3..', s: '4213314224311324', p: 300 },
  { t: 'sudoku', g: '.14....2..3.43..', s: '2143341212344321', p: 300 },

  // ----- Blokken slepen -----
  { t: 'sort', q: 'Sleep van licht naar zwaar.', items: ['Muis', 'Kat', 'Paard', 'Olifant'], p: 100 },
  { t: 'sort', q: 'Sleep in alfabetische volgorde.', items: ['Appel', 'Druif', 'Kers', 'Peer'], p: 100 },
  { t: 'sort', q: 'Sleep van klein naar groot.', items: ['1/4', '0,3', '0,5', '2/3'], p: 200 },
  { t: 'sort', q: 'Sleep de planeten van dicht bij de zon naar ver.', items: ['Venus', 'Aarde', 'Mars', 'Jupiter'], p: 200 },
  { t: 'sort', q: 'Sleep van klein naar groot.', items: ['5¹', '2³', '3²', '4²'], p: 300 },

  // ----- Welke figuur ontbreekt? -----
  { t: 'matrix', cells: ['c1', 'c2', 'c3', 's1', 's2', 's3', 't1', 't2'], o: ['t2', 't3', 's3', 'c3'], a: 1, p: 200 },
  { t: 'matrix', cells: ['a0', 'a90', 'a180', 'a90', 'a180', 'a270', 'a180', 'a270'], o: ['a90', 'a270', 'a0', 'a180'], a: 2, p: 300 },
  { t: 'matrix', cells: ['c1', 's1', 't1', 's1', 't1', 'c1', 't1', 'c1'], o: ['c1', 't1', 's2', 's1'], a: 3, p: 200 }
];
