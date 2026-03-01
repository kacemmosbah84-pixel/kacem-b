// app.js (Firebase Username+Password + Cloud Sync)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/** 1) حط الكونفيق حقك هنا */
const firebaseConfig = {
  apiKey: "AIzaSyAY0UUup62U68r2Hv1mS6ffX4ZjSmvcOqQ",
  authDomain: "kacem-b.firebaseapp.com",
  projectId: "kacem-b",
  storageBucket: "kacem-b.firebasestorage.app",
  messagingSenderId: "25625777376",
  appId: "1:25625777376:web:3fa483d33191faaeb86c85",
  measurementId: "G-WM1LNSFQ2J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");
const now = () => new Date();
const ym = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseYMD = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], da = +m[3];
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
  return d;
};

const toInt = (s) => {
  const n = Number(String(s ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const money = (n) => `${(n || 0).toLocaleString("ar-DZ")} دج`;
const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const setVisible = (el, yes) => (el.style.display = yes ? "" : "none");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function openModal(backId) { $(backId).classList.add("show"); }
function closeModal(backId) { $(backId).classList.remove("show"); }

function requestNotify() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission().catch(()=>{});
}
function notifyStop(msg) {
  alert(msg);
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("kacem B", { body: msg });
    }
  } catch {}
}

// ---------- State (per-user in Firestore) ----------
const defaultState = {
  version: 2,
  settings: { salary: 47000, maxSpend: 47000, currency: "دج", integersOnly: true },
  expenses: [],
};

let state = structuredClone(defaultState);
let session = { loggedIn: false, user: null };
let monthKey = ym(now());
let sortMode = "new";
let query = "";
let editId = null;

let saveTimer = null;
function debounceSaveCloud() {
  if (!session.user) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCloud, 600);
}

function usernameToEmail(username) {
  const u = (username || "").trim().toLowerCase();
  // السماح بحروف/أرقام/._- فقط
  if (!/^[a-z0-9._-]{3,20}$/.test(u)) return null;
  return `${u}@kacem-b.local`;
}

async function loadCloud() {
  const user = session.user;
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    state = {
      ...defaultState,
      ...data,
      settings: { ...defaultState.settings, ...(data.settings || {}) },
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
    };
  } else {
    state = structuredClone(defaultState);
    await setDoc(ref, { ...state, createdAt: serverTimestamp() }, { merge: true });
  }
}

async function saveCloud() {
  const user = session.user;
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  await setDoc(ref, { ...state, updatedAt: serverTimestamp() }, { merge: true });
}

// ---------- UI ----------
function applyLoginUI() {
  setVisible($("loginCard"), !session.loggedIn);
  setVisible($("homeArea"), session.loggedIn);
  setVisible($("btnSettings"), session.loggedIn);
  setVisible($("btnBackup"), session.loggedIn);
  setVisible($("btnLogout"), session.loggedIn);

  // نغيّر النص تحت: ما عاد فيه حساب افتراضي
  const hint = $("loginHint");
  if (hint) hint.textContent = "سجّل دخول أو أنشئ حساب جديد. (اسم المستخدم 3-20: حروف/أرقام/._-)";
}

// نضيف زر “إنشاء حساب” داخل بطاقة الدخول
function ensureSignupButton() {
  if ($("btnSignup")) return;
  const btn = document.createElement("button");
  btn.id = "btnSignup";
  btn.className = "btn";
  btn.textContent = "إنشاء حساب";
  $("btnLogin").parentElement.appendChild(btn);
  btn.onclick = signup;
}

function monthExpenses() {
  const list = state.expenses.filter(x => (x.dateYMD || "").startsWith(monthKey));
  const q = query.trim().toLowerCase();
  let filtered = q
    ? list.filter(x =>
        (x.desc || "").toLowerCase().includes(q) ||
        String(x.amount || "").includes(q) ||
        (x.dateYMD || "").includes(q)
      )
    : list;

  filtered.sort((a, b) => {
    if (sortMode === "new") return (b.dateYMD || "").localeCompare(a.dateYMD || "");
    if (sortMode === "old") return (a.dateYMD || "").localeCompare(b.dateYMD || "");
    if (sortMode === "high") return (b.amount || 0) - (a.amount || 0);
    if (sortMode === "low") return (a.amount || 0) - (b.amount || 0);
    return 0;
  });

  return filtered;
}

