/* هدفي | MyGoal
   Tech: Vanilla JS + Firebase Auth + Firestore + Hosting + PWA
   Online First: لا تخزين مهم في localStorage
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* -----------------------------
   1) Firebase Config (ضع بياناتك)
-------------------------------- */
const firebaseConfig = {
  apiKey: "PUT_YOUR_API_KEY",
  authDomain: "PUT_YOUR_AUTH_DOMAIN",
  projectId: "PUT_YOUR_PROJECT_ID",
  storageBucket: "PUT_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PUT_YOUR_SENDER_ID",
  appId: "PUT_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -----------------------------
   2) Helpers
-------------------------------- */
const $ = (id) => document.getElementById(id);

function toInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.floor(x));
}

function fmtDZD(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("fr-DZ").format(v) + " دج";
}

function nowISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKeyFromDateISO(dateISO) {
  // YYYY-MM-DD => YYYY-MM
  return dateISO.slice(0, 7);
}

function firstDayOfMonth(monthKey) {
  return `${monthKey}-01`;
}

function monthNameMaghrebFR(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const names = [
    "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
    "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];
  return `${names[m - 1]} ${y}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeText(s) {
  return String(s ?? "").trim();
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setNotice(el, msg, tone = "info") {
  el.className = "notice " + tone;
  el.textContent = msg;
  show(el);
}

function clearNotice(el) {
  el.textContent = "";
  hide(el);
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
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

/* -----------------------------
   3) State (في الذاكرة فقط)
-------------------------------- */
const state = {
  user: null,
  settings: { salary: 0, max: 0, goal: 0, createdAt: null },
  currentMonth: monthKeyFromDateISO(nowISODate()),
  currentMonthSummary: { incomeTotal: 0, expenseTotal: 0, net: 0, capUsedPercent: 0, updatedAt: null },
  currentTxns: [], // loaded month txns
  dayFilter: null, // YYYY-MM-DD
  totalsAll: { incomeAll: 0, expenseAll: 0, balanceAll: 0 },
  installPromptEvent: null
};

/* -----------------------------
   4) Firestore Paths
-------------------------------- */
function userBase(uid) {
  return `users/${uid}`;
}
function settingsRef(uid) {
  return doc(db, `${userBase(uid)}/settings/main`);
}
function monthDocRef(uid, monthKey) {
  return doc(db, `${userBase(uid)}/months/${monthKey}`);
}
function monthSummaryRef(uid, monthKey) {
  return doc(db, `${userBase(uid)}/months/${monthKey}/summary/main`);
}
function monthTxnsCol(uid, monthKey) {
  return collection(db, `${userBase(uid)}/months/${monthKey}/transactions`);
}
function txnRef(uid, monthKey, txnId) {
  return doc(db, `${userBase(uid)}/months/${monthKey}/transactions/${txnId}`);
}

/* -----------------------------
   5) UI Elements
-------------------------------- */
const el = {
  splash: $("splash"),

  authView: $("authView"),
  mainView: $("mainView"),
  authMsg: $("authMsg"),

  loginEmail: $("loginEmail"),
  loginPass: $("loginPass"),
  signupEmail: $("signupEmail"),
  signupPass: $("signupPass"),
  btnLogin: $("btnLogin"),
  btnSignup: $("btnSignup"),
  btnLogout: $("btnLogout"),

  btnInstall: $("btnInstall"),
  btnSettings: $("btnSettings"),
  btnBackup: $("btnBackup"),

  settingsModal: $("settingsModal"),
  closeSettingsModal: $("closeSettingsModal"),
  setSalary: $("setSalary"),
  setMax: $("setMax"),
  setGoal: $("setGoal"),
  btnSaveSettings: $("btnSaveSettings"),
  settingsMsg: $("settingsMsg"),

  monthPickerBtn: $("monthPickerBtn"),
  monthLabel: $("monthLabel"),
  monthModal: $("monthModal"),
  closeMonthModal: $("closeMonthModal"),
  monthInput: $("monthInput"),
  btnGoMonth: $("btnGoMonth"),
  monthQuickList: $("monthQuickList"),
  btnTodayMonth: $("btnTodayMonth"),

  totalBalance: $("totalBalance"),
  monthIncome: $("monthIncome"),
  monthExpense: $("monthExpense"),
  monthNet: $("monthNet"),
  monthUpdated: $("monthUpdated"),

  goalValue: $("goalValue"),
  goalProgress: $("goalProgress"),
  goalBar: $("goalBar"),
  goalPercentChip: $("goalPercentChip"),
  goalCongrats: $("goalCongrats"),

  capMax: $("capMax"),
  capRemaining: $("capRemaining"),
  capBar: $("capBar"),
  capChip: $("capChip"),
  capNotice: $("capNotice"),

  calendar: $("calendar"),
  btnClearDayFilter: $("btnClearDayFilter"),
  dayFilterHint: $("dayFilterHint"),

  searchInput: $("searchInput"),
  sortSelect: $("sortSelect"),
  btnAddExpense: $("btnAddExpense"),
  txnList: $("txnList"),
  emptyTxns: $("emptyTxns"),

  txnModal: $("txnModal"),
  closeTxnModal: $("closeTxnModal"),
  txnModalTitle: $("txnModalTitle"),
  txnDate: $("txnDate"),
  txnAmount: $("txnAmount"),
  txnCategory: $("txnCategory"),
  txnType: $("txnType"),
  txnDesc: $("txnDesc"),
  btnSaveTxn: $("btnSaveTxn"),
  btnDeleteTxn: $("btnDeleteTxn"),
  txnMsg: $("txnMsg"),

  backupModal: $("backupModal"),
  closeBackupModal: $("closeBackupModal"),
  btnExportJSON: $("btnExportJSON"),
  btnExportCSV: $("btnExportCSV"),
  importFile: $("importFile"),
  btnImportJSON: $("btnImportJSON"),
  btnImportDryRun: $("btnImportDryRun"),
  backupMsg: $("backupMsg"),

  chart: $("chart")
};

/* -----------------------------
   6) PWA: Service Worker + Install
-------------------------------- */
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (e) {
    // ما نوقف التطبيق لو فشل
    console.warn("SW register failed", e);
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPromptEvent = e;
  show(el.btnInstall);
});

el.btnInstall.addEventListener("click", async () => {
  if (!state.installPromptEvent) return;
  state.installPromptEvent.prompt();
  try {
    await state.installPromptEvent.userChoice;
  } catch {}
  state.installPromptEvent = null;
  hide(el.btnInstall);
});

/* -----------------------------
   7) Auth
-------------------------------- */
async function doLogin() {
  clearNotice(el.authMsg);
  const email = safeText(el.loginEmail.value);
  const pass = safeText(el.loginPass.value);
  if (!email || !pass) return setNotice(el.authMsg, "اكتب البريد وكلمة المرور.", "warn");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    setNotice(el.authMsg, humanAuthError(e), "danger");
  }
}

async function doSignup() {
  clearNotice(el.authMsg);
  const email = safeText(el.signupEmail.value);
  const pass = safeText(el.signupPass.value);
  if (!email || !pass) return setNotice(el.authMsg, "اكتب البريد وكلمة المرور.", "warn");
  if (pass.length < 8) return setNotice(el.authMsg, "كلمة المرور لازم 8 أحرف أو أكثر.", "warn");

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    setNotice(el.authMsg, humanAuthError(e), "danger");
  }
}

function humanAuthError(e) {
  const code = e?.code || "";
  if (code.includes("auth/invalid-email")) return "البريد غير صحيح.";
  if (code.includes("auth/user-not-found")) return "الحساب غير موجود.";
  if (code.includes("auth/wrong-password")) return "كلمة المرور غير صحيحة.";
  if (code.includes("auth/email-already-in-use")) return "هذا البريد مستخدم مسبقًا.";
  if (code.includes("auth/weak-password")) return "كلمة المرور ضعيفة.";
  if (code.includes("auth/too-many-requests")) return "محاولات كثيرة. جرّب بعد شوي.";
  return "صار خطأ في الدخول/التسجيل.";
}

el.btnLogin.addEventListener("click", doLogin);
el.btnSignup.addEventListener("click", doSignup);

el.btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

/* -----------------------------
   8) Boot: Auth State
-------------------------------- */
onAuthStateChanged(auth, async (user) => {
  state.user = user || null;

  if (!user) {
    // show auth
    hide(el.mainView);
    show(el.authView);
    hide(el.splash);
    return;
  }

  // show main
  hide(el.authView);
  show(el.mainView);
  hide(el.splash);

  // load settings + month
  await ensureUserSettings();
  await openMonth(state.currentMonth, { jumpToToday: true });

  // build month quick list
  renderMonthQuickList();
});

/* -----------------------------
   9) User Settings
-------------------------------- */
async function ensureUserSettings() {
  const uid = state.user.uid;
  const ref = settingsRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initial = {
      salary: 0,
      max: 0,
      goal: 0,
      createdAt: serverTimestamp()
    };
    await setDoc(ref, initial);
    state.settings = { ...initial, createdAt: new Date() };
  } else {
    const data = snap.data();
    state.settings = {
      salary: toInt(data.salary),
      max: toInt(data.max),
      goal: toInt(data.goal),
      createdAt: data.createdAt || null
    };
  }

  // fill modal fields
  el.setSalary.value = String(state.settings.salary || "");
  el.setMax.value = String(state.settings.max || "");
  el.setGoal.value = String(state.settings.goal || "");

  renderDashboard(); // some parts depend on settings
}

async function saveSettings() {
  clearNotice(el.settingsMsg);
  const uid = state.user.uid;

  const salary = toInt(el.setSalary.value);
  const max = toInt(el.setMax.value);
  const goal = toInt(el.setGoal.value);

  try {
    await setDoc(settingsRef(uid), { salary, max, goal }, { merge: true });
    state.settings.salary = salary;
    state.settings.max = max;
    state.settings.goal = goal;

    setNotice(el.settingsMsg, "تم حفظ الإعدادات ✅", "success");

    // salary may affect auto-salary, re-check current month salary
    await ensureMonthDocAndSalary(uid, state.currentMonth);
    await refreshMonthData(uid, state.currentMonth);
    await refreshAllTotals(uid);
    renderDashboard();
  } catch (e) {
    setNotice(el.settingsMsg, "فشل حفظ الإعدادات.", "danger");
  }
}

/* -----------------------------
   10) Months: ensure + open + salary
-------------------------------- */
async function ensureMonthDocAndSalary(uid, monthKey) {
  // Create month doc for existence (optional metadata)
  await setDoc(monthDocRef(uid, monthKey), { updatedAt: serverTimestamp() }, { merge: true });

  // Salary auto-add: txn id ثابت "salary" يمنع التكرار
  const salaryAmount = toInt(state.settings.salary);
  if (salaryAmount <= 0) return;

  const salaryTxnId = "salary";
  const ref = txnRef(uid, monthKey, salaryTxnId);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // already added

  const salaryTxn = {
    type: "income",
    amount: salaryAmount,
    date: firstDayOfMonth(monthKey),
    category: "راتب",
    desc: "الراتب الشهري (تلقائي)",
    createdAt: serverTimestamp()
  };
  await setDoc(ref, salaryTxn);
}

async function openMonth(monthKey, opts = {}) {
  const uid = state.user.uid;
  state.currentMonth = monthKey;

  // ensure month + salary
  await ensureMonthDocAndSalary(uid, monthKey);

  // refresh month transactions + summary
  await refreshMonthData(uid, monthKey);

  // refresh global totals (using summaries)
  await refreshAllTotals(uid);

  // UI
  el.monthLabel.textContent = monthNameMaghrebFR(monthKey);
  el.monthInput.value = monthKey;

  if (opts.jumpToToday) {
    state.dayFilter = null;
    hide(el.btnClearDayFilter);
  }

  renderDashboard();
  renderCalendar();
  renderTransactions();
  renderChart();
}

async function refreshMonthData(uid, monthKey) {
  // Load txns for this month
  const q = query(monthTxnsCol(uid, monthKey), orderBy("date", "desc"));
  const snap = await getDocs(q);
  state.currentTxns = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Recompute summary and store (مخزن وليس محسوب كل مرة من UI)
  const summary = computeMonthSummary(state.currentTxns);
  summary.updatedAt = serverTimestamp();

  await setDoc(monthSummaryRef(uid, monthKey), summary, { merge: true });

  state.currentMonthSummary = { ...summary, updatedAt: new Date() };
}

function computeMonthSummary(txns) {
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const t of txns) {
    const amt = Number(t.amount) || 0;
    if (t.type === "income") incomeTotal += amt;
    if (t.type === "expense") expenseTotal += amt;
  }
  const net = incomeTotal - expenseTotal;

  const max = toInt(state.settings.max);
  const capUsedPercent = max > 0 ? (expenseTotal / max) * 100 : 0;

  return {
    incomeTotal: Math.floor(incomeTotal),
    expenseTotal: Math.floor(expenseTotal),
    net: Math.floor(net),
    capUsedPercent: Math.round(capUsedPercent * 10) / 10
  };
}

async function refreshAllTotals(uid) {
  // Sum all month summaries to get totals across all time
  // This scales decently; if user has many months, still acceptable for PWA personal.
  const monthsCol = collection(db, `${userBase(uid)}/months`);
  const monthsSnap = await getDocs(monthsCol);

  let incomeAll = 0;
  let expenseAll = 0;

  for (const mdoc of monthsSnap.docs) {
    const monthKey = mdoc.id;
    const sRef = monthSummaryRef(uid, monthKey);
    const sSnap = await getDoc(sRef);
    if (!sSnap.exists()) continue;
    const s = sSnap.data();
    incomeAll += Number(s.incomeTotal) || 0;
    expenseAll += Number(s.expenseTotal) || 0;
  }

  state.totalsAll.incomeAll = Math.floor(incomeAll);
  state.totalsAll.expenseAll = Math.floor(expenseAll);
  state.totalsAll.balanceAll = Math.floor(incomeAll - expenseAll);
}

/* -----------------------------
   11) Transactions CRUD
-------------------------------- */
let editingTxnId = null;

function openTxnModalAdd() {
  editingTxnId = null;
  el.txnModalTitle.textContent = "إضافة صرف";
  el.txnType.value = "expense";
  el.txnDate.value = nowISODate().slice(0, 7) === state.currentMonth ? nowISODate() : firstDayOfMonth(state.currentMonth);
  el.txnAmount.value = "";
  el.txnCategory.value = "أكل";
  el.txnDesc.value = "";
  hide(el.btnDeleteTxn);
  clearNotice(el.txnMsg);
  show(el.txnModal);
}

function openTxnModalEdit(txnId) {
  const t = state.currentTxns.find(x => x.id === txnId);
  if (!t) return;

  editingTxnId = txnId;
  el.txnModalTitle.textContent = (t.type === "income") ? "تفاصيل الدخل" : "تعديل صرف";
  el.txnType.value = t.type || "expense";
  el.txnDate.value = t.date || firstDayOfMonth(state.currentMonth);
  el.txnAmount.value = String(Number(t.amount) || 0);
  el.txnCategory.value = t.category || "أخرى";
  el.txnDesc.value = t.desc || "";

  // لا نسمح بتعديل الراتب التلقائي داخل UI (حسب المطلوب)
  const isSalary = (t.type === "income" && t.category === "راتب" && t.id === "salary");
  if (isSalary) {
    el.txnAmount.disabled = true;
    el.txnDate.disabled = true;
    el.txnCategory.disabled = true;
    el.txnDesc.disabled = true;
    hide(el.btnDeleteTxn);
    setNotice(el.txnMsg, "هذا الراتب تلقائي (ما ينعدل من هنا). عدّل الراتب من الإعدادات.", "warn");
  } else {
    el.txnAmount.disabled = false;
    el.txnDate.disabled = false;
    el.txnCategory.disabled = false;
    el.txnDesc.disabled = false;
    show(el.btnDeleteTxn);
    clearNotice(el.txnMsg);
  }

  show(el.txnModal);
}

async function saveTxn() {
  clearNotice(el.txnMsg);

  const uid = state.user.uid;
  const monthKey = state.currentMonth;

  const date = safeText(el.txnDate.value);
  const amount = toInt(el.txnAmount.value);
  const category = safeText(el.txnCategory.value) || "أخرى";
  const desc = safeText(el.txnDesc.value);
  const type = "expense"; // UI only expense

  if (!date || !date.startsWith(monthKey)) {
    return setNotice(el.txnMsg, "اختَر تاريخ داخل نفس الشهر المختار.", "warn");
  }
  if (amount <= 0) return setNotice(el.txnMsg, "اكتب مبلغ صحيح أكبر من 0.", "warn");

  const payload = {
    type,
    amount,
    date,
    category,
    desc,
    createdAt: serverTimestamp()
  };

  try {
    if (!editingTxnId) {
      await addDoc(monthTxnsCol(uid, monthKey), payload);
    } else {
      // Update via setDoc merge
      await setDoc(txnRef(uid, monthKey, editingTxnId), payload, { merge: true });
    }

    // Update month summary (recompute & store)
    await refreshMonthData(uid, monthKey);
    await refreshAllTotals(uid);

    // Close modal
    hide(el.txnModal);

    // Re-render
    renderDashboard();
    renderCalendar();
    renderTransactions();
    renderChart();
  } catch (e) {
    setNotice(el.txnMsg, "فشل الحفظ. تأكد من الاتصال.", "danger");
  }
}

async function deleteTxn() {
  clearNotice(el.txnMsg);
  if (!editingTxnId) return;

  const uid = state.user.uid;
  const monthKey = state.currentMonth;

  // منع حذف الراتب
  if (editingTxnId === "salary") {
    return setNotice(el.txnMsg, "ما تقدر تحذف الراتب التلقائي.", "warn");
  }

  try {
    await deleteDoc(txnRef(uid, monthKey, editingTxnId));
    await refreshMonthData(uid, monthKey);
    await refreshAllTotals(uid);

    hide(el.txnModal);

    renderDashboard();
    renderCalendar();
    renderTransactions();
    renderChart();
  } catch (e) {
    setNotice(el.txnMsg, "فشل الحذف. تأكد من الاتصال.", "danger");
  }
}

/* -----------------------------
   12) Dashboard Render
-------------------------------- */
function renderDashboard() {
  // total balance
  el.totalBalance.textContent = fmtDZD(state.totalsAll.balanceAll);

  // month summary
  const s = state.currentMonthSummary;
  el.monthIncome.textContent = fmtDZD(s.incomeTotal || 0);
  el.monthExpense.textContent = fmtDZD(s.expenseTotal || 0);

  const net = Number(s.net) || 0;
  el.monthNet.textContent = fmtDZD(net);
  el.monthNet.style.color = net >= 0 ? "var(--good)" : "var(--bad)";
  el.monthUpdated.textContent = "آخر تحديث: " + new Date().toLocaleString("ar-DZ");

  // Goal progress
  const goal = toInt(state.settings.goal);
  const progress = Math.max(0, state.totalsAll.balanceAll);
  el.goalValue.textContent = fmtDZD(goal);
  el.goalProgress.textContent = fmtDZD(progress);

  let pct = 0;
  if (goal > 0) pct = clamp((progress / goal) * 100, 0, 999);
  const pctShow = (goal > 0) ? (Math.round(pct * 10) / 10) : 0;

  el.goalPercentChip.textContent = (goal > 0) ? `${pctShow}%` : "اضبط الهدف";
  el.goalBar.style.width = clamp(pct, 0, 100) + "%";

  if (goal > 0 && progress >= goal) {
    setNotice(el.goalCongrats, "مبروك! وصلت هدفك 100% 🎉🚀", "success");
  } else {
    hide(el.goalCongrats);
  }

  // Cap logic (max monthly spending)
  const max = toInt(state.settings.max);
  const expense = Number(s.expenseTotal) || 0;

  el.capMax.textContent = fmtDZD(max);
  const remaining = max - expense;
  el.capRemaining.textContent = fmtDZD(remaining);
  el.capRemaining.style.color = remaining >= 0 ? "var(--text)" : "var(--bad)";

  const capPct = (max > 0) ? clamp((expense / max) * 100, 0, 999) : 0;
  el.capBar.style.width = clamp(capPct, 0, 100) + "%";
  el.capChip.textContent = (max > 0) ? `${Math.round(capPct)}%` : "حدد الماكس";

  // Alerts per spec
  if (max > 0 && expense >= max) {
    setNotice(el.capNotice, "توقف ✋ وصلت/تجاوزت الحد الشهري", "danger");
  } else if (max > 0 && expense >= 0.8 * max) {
    setNotice(el.capNotice, "تنبيه: اقتراب من الحد (80%)", "warn");
  } else {
    hide(el.capNotice);
  }
}

/* -----------------------------
   13) Month Picker UI
-------------------------------- */
function renderMonthQuickList() {
  // last 12 months quick buttons (including current)
  el.monthQuickList.innerHTML = "";
  const base = new Date();
  const items = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    items.push(mk);
  }

  for (const mk of items) {
    const btn = document.createElement("button");
    btn.className = "btn ghost";
    btn.textContent = monthNameMaghrebFR(mk);
    btn.addEventListener("click", async () => {
      hide(el.monthModal);
      state.dayFilter = null;
      hide(el.btnClearDayFilter);
      await openMonth(mk);
    });
    el.monthQuickList.appendChild(btn);
  }
}

el.monthPickerBtn.addEventListener("click", () => {
  el.monthInput.value = state.currentMonth;
  show(el.monthModal);
});
$("closeMonthModal").addEventListener("click", () => hide(el.monthModal));
$("btnGoMonth").addEventListener("click", async () => {
  const mk = safeText(el.monthInput.value);
  if (!mk || mk.length !== 7) return;
  hide(el.monthModal);
  state.dayFilter = null;
  hide(el.btnClearDayFilter);
  await openMonth(mk);
});
el.btnTodayMonth.addEventListener("click", async () => {
  const mk = monthKeyFromDateISO(nowISODate());
  state.dayFilter = null;
  hide(el.btnClearDayFilter);
  await openMonth(mk, { jumpToToday: true });
});

/* -----------------------------
   14) Calendar
-------------------------------- */
function renderCalendar() {
  const monthKey = state.currentMonth;
  const [yy, mm] = monthKey.split("-").map(Number);
  const first = new Date(yy, mm - 1, 1);
  const last = new Date(yy, mm, 0);
  const daysInMonth = last.getDate();

  // Start day (Mon-first for nicer Maghreb feel)
  // JS getDay(): Sun=0..Sat=6
  const startDay = (first.getDay() + 6) % 7; // shift so Mon=0

  // aggregate totals per day
  const perDay = new Map(); // date -> {income, expense}
  for (const t of state.currentTxns) {
    const date = t.date;
    if (!date || !date.startsWith(monthKey)) continue;
    if (!perDay.has(date)) perDay.set(date, { income: 0, expense: 0 });
    const agg = perDay.get(date);
    const amt = Number(t.amount) || 0;
    if (t.type === "income") agg.income += amt;
    if (t.type === "expense") agg.expense += amt;
  }

  const weekDays = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

  el.calendar.innerHTML = "";
  const head = document.createElement("div");
  head.className = "cal-head";
  for (const w of weekDays) {
    const c = document.createElement("div");
    c.className = "cal-w";
    c.textContent = w;
    head.appendChild(c);
  }
  el.calendar.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "cal-grid";

  // blanks
  for (let i = 0; i < startDay; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-cell muted-cell";
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${monthKey}-${String(d).padStart(2, "0")}`;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-cell";
    if (state.dayFilter === dateISO) cell.classList.add("selected");

    const top = document.createElement("div");
    top.className = "cal-day";
    top.textContent = String(d);

    const badge = document.createElement("div");
    badge.className = "cal-badge";

    const agg = perDay.get(dateISO);
    if (agg) {
      const exp = Math.floor(agg.expense);
      const inc = Math.floor(agg.income);
      // show small indicator: prefer expense
      if (exp > 0) {
        badge.textContent = `−${new Intl.NumberFormat("fr-DZ").format(exp)}`;
        badge.classList.add("bad");
      } else if (inc > 0) {
        badge.textContent = `+${new Intl.NumberFormat("fr-DZ").format(inc)}`;
        badge.classList.add("good");
      }
    } else {
      badge.textContent = "";
    }

    cell.appendChild(top);
    cell.appendChild(badge);

    cell.addEventListener("click", () => {
      state.dayFilter = (state.dayFilter === dateISO) ? null : dateISO;
      if (state.dayFilter) show(el.btnClearDayFilter);
      else hide(el.btnClearDayFilter);

      renderCalendar();
      renderTransactions();
    });

    grid.appendChild(cell);
  }

  el.calendar.appendChild(grid);

  // hint
  if (state.dayFilter) {
    el.dayFilterHint.textContent = `فلتر اليوم: ${state.dayFilter}`;
  } else {
    el.dayFilterHint.textContent = "اضغط على يوم لفلترة العمليات";
  }
}

