import { firebaseConfig, fixedClientId } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy,
  deleteDoc, enableIndexedDbPersistence, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function parseNumber(s) {
  const normalized = String(s).trim().replace(",", ".");
  if (!normalized) return null;
  const v = Number(normalized);
  return Number.isFinite(v) ? v : null;
}

function nowISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const ym = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  return { ts, ym, epoch: d.getTime() };
}

function getClientId() {
  if (fixedClientId && typeof fixedClientId === "string") return fixedClientId;
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
  return records.filter(r => r.ym === ym).reduce((a, r) => a + Number(r.value), 0);
}

function toCSV(records) {
  const lines = ["timestamp,value"];
  records.slice().sort((a,b) => a.epoch - b.epoch).forEach(r => {
    lines.push(`${r.ts},${r.value}`);
  });
  return lines.join("\n") + "\n";
}

function downloadText(filename, text, mime="text/csv") {
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
  b.classList.remove("online","offline");
  b.classList.add(isOnline ? "online" : "offline");
  b.textContent = isOnline ? "● online" : "● offline";
}

const clientId = getClientId();

let db;
let state = { records: [], month: null };

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

  const filtered = records.filter(r => r.ym === state.month).slice().sort((a,b) => a.epoch - b.epoch);

  $("sumValue").textContent = monthSum(records, state.month).toLocaleString("hu-HU");
  $("countValue").textContent = String(filtered.length);

  const list = $("list");
  list.innerHTML = "";
  filtered.forEach(r => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div>${r.ts}</div><div class="right">${Number(r.value).toLocaleString("hu-HU")}</div>`;
    list.appendChild(div);
  });
}

function recordsCollection() {
  return collection(db, "users", clientId, "records");
}

async function loadAll() {
  const q = query(recordsCollection(), orderBy("epoch", "asc"));
  const snap = await getDocs(q);
  const recs = [];
  snap.forEach(d => recs.push({ id: d.id, ...d.data() }));
  state.records = recs;
  if (!state.month) state.month = nowISO().ym;
  render();
}

async function addValue(value) {
  const { ts, ym, epoch } = nowISO();
  await addDoc(recordsCollection(), { ts, ym, epoch, value });
  await loadAll();
}

async function deleteAll() {
  const snap = await getDocs(recordsCollection());
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  state.month = nowISO().ym;
  await loadAll();
}

async function deleteMonth(ym) {
  const snap = await getDocs(recordsCollection());
  const docs = snap.docs.filter(d => d.data()?.ym === ym);
  await Promise.all(docs.map(d => deleteDoc(d.ref)));
  state.month = nowISO().ym;
  await loadAll();
}

async function main() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  try { await enableIndexedDbPersistence(db); } catch {}

  setNetBadge(navigator.onLine);
  window.addEventListener("online", () => setNetBadge(true));
  window.addEventListener("offline", () => setNetBadge(false));

  await loadAll();

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
    await loadAll();
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
  });

  $("btnClearMonth").addEventListener("click", async () => {
    const ym = state.month;
    if (!confirm(`Biztosan törlöd a(z) ${ym} hónapot? (felhőből is)`)) return;
    await deleteMonth(ym);
  });

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) await loadAll();
  });
}

main();
