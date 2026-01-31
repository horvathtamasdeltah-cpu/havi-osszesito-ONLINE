import { firebaseConfig, fixedClientId } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  enableIndexedDbPersistence,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

function parseNumber(s) {
  const normalized = String(s).trim().replace(",", ".");
  if (!normalized) return null;
  const v = Number(normalized);
  return Number.isFinite(v) ? v : null;
}

function nowISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return { ts, ym, epoch: d.getTime() };
}

function getClientId() {
  if (fixedClientId && typeof fixedClientId === "string" && fixedClientId.trim()) {
    return fixedClientId.trim();
  }
  const key = "havi_osszesito_client_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function uniqueMonths(records) {
  const set = new Set(records.map(r => r.ym));
  set.add(nowISO().ym);
  return Array.from(set).sort();
}

function monthSum(records, ym) {
  return records
    .filter(r => r.ym === ym)
    .reduce((a, r) => a + Number(r.value), 0);
}

function toCSV(records) {
  const lines = ["timestamp,value"];
  records
    .slice()
    .sort((a, b) => a.epoch - b.epoch)
    .forEach(r => lines.push(`${r.ts},${r.value}`));
  return lines.join("\n") + "\n";
}

function downloadText(filename, text, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setNetBadge(isOnline) {
  const b = $("netBadge");
  if (!b) return;
  b.classList.remove("online", "offline");
  b.classList.add(isOnline ? "online" : "offline");
  b.textContent = isOnline ? "● online" : "● offline";
}

const clientId = getClientId();

let db;
let state = { records: [], month: null };
let unsubscribe = null;

function render() {
  const records = state.records;
  const months = uniqueMonths(records);

  const sel = $("monthSelect");
  sel.innerHTML = "";
  months.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });

  if (!state.month || !months.includes(state.month)) {
    state.month = months[months.length - 1];
  }
  sel.value = state.month;

  const filtered = records
    .filter(r => r.ym === state.month)
    .slice()
    .sort((a, b) => a.epoch - b.epoch);

  $("sumValue").textContent = monthSum(records, state.month).toLocaleString("hu-HU");
  $("countValue").textContent = String(filtered.length);

  const list = $("list");
  list.innerHTML = "";
  filtered.forEach(r => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML =
      `<div>${r.ts}</div>` +
      `<div class="right">${Number(r.value).toLocaleString("hu-HU")}</div>`;
    list.appendChild(div);
  });
}

function recordsCollection() {
  // "Privát" útvonal belépés nélkül: users/{clientId}/records
  return collection(db, "users", clientId, "records");
}

function startLiveSync() {
  const q = query(recordsCollection(), orderBy("epoch", "asc"));
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(
    q,
    (snap) => {
      const recs = [];
      snap.forEach(d => recs.push({ id: d.id, ...d.data() }));
      state.records = recs;
      if (!state.month) state.month = nowISO().ym;
      render();
    },
    (err) => {
      // ha valamiért nem megy a realtime, legalább jelezzünk
      console.error("Firestore realtime error:", err);
    }
  );
}

async function addValue(value) {
  const { ts, ym, epoch } = nowISO();
  await addDoc(recordsCollection(), { ts, ym, epoch, value });
  // Nem kell manuális reload: onSnapshot frissít
}

async function deleteAll() {
  const snap = await getDocs(recordsCollection());
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

async function deleteMonth(ym) {
  const snap = await getDocs(recordsCollection());
  const docs = snap.docs.filter(d => d.data()?.ym === ym);
  await Promise.all(docs.map(d => deleteDoc(d.ref)));
}

async function main() {
  // service worker
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }

  // firebase init
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  // offline persistence (best-effort)
  try { await enableIndexedDbPersistence(db); } catch {}

  // net badge
  setNetBadge(navigator.onLine);
  window.addEventListener("online", () => setNetBadge(true));
  window.addEventListener("offline", () => setNetBadge(false));

  // REALTIME SYNC
  startLiveSync();

  // UI events
  $("btnAdd").addEventListener("click", async () => {
    const v = parseNumber($("valueInput").value);
    if (v === null) return;

    $("btnAdd").disabled = true;
    try {
      await addValue(v);
      $("valueInput").value = "";
      $("valueInput").focus();
    } finally {
      $("btnAdd").disabled = false;
    }
  });

  $("valueInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnAdd").click();
  });

  $("monthSelect").addEventListener("change", (e) => {
    state.month = e.target.value;
    render();
  });

  $("btnExport").addEventListener("click", async () => {
    // exporthoz elég a jelenlegi state (realtime naprakész)
    const csv = toCSV(state.records);
    const name = `havi_osszesito_${nowISO().ym}.csv`;
    downloadText(name, csv, "text/csv");
  });

  $("btnCopyId").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(clientId);
      alert("ID kimásolva a vágólapra.");
    } catch {
      prompt("Másold ki ezt az ID-t:", clientId);
    }
  });

  $("btnClearAll").addEventListener("click", async () => {
    if (!confirm("Biztosan törölsz MINDENT? (felhőből is)")) return;
    await deleteAll();
    state.month = nowISO().ym;
    // onSnapshot frissít
  });

  $("btnClearMonth").addEventListener("click", async () => {
    const ym = state.month;
    if (!confirm(`Biztosan törlöd a(z) ${ym} hónapot? (felhőből is)`)) return;
    await deleteMonth(ym);
    state.month = nowISO().ym;
    // onSnapshot frissít
  });

  // amikor visszajössz az appba, újraindítjuk a sync-et (biztonság kedvéért)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startLiveSync();
  });
}

main();
