alert("app.js شغّال ✅");
console.log("app.js loaded");
// ===========================
// Firebase (CDN - Modular v9)
// ===========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, deleteDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";

// ===========================
// 1) Firebase Config (مالك)
// ===========================
const firebaseConfig = {
  apiKey: "AIzaSyAY0UUup62U68r2Hv1mS6ffX4ZjSmvcOqQ",
  authDomain: "kacem-b.firebaseapp.com",
  projectId: "kacem-b",
  storageBucket: "kacem-b.firebasestorage.app",
  messagingSenderId: "25625777376",
  appId: "1:25625777376:web:3fa483d33191faaeb86c85",
  measurementId: "G-WM1LNSFQ2J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics = null;
try { analytics = getAnalytics(app); } catch (_) {}

const auth = getAuth(app);
const db = getFirestore(app);

// ===========================
// Helpers
// ===========================
const $ = (id) => document.getElementById(id);

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const ym = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const money = (n) => (isFinite(n) ? Number(n).toLocaleString("ar-DZ") : "0");

const firstDayOfMonth = (y, m) => new Date(y, m, 1);
const lastDayOfMonth = (y, m) => new Date(y, m + 1, 0);

function monthLabelText(d) {
  const names = ["يناير","فبراير","مارس","أبريل","ماي","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${names[d.getMonth()]} ${d.getFullYear()}`;
}

// ===========================
// UI Elements
// ===========================
const loginCard = $("loginCard");
const homeArea = $("homeArea");
const loginUser = $("loginUser");
const loginPass = $("loginPass");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const loginHint = $("loginHint");

const btnLogout = $("btnLogout");
const btnSettings = $("btnSettings");
const btnBackup = $("btnBackup");

const prevMonth = $("prevMonth");
const nextMonth = $("nextMonth");
const monthLabel = $("monthLabel");

const kpiSalary = $("kpiSalary");
const kpiMax = $("kpiMax");
const kpiTotal = $("kpiTotal");
const kpiRemainSalary = $("kpiRemainSalary");
const kpiRemainMax = $("kpiRemainMax");
const kpiEnd = $("kpiEnd");
const kpiEnd2 = $("kpiEnd2");
const stopAlert = $("stopAlert");
const kpiRemainSalaryBox = $("kpiRemainSalaryBox");
const kpiRemainMaxBox = $("kpiRemainMaxBox");

const searchBox = $("searchBox");
const listArea = $("listArea");
const chips = Array.from(document.querySelectorAll(".chip"));

const btnAdd = $("btnAdd");

// Add/Edit modal
const modalBack = $("modalBack");
const modalClose = $("modalClose");
const modalCancel = $("modalCancel");
const modalSave = $("modalSave");
const modalTitle = $("modalTitle");
const fDate = $("fDate");
const fAmt = $("fAmt");
const fDesc = $("fDesc");

// Settings modal
const settingsBack = $("settingsBack");
const settingsClose = $("settingsClose");
const settingsSave = $("settingsSave");
const settingsReset = $("settingsReset");
const sSalary = $("sSalary");
const sMax = $("sMax");

// Backup modal
const backupBack = $("backupBack");
const backupClose = $("backupClose");
const backupText = $("backupText");
const backupRefresh = $("backupRefresh");
const backupImport = $("backupImport");
const backupCSV = $("backupCSV");

// ===========================
// State
// ===========================
let currentUser = null;
let currentMonth = new Date();         // الشهر الحالي المعروض
let currentSort = "new";               // new | old | high | low
let userSettings = { salary: 0, max: 0 };
let monthTx = [];                      // عمليات الشهر المعروض

// ===========================
// Firebase Paths
// ===========================
function userDocRef(uid) {
  return doc(db, "users", uid);
}
function txColRef(uid) {
  return collection(db, "users", uid, "tx");
}

// ===========================
// Auth UI
// ===========================
function showLogin() {
  loginCard.style.display = "block";
  homeArea.style.display = "none";
  btnLogout.style.display = "none";
  btnSettings.style.display = "none";
  btnBackup.style.display = "none";
}

function showHome() {
  loginCard.style.display = "none";
  homeArea.style.display = "flex";
  btnLogout.style.display = "inline-block";
  btnSettings.style.display = "inline-block";
  btnBackup.style.display = "inline-block";
}

function setHint(msg) {
  loginHint.textContent = msg || "";
}

// ===========================
// Load / Save Settings
// ===========================
async function ensureUserDoc(uid) {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      salary: 0,
      max: 0,
      createdAt: Date.now()
    });
  }
}

