# Havi összesítő – PWA ONLINE (Firebase Firestore, belépés nélkül)

## 0) Fontos (belépés nélkül)
- Adatútvonal: `users/{clientId}/records`
- A "privát" hozzáférés a véletlen clientId-n alapul (nem erős biztonság).
- Ne tárolj érzékeny adatot.

## 1) Firebase lépések
1. Firebase Console -> Add project
2. Build -> Firestore Database -> Create database
3. Project settings -> Your apps -> Add app (Web) -> másold ki a configot
4. Firestore Rules (egyszerű, auth nélkül):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{docId} {
      allow read, write: if true;
    }
  }
}
```

## 2) config.js kitöltése
Nyisd meg a `config.js`-t és illeszd be a firebaseConfig értékeket.

## 3) GitHub Pages
- A fájlok a repo gyökerébe kerüljenek (index.html rootban)
- Repo Settings -> Pages -> main / root

## 4) Ugyanaz az adat több eszközön (opcionális)
- Az app fejlécében az "ID" gomb kimásolja a clientId-t.
- A másik repo/telepítésben a `config.js`-ben:
  `export const fixedClientId = "IDE_MASOLD_AZ_ID-T";`
