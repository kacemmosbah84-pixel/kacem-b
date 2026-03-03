import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
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
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   1) Firebase Config
   Ctrl+F: PUT_YOUR_
========================= */
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

/* =========================
   2) Helpers
========================= */
const $ = (id) => document.getElementById(id);

function toInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}
function fmtDZD(n){
  const v = Number(n) || 0;
  return new Intl.NumberFormat("fr-DZ").format(v) + " دج";
}
function safeText(s){ return String(s ?? "").trim(); }

function nowISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function monthKeyFromISO(dateISO){ return dateISO.slice(0,7); }
function firstDayOfMonth(monthKey){ return `${monthKey}-01`; }

function monthNameAr(monthKey){
  const [y,m] = monthKey.split("-").map(Number);
  const names = ["جانفي","فيفري","مارس","أفريل","ماي","جوان","جويلية","أوت","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${names[m-1]} ${y}`;
}

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function setNotice(el, msg, tone="info"){
  el.className = `notice ${tone}`;
  el.textContent = msg;
  show(el);
}
function clearNotice(el){
  el.textContent = "";
  hide(el);
}

/* =========================
   3) State
========================= */
const state = {
  user: null,
  username: "",
  settings: { salary:0, max:0, yearGoal:0 },
  currentMonth: monthKeyFromISO(nowISO()),
  txns: [],
  monthSummary: { expenseTotal:0 },
  charts: { cat: null, days: null },
  installPrompt: null,
};

/* =========================
   4) Firestore Paths
========================= */
function base(uid){ return `users/${uid}`; }
function settingsRef(uid){ return doc(db, `${base(uid)}/settings/main`); }
function userProfileRef(uid){ return doc(db, `${base(uid)}/profile/main`); }

function monthDocRef(uid, mk){ return doc(db, `${base(uid)}/months/${mk}`); }
function txnsCol(uid, mk){ return collection(db, `${base(uid)}/months/${mk}/transactions`); }
function txnRef(uid, mk, id){ return doc(db, `${base(uid)}/months/${mk}/transactions/${id}`); }

/* =========================
   5) Elements
========================= */
const el = {
  splash: $("splash"),

  authView: $("authView"),
  mainView: $("mainView"),

  tabLogin: $("tabLogin"),
  tabSignup: $("tabSignup"),
  loginForm: $("loginForm"),
  signupForm: $("signupForm"),
  authMsg: $("authMsg"),

  loginUser: $("loginUser"),
  loginPass: $("loginPass"),
  btnLogin: $("btnLogin"),

  suFirst: $("suFirst"),
  suLast: $("suLast"),
  suUsername: $("suUsername"),
  suEmail: $("suEmail"),
  suPass: $("suPass"),
  suPass2: $("suPass2"),
  btnSignup: $("btnSignup"),

  btnLogout: $("btnLogout"),
  btnSettings: $("btnSettings"),
  btnBackup: $("btnBackup"),
  btnInstall: $("btnInstall"),

  // pages
  pageHome: $("pageHome"),
  pageTxns: $("pageTxns"),
  pageCharts: $("pageCharts"),
  pageProfile: $("pageProfile"),
  monthLabelTop: $("monthLabelTop"),

  // home
  helloName: $("helloName"),
  monthLabel: $("monthLabel"),
  kpiTotal: $("kpiTotal"),
  kpiRemain: $("kpiRemain"),
  kpiMax: $("kpiMax"),
  kpiSalary: $("kpiSalary"),
  nearAlert: $("nearAlert"),
  stopAlert: $("stopAlert"),
  btnAdd: $("btnAdd"),

  // goal year
  goalPctChip: $("goalPctChip"),
  goalStageChip: $("goalStageChip"),
  goalNowBig: $("goalNowBig"),
  goalBarMain: $("goalBarMain"),
  goalRemain: $("goalRemain"),
  goalDaysLeft: $("goalDaysLeft"),
  goalDailyNeed: $("goalDailyNeed"),
  goalMotivation: $("goalMotivation"),

  // txns
  searchBox: $("searchBox"),
  filterCat: $("filterCat"),
  listArea: $("listArea"),
  emptyTxns: $("emptyTxns"),

  // charts
  chartsToggle: $("chartsToggle"),
  chartsArrow: $("chartsArrow"),
  chartsBody: $("chartsBody"),
  chartCat: $("chartCat"),
  chartDays: $("chartDays"),

  // profile
  whoAmI: $("whoAmI"),
  whoEmail: $("whoEmail"),

  // add modal
  modalBack: $("modalBack"),
  modalClose: $("modalClose"),
  modalCancel: $("modalCancel"),
  modalSave: $("modalSave"),
  fDate: $("fDate"),
  fAmt: $("fAmt"),
  fCat: $("fCat"),
  fDesc: $("fDesc"),
  txnMsg: $("txnMsg"),

  // settings modal
  settingsBack: $("settingsBack"),
  settingsClose: $("settingsClose"),
  settingsSave: $("settingsSave"),
  sSalary: $("sSalary"),
  sMax: $("sMax"),
  sYearGoal: $("sYearGoal"),
  settingsMsg: $("settingsMsg"),

  // backup modal
  backupBack: $("backupBack"),
  backupClose: $("backupClose"),
  backupExportJSON: $("backupExportJSON"),
  backupExportCSV: $("backupExportCSV"),
  backupMsg: $("backupMsg"),
};

/* =========================
   6) Tabs + Bottom Nav
========================= */
function setAuthTab(which){
  clearNotice(el.authMsg);
  if (which === "login"){
    el.tabLogin.classList.add("active");
    el.tabSignup.classList.remove("active");
    hide(el.signupForm);
    show(el.loginForm);
  } else {
    el.tabSignup.classList.add("active");
    el.tabLogin.classList.remove("active");
    hide(el.loginForm);
    show(el.signupForm);
  }
}
el.tabLogin.addEventListener("click", ()=>setAuthTab("login"));
el.tabSignup.addEventListener("click", ()=>setAuthTab("signup"));

const navBtns = Array.from(document.querySelectorAll(".navBtn"));
function goPage(name){
  const pages = {
    Home: el.pageHome,
    Txns: el.pageTxns,
    Charts: el.pageCharts,
    Profile: el.pageProfile,
  };
  Object.values(pages).forEach(hide);
  show(pages[name]);

  navBtns.forEach(b => b.classList.toggle("active", b.dataset.page === name));
}
navBtns.forEach(btn => btn.addEventListener("click", ()=>goPage(btn.dataset.page)));

/* =========================
   7) PWA Install
========================= */
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  state.installPrompt = e;
  show(el.btnInstall);
});
el.btnInstall.addEventListener("click", async ()=>{
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  try { await state.installPrompt.userChoice; } catch {}
  state.installPrompt = null;
  hide(el.btnInstall);
});