function computeSums(list) {
  const total = list.reduce((a, x) => a + (x.amount || 0), 0);
  const salary = state.settings.salary || 0;
  const maxSpend = state.settings.maxSpend || 0;
  const remainingSalary = salary - total;
  const remainingMax = maxSpend - total;
  return { total, salary, maxSpend, remainingSalary, remainingMax };
}

function render() {
  applyLoginUI();
  if (!session.loggedIn) return;

  $("monthLabel").textContent = monthKey;

  const list = monthExpenses();
  const sums = computeSums(list);

  $("kpiSalary").textContent = money(sums.salary);
  $("kpiMax").textContent = money(sums.maxSpend);
  $("kpiTotal").textContent = money(sums.total);
  $("kpiRemainSalary").textContent = money(sums.remainingSalary);
  $("kpiRemainMax").textContent = money(sums.remainingMax);

  $("kpiEnd").textContent = `المجموع: ${money(sums.total)}`;
  $("kpiEnd2").textContent = `الباقي: ${money(sums.remainingSalary)} | (من الماكس): ${money(sums.remainingMax)}`;

  $("kpiRemainSalaryBox").classList.toggle("dangerBorder", sums.remainingSalary <= 0);
  $("kpiRemainMaxBox").classList.toggle("dangerBorder", sums.remainingMax <= 0);

  const stop = (sums.maxSpend > 0 && sums.total >= sums.maxSpend) || (sums.salary > 0 && sums.total >= sums.salary);
  setVisible($("stopAlert"), stop);

  if (stop) {
    const key = `notified_${monthKey}_${sums.total}`;
    if (!session[key]) {
      session[key] = true;
      requestNotify();
      notifyStop("وقف ✋ وصلت/تجاوزت الحد.");
    }
  }

  const area = $("listArea");
  area.innerHTML = "";
  if (list.length === 0) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<div class="muted">ما فيه مصاريف لهالشهر.</div>`;
    area.appendChild(div);
    return;
  }

  for (const x of list) {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="meta">
        <div style="font-weight:900">${money(x.amount)}</div>
        <div class="desc">${escapeHtml(x.desc || "")}</div>
        <div class="muted small">${escapeHtml(x.dateYMD || "")}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">
        <button class="btn" data-act="edit" data-id="${x.id}">تعديل</button>
        <button class="btn danger" data-act="del" data-id="${x.id}">حذف</button>
      </div>
    `;
    area.appendChild(item);
  }
}

function setMonth(delta) {
  const [Y, M] = monthKey.split("-").map(Number);
  const d = new Date(Y, (M - 1) + delta, 1);
  monthKey = ym(d);
  render();
}

function openAdd() {
  editId = null;
  $("modalTitle").textContent = "إضافة صرف";
  $("fDate").value = ymd(now());
  $("fAmt").value = "";
  $("fDesc").value = "";
  openModal("modalBack");
}

function openEdit(id) {
  const it = state.expenses.find(x => x.id === id);
  if (!it) return;
  editId = id;
  $("modalTitle").textContent = "تعديل صرف";
  $("fDate").value = it.dateYMD || ymd(now());
  $("fAmt").value = String(it.amount || "");
  $("fDesc").value = it.desc || "";
  openModal("modalBack");
}

function saveExpense() {
  const d = parseYMD($("fDate").value);
  if (!d) return alert("التاريخ لازم يكون بالشكل YYYY-MM-DD");
  const amount = toInt($("fAmt").value);
  if (amount <= 0) return alert("اكتب مبلغ صحيح أكبر من 0");
  const desc = ($("fDesc").value || "").trim();
  if (!desc) return alert("اكتب وصف للمبلغ");

  const item = { id: editId || uid(), dateYMD: ymd(d), amount, desc };

  if (editId) state.expenses = state.expenses.map(x => x.id === editId ? item : x);
  else state.expenses = [item, ...state.expenses];

  closeModal("modalBack");
  render();
  debounceSaveCloud();
}

function deleteExpense(id) {
  if (!confirm("متأكد تحذف العملية؟")) return;
  state.expenses = state.expenses.filter(x => x.id !== id);
  render();
  debounceSaveCloud();
}

function openSettings() {
  $("sUser").value = ""; // ما عاد نغير يوزر/باس هنا (تتبع للحساب)
  $("sPass").value = "";
  $("sSalary").value = String(state.settings.salary || 0);
  $("sMax").value = String(state.settings.maxSpend || 0);
  openModal("settingsBack");
}

