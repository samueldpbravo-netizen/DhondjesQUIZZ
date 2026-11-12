// ---------------------------------------------------------------
//  FIREBASE INSTELLINGEN
// ---------------------------------------------------------------
//  Zolang FIREBASE_CONFIG = null draait de quiz in DEMO-MODUS:
//  alles werkt, maar alleen tussen tabbladen van dezelfde browser.
//
//  Om echt met 50 mensen te spelen:
//   1. Maak een project op https://console.firebase.google.com
//   2. Build > Realtime Database > "Create database"
//   3. Projectinstellingen > "Jouw apps" > web-app (</>) toevoegen
//   4. Plak de config hieronder (zie README.md voor alle stappen)
// ---------------------------------------------------------------

window.FIREBASE_CONFIG = null;

/* Voorbeeld:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "mijn-quiz.firebaseapp.com",
  databaseURL: "https://mijn-quiz-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mijn-quiz",
  appId: "1:1234567890:web:abcdef"
};
*/
