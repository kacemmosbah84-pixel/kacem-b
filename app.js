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
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/* ================= Firebase Config ================= */
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

/* ================= Helpers ================= */
const $ = (id) => document.getElementById(id);
const num = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => ${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())};
const ymKey = (d) => ${d.getFullYear()}-${pad2(d.getMonth()+1)};
const monthFromDateStr = (s) => String(s || "").slice(0,7);

function toEmail(userOrEmail) {
  const u = String(userOrEmail || "").trim().toLowerCase();
  if (!u) return "";
  if (u.includes("@")) return u;
  return ${u}@kacem.local; // دعم "اسم مستخدم" بدون @
}

function monthLabel(d){
  const names = ["يناير","فبراير","مارس","أبريل","ماي","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return ${names[d.getMonth()]} ${d.getFullYear()};
}

/* ================= UI ================= */
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
const btnInstall = $("btnInstall");

const whoAmI = $("whoAmI");
const monthLabelEl = $("monthLabel");

const kpiSalary = $("kpiSalary");
const kpiMax = $("kpiMax");
const kpiTotal = $("kpiTotal");
const kpiRemain = $("kpiRemain");
const nearAlert = $("nearAlert");
const stopAlert = $("stopAlert");

const prevMonth = $("prevMonth");
const nextMonth = $("nextMonth");
const todayBtn = $("todayBtn");
const calGrid = $("calGrid");
const dayHint = $("dayHint");

const btnAdd = $("btnAdd");
const modalBack = $("modalBack");
const modalClose = $("modalClose");
const modalCancel = $("modalCancel");
const modalSave = $("modalSave");
const fDate = $("fDate");
const fAmt = $("fAmt");
const fDesc = $("fDesc");
const fCat = $("fCat");

const searchBox = $("searchBox");
const filterCat = $("filterCat");
const listArea = $("listArea");

const settingsBack = $("settingsBack");
const settingsClose = $("settingsClose");
const settingsSave = $("settingsSave");
const sSalary = $("sSalary");
const sMax = $("sMax");

const backupBack = $("backupBack");
const backupClose = $("backupClose");
const backupText = $("backupText");
const backupRefresh = $("backupRefresh");
const backupImport = $("backupImport");
const backupCSV = $("backupCSV");

/* ================= PWA Install Button ================= */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.style.display = "inline-block";
});
btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.style.display = "none";
});

/* ================= State ================= */
let currentUser = null;
let settings = { salary: 0, max: 0 };
let txAll = [];           // كل العمليات
let currentMonth = new Date();  // الشهر المعروض
let activeDay = "";       // YYYY-MM-DD (فلتر يوم)
let unsubTx = null;

/* ================= Firestore paths ================= */
const userDoc = (uid) => doc(db, "users", uid);
const settingsDoc = (uid) => doc(db, "users", uid, "settings", "main");
const txCol = (uid) => collection(db, "users", uid, "tx");

/* ================= UI helpers ================= */
function showLogin(){
  loginCard.style.display = "block";
  homeArea.style.display = "none";
  btnLogout.style.display = "none";
  btnSettings.style.display = "none";
  btnBackup.style.display = "none";
}
function showHome(){
  loginCard.style.display = "none";
  homeArea.style.display = "flex";
  btnLogout.style.display = "inline-block";
  btnSettings.style.display = "inline-block";
  btnBackup.style.display = "inline-block";
}
function setHint(t){ loginHint.textContent = t || ""; }

function open(back){ back.classList.add("show"); }
function close(back){ back.classList.remove("show"); }

/* ================= Settings ================= */
async function loadSettings(uid){
  const ref = settingsDoc(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()){
    await setDoc(ref, { salary: 0, max: 0 }, { merge:true });
    settings = { salary: 0, max: 0 };
  } else {
    const d = snap.data() || {};
    settings = { salary: num(d.salary), max: num(d.max) };
  }

  sSalary.value = settings.salary ? String(settings.salary) : "";
  sMax.value = settings.max ? String(settings.max) : "";
  renderAll();
}

async function saveSettings(uid){
  settings = { salary: num(sSalary.value), max: num(sMax.value) };
  await setDoc(settingsDoc(uid), settings, { merge:true });
  renderAll();
  alert("تم حفظ الإعدادات ✅");
}