/* =========================
   8) Auth (Login/Signup)
========================= */
async function findEmailByUsername(username){
  // username stored at: users/{uid}/profile/main { username, email }
  // We don’t have a global index (Firestore rules), so simplest:
  // If user typed "something@..." treat as email; otherwise fail politely.
  // (Later we can build a public index collection if you want)
  return null;
}

async function doLogin(){
  clearNotice(el.authMsg);
  const userOrEmail = safeText(el.loginUser.value);
  const pass = safeText(el.loginPass.value);
  if (!userOrEmail || !pass) return setNotice(el.authMsg, "اكتب الإيميل/اسم المستخدم وكلمة المرور.", "warn");

  // Simple: if contains @ -> email
  const isEmail = userOrEmail.includes("@");
  if (!isEmail){
    return setNotice(el.authMsg, "حالياً الدخول باسم المستخدم غير مفعل (لازم إيميل). إذا تبغاه أفعله لك بعدين.", "warn");
  }

  try{
    await signInWithEmailAndPassword(auth, userOrEmail, pass);
  } catch(e){
    setNotice(el.authMsg, "فشل الدخول. تأكد من الإيميل/كلمة المرور.", "danger");
  }
}

async function doSignup(){
  clearNotice(el.authMsg);

  const first = safeText(el.suFirst.value);
  const last = safeText(el.suLast.value);
  const username = safeText(el.suUsername.value).replace(/\s+/g,"");
  const email = safeText(el.suEmail.value);
  const pass = safeText(el.suPass.value);
  const pass2 = safeText(el.suPass2.value);

  if (!first || !last || !username || !email || !pass || !pass2){
    return setNotice(el.authMsg, "كمّل كل الحقول.", "warn");
  }
  if (pass.length < 8) return setNotice(el.authMsg, "كلمة المرور لازم 8 أحرف أو أكثر.", "warn");
  if (pass !== pass2) return setNotice(el.authMsg, "التأكيد مو مطابق.", "warn");

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: `${first} ${last}` });

    // save profile doc
    await setDoc(userProfileRef(cred.user.uid), {
      first, last, username, email,
      createdAt: serverTimestamp()
    }, { merge:true });

    // send verification email
    try{ await sendEmailVerification(cred.user); } catch {}

    setNotice(el.authMsg, "تم إنشاء الحساب ✅ تم إرسال رسالة تأكيد للإيميل.", "success");
  } catch(e){
    setNotice(el.authMsg, "فشل إنشاء الحساب. يمكن الإيميل مستخدم.", "danger");
  }
}