function saveSettings() {
  const salary = toInt($("sSalary").value);
  const maxSpend = toInt($("sMax").value);
  if (salary <= 0) return alert("الراتب لازم يكون أكبر من 0");
  if (maxSpend <= 0) return alert("الماكس لازم يكون أكبر من 0");

  state.settings.salary = salary;
  state.settings.maxSpend = maxSpend;

  closeModal("settingsBack");
  alert("تم حفظ الإعدادات.");
  render();
  debounceSaveCloud();
}

// ---------- Backup ----------
function openBackup() {
  $("backupText").value = JSON.stringify(state, null, 2);
  openModal("backupBack");
}
function refreshBackupText() { $("backupText").value = JSON.stringify(state, null, 2); }
function importBackupText() {
  try {
    const parsed = JSON.parse($("backupText").value || "");
    state = {
      ...defaultState,
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
    alert("تم الاستيراد.");
    closeModal("backupBack");
    render();
    debounceSaveCloud();
  } catch { alert("النص مو JSON صحيح."); }
}
function exportCSV() {
  const rows = [
    ["id","date","amount","desc"].join(","),
    ...state.expenses.map(x => {
      const safe = String(x.desc || "").replace(/"/g,'""');
      return [x.id, x.dateYMD, x.amount, `"${safe}"`].join(",");
    })
  ];
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kacem_b_expenses_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Auth (username + password) ----------
async function login() {
  const username = ($("loginUser").value || "").trim();
  const password = $("loginPass").value || "";
  const email = usernameToEmail(username);
  if (!email) return alert("اسم المستخدم لازم يكون 3-20 (حروف/أرقام/._-)");
  if (!password || password.length < 6) return alert("كلمة السر لازم تكون 6 أحرف أو أكثر");

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert("فشل الدخول. تأكد من اسم المستخدم وكلمة السر.");
  }
}

async function signup() {
  const username = ($("loginUser").value || "").trim();
  const password = $("loginPass").value || "";
  const email = usernameToEmail(username);
  if (!email) return alert("اسم المستخدم لازم يكون 3-20 (حروف/أرقام/._-)");
  if (!password || password.length < 6) return alert("كلمة السر لازم تكون 6 أحرف أو أكثر");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // نحفظ “username” داخل ملف المستخدم (للعرض فقط)
    await setDoc(doc(db, "users", cred.user.uid), { username: username.toLowerCase(), ...defaultState, createdAt: serverTimestamp() }, { merge: true });
    alert("تم إنشاء الحساب ✅");
  } catch (e) {
    // غالباً الاسم مستخدم (الإيميل موجود)
    alert("ما قدرنا نسوي الحساب. غالباً اسم المستخدم مستخدم أو فيه مشكلة.");
  }
}

// ---------- Events ----------
$("btnLogin").onclick = login;
$("btnLogout").onclick = () => signOut(auth);

$("btnAdd").onclick = openAdd;

$("modalClose").onclick = () => closeModal("modalBack");
$("modalCancel").onclick = () => closeModal("modalBack");
$("modalSave").onclick = saveExpense;

$("btnSettings").onclick = openSettings;
$("settingsClose").onclick = () => closeModal("settingsBack");
$("settingsSave").onclick = saveSettings;

$("btnBackup").onclick = openBackup;
$("backupClose").onclick = () => closeModal("backupBack");
$("backupRefresh").onclick = refreshBackupText;
$("backupImport").onclick = importBackupText;
$("backupCSV").onclick = exportCSV;

$("prevMonth").onclick = () => setMonth(-1);
$("nextMonth").onclick = () => setMonth(1);

$("searchBox").oninput = (e) => { query = e.target.value || ""; render(); };

$$(".chip").forEach(ch => {
  ch.onclick = () => {
    $$(".chip").forEach(x => x.classList.remove("active"));
    ch.classList.add("active");
    sortMode = ch.dataset.sort;
    render();
  };
});

$("listArea").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (act === "edit") openEdit(id);
  if (act === "del") deleteExpense(id);
});

(function init(){
  ensureSignupButton();
  monthKey = ym(now());

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      session.user = user;
      session.loggedIn = true;
      await loadCloud();
      render();
    } else {
      session.user = null;
      session.loggedIn = false;
      state = structuredClone(defaultState);
      render();
    }
  });

  render();
})();