/* ================= Transactions listener ================= */
function startTx(uid){
  if (unsubTx) unsubTx();

  const qy = query(txCol(uid), orderBy("createdAt", "desc"));
  unsubTx = onSnapshot(qy, (snap) => {
    txAll = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderAll();
  });
}

async function addTx(uid, {date, amt, desc, cat}){
  await addDoc(txCol(uid), {
    date,
    month: monthFromDateStr(date),
    amt: num(amt),
    desc: String(desc || "").trim(),
    cat: String(cat || "أخرى"),
    createdAt: serverTimestamp()
  });
}

async function delTx(uid, id){
  await deleteDoc(doc(db, "users", uid, "tx", id));
}

/* ================= Filtering ================= */
function txForCurrentMonth(){
  const m = ymKey(currentMonth);
  return txAll
    .map(t => ({
      id: t.id,
      date: t.date || "",
      month: t.month || monthFromDateStr(t.date),
      amt: num(t.amt),
      desc: t.desc || "",
      cat: t.cat || "أخرى",
    }))
    .filter(t => t.month === m);
}

function applyFilters(list){
  const q = String(searchBox.value || "").trim().toLowerCase();
  const c = String(filterCat.value || "");

  return list.filter(t => {
    if (activeDay && t.date !== activeDay) return false;
    if (c && t.cat !== c) return false;
    if (!q) return true;
    return (
      t.date.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      String(t.amt).includes(q) ||
      t.cat.toLowerCase().includes(q)
    );
  });
}

/* ================= KPI + Alerts ================= */
function renderKPI(monthList){
  const total = monthList.reduce((s,t)=>s+t.amt,0);
  const max = settings.max || 0;
  const remain = max - total;

  kpiSalary.textContent = String(settings.salary || 0);
  kpiMax.textContent = String(max || 0);
  kpiTotal.textContent = String(total);
  kpiRemain.textContent = String(remain);

  // alerts
  nearAlert.style.display = "none";
  stopAlert.style.display = "none";

  if (max > 0){
    const ratio = total / max;
    if (ratio >= 1) {
      stopAlert.style.display = "block";
    } else if (ratio >= 0.8) {
      nearAlert.style.display = "block";
    }
  }
}

/* ================= Calendar ================= */
function buildCalendar(monthList){
  calGrid.innerHTML = "";

  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth();

  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);

  // نرتب الأسبوع من السبت (0) إلى الجمعة (6)
  // JS getDay: الأحد=0 ... السبت=6
  // نبي: السبت=0 ... الجمعة=6
  const toSatFirst = (jsDay) => (jsDay + 1) % 7;

  const startPad = toSatFirst(first.getDay());
  const daysInMonth = last.getDate();

  // totals per day
  const byDay = new Map();
  for (const t of monthList){
    byDay.set(t.date, (byDay.get(t.date) || 0) + t.amt);
  }

  const totalCells = startPad + daysInMonth;
  const tailPad = (7 - (totalCells % 7)) % 7;
  const cells = totalCells + tailPad;

  const today = ymd(new Date());
  const currentMKey = ymKey(currentMonth);

  // اضافة خلايا قبل الشهر
  for (let i=0;i<cells;i++){
    const cell = document.createElement("div");
    cell.className = "calCell";

    const dayNum = i - startPad + 1;

    let dateStr = "";
    let isThisMonth = dayNum >= 1 && dayNum <= daysInMonth;

    if (!isThisMonth){
      cell.classList.add("mutedCell");
      cell.innerHTML = <div class="calDay"> </div><div class="calSum muted small"> </div>;
      calGrid.appendChild(cell);
      continue;
    }

    dateStr = ${y}-${pad2(m+1)}-${pad2(dayNum)};
    const sum = byDay.get(dateStr) || 0;

    if (dateStr === activeDay) cell.classList.add("active");
    if (!activeDay && dateStr === today && monthFromDateStr(today) === currentMKey) cell.classList.add("active");

    cell.innerHTML = `
      <div class="calDay">${dayNum}</div>
      <div class="calSum">${sum ? (sum + " دج") : "—"}</div>
    `;

    cell.addEventListener("click", () => {
      // toggle day filter
      if (activeDay === dateStr) {
        activeDay = "";
        dayHint.textContent = "";
      } else {
        activeDay = dateStr;
        dayHint.textContent = فلتر اليوم: ${dateStr} (اضغط مرة ثانية لإلغاء);
      }
      renderAll();
    });

    calGrid.appendChild(cell);
  }
}