el.btnLogin.addEventListener("click", doLogin);
el.btnSignup.addEventListener("click", doSignup);
el.btnLogout.addEventListener("click", async ()=>{ await signOut(auth); });

/* =========================
   9) Settings + Salary auto
========================= */
async function ensureSettings(uid){
  const sRef = settingsRef(uid);
  const snap = await getDoc(sRef);
  if (!snap.exists()){
    const initial = { salary:0, max:0, yearGoal:0, createdAt: serverTimestamp() };
    await setDoc(sRef, initial);
    state.settings = { salary:0, max:0, yearGoal:0 };
  } else {
    const d = snap.data();
    state.settings = {
      salary: toInt(d.salary),
      max: toInt(d.max),
      yearGoal: toInt(d.yearGoal),
    };
  }

  el.sSalary.value = state.settings.salary ? String(state.settings.salary) : "";
  el.sMax.value = state.settings.max ? String(state.settings.max) : "";
  el.sYearGoal.value = state.settings.yearGoal ? String(state.settings.yearGoal) : "";
}

async function ensureMonthAndSalary(uid, mk){
  await setDoc(monthDocRef(uid, mk), { updatedAt: serverTimestamp() }, { merge:true });

  const salary = toInt(state.settings.salary);
  if (salary <= 0) return;

  // ثابت salary ما يتكرر
  const ref = txnRef(uid, mk, "salary");
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    type: "income",
    amount: salary,
    date: firstDayOfMonth(mk),
    category: "راتب",
    desc: "الراتب الشهري (تلقائي)",
    createdAt: serverTimestamp()
  });
}

async function saveSettings(){
  clearNotice(el.settingsMsg);
  const uid = state.user.uid;

  const salary = toInt(el.sSalary.value);
  const max = toInt(el.sMax.value);
  const yearGoal = toInt(el.sYearGoal.value);

  try{
    await setDoc(settingsRef(uid), { salary, max, yearGoal }, { merge:true });
    state.settings = { salary, max, yearGoal };
    setNotice(el.settingsMsg, "تم حفظ الإعدادات ✅", "success");

    // ensure salary in current month
    await ensureMonthAndSalary(uid, state.currentMonth);

    // refresh UI
    await loadMonth(uid, state.currentMonth);
    renderAll();
  } catch(e){
    setNotice(el.settingsMsg, "فشل حفظ الإعدادات.", "danger");
  }
}

/* =========================
   10) Load Month Data
========================= */
function computeMonthExpense(txns){
  let exp = 0;
  for (const t of txns){
    const amt = Number(t.amount) || 0;
    if (t.type === "expense") exp += amt;
  }
  return Math.floor(exp);
}

function computeYearSavings(txnsByMonths){
  // savings = income - expense for months in current year only
  const year = new Date().getFullYear();
  let income = 0;
  let expense = 0;

  for (const { mk, txns } of txnsByMonths){
    if (!mk.startsWith(String(year))) continue;
    for (const t of txns){
      const amt = Number(t.amount) || 0;
      if (t.type === "income") income += amt;
      if (t.type === "expense") expense += amt;
    }
  }
  return Math.floor(income - expense);
}

async function loadMonth(uid, mk){
  state.currentMonth = mk;
  el.monthLabel.textContent = monthNameAr(mk);
  el.monthLabelTop.textContent = monthNameAr(mk);

  await ensureMonthAndSalary(uid, mk);

  const qy = query(txnsCol(uid, mk), orderBy("date","desc"));
  const snap = await getDocs(qy);
  state.txns = snap.docs.map(d => ({ id:d.id, ...d.data() }));

  state.monthSummary.expenseTotal = computeMonthExpense(state.txns);
}