async function loadSettings(uid) {
  await ensureUserDoc(uid);
  const snap = await getDoc(userDocRef(uid));
  const data = snap.data() || {};
  userSettings.salary = Number(data.salary || 0);
  userSettings.max = Number(data.max || 0);

  // fill settings inputs
  sSalary.value = userSettings.salary ? String(userSettings.salary) : "";
  sMax.value = userSettings.max ? String(userSettings.max) : "";
}

async function saveSettings(uid) {
  const salary = Number(String(sSalary.value || "").replace(/[^\d.]/g, "")) || 0;
  const max = Number(String(sMax.value || "").replace(/[^\d.]/g, "")) || 0;

  await setDoc(userDocRef(uid), { salary, max }, { merge: true });
  userSettings.salary = salary;
  userSettings.max = max;
}

// ===========================
// Load Transactions (by month)
// ===========================
function isInMonth(ymStr, dateStr) {
  // dateStr: YYYY-MM-DD
  return (dateStr || "").slice(0, 7) === ymStr;
}

async function loadMonthTx(uid) {
  const ymStr = ym(currentMonth);

  // نجيب كل العمليات مرتبة بتاريخ الإضافة (تقريبًا)
  const qy = query(txColRef(uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  const all = [];
  snap.forEach((d) => all.push({ id: d.id, ...d.data() }));

  // فلترة الشهر
  monthTx = all
    .filter((t) => isInMonth(ymStr, t.date))
    .map((t) => ({
      id: t.id,
      date: t.date || "",
      amt: Number(t.amt || 0),
      desc: t.desc || "",
      createdAt: Number(t.createdAt || 0)
    }));

  renderAll();
}

// ===========================
// Render
// ===========================
function applySortAndSearch(list) {
  const q = (searchBox.value || "").trim().toLowerCase();

  let filtered = list.filter((t) => {
    if (!q) return true;
    return (
      String(t.date).toLowerCase().includes(q) ||
      String(t.desc).toLowerCase().includes(q) ||
      String(t.amt).includes(q)
    );
  });

  if (currentSort === "new") {
    filtered.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt));
  } else if (currentSort === "old") {
    filtered.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));
  } else if (currentSort === "high") {
    filtered.sort((a, b) => (b.amt - a.amt));
  } else if (currentSort === "low") {
    filtered.sort((a, b) => (a.amt - b.amt));
  }
  return filtered;
}

function renderKPI() {
  const salary = userSettings.salary || 0;
  const max = userSettings.max || 0;
  const total = monthTx.reduce((s, t) => s + (t.amt || 0), 0);

  kpiSalary.textContent = money(salary);
  kpiMax.textContent = money(max);
  kpiTotal.textContent = money(total);

  const remainSalary = salary - total;
  const remainMax = max - total;

  kpiRemainSalary.textContent = money(remainSalary);
  kpiRemainMax.textContent = money(remainMax);

  // تلوين بسيط لو صار سالب
  kpiRemainSalaryBox.classList.toggle("dangerBorder", remainSalary < 0);
  kpiRemainMaxBox.classList.toggle("dangerBorder", remainMax < 0);

  // stop alert لو تعدى max (إذا max محدد)
  stopAlert.style.display = (max > 0 && total >= max) ? "block" : "none";

  // ملخص آخر الشهر
  const last = lastDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  kpiEnd.textContent = `حتى ${ymd(last)}`;
  kpiEnd2.textContent = `المتبقي من الماكس: ${money(remainMax)}`;
}

