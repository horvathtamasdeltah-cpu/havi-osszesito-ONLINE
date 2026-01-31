// IDE kell bemásolni a Firebase Web App konfigurációt (GitHub Pages-en is működik).
// 1) Firebase Console -> Project -> Add app (Web) -> Copy config object
// 2) Másold be az alábbi firebaseConfig helyére.

export const firebaseConfig = {
  apiKey: "AIzaSyBQTESWE3Os7H67ll2hfriSEY7prCTDSNg",
  authDomain: "osszesito-tom.firebaseapp.com",
  projectId: "osszesito-tom",
  storageBucket: "osszesito-tom.firebasestorage.app",
  messagingSenderId: "670497769993",
  appId: "1:670497769993:web:7196bdfb31f6c3c70446d8",
  measurementId: "G-L7ZH18HTH6"
};

// Opcionális: ha szeretnéd kézzel beállítani az eszköz-ID-t (másik eszközön ugyanazt használni),
// akkor add meg itt (különben automatikusan generáljuk és localStorage-ban mentjük).
export const fixedClientId = 09109a7a-463d-4cb2-9a44-056dc180a854;
