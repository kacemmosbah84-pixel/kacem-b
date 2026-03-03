/* MyGoal / kacem-b — Vanilla JS + Firebase Auth + Firestore
   ✅ Online First: كل شيء في Firestore
   ✅ متوافق مع index.html الحالي (loginCard/homeArea/... إلخ)
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
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* -----------------------------
   1) Firebase Config (لازم تعبيها)
-------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAY0UUup62U68r2Hv1mS6ffX4ZjSmvcOqQ",
  authDomain: "kacem-b.firebaseapp.com",
  projectId: "kacem-b",
  storageBucket: "kacem-b.firebasestorage.app",
  messagingSenderId: "25625777376",
  appId: "1:25625777376:web:3fa483d33191faaeb86c85"
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

function safeText(s) {
  return String(s ?? "").trim();
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
  return dateISO.slice(0, 7); // YYYY-MM
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

function showEl(el, display = "block") {
  if (!el) return;
  el.style.display = display;
}
function hideEl(el) {
  if (!el) return;
  el.style.display = "none";
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/* -----------------------------
   3) Firestore Paths
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
   4) UI (IDs من index.html حقك)
-------------------------------- */
const ui = {
  // auth
  loginCard: $("loginCard"),
  loginUser: $("loginUser"),
  loginPass: $("loginPass"),
  btnLogin: $("btnLogin"),
  btnSignup: $("btnSignup"),
  loginHint: $("loginHint"),

  // main
  homeArea: $("homeArea"),
  whoAmI: $("whoAmI"),
  monthLabel: $("monthLabel"),

  btnInstall: $("btnInstall"),
  btnSettings: $("btnSettings"),
  btnBackup: $("btnBackup"),
  btnLogout: $("btnLogout"),

  // summary KPI
  kpiSalary: $("kpiSalary"),
  kpiMax: $("kpiMax"),
  kpiTotal: $("kpiTotal"),
  kpiRemain: $("kpiRemain"),
  nearAlert: $("nearAlert"),
  stopAlert: $("stopAlert"),
  btnAdd: $("btnAdd"),

  // month nav
  prevMonth: $("prevMonth"),
  nextMonth: $("nextMonth"),
  todayBtn: $("todayBtn"),

  // calendar
  calGrid: $("calGrid"),
  dayHint: $("dayHint"),

  // txns
  listArea: $("listArea"),
  searchBox: $("searchBox"),
  filterCat: $("filterCat"),

  // add/edit modal
  modalBack: $("modalBack"),
  modalClose: $("modalClose"),
  modalCancel: $("modalCancel"),
  modalSave: $("modalSave"),
  fDate: $("fDate"),
  fAmt: $("fAmt"),
  fCat: $("fCat"),
  fDesc: $("fDesc"),

  // settings modal
  settingsBack: $("settingsBack"),
  settingsClose: $("settingsClose"),
  settingsSave: $("settingsSave"),
  sSalary: $("sSalary"),
  sMax: $("sMax"),

  // backup modal
  backupBack: $("backupBack"),
  backupClose: $("backupClose"),
  backupText: $("backupText"),
  backupRefresh: $("backupRefresh"),
  backupImport: $("backupImport"),
  backupCSV: $("backupCSV"),

  // charts
  chartCat: $("chartCat"),
  chartDays: $("chartDays"),
};

/* -----------------------------
   5) State
-------------------------------- */
const state = {
  user: null,
  settings: { salary: 0, max: 0, goal: 0 },
  currentMonth: monthKeyFromDateISO(nowISODate()),
  currentTxns: [],
  dayFilter: null, // YYYY-MM-DD
  installPromptEvent: null
};

let editingTxnId = null; // null => add, otherwise edit

/* -----------------------------
   6) PWA: Install button
-------------------------------- */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPromptEvent = e;
  showEl(ui.btnInstall, "inline-block");
});