async function loadYearData(uid){
  const monthsCol = collection(db, `${base(uid)}/months`);
  const monthsSnap = await getDocs(monthsCol);

  const txnsByMonths = [];
  for (const m of monthsSnap.docs){
    const mk = m.id;
    const qy = query(txnsCol(uid, mk), orderBy("date","desc"));
    const s = await getDocs(qy);
    const txns = s.docs.map(d => ({ id:d.id, ...d.data() }));
    txnsByMonths.push({ mk, txns });
  }
  return txnsByMonths;
}

/* =========================
   11) Render UI
========================= */
function renderHome(){
  // name
  const u = state.user;
  const displayName = (u?.displayName) ? u.displayName : (u?.email ? u.email.split("@")[0] : "مستخدم");
  el.helloName.textContent = displayName;

  el.whoAmI.textContent = displayName;
  el.whoEmail.textContent = u?.email || "—";

  // month KPIs
  const max = toInt(state.settings.max);
  const salary = toInt(state.settings.salary);
  const total = toInt(state.monthSummary.expenseTotal);

  el.kpiMax.textContent = fmtDZD(max);
  el.kpiSalary.textContent = fmtDZD(salary);
  el.kpiTotal.textContent = fmtDZD(total);

  const remain = max - total;
  el.kpiRemain.textContent = fmtDZD(remain);

  // alerts
  hide(el.nearAlert);
  hide(el.stopAlert);
  if (max > 0 && total >= max){
    show(el.stopAlert);
  } else if (max > 0 && total >= 0.8 * max){
    show(el.nearAlert);
  }
}

function stageText(pct){
  if (pct >= 100) return {stage:"أسطورة 🔥", msg:"🎉 وصلت الهدف! الحين ارفع السقف!"};
  if (pct >= 80) return {stage:"قربت جدًا ⚡", msg:"🔥 آخر دفعة وتكملها!"};
  if (pct >= 60) return {stage:"ممتاز 💪", msg:"✨ ثابت على الطريق… كمل!"};
  if (pct >= 40) return {stage:"أنت قوي 🚀", msg:"👏 شغل مرتب… لا تهدي!"};
  if (pct >= 20) return {stage:"بداية حلوة ✨", msg:"💙 كل يوم يفرق… كمل!"};
  return {stage:"بداية قوية", msg:"🔥 يلا نبدأ… كل دج يقربك!"};
}

function daysLeftThisYear(){
  const now = new Date();
  const end = new Date(now.getFullYear(), 11, 31);
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000*60*60*24)));
}

function renderYearGoal(yearSavings){
  const target = toInt(state.settings.yearGoal);

  const nowVal = Math.max(0, yearSavings);
  el.goalNowBig.textContent = fmtDZD(nowVal);

  if (target <= 0){
    el.goalPctChip.textContent = "اضبط الهدف";
    el.goalStageChip.textContent = "جاهز؟";
    el.goalBarMain.style.width = "0%";
    el.goalRemain.textContent = "—";
    el.goalDaysLeft.textContent = "— يوم";
    el.goalDailyNeed.textContent = "—";
    el.goalMotivation.textContent = "⚙️ حدد هدف السنة من الإعدادات";
    return;
  }

  const pct = Math.max(0, Math.min(999, (nowVal/target)*100));
  const pctShown = Math.round(pct*10)/10;
  el.goalPctChip.textContent = `${pctShown}%`;

  el.goalBarMain.style.width = `${Math.min(100, pct)}%`;

  const remain = Math.max(0, target - nowVal);
  el.goalRemain.textContent = fmtDZD(remain);

  const left = daysLeftThisYear();
  el.goalDaysLeft.textContent = `${left} يوم`;

  const daily = left > 0 ? Math.ceil(remain / left) : remain;
  el.goalDailyNeed.textContent = fmtDZD(daily);

  const st = stageText(pct);
  el.goalStageChip.textContent = st.stage;
  el.goalMotivation.textContent = st.msg;
}