/* ================= Charts ================= */
let chartCat = null;
let chartDays = null;

function destroyCharts(){
  try { chartCat?.destroy(); } catch {}
  try { chartDays?.destroy(); } catch {}
  chartCat = null;
  chartDays = null;
}

function renderCharts(monthList){
  if (!window.Chart) return;

  // by category
  const catMap = new Map();
  for (const t of monthList){
    catMap.set(t.cat, (catMap.get(t.cat) || 0) + t.amt);
  }
  const catLabels = Array.from(catMap.keys());
  const catValues = Array.from(catMap.values());

  // by day
  const dayMap = new Map();
  for (const t of monthList){
    dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amt);
  }
  const dayLabels = Array.from(dayMap.keys()).sort((a,b)=>a.localeCompare(b));
  const dayValues = dayLabels.map(d => dayMap.get(d));

  destroyCharts();

  const ctx1 = $("chartCat");
  const ctx2 = $("chartDays");

  chartCat = new window.Chart(ctx1, {
    type: "doughnut",
    data: { labels: catLabels, datasets: [{ data: catValues }] },
    options: { responsive:true, plugins:{ legend:{ position:"bottom" } } }
  });

  chartDays = new window.Chart(ctx2, {
    type: "line",
    data: { labels: dayLabels, datasets: [{ data: dayValues, tension:0.3 }] },
    options: { responsive:true, plugins:{ legend:{ display:false } } }
  });
}

/* ================= List ================= */
function renderList(list){
  listArea.innerHTML = "";

  if (list.length === 0){
    const d = document.createElement("div");
    d.className = "muted";
    d.textContent = "ما فيه عمليات.";
    listArea.appendChild(d);
    return;
  }

  for (const t of list){
    const item = document.createElement("div");
    item.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <div><b>${t.amt} دج</b> <span class="muted small">— ${t.date}</span></div>
      <div class="desc">${t.cat} • ${t.desc || "(بدون وصف)"}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.justifyContent = "flex-start";

    const del = document.createElement("button");
    del.className = "btn danger small";
    del.textContent = "حذف";
    del.onclick = async () => {
      if (!currentUser) return;
      if (!confirm("متأكد تحذف؟")) return;
      await delTx(currentUser.uid, t.id);
    };

    actions.appendChild(del);
    item.appendChild(meta);
    item.appendChild(actions);
    listArea.appendChild(item);
  }
}

/* ================= Render all ================= */
function renderAll(){
  if (!currentUser) return;

  const monthList = txForCurrentMonth();
  const filtered = applyFilters(monthList);

  monthLabelEl.textContent = monthLabel(currentMonth);

  renderKPI(monthList);
  buildCalendar(monthList);
  renderCharts(monthList);
  renderList(filtered);
}

/* ================= Events ================= */
btnLogin.addEventListener("click", async () => {
  const email = toEmail(loginUser.value);
  const pass = String(loginPass.value || "");

  if (!email || !pass) return setHint("اكتب اسم/إيميل + كلمة السر");
  setHint("جاري تسجيل الدخول...");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    setHint("");
  } catch (e) {
    setHint("فشل الدخول. تأكد من البيانات أو سو إنشاء حساب.");
  }
});