el.btnClearDayFilter.addEventListener("click", () => {
  state.dayFilter = null;
  hide(el.btnClearDayFilter);
  renderCalendar();
  renderTransactions();
});

/* -----------------------------
   15) Transactions List (Search + Sort + Filter)
-------------------------------- */
function getVisibleTxns() {
  let txns = [...state.currentTxns];

  // apply day filter
  if (state.dayFilter) {
    txns = txns.filter(t => t.date === state.dayFilter);
  }

  // search
  const q = safeText(el.searchInput.value).toLowerCase();
  if (q) {
    txns = txns.filter(t => {
      const s = [
        t.desc,
        t.category,
        t.date,
        String(t.amount ?? "")
      ].join(" ").toLowerCase();
      return s.includes(q);
    });
  }

  // sort
  const sort = el.sortSelect.value;
  if (sort === "newest") {
    txns.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } else if (sort === "oldest") {
    txns.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  } else if (sort === "amount_desc") {
    txns.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  } else if (sort === "amount_asc") {
    txns.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
  }

  return txns;
}

function renderTransactions() {
  const txns = getVisibleTxns();
  el.txnList.innerHTML = "";

  if (txns.length === 0) {
    show(el.emptyTxns);
    return;
  }
  hide(el.emptyTxns);

  for (const t of txns) {
    const row = document.createElement("div");
    row.className = "txn";

    const left = document.createElement("div");
    left.className = "txn-left";

    const title = document.createElement("div");
    title.className = "txn-title";
    title.textContent = t.desc ? t.desc : (t.type === "income" ? "دخل" : "صرف");

    const meta = document.createElement("div");
    meta.className = "txn-meta";
    meta.textContent = `${t.date || ""} • ${t.category || "—"}`;

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "txn-right";

    const amt = document.createElement("div");
    const sign = (t.type === "income") ? "+" : "−";
    amt.className = "txn-amt " + (t.type === "income" ? "good" : "bad");
    amt.textContent = `${sign}${new Intl.NumberFormat("fr-DZ").format(Number(t.amount) || 0)} دج`;

    const btn = document.createElement("button");
    btn.className = "btn mini ghost";
    btn.textContent = "تفاصيل";
    btn.addEventListener("click", () => openTxnModalEdit(t.id));

    right.appendChild(amt);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);

    el.txnList.appendChild(row);
  }
}