function renderTxns(){
  const q = safeText(el.searchBox.value).toLowerCase();
  const cat = safeText(el.filterCat.value);

  let txns = [...state.txns];

  // filter only expense in list (حسب فكرتك)
  txns = txns.filter(t => t.type === "expense");

  if (cat) txns = txns.filter(t => (t.category || "") === cat);

  if (q){
    txns = txns.filter(t => {
      const s = [t.desc, t.category, t.date, t.amount].join(" ").toLowerCase();
      return s.includes(q);
    });
  }

  el.listArea.innerHTML = "";
  if (txns.length === 0){
    show(el.emptyTxns);
    return;
  }
  hide(el.emptyTxns);

  for (const t of txns){
    const row = document.createElement("div");
    row.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = t.desc || "صرف";

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `${t.date || ""} • ${t.category || "—"}`;

    meta.appendChild(desc);
    meta.appendChild(sub);

    const amt = document.createElement("div");
    amt.className = "amount bad";
    amt.textContent = `−${new Intl.NumberFormat("fr-DZ").format(Number(t.amount)||0)} دج`;

    row.appendChild(meta);
    row.appendChild(amt);

    el.listArea.appendChild(row);
  }
}

function renderCharts(){
  // data from txns (expense only)
  const exp = state.txns.filter(t => t.type === "expense");

  const byCat = new Map();
  const byDay = new Map();

  for (const t of exp){
    const cat = t.category || "أخرى";
    const day = t.date || "";
    const amt = Number(t.amount) || 0;
    byCat.set(cat, (byCat.get(cat)||0) + amt);
    if (day) byDay.set(day, (byDay.get(day)||0) + amt);
  }

  const catLabels = [...byCat.keys()];
  const catVals = catLabels.map(k => Math.floor(byCat.get(k)));

  const dayLabels = [...byDay.keys()].sort();
  const dayVals = dayLabels.map(k => Math.floor(byDay.get(k)));

  // destroy old
  if (state.charts.cat) state.charts.cat.destroy();
  if (state.charts.days) state.charts.days.destroy();

  state.charts.cat = new Chart(el.chartCat, {
    type: "bar",
    data: { labels: catLabels, datasets: [{ label:"صرف", data: catVals }] },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:"rgba(255,255,255,.85)", font:{weight:"700"} } },
        y:{ ticks:{ color:"rgba(255,255,255,.75)", font:{weight:"700"} } }
      }
    }
  });

  state.charts.days = new Chart(el.chartDays, {
    type: "line",
    data: { labels: dayLabels, datasets: [{ label:"صرف يومي", data: dayVals, tension:.35 }] },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:"rgba(255,255,255,.85)", font:{weight:"700"} } },
        y:{ ticks:{ color:"rgba(255,255,255,.75)", font:{weight:"700"} } }
      }
    }
  });
}

async function renderAll(){
  renderHome();
  renderTxns();

  // year goal uses all year data
  const all = await loadYearData(state.user.uid);
  const yearSavings = computeYearSavings(all);
  renderYearGoal(yearSavings);

  // charts if open
  if (!el.chartsBody.classList.contains("hidden")){
    renderCharts();
  }
}

/* =========================
   12) Add Expense
========================= */
function openAddModal(){
  clearNotice(el.txnMsg);
  el.fDate.value = nowISO().startsWith(state.currentMonth) ? nowISO() : firstDayOfMonth(state.currentMonth);
  el.fAmt.value = "";
  el.fCat.value = "أكل";
  el.fDesc.value = "";
  show(el.modalBack);
}
function closeAddModal(){
  hide(el.modalBack);
}
el.btnAdd.addEventListener("click", openAddModal);
el.modalClose.addEventListener("click", closeAddModal);
el.modalCancel.addEventListener("click", closeAddModal);

async function saveExpense(){
  clearNotice(el.txnMsg);
  const uid = state.user.uid;
  const mk = state.currentMonth;

  const date = safeText(el.fDate.value);
  const amount = toInt(el.fAmt.value);
  const category = safeText(el.fCat.value) || "أخرى";
  const desc = safeText(el.fDesc.value);

  if (!date || !date.startsWith(mk)) return setNotice(el.txnMsg, "اختَر تاريخ داخل نفس الشهر.", "warn");
  if (amount <= 0) return setNotice(el.txnMsg, "اكتب مبلغ صحيح أكبر من 0.", "warn");

  try{
    await addDoc(txnsCol(uid, mk), {
      type:"expense",
      amount,
      date,
      category,
      desc,
      createdAt: serverTimestamp()
    });

    await loadMonth(uid, mk);
    await renderAll();
    closeAddModal();
  } catch(e){
    setNotice(el.txnMsg, "فشل الحفظ. تأكد من الاتصال.", "danger");
  }
}
el.modalSave.addEventListener("click", saveExpense);