btnSignup.addEventListener("click", async () => {
  const email = toEmail(loginUser.value);
  const pass = String(loginPass.value || "");

  if (!email || !pass) return setHint("اكتب اسم/إيميل + كلمة السر");
  if (pass.length < 6) return setHint("كلمة السر لازم 6 أحرف أو أكثر");

  setHint("جاري إنشاء الحساب...");
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    setHint("تم إنشاء الحساب ✅");
  } catch (e) {
    setHint("ما قدرنا ننشئ الحساب (ممكن الاسم مستخدم قبل).");
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

btnAdd.addEventListener("click", () => {
  fDate.value = ymd(new Date());
  fAmt.value = "";
  fDesc.value = "";
  fCat.value = "أكل";
  open(modalBack);
});

modalClose.addEventListener("click", ()=>close(modalBack));
modalCancel.addEventListener("click", ()=>close(modalBack));

modalSave.addEventListener("click", async () => {
  if (!currentUser) return;

  const date = String(fDate.value || "").trim();
  const amt = num(fAmt.value);
  const desc = String(fDesc.value || "").trim();
  const cat = String(fCat.value || "أخرى");

  if (!date) return alert("اختر تاريخ");
  if (!amt || amt <= 0) return alert("اكتب مبلغ صحيح");
  if (!desc) return alert("اكتب وصف");

  await addTx(currentUser.uid, { date, amt, desc, cat });
  close(modalBack);
});

searchBox.addEventListener("input", renderAll);
filterCat.addEventListener("change", renderAll);

btnSettings.addEventListener("click", ()=>open(settingsBack));
settingsClose.addEventListener("click", ()=>close(settingsBack));
settingsSave.addEventListener("click", async ()=>{
  if (!currentUser) return;
  await saveSettings(currentUser.uid);
  close(settingsBack);
});

btnBackup.addEventListener("click", ()=>open(backupBack));
backupClose.addEventListener("click", ()=>close(backupBack));

backupRefresh.addEventListener("click", ()=>{
  if (!currentUser) return;
  const payload = {
    settings,
    tx: txAll.map(t => ({
      date: t.date || "",
      amt: num(t.amt),
      desc: t.desc || "",
      cat: t.cat || "أخرى"
    }))
  };
  backupText.value = JSON.stringify(payload, null, 2);
  alert("تم تحديث النسخة ✅");
});

backupImport.addEventListener("click", async ()=>{
  if (!currentUser) return;
  const raw = String(backupText.value || "").trim();
  if (!raw) return alert("الصق JSON أول");

  let payload;
  try { payload = JSON.parse(raw); } catch { return alert("JSON غير صحيح"); }

  if (payload?.settings){
    await setDoc(settingsDoc(currentUser.uid), {
      salary: num(payload.settings.salary),
      max: num(payload.settings.max)
    }, { merge:true });
    await loadSettings(currentUser.uid);
  }

  const arr = Array.isArray(payload?.tx) ? payload.tx : [];
  for (const t of arr){
    const date = String(t.date || "").slice(0,10);
    if (!date) continue;
    await addTx(currentUser.uid, {
      date,
      amt: num(t.amt),
      desc: String(t.desc || ""),
      cat: String(t.cat || "أخرى")
    });
  }

  alert("تم الاستيراد ✅");
});

backupCSV.addEventListener("click", ()=>{
  const rows = [
    ["date","amt","cat","desc"],
    ...txAll.map(t => [t.date || "", num(t.amt), t.cat || "أخرى", t.desc || ""])
  ];
  const csv = rows.map(r => r.map(x => "${String(x).replaceAll('"','""')}").join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kacemB.csv";
  a.click();
  URL.revokeObjectURL(url);
});

prevMonth.addEventListener("click", ()=>{
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1);
  activeDay = "";
  dayHint.textContent = "";
  renderAll();
});
nextMonth.addEventListener("click", ()=>{
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1);
  activeDay = "";
  dayHint.textContent = "";
  renderAll();
});
todayBtn.addEventListener("click", ()=>{
  currentMonth = new Date();
  activeDay = "";
  dayHint.textContent = "";
  renderAll();
});

/* ================= Auth state ================= */
onAuthStateChanged(auth, async (u)=>{
  currentUser = u || null;

  if (!currentUser){
    if (unsubTx) unsubTx();
    txAll = [];
    settings = { salary:0, max:0 };
    showLogin();
    setHint("اكتب اسم مستخدم أو إيميل + كلمة السر. (كلمة السر 6+)");
    return;
  }

  showHome();
  whoAmI.textContent = currentUser.email || currentUser.uid;

  // تأكد وثيقة المستخدم موجودة
  await setDoc(userDoc(currentUser.uid), { lastLogin: serverTimestamp() }, { merge:true });

  await loadSettings(currentUser.uid);
  startTx(currentUser.uid);

  monthLabelEl.textContent = monthLabel(currentMonth);
  renderAll();
});