ui.btnInstall?.addEventListener("click", async () => {
  if (!state.installPromptEvent) return;
  state.installPromptEvent.prompt();
  try { await state.installPromptEvent.userChoice; } catch {}
  state.installPromptEvent = null;
  hideEl(ui.btnInstall);
});

/* -----------------------------
   7) Auth
-------------------------------- */
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

async function doLogin() {
  ui.loginHint.textContent = "";
  const email = safeText(ui.loginUser.value);
  const pass = safeText(ui.loginPass.value);
  if (!email || !pass) {
    ui.loginHint.textContent = "اكتب البريد وكلمة المرور.";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    ui.loginHint.textContent = humanAuthError(e);
  }
}

async function doSignup() {
  ui.loginHint.textContent = "";
  const email = safeText(ui.loginUser.value);
  const pass = safeText(ui.loginPass.value);
  if (!email || !pass) {
    ui.loginHint.textContent = "اكتب البريد وكلمة المرور.";
    return;
  }
  // ✅ توافق واجهتك (6+)
  if (pass.length < 6) {
    ui.loginHint.textContent = "كلمة المرور لازم 6 أحرف أو أكثر.";
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    ui.loginHint.textContent = humanAuthError(e);
  }
}

ui.btnLogin?.addEventListener("click", doLogin);
ui.btnSignup?.addEventListener("click", doSignup);

ui.btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
});

/* -----------------------------
   8) Settings (salary/max)
-------------------------------- */
async function ensureUserSettings() {
  const uid = state.user.uid;
  const ref = settingsRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initial = { salary: 0, max: 0, goal: 0, createdAt: serverTimestamp() };
    await setDoc(ref, initial);
    state.settings.salary = 0;
    state.settings.max = 0;
    state.settings.goal = 0;
  } else {
    const d = snap.data() || {};
    state.settings.salary = toInt(d.salary);
    state.settings.max = toInt(d.max);
    state.settings.goal = toInt(d.goal);
  }

  ui.sSalary.value = String(state.settings.salary || "");
  ui.sMax.value = String(state.settings.max || "");
}

async function saveSettings() {
  const uid = state.user.uid;
  const salary = toInt(ui.sSalary.value);
  const max = toInt(ui.sMax.value);

  await setDoc(settingsRef(uid), { salary, max }, { merge: true });
  state.settings.salary = salary;
  state.settings.max = max;

  // تأكد من الراتب التلقائي بعد تغيير الراتب
  await ensureMonthDocAndSalary(uid, state.currentMonth);
  await refreshMonth(uid, state.currentMonth);

  hideEl(ui.settingsBack);
}

ui.btnSettings?.addEventListener("click", async () => {
  ui.sSalary.value = String(state.settings.salary || "");
  ui.sMax.value = String(state.settings.max || "");
  showEl(ui.settingsBack, "flex");
});
ui.settingsClose?.addEventListener("click", () => hideEl(ui.settingsBack));
ui.settingsSave?.addEventListener("click", saveSettings);

/* -----------------------------
   9) Months + Salary auto
-------------------------------- */
async function ensureMonthDocAndSalary(uid, monthKey) {
  // month doc metadata
  await setDoc(monthDocRef(uid, monthKey), { updatedAt: serverTimestamp() }, { merge: true });

  // salary auto txn with fixed id "salary"
  const salaryAmount = toInt(state.settings.salary);
  if (salaryAmount <= 0) return;

  const ref = txnRef(uid, monthKey, "salary");
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    type: "income",
    amount: salaryAmount,
    date: firstDayOfMonth(monthKey),
    category: "راتب",
    desc: "الراتب الشهري (تلقائي)",
    createdAt: serverTimestamp()
  });
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
    capUsedPercent: Math.round(capUsedPercent * 10) / 10,
    updatedAt: serverTimestamp()
  };
}

