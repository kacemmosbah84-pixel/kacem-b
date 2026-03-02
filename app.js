// ===================== Firebase Config (بدّلها بقيم مشروعك) =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

// ===================== Helpers =====================
const $ = (id) => document.getElementById(id);

function toast(msg) {
  alert(msg);
}

function normalizeUsername(u) {
  return (u || "").trim().toLowerCase();
}

// نحول اسم المستخدم لإيميل داخلي
function usernameToEmail(username) {
  const u = normalizeUsername(username);
  if (!u) return "";
  if (u.includes("@")) return u; // لو كتب إيميل فعلي
  return `${u}@kacem.local`;
}

function num(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKeyFromYMD(ymd) {
  // "YYYY-MM"
  return String(ymd || "").slice(0, 7);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(filename, rows) {
  const esc = (s) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  downloadText(filename, csv);
}

// ===================== UI refs =====================
const loginCard = $("loginCard");
const homeArea  = $("homeArea");

const loginUser = $("loginUser");
const loginPass = $("loginPass");
const loginHint = $("loginHint");

const btnLogin  = $("btnLogin");
const btnSignup = $("btnSignup");
const btnLogout = $("btnLogout");

const btnAdd = $("btnAdd");
const modalBack = $("modalBack");
const modalClose = $("modalClose");
const modalCancel = $("modalCancel");
const modalSave = $("modalSave");
const fDate = $("fDate");
const fAmt  = $("fAmt");
const fDesc = $("fDesc");

const whoAmI = $("whoAmI");
const listArea = $("listArea");
const searchBox = $("searchBox");

const btnSettings = $("btnSettings");
const settingsBack = $("settingsBack");
const settingsClose = $("settingsClose");
const settingsSave = $("settingsSave");
const sSalary = $("sSalary");
const sMax = $("sMax");

const btnBackup = $("btnBackup");
const backupBack = $("backupBack");
const backupClose = $("backupClose");
const backupText = $("backupText");
const backupRefresh = $("backupRefresh");
const backupImport = $("backupImport");
const backupCSV = $("backupCSV");

const kpiSalary = $("kpiSalary");
const kpiMax = $("kpiMax");
const kpiTotal = $("kpiTotal");
const kpiRemain = $("kpiRemain");

// ===================== State =====================
let currentUser = null;
let unsubTx = null;
let cachedTx = [];
let settings = { salary: 0, max: 0 };

// ===================== Show/Hide =====================
function showLogin() {
  loginCard.style.display = "block";
  homeArea.style.display = "none";

  btnSettings.style.display = "none";
  btnBackup.style.display = "none";
  btnLogout.style.display = "none";
}

function showHome() {
  loginCard.style.display = "none";
  homeArea.style.display = "flex";

  btnSettings.style.display = "inline-block";
  btnBackup.style.display = "inline-block";
  btnLogout.style.display = "inline-block";
}

// ===================== Firestore paths =====================
function userRoot(uid) {
  return doc(db, "users", uid);
}
function settingsDoc(uid) {
  return doc(db, "users", uid, "settings", "main");
}
function txCol(uid) {
  return collection(db, "users", uid, "tx");
}

// ===================== Settings load/save =====================
async function loadSettings(uid) {
  const ref = settingsDoc(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // defaults
    settings = { salary: 0, max: 0 };
    await setDoc(ref, settings, { merge: true });
  } else {
    const data = snap.data() || {};
    settings = {
      salary: num(data.salary),
      max: num(data.max),
    };
  }

  sSalary.value = settings.salary || "";
  sMax.value = settings.max || "";
  renderKPIs();
}

async function saveSettings(uid) {
  const salary = num(sSalary.value);
  const max = num(sMax.value);

  settings = { salary, max };
  await setDoc(settingsDoc(uid), settings, { merge: true });

  renderKPIs();
  toast("تم حفظ الإعدادات ✅");
}

// ===================== Transactions =====================
function startTxListener(uid) {
  if (unsubTx) unsubTx();

  const qy = query(txCol(uid), orderBy("createdAt", "desc"));
  unsubTx = onSnapshot(qy, (snap) => {
    cachedTx = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
    renderKPIs();
  });
}

async function addTransaction(uid, { date, amt, desc }) {
  await addDoc(txCol(uid), {
    date,                 // "YYYY-MM-DD"
    month: monthKeyFromYMD(date), // "YYYY-MM"
    amt: num(amt),
    desc: String(desc || "").trim(),
    createdAt: serverTimestamp(),
  });
}

async function importBackup(uid, payload) {
  // payload: { settings, tx[] }
  if (payload?.settings) {
    await setDoc(settingsDoc(uid), {
      salary: num(payload.settings.salary),
      max: num(payload.settings.max),
    }, { merge: true });
  }

  const tx = Array.isArray(payload?.tx) ? payload.tx : [];
  // نضيفها من جديد (ممكن يصير تكرار لو كررت الاستيراد)
  for (const t of tx) {
    const date = String(t.date || "").slice(0, 10) || todayYMD();
    await addDoc(txCol(uid), {
      date,
      month: monthKeyFromYMD(date),
      amt: num(t.amt),
      desc: String(t.desc || "").trim(),
      createdAt: serverTimestamp(),
    });
  }
}

// ===================== Render =====================
function renderList() {
  const q = String(searchBox.value || "").trim().toLowerCase();
  const filtered = cachedTx.filter(t => {
    if (!q) return true;
    return (
      String(t.desc || "").toLowerCase().includes(q) ||
      String(t.amt ?? "").includes(q) ||
      String(t.date || "").includes(q)
    );
  });

  listArea.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "ما فيه عمليات.";
    listArea.appendChild(empty);
    return;
  }

  for (const t of filtered) {
    const row = document.createElement("div");
    row.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const top = document.createElement("b");
    top.textContent = `${t.amt || 0} دج`;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = `${t.date || ""} — ${t.desc || ""}`;

    meta.appendChild(top);
    meta.appendChild(desc);

    row.appendChild(meta);
    listArea.appendChild(row);
  }
}

function renderKPIs() {
  const monthNow = monthKeyFromYMD(todayYMD());
  const txThisMonth = cachedTx.filter(t => t.month === monthNow);
  const total = txThisMonth.reduce((s, t) => s + num(t.amt), 0);

  kpiSalary.textContent = String(settings.salary || 0);
  kpiMax.textContent = String(settings.max || 0);
  kpiTotal.textContent = String(total);

  const remain = (settings.max || 0) - total;
  kpiRemain.textContent = String(remain);
}

// ===================== Modal helpers =====================
function openModal(backEl) {
  backEl.classList.add("show");
}
function closeModal(backEl) {
  backEl.classList.remove("show");
}

// ===================== Auth actions =====================
async function doLogin() {
  const u = usernameToEmail(loginUser.value);
  const p = String(loginPass.value || "");

  if (!u || !p) return toast("اكتب اسم المستخدم وكلمة السر");

  try {
    await signInWithEmailAndPassword(auth, u, p);
  } catch (e) {
    toast("فشل تسجيل الدخول ❌\nتأكد من البيانات أو سوّ إنشاء حساب.");
    console.error(e);
  }
}

async function doSignup() {
  const rawU = normalizeUsername(loginUser.value);
  const u = usernameToEmail(rawU);
  const p = String(loginPass.value || "");

  if (!rawU || !p) return toast("اكتب اسم المستخدم وكلمة السر");
  if (p.length < 6) return toast("كلمة السر لازم 6 أحرف أو أكثر");

  try {
    const cred = await createUserWithEmailAndPassword(auth, u, p);
    const uid = cred.user.uid;

    // نخزن اسم المستخدم
    await setDoc(userRoot(uid), { username: rawU, createdAt: serverTimestamp() }, { merge: true });

    // settings افتراضية
    await setDoc(settingsDoc(uid), { salary: 0, max: 0 }, { merge: true });

    toast("تم إنشاء الحساب ✅");
  } catch (e) {
    // غالبًا الحساب موجود
    toast("ما قدرنا ننشئ الحساب ❌\nممكن الاسم مستخدم قبل.");
    console.error(e);
  }
}

async function doLogout() {
  await signOut(auth);
}

// ===================== Wire events =====================
btnLogin.addEventListener("click", doLogin);
btnSignup.addEventListener("click", doSignup);
btnLogout.addEventListener("click", doLogout);

btnAdd.addEventListener("click", () => {
  fDate.value = todayYMD();
  fAmt.value = "";
  fDesc.value = "";
  openModal(modalBack);
});

modalClose.addEventListener("click", () => closeModal(modalBack));
modalCancel.addEventListener("click", () => closeModal(modalBack));

modalSave.addEventListener("click", async () => {
  if (!currentUser) return;

  const date = String(fDate.value || "").trim() || todayYMD();
  const amt = num(fAmt.value);
  const desc = String(fDesc.value || "").trim();

  if (!date || !amt || !desc) return toast("كمّل البيانات (تاريخ/مبلغ/وصف)");

  try {
    await addTransaction(currentUser.uid, { date, amt, desc });
    closeModal(modalBack);
    toast("تمت الإضافة ✅");
  } catch (e) {
    toast("صار خطأ في الحفظ ❌");
    console.error(e);
  }
});

searchBox.addEventListener("input", renderList);

// Settings
btnSettings.addEventListener("click", () => openModal(settingsBack));
settingsClose.addEventListener("click", () => closeModal(settingsBack));
settingsSave.addEventListener("click", async () => {
  if (!currentUser) return;
  try {
    await saveSettings(currentUser.uid);
    closeModal(settingsBack);
  } catch (e) {
    toast("صار خطأ في حفظ الإعدادات ❌");
    console.error(e);
  }
});

// Backup
btnBackup.addEventListener("click", () => openModal(backupBack));
backupClose.addEventListener("click", () => closeModal(backupBack));

backupRefresh.addEventListener("click", async () => {
  if (!currentUser) return;

  const payload = {
    settings,
    tx: cachedTx.map(t => ({
      date: t.date || "",
      amt: num(t.amt),
      desc: t.desc || "",
    })),
  };

  backupText.value = JSON.stringify(payload, null, 2);
  toast("تم تحديث نص النسخة ✅");
});

backupImport.addEventListener("click", async () => {
  if (!currentUser) return;
  try {
    const txt = String(backupText.value || "").trim();
    if (!txt) return toast("الصق JSON أول");

    const payload = JSON.parse(txt);
    await importBackup(currentUser.uid, payload);
    await loadSettings(currentUser.uid);

    toast("تم الاستيراد ✅");
  } catch (e) {
    toast("JSON غير صحيح ❌");
    console.error(e);
  }
});

backupCSV.addEventListener("click", () => {
  const rows = [
    ["date", "amt", "desc"],
    ...cachedTx.map(t => [t.date || "", num(t.amt), t.desc || ""]),
  ];
  downloadCSV("kacemB-transactions.csv", rows);
});

// ===================== Auth state =====================
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    if (unsubTx) unsubTx();
    cachedTx = [];
    settings = { salary: 0, max: 0 };
    loginHint.textContent = "اكتب اسم المستخدم + كلمة السر. (إنشاء حساب لأول مرة).";
    showLogin();
    return;
  }

  showHome();
  whoAmI.textContent = `UID: ${user.uid}`;

  try {
    await loadSettings(user.uid);
    startTxListener(user.uid);

    // اسم المستخدم من الوثيقة
    const uSnap = await getDoc(userRoot(user.uid));
    const uname = uSnap.exists() ? (uSnap.data().username || "") : "";
    if (uname) whoAmI.textContent = `مستخدم: ${uname}`;

  } catch (e) {
    toast("فيه مشكلة إعدادات/قواعد Firestore ❌");
    console.error(e);
  }
});