/* =========================
   13) Settings Modal
========================= */
el.btnSettings.addEventListener("click", ()=>{
  clearNotice(el.settingsMsg);
  el.sSalary.value = state.settings.salary ? String(state.settings.salary) : "";
  el.sMax.value = state.settings.max ? String(state.settings.max) : "";
  el.sYearGoal.value = state.settings.yearGoal ? String(state.settings.yearGoal) : "";
  show(el.settingsBack);
});
el.settingsClose.addEventListener("click", ()=>hide(el.settingsBack));
el.settingsSave.addEventListener("click", saveSettings);

/* =========================
   14) Backup (simple)
========================= */
function downloadText(name, text, mime="text/plain;charset=utf-8"){
  const blob = new Blob([text], { type:mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
el.btnBackup.addEventListener("click", ()=>{
  clearNotice(el.backupMsg);
  show(el.backupBack);
});
el.backupClose.addEventListener("click", ()=>hide(el.backupBack));

el.backupExportJSON.addEventListener("click", async ()=>{
  clearNotice(el.backupMsg);
  try{
    const uid = state.user.uid;
    const payload = {
      app:"MyGoal",
      exportedAt: new Date().toISOString(),
      month: state.currentMonth,
      settings: state.settings,
      txns: state.txns
    };
    downloadText(`mygoal-${uid}-${state.currentMonth}.json`, JSON.stringify(payload,null,2), "application/json;charset=utf-8");
    setNotice(el.backupMsg, "تم تصدير JSON ✅", "success");
  } catch(e){
    setNotice(el.backupMsg, "فشل التصدير.", "danger");
  }
});

el.backupExportCSV.addEventListener("click", ()=>{
  clearNotice(el.backupMsg);
  const rows = [["id","type","amount","date","category","desc"]];
  for (const t of state.txns){
    rows.push([t.id, t.type, String(t.amount||0), t.date||"", t.category||"", (t.desc||"").replaceAll('"','""')]);
  }
  const csv = rows.map(r => r.map(x => `"${String(x??"")}"`).join(",")).join("\n");
  downloadText(`mygoal-${state.currentMonth}.csv`, csv, "text/csv;charset=utf-8");
  setNotice(el.backupMsg, "تم تصدير CSV ✅", "success");
});

/* =========================
   15) Charts toggle + search
========================= */
el.chartsToggle.addEventListener("click", async ()=>{
  const open = el.chartsBody.classList.contains("hidden");
  if (open){
    show(el.chartsBody);
    el.chartsArrow.classList.add("up");
    renderCharts();
  } else {
    hide(el.chartsBody);
    el.chartsArrow.classList.remove("up");
  }
});

el.searchBox.addEventListener("input", renderTxns);
el.filterCat.addEventListener("change", renderTxns);

/* =========================
   16) Auth State
========================= */
function setLoggedOutUI(){
  hide(el.mainView);
  show(el.authView);
  hide(el.splash);
  setAuthTab("login");
}
function setLoggedInUI(user){
  hide(el.authView);
  show(el.mainView);
  hide(el.splash);

  // default home
  goPage("Home");
}

onAuthStateChanged(auth, async (user)=>{
  state.user = user || null;

  if (!user){
    setLoggedOutUI();
    return;
  }

  // (اختياري) لو تبي تمنع دخول غير المؤكدين:
  // if (!user.emailVerified) { ... }

  setLoggedInUI(user);

  // profile
  try{
    const p = await getDoc(userProfileRef(user.uid));
    if (p.exists()){
      const d = p.data();
      state.username = d.username || "";
    }
  } catch {}

  await ensureSettings(user.uid);

  state.currentMonth = monthKeyFromISO(nowISO());
  await loadMonth(user.uid, state.currentMonth);

  el.monthLabel.textContent = monthNameAr(state.currentMonth);
  el.monthLabelTop.textContent = monthNameAr(state.currentMonth);

  await renderAll();
});

/* =========================
   17) First load
========================= */
hide(el.btnInstall); // يظهر فقط لما يكون جاهز