async function refreshMonth(uid, monthKey) {
  // load txns
  const qy = query(monthTxnsCol(uid, monthKey), orderBy("date", "desc"));
  const snap = await getDocs(qy);
  state.currentTxns = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // store summary
  const summary = computeMonthSummary(state.currentTxns);
  await setDoc(monthSummaryRef(uid, monthKey), summary, { merge: true });

  // render
  ui.monthLabel.textContent = monthNameMaghrebFR(monthKey);
  renderSummary(summary);
  renderCalendar();
  renderTransactions();
  renderCharts();
}

function moveMonth(delta) {
  const [yy, mm] = state.currentMonth.split("-").map(Number);
  const d = new Date(yy, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

ui.prevMonth?.addEventListener("click", async () => {
  const uid = state.user.uid;
  state.currentMonth = moveMonth(-1);
  state.dayFilter = null;
  await ensureMonthDocAndSalary(uid, state.currentMonth);
  await refreshMonth(uid, state.currentMonth);
});

ui.nextMonth?.addEventListener("click", async () => {
  const uid = state.user.uid;
  state.currentMonth = moveMonth(+1);
  state.dayFilter = null;
  await ensureMonthDocAndSalary(uid, state.currentMonth);
  await refreshMonth(uid, state.currentMonth);
});

ui.todayBtn?.addEventListener("click", async () => {
  const uid = state.user.uid;
  state.currentMonth = monthKeyFromDateISO(nowISODate());
  state.dayFilter = null;
  await ensureMonthDocAndSalary(uid, state.currentMonth);
  await refreshMonth(uid, state.currentMonth);
});

/* -----------------------------
   10) Summary UI (kpiSalary/kpiMax/kpiTotal/kpiRemain + alerts)
-------------------------------- */
function renderSummary(summary) {
  const salary = toInt(state.settings.salary);
  const max = toInt(state.settings.max);

  ui.kpiSalary.textContent = fmtDZD(salary);
  ui.kpiMax.textContent = fmtDZD(max);

  const expense = Number(summary?.expenseTotal) || 0;
  ui.kpiTotal.textContent = fmtDZD(expense);

  const remain = max - expense;
  ui.kpiRemain.textContent = fmtDZD(remain);
  ui.kpiRemain.style.color = remain < 0 ? "rgba(255,90,90,0.95)" : "";

  // alerts
  hideEl(ui.nearAlert);
  hideEl(ui.stopAlert);

  if (max > 0 && expense >= max) {
    showEl(ui.stopAlert, "block");
  } else if (max > 0 && expense >= 0.8 * max) {
    showEl(ui.nearAlert, "block");
  }
}

/* -----------------------------
   11) Calendar (calGrid) + day filter
-------------------------------- */
function renderCalendar() {
  const monthKey = state.currentMonth;
  const [yy, mm] = monthKey.split("-").map(Number);

  const first = new Date(yy, mm - 1, 1);
  const last = new Date(yy, mm, 0);
  const daysInMonth = last.getDate();

  // In your UI: header starts Saturday..Friday
  // JS getDay(): Sun=0..Sat=6
  // For Saturday-first grid, shift so Sat=0:
  const startDay = (first.getDay() + 1) % 7; // Sat=0, Sun=1, ... Fri=6

  // aggregate per day
  const perDay = new Map();
  for (const t of state.currentTxns) {
    const date = t.date;
    if (!date || !date.startsWith(monthKey)) continue;
    if (!perDay.has(date)) perDay.set(date, { income: 0, expense: 0 });
    const agg = perDay.get(date);
    const amt = Number(t.amount) || 0;
    if (t.type === "income") agg.income += amt;
    if (t.type === "expense") agg.expense += amt;
  }

  ui.calGrid.innerHTML = "";

  // blanks
  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement("div");
    blank.className = "calCell mutedCell";
    ui.calGrid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${monthKey}-${String(d).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "calCell";
    if (state.dayFilter === dateISO) cell.classList.add("active");

    const day = document.createElement("div");
    day.className = "calDay";
    day.textContent = String(d);

    const sum = document.createElement("div");
    sum.className = "calSum";

    const agg = perDay.get(dateISO);
    if (agg) {
      const exp = Math.floor(agg.expense);
      const inc = Math.floor(agg.income);
      if (exp > 0) sum.textContent = `−${new Intl.NumberFormat("fr-DZ").format(exp)}`;
      else if (inc > 0) sum.textContent = `+${new Intl.NumberFormat("fr-DZ").format(inc)}`;
      else sum.textContent = "";
    } else {
      sum.textContent = "";
    }

    cell.appendChild(day);
    cell.appendChild(sum);

    cell.addEventListener("click", () => {
      state.dayFilter = (state.dayFilter === dateISO) ? null : dateISO;
      renderCalendar();
      renderTransactions();
    });

    ui.calGrid.appendChild(cell);
  }

  ui.dayHint.textContent = state.dayFilter
    ? `فلترة اليوم: ${state.dayFilter} (اضغط مرة ثانية لإلغاء)`
    : "اضغط على يوم لفلترة العمليات";
}

/* -----------------------------
   12) Transactions (Add/Edit/Delete) + Search + Category filter
-------------------------------- */
function visibleTxns() {
  let txns = [...state.currentTxns];

  // day filter
  if (state.dayFilter) {
    txns = txns.filter(t => t.date === state.dayFilter);
  }

  // category filter
  const cat = safeText(ui.filterCat.value);
  if (cat) {
    txns = txns.filter(t => (t.category || "") === cat);
  }

  // search
  const q = safeText(ui.searchBox.value).toLowerCase();
  if (q) {
    txns = txns.filter(t => {
      const hay = [
        t.desc, t.category, t.date, String(t.amount ?? "")
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  // keep newest first (already from query orderBy desc)
  return txns;
}

function openModalAdd() {
  editingTxnId = null;
  ui.fDate.value = nowISODate().startsWith(state.currentMonth) ? nowISODate() : firstDayOfMonth(state.currentMonth);
  ui.fAmt.value = "";
  ui.fCat.value = "أكل";
  ui.fDesc.value = "";
  showEl(ui.modalBack, "flex");
}

function openModalEdit(txnId) {
  const t = state.currentTxns.find(x => x.id === txnId);
  if (!t) return;

  // salary locked
  const isSalary = (t.id === "salary");
  if (isSalary) {
    alert("هذا الراتب تلقائي. تعدّل الراتب من (تعديل).");
    return;
  }

  editingTxnId = txnId;
  ui.fDate.value = t.date || firstDayOfMonth(state.currentMonth);
  ui.fAmt.value = String(Number(t.amount) || 0);
  ui.fCat.value = t.category || "أخرى";
  ui.fDesc.value = t.desc || "";
  showEl(ui.modalBack, "flex");
}

async function saveExpense() {
  const uid = state.user.uid;
  const monthKey = state.currentMonth;

  const date = safeText(ui.fDate.value);
  const amount = toInt(ui.fAmt.value);
  const category = safeText(ui.fCat.value) || "أخرى";
  const desc = safeText(ui.fDesc.value);

  if (!date || !date.startsWith(monthKey)) {
    alert("اختَر تاريخ داخل نفس الشهر المختار.");
    return;
  }
  if (amount <= 0) {
    alert("اكتب مبلغ صحيح أكبر من 0.");
    return;
  }

  const payload = {
    type: "expense",
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
      // replace existing by deleting then adding? لا: نخزن بنفس id عبر setDoc
      await setDoc(txnRef(uid, monthKey, editingTxnId), payload, { merge: true });
    }

    hideEl(ui.modalBack);
    await refreshMonth(uid, monthKey);
  } catch (e) {
    alert("فشل الحفظ. تأكد من الاتصال.");
  }
}

async function deleteExpense(txnId) {
  const uid = state.user.uid;
  const monthKey = state.currentMonth;

  if (txnId === "salary") {
    alert("ما تقدر تحذف الراتب التلقائي.");
    return;
  }
  const ok = confirm("متأكد تبغى تحذف العملية؟");
  if (!ok) return;

  try {
    await deleteDoc(txnRef(uid, monthKey, txnId));
    await refreshMonth(uid, monthKey);
  } catch (e) {
    alert("فشل الحذف. تأكد من الاتصال.");
  }
}

function renderTransactions() {
  ui.listArea.innerHTML = "";

  const txns = visibleTxns();

  if (txns.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "ما فيه عمليات (حسب الفلاتر الحالية).";
    ui.listArea.appendChild(empty);
    return;
  }

  for (const t of txns) {
    const item = document.createElement("div");
    item.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("div");
    title.style.fontWeight = "900";
    title.textContent = t.desc || (t.type === "income" ? "دخل" : "صرف");

    const sub = document.createElement("div");
    sub.className = "desc";
    sub.textContent = `${t.date || ""} • ${t.category || "—"}`;

    meta.appendChild(title);
    meta.appendChild(sub);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const amt = document.createElement("div");
    amt.style.fontWeight = "900";
    const sign = t.type === "income" ? "+" : "−";
    amt.textContent = `${sign}${new Intl.NumberFormat("fr-DZ").format(Number(t.amount) || 0)} دج`;
    amt.style.color = t.type === "income" ? "rgba(56,214,166,0.95)" : "rgba(255,90,90,0.95)";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn small";
    btnEdit.textContent = "تعديل";
    btnEdit.disabled = (t.id === "salary"); // salary locked
    btnEdit.addEventListener("click", () => openModalEdit(t.id));

    const btnDel = document.createElement("button");
    btnDel.className = "btn danger small";
    btnDel.textContent = "حذف";
    btnDel.disabled = (t.id === "salary");
    btnDel.addEventListener("click", () => deleteExpense(t.id));

    right.appendChild(amt);
    right.appendChild(btnEdit);
    right.appendChild(btnDel);

    item.appendChild(meta);
    item.appendChild(right);

    ui.listArea.appendChild(item);
  }
}

ui.searchBox?.addEventListener("input", renderTransactions);
ui.filterCat?.addEventListener("change", renderTransactions);

ui.btnAdd?.addEventListener("click", openModalAdd);
ui.modalClose?.addEventListener("click", () => hideEl(ui.modalBack));
ui.modalCancel?.addEventListener("click", () => hideEl(ui.modalBack));
ui.modalSave?.addEventListener("click", saveExpense);

/* -----------------------------
   13) Charts (Canvas) — حسب التصنيف + حسب الأيام
-------------------------------- */
function renderCharts() {
  renderChartByCategory();
  renderChartByDays();
}

function setupCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 600;
  const cssH = canvas.height ? canvas.height : 220;

  // keep CSS height from attribute, width from layout
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { ctx, w: cssW, h: cssH };
}

function renderChartByCategory() {
  const pack = setupCanvas(ui.chartCat);
  if (!pack) return;
  const { ctx, w, h } = pack;

  const txns = state.currentTxns.filter(t => t.type === "expense");
  const agg = new Map();
  for (const t of txns) {
    const cat = t.category || "أخرى";
    agg.set(cat, (agg.get(cat) || 0) + (Number(t.amount) || 0));
  }
  const data = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  ctx.clearRect(0, 0, w, h);

  if (data.length === 0) {
    ctx.fillStyle = "rgba(233,239,255,0.85)";
    ctx.font = "14px system-ui";
    ctx.fillText("ما فيه صرف كفاية للرسم.", 14, 28);
    return;
  }

  const pad = 14;
  const maxVal = Math.max(...data.map(x => x[1]), 1);
  const barH = 18;
  const gap = 14;
  let y = pad + 18;

  ctx.font = "12px system-ui";
  for (const [cat, val] of data) {
    const bw = Math.floor((val / maxVal) * (w - pad * 2 - 110));
    // bar
    ctx.fillStyle = "rgba(124,92,255,0.75)";
    ctx.fillRect(pad, y, bw, barH);

    // label
    ctx.fillStyle = "rgba(233,239,255,0.92)";
    ctx.fillText(cat, pad, y - 4);

    // value
    ctx.fillStyle = "rgba(233,239,255,0.85)";
    ctx.fillText(`−${new Intl.NumberFormat("fr-DZ").format(Math.floor(val))}`, pad + bw + 10, y + 13);

    y += barH + gap;
    if (y > h - pad) break;
  }
}

function renderChartByDays() {
  const pack = setupCanvas(ui.chartDays);
  if (!pack) return;
  const { ctx, w, h } = pack;

  const monthKey = state.currentMonth;
  const map = new Map(); // day -> total expense
  for (const t of state.currentTxns) {
    if (t.type !== "expense") continue;
    const d = t.date;
    if (!d || !d.startsWith(monthKey)) continue;
    map.set(d, (map.get(d) || 0) + (Number(t.amount) || 0));
  }

  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  // show last 10 active days or first 10 if many
  const data = entries.slice(-10);

  ctx.clearRect(0, 0, w, h);

  if (data.length === 0) {
    ctx.fillStyle = "rgba(233,239,255,0.85)";
    ctx.font = "14px system-ui";
    ctx.fillText("ما فيه صرف كفاية للرسم.", 14, 28);
    return;
  }

  const pad = 16;
  const maxVal = Math.max(...data.map(x => x[1]), 1);

  // axes baseline
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  const barW = Math.max(10, Math.floor((w - pad * 2) / (data.length * 1.6)));
  const gap = Math.floor(barW * 0.6);

  let x = pad;
  ctx.font = "10px system-ui";

  for (const [date, val] of data) {
    const bh = Math.floor((val / maxVal) * (h - pad * 2 - 18));
    ctx.fillStyle = "rgba(56,214,166,0.70)";
    ctx.fillRect(x, (h - pad) - bh, barW, bh);

    ctx.fillStyle = "rgba(233,239,255,0.70)";
    const dd = date.slice(8, 10);
    ctx.fillText(dd, x, h - 6);

    x += barW + gap;
    if (x > w - pad) break;
  }
}

/* -----------------------------
   14) Backup (textarea JSON) + CSV
-------------------------------- */
async function buildBackupPayload(uid) {
  const sSnap = await getDoc(settingsRef(uid));
  const settings = sSnap.exists() ? sSnap.data() : {};

  const monthsCol = collection(db, `${userBase(uid)}/months`);
  const monthsSnap = await getDocs(monthsCol);

  const months = {};
  for (const m of monthsSnap.docs) {
    const mk = m.id;

    const sumSnap = await getDoc(monthSummaryRef(uid, mk));
    const summary = sumSnap.exists() ? sumSnap.data() : null;

    const txSnap = await getDocs(query(monthTxnsCol(uid, mk), orderBy("date", "asc")));
    const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    months[mk] = { summary, transactions };
  }

  return {
    app: "MyGoal",
    exportedAt: new Date().toISOString(),
    settings,
    months
  };
}

ui.btnBackup?.addEventListener("click", async () => {
  showEl(ui.backupBack, "flex");
  // حضّر النص مباشرة
  try {
    const payload = await buildBackupPayload(state.user.uid);
    ui.backupText.value = JSON.stringify(payload, null, 2);
  } catch {
    ui.backupText.value = "فشل تحميل البيانات. تأكد من الاتصال.";
  }
});

ui.backupClose?.addEventListener("click", () => hideEl(ui.backupBack));

ui.backupRefresh?.addEventListener("click", async () => {
  try {
    const payload = await buildBackupPayload(state.user.uid);
    ui.backupText.value = JSON.stringify(payload, null, 2);
  } catch {
    ui.backupText.value = "فشل تحميل البيانات. تأكد من الاتصال.";
  }
});

ui.backupCSV?.addEventListener("click", () => {
  const mk = state.currentMonth;
  const rows = [["id","type","amount","date","category","desc"]];
  for (const t of state.currentTxns) {
    rows.push([t.id, t.type, String(Number(t.amount) || 0), t.date || "", t.category || "", (t.desc || "").replaceAll('"','""')]);
  }
  const csv = rows.map(r => r.map(x => `"${String(x ?? "")}"`).join(",")).join("\n");
  downloadText(`mygoal-${mk}.csv`, csv, "text/csv;charset=utf-8");
});

ui.backupImport?.addEventListener("click", async () => {
  const text = safeText(ui.backupText.value);
  if (!text) return alert("الصق JSON أول.");
  let obj;
  try { obj = JSON.parse(text); } catch { return alert("JSON مو صحيح."); }
  if (!obj || obj.app !== "MyGoal" || !obj.months) return alert("هذا مو ملف MyGoal.");

  const uid = state.user.uid;

  try {
    // settings
    const salary = toInt(obj.settings?.salary);
    const max = toInt(obj.settings?.max);
    const goal = toInt(obj.settings?.goal);
    await setDoc(settingsRef(uid), { salary, max, goal }, { merge: true });
    state.settings.salary = salary;
    state.settings.max = max;
    state.settings.goal = goal;

    // months
    for (const [mk, data] of Object.entries(obj.months)) {
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;

      await setDoc(monthDocRef(uid, mk), { updatedAt: serverTimestamp() }, { merge: true });

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

      // recompute summary
      const qy = query(monthTxnsCol(uid, mk), orderBy("date", "desc"));
      const snap = await getDocs(qy);
      const txNow = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const summary = computeMonthSummary(txNow);
      await setDoc(monthSummaryRef(uid, mk), summary, { merge: true });
    }

    // refresh current
    ui.sSalary.value = String(state.settings.salary || "");
    ui.sMax.value = String(state.settings.max || "");

    await ensureMonthDocAndSalary(uid, state.currentMonth);
    await refreshMonth(uid, state.currentMonth);

    alert("تم الاستيراد ✅");
  } catch (e) {
    alert("فشل الاستيراد. تأكد من الاتصال.");
  }
});

/* -----------------------------
   15) download helper
-------------------------------- */
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
   16) Auth State Boot
-------------------------------- */
function setLoggedOutUI() {
  showEl(ui.loginCard, "block");
  hideEl(ui.homeArea);

  hideEl(ui.btnLogout);
  hideEl(ui.btnSettings);
  hideEl(ui.btnBackup);

  ui.whoAmI.textContent = "";
  ui.loginHint.textContent = "";
}

function setLoggedInUI(user) {
  hideEl(ui.loginCard);
  showEl(ui.homeArea, "flex"); // homeArea عندك flex-direction بالستايل inline

  showEl(ui.btnLogout, "inline-block");
  showEl(ui.btnSettings, "inline-block");
  showEl(ui.btnBackup, "inline-block");

  ui.whoAmI.textContent = user.email || user.uid;
}

onAuthStateChanged(auth, async (user) => {
  state.user = user || null;

  if (!user) {
    setLoggedOutUI();
    return;
  }

  setLoggedInUI(user);
// === تحديث اسم المستخدم في الصفحة الرئيسية ===
const helloNameEl = document.getElementById("helloName");

if (helloNameEl) {
  const displayName =
    user.displayName ||
    (user.email ? user.email.split("@")[0] : null) ||
    "مستخدم";

  helloNameEl.textContent = displayName;
}
  await ensureUserSettings();

  // month label + data
  state.currentMonth = monthKeyFromDateISO(nowISODate());
  await ensureMonthDocAndSalary(user.uid, state.currentMonth);
  await refreshMonth(user.uid, state.currentMonth);
});

// ملاحظة: service worker يتسجل من index.html عندك بالفعل