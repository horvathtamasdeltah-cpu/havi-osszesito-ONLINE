import { firebaseConfig, fixedClientId } from "./config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy,
  deleteDoc, doc, onSnapshot, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

function parseNumber(s) {
  if (!s) return null;
  const v = Number(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function nowISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return {
    ts: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    ym: `${d.getFullYear()}-${pad(d.getMonth()+1)}`,
    epoch: d.getTime()
  };
}

function getClientId() {
  if (fixedClientId) return fixedClientId;
  let id = localStorage.getItem("clientId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("clientId", id);
  }
  return id;
}

const clientId = getClientId();

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const recordsRef = collection(db, "users", clientId, "records");
const settingsRef = doc(db, "users", clientId, "settings", "main");

let state = {
  records: [],
  month: null,
  multiplier: 1
};

function render() {
  const months = [...new Set(state.records.map(r => r.ym))].sort();
  if (!state.month) state.month = months.at(-1);

  $("monthSelect").innerHTML = months.map(m =>
    `<option value="${m}">${m}</option>`
  ).join("");
  $("monthSelect").value = state.month;

  const filtered = state.records.filter(r => r.ym === state.month);
  const sum = filtered.reduce((a,b)=>a+b.value,0);
  const forint = sum * state.multiplier;

  $("sumValue").textContent = sum.toLocaleString("hu-HU");
  $("forintValue").textContent = forint.toLocaleString("hu-HU");
  $("multiplierValue").textContent = state.multiplier;

  $("list").innerHTML = filtered.map(r => `
    <div class="item">
      <div>${r.ts}</div>
      <div class="right">
        ${r.value.toLocaleString("hu-HU")}
        <button class="btn btn-danger btn-outline"
          data-id="${r.id}">✕</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-id]").forEach(btn => {
    btn.onclick = async () => {
      await deleteDoc(doc(db, "users", clientId, "records", btn.dataset.id));
    };
  });
}

onSnapshot(query(recordsRef, orderBy("epoch")), snap => {
  state.records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

onSnapshot(settingsRef, snap => {
  if (snap.exists()) {
    state.multiplier = snap.data().multiplier || 1;
    render();
  }
});

$("btnAdd").onclick = async () => {
  const v = parseNumber($("valueInput").value);
  if (v === null) return;
  const t = nowISO();
  await addDoc(recordsRef, { ...t, value: v });
  $("valueInput").value = "";
};

$("monthSelect").onchange = e => {
  state.month = e.target.value;
  render();
};

$("btnMultiplier").onclick = async () => {
  const v = parseNumber(prompt("Szorzó értéke:", state.multiplier));
  if (v === null) return;
  await setDoc(settingsRef, { multiplier: v });
};