function renderList() {
  listArea.innerHTML = "";

  const list = applySortAndSearch(monthTx);

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card muted";
    empty.textContent = "ما فيه عمليات بهذا الشهر.";
    listArea.appendChild(empty);
    return;
  }

  for (const t of list) {
    const item = document.createElement("div");
    item.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const top = document.createElement("div");
    top.innerHTML = `<b>${money(t.amt)} دج</b> <span class="muted small">— ${t.date || ""}</span>`;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = t.desc || "(بدون وصف)";

    meta.appendChild(top);
    meta.appendChild(desc);

    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.justifyContent = "flex-start";

    const del = document.createElement("button");
    del.className = "btn danger";
    del.textContent = "حذف";
    del.onclick = async () => {
      if (!currentUser) return;
      if (!confirm("متأكد تحذف؟")) return;
      await deleteDoc(doc(db, "users", currentUser.uid, "tx", t.id));
      await loadMonthTx(currentUser.uid);
    };

    actions.appendChild(del);

    item.appendChild(meta);
    item.appendChild(actions);
    listArea.appendChild(item);
  }
}

function renderMonthHeader() {
  monthLabel.textContent = monthLabelText(currentMonth);
}

function renderAll() {
  renderMonthHeader();
  renderKPI();
  renderList();
}

// ===========================
// Modals
// ===========================
function openModal() {
  modalBack.classList.add("show");
}
function closeModal() {
  modalBack.classList.remove("show");
}
function openSettings() {
  settingsBack.classList.add("show");
}
function closeSettings() {
  settingsBack.classList.remove("show");
}
function openBackup() {
  backupBack.classList.add("show");
}
function closeBackup() {
  backupBack.classList.remove("show");
}

// ===========================
// Actions
// ===========================
async function addTx(uid, { date, amt, desc }) {
  await addDoc(txColRef(uid), {
    date,
    amt: Number(amt || 0),
    desc: String(desc || ""),
    createdAt: Date.now()
  });
}

function defaultAddForm() {
  fDate.value = ymd(new Date());
  fAmt.value = "";
  fDesc.value = "";
}

// ===========================
// Events (Login / Signup)
// ===========================
btnLogin.addEventListener("click", async () => {
  const email = (loginUser.value || "").trim();
  const pass = (loginPass.value || "").trim();

  if (!email || !pass) {
    setHint("اكتب الإيميل وكلمة السر.");
    return;
  }

  setHint("جاري تسجيل الدخول...");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    setHint("");
  } catch (e) {
    setHint(`فشل الدخول: ${e?.message || e}`);
  }
});

btnSignup.addEventListener("click", async () => {
  const email = (loginUser.value || "").trim();
  const pass = (loginPass.value || "").trim();

  if (!email || !pass) {
    setHint("اكتب الإيميل وكلمة السر لإنشاء حساب.");
    return;
  }
  if (pass.length < 6) {
    setHint("كلمة السر لازم 6 أحرف أو أكثر.");
    return;
  }

  setHint("جاري إنشاء الحساب...");
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    setHint("تم إنشاء الحساب ✅");
  } catch (e) {
    setHint(`فشل إنشاء الحساب: ${e?.message || e}`);
  }
});

// ===========================
// Events (App)
// ===========================
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

btnSettings.addEventListener("click", () => {
  openSettings();
});

btnBackup.addEventListener("click", async () => {
  openBackup();
  await refreshBackupText();
});

settingsClose.addEventListener("click", closeSettings);
settingsSave.addEventListener("click", async () => {
  if (!currentUser) return;
  await saveSettings(currentUser.uid);
  closeSettings();
  renderAll();
});
settingsReset.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!confirm("بتصفر الراتب والماكس؟")) return;
  sSalary.value = "0";