el.searchInput.addEventListener("input", () => renderTransactions());
el.sortSelect.addEventListener("change", () => renderTransactions());

/* -----------------------------
   16) Chart: Expense by Category (Canvas)
-------------------------------- */
function renderChart() {
  const canvas = el.chart;
  const ctx = canvas.getContext("2d");

  // handle retina
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 800;
  const cssH = canvas.clientHeight || 420;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // data (only expenses)
  const txns = state.currentTxns.filter(t => t.type === "expense");
  const agg = new Map(); // cat -> total
  for (const t of txns) {
    const cat = t.category || "أخرى";
    const amt = Number(t.amount) || 0;
    agg.set(cat, (agg.get(cat) || 0) + amt);
  }

  const entries = [...agg.entries()].sort((a, b) => b[1] - a[1]);
  const maxBars = 6;
  const data = entries.slice(0, maxBars);

  // clear
  ctx.clearRect(0, 0, cssW, cssH);

  // background grid
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  for (let y = 40; y < cssH; y += 40) {
    ctx.moveTo(20, y);
    ctx.lineTo(cssW - 20, y);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // empty
  if (data.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "16px system-ui";
    ctx.fillText("ما فيه صرف كفاية لرسم الرسم البياني.", 20, 40);
    return;
  }

  const maxVal = Math.max(...data.map(x => x[1]), 1);

  const pad = 20;
  const chartW = cssW - pad * 2;
  const chartH = cssH - pad * 2 - 30;

  const barH = Math.max(18, Math.floor(chartH / (data.length * 1.3)));
  const gap = Math.floor(barH * 0.45);

  ctx.font = "14px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.9)";

  let y = pad + 20;
  for (const [cat, val] of data) {
    const w = Math.floor((val / maxVal) * (chartW * 0.72));
    // bar
    ctx.fillStyle = "rgba(124, 92, 255, 0.75)";
    ctx.fillRect(pad, y, w, barH);

    // labels
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(cat, pad, y - 6);

    const text = `−${new Intl.NumberFormat("fr-DZ").format(Math.floor(val))} دج`;
    ctx.fillText(text, pad + w + 10, y + Math.floor(barH * 0.72));

    y += barH + gap;
  }
}

/* -----------------------------
   17) Backup: Export/Import JSON + Export CSV
-------------------------------- */
async function exportJSON() {
  clearNotice(el.backupMsg);
  const uid = state.user.uid;

  try {
    // settings
    const sSnap = await getDoc(settingsRef(uid));
    const settings = sSnap.exists() ? sSnap.data() : {};

    // months list
    const monthsCol = collection(db, `${userBase(uid)}/months`);
    const monthsSnap = await getDocs(monthsCol);

    const months = {};
    for (const m of monthsSnap.docs) {
      const mk = m.id;

      const sumSnap = await getDoc(monthSummaryRef(uid, mk));
      const summary = sumSnap.exists() ? sumSnap.data() : null;

      const txSnap = await getDocs(query(monthTxnsCol(uid, mk), orderBy("date", "asc")));
      const txns = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      months[mk] = { summary, transactions: txns };
    }

    const payload = {
      app: "MyGoal",
      exportedAt: new Date().toISOString(),
      settings,
      months
    };

    downloadText(`mygoal-backup-${uid}-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setNotice(el.backupMsg, "تم تصدير JSON ✅", "success");
  } catch (e) {
    setNotice(el.backupMsg, "فشل التصدير. تأكد من الاتصال.", "danger");
  }
}

function exportCSVCurrentMonth() {
  const monthKey = state.currentMonth;
  const rows = [["id","type","amount","date","category","desc"]];

  for (const t of state.currentTxns) {
    rows.push([
      t.id,
      t.type,
      String(Number(t.amount) || 0),
      t.date || "",
      (t.category || "").replaceAll('"', '""'),
      (t.desc || "").replaceAll('"', '""')
    ]);
  }

  const csv = rows.map(r => r.map(x => `"${String(x ?? "")}"`).join(",")).join("\n");
  downloadText(`mygoal-${monthKey}.csv`, csv, "text/csv;charset=utf-8");
}

function readImportFile() {
  const f = el.importFile.files?.[0];
  if (!f) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || "{}"));
        resolve(obj);
      } catch (e) {
        reject(new Error("JSON_PARSE"));
      }
    };
    reader.onerror = () => reject(new Error("FILE_READ"));
    reader.readAsText(f, "utf-8");
  });
}

function validateBackup(obj) {
  if (!obj || typeof obj !== "object") return "الملف غير صالح.";
  if (obj.app !== "MyGoal") return "هذا الملف مو ملف MyGoal.";
  if (!obj.months || typeof obj.months !== "object") return "الملف ناقص (months).";
  return null;
}

async function importJSON({ dryRun = false } = {}) {
  clearNotice(el.backupMsg);

  let obj;
  try {
    obj = await readImportFile();
  } catch (e) {
    return setNotice(el.backupMsg, "ما قدرت أقرأ الملف أو JSON مو صحيح.", "danger");
  }

  const err = validateBackup(obj);
  if (err) return setNotice(el.backupMsg, err, "danger");

  if (dryRun) {
    const monthsCount = Object.keys(obj.months).length;
    return setNotice(el.backupMsg, `✅ الملف سليم. عدد الشهور داخل النسخة: ${monthsCount}`, "success");
  }

  const uid = state.user.uid;

  try {
    // settings
    if (obj.settings && typeof obj.settings === "object") {
      const salary = toInt(obj.settings.salary);
      const max = toInt(obj.settings.max);
      const goal = toInt(obj.settings.goal);
      await setDoc(settingsRef(uid), { salary, max, goal }, { merge: true });
      state.settings.salary = salary;
      state.settings.max = max;
      state.settings.goal = goal;
    }

    // months
    for (const [mk, data] of Object.entries(obj.months)) {
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;

      await setDoc(monthDocRef(uid, mk), { updatedAt: serverTimestamp() }, { merge: true });

      // transactions
      const txns = Array.isArray(data?.transactions) ? data.transactions : [];
      for (const t of txns) {
        const id = safeText(t.id);
        if (!id) continue;
        const payload = {
          type: (t.type === "income" ? "income" : "expense"),
          amount: toInt(t.amount),
          date: safeText(t.date),
          category: safeText(t.category) || "أخرى",
          desc: safeText(t.desc),
          createdAt: serverTimestamp()
        };
        await setDoc(txnRef(uid, mk, id), payload, { merge: true });
      }

      // summary (recompute to be consistent)
      // load month txns and recompute
      const q = query(monthTxnsCol(uid, mk), orderBy("date", "desc"));
      const snap = await getDocs(q);
      const txNow = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const summary = computeMonthSummary(txNow);
      summary.updatedAt = serverTimestamp();
      await setDoc(monthSummaryRef(uid, mk), summary, { merge: true });
    }

    setNotice(el.backupMsg, "تم الاستيراد ✅", "success");

    // reload current context
    await ensureUserSettings();
    await openMonth(state.currentMonth, { jumpToToday: false });
  } catch (e) {
    setNotice(el.backupMsg, "فشل الاستيراد. تأكد من الاتصال.", "danger");
  }
}

/* -----------------------------
   18) Modals + Buttons
-------------------------------- */
function setupModalClose(modalEl, closeBtnEl) {
  const backdrop = modalEl.querySelector(".modal-backdrop");
  backdrop.addEventListener("click", () => hide(modalEl));
  closeBtnEl.addEventListener("click", () => hide(modalEl));
}

setupModalClose(el.settingsModal, el.closeSettingsModal);
setupModalClose(el.monthModal, el.closeMonthModal);
setupModalClose(el.txnModal, el.closeTxnModal);
setupModalClose(el.backupModal, el.closeBackupModal);

el.btnSettings.addEventListener("click", () => {
  clearNotice(el.settingsMsg);
  el.setSalary.value = String(state.settings.salary || "");
  el.setMax.value = String(state.settings.max || "");
  el.setGoal.value = String(state.settings.goal || "");
  show(el.settingsModal);
});

el.btnSaveSettings.addEventListener("click", saveSettings);

el.btnAddExpense.addEventListener("click", openTxnModalAdd);
el.btnSaveTxn.addEventListener("click", saveTxn);
el.btnDeleteTxn.addEventListener("click", deleteTxn);

el.btnBackup.addEventListener("click", () => {
  clearNotice(el.backupMsg);
  el.importFile.value = "";
  show(el.backupModal);
});

el.btnExportJSON.addEventListener("click", exportJSON);
el.btnExportCSV.addEventListener("click", exportCSVCurrentMonth);
el.btnImportDryRun.addEventListener("click", () => importJSON({ dryRun: true }));
el.btnImportJSON.addEventListener("click", () => importJSON({ dryRun: false }));

/* -----------------------------
   19) Initial
-------------------------------- */
await registerSW();

// in case already logged in, UI will switch via onAuthStateChanged
// keep splash for a short moment (no timers required)