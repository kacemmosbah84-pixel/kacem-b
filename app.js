const STORAGE_KEY = "kacem_b_pwa_v1";

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

const defaultState = {
  version: 1,
  auth: { username: "kacem", password: "1234" },
  settings: { salary: 47000, maxSpend: 47000, currency: "دج", integersOnly: true },
  expenses: [],
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      auth: { ...defaultState.auth, ...(parsed.auth || {}) },
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = load();
let session = { loggedIn: false };
let monthKey = ym(now());
let sortMode = "new";
let query = "";
let editId = null;

function setVisible(el, yes) {
  el.style.display = yes ? "" : "none";
}

function openModal(backId) { $(backId).classList.add("show"); }
function closeModal(backId) { $(backId).classList.remove("show"); }

function requestNotify() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission().catch(()=>{});
}
function notifyStop(msg) {
  // داخل الصفحة
  alert(msg);
  // إشعار (إذا مسموح)
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("kacem B", { body: msg });
    }
  } catch {}
}

function applyLoginUI() {
  setVisible($("loginCard"), !session.loggedIn);
  setVisible($("homeArea"), session.loggedIn);
  setVisible($("btnSettings"), session.loggedIn);
  setVisible($("btnBackup"), session.loggedIn);
  setVisible($("btnLogout"), session.loggedIn);

  $("loginHint").textContent = `افتراضيًا: user = ${state.auth.username} ، pass = ${state.auth.password}`;
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

  // آخر الشهر (ملخص)
  $("kpiEnd").textContent = `المجموع: ${money(sums.total)}`;
  $("kpiEnd2").textContent = `الباقي: ${money(sums.remainingSalary)} | (من الماكس): ${money(sums.remainingMax)}`;

  // danger borders
  $("kpiRemainSalaryBox").classList.toggle("dangerBorder", sums.remainingSalary <= 0);
  $("kpiRemainMaxBox").classList.toggle("dangerBorder", sums.remainingMax <= 0);

  const stop = (sums.maxSpend > 0 && sums.total >= sums.maxSpend) || (sums.salary > 0 && sums.total >= sums.salary);
  setVisible($("stopAlert"), stop);

  // تنبيه "وقف"
  if (stop) {
    // مرة واحدة لكل شهر/إجمالي
    const key = `notified_${monthKey}_${sums.total}`;
    if (!session[key]) {
      session[key] = true;
      requestNotify();
      notifyStop("وقف ✋ وصلت/تجاوزت الحد.");
    }
  }

  // list
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
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

  if (editId) {
    state.expenses = state.expenses.map(x => x.id === editId ? item : x);
  } else {
    state.expenses = [item, ...state.expenses];
  }
  save(state);
  closeModal("modalBack");
  render();
}

function deleteExpense(id) {
  if (!confirm("متأكد تحذف العملية؟")) return;
  state.expenses = state.expenses.filter(x => x.id !== id);
  save(state);
  render();
}

function openSettings() {
  $("sUser").value = state.auth.username || "";
  $("sPass").value = state.auth.password || "";
  $("sSalary").value = String(state.settings.salary || 0);
  $("sMax").value = String(state.settings.maxSpend || 0);
  openModal("settingsBack");
}

function saveSettings() {
  const username = ($("sUser").value || "").trim();
  const password = $("sPass").value || "";
  const salary = toInt($("sSalary").value);
  const maxSpend = toInt($("sMax").value);

  if (!username) return alert("اسم المستخدم ما ينفع فاضي");
  if (!password) return alert("كلمة السر ما تنفع فاضية");
  if (salary <= 0) return alert("الراتب لازم يكون أكبر من 0");
  if (maxSpend <= 0) return alert("الماكس لازم يكون أكبر من 0");

  state.auth = { username, password };
  state.settings.salary = salary;
  state.settings.maxSpend = maxSpend;

  save(state);
  closeModal("settingsBack");
  alert("تم حفظ الإعدادات.");
  render();
}

function resetAll() {
  if (!confirm("ترجع كل شيء افتراضي؟")) return;
  state = structuredClone(defaultState);
  save(state);
  closeModal("settingsBack");
  session.loggedIn = false;
  render();
}

function openBackup() {
  $("backupText").value = JSON.stringify(state, null, 2);
  openModal("backupBack");
}

function refreshBackupText() {
  $("backupText").value = JSON.stringify(state, null, 2);
}

function importBackupText() {
  try {
    const parsed = JSON.parse($("backupText").value || "");
    state = {
      ...defaultState,
      ...parsed,
      auth: { ...defaultState.auth, ...(parsed.auth || {}) },
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
    save(state);
    alert("تم الاستيراد.");
    closeModal("backupBack");
    render();
  } catch {
    alert("النص مو JSON صحيح.");
  }
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
  downloadText(csv, `kacem_b_expenses_${Date.now()}.csv`, "text/csv;charset=utf-8");
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// events
$("btnLogin").onclick = () => {
  const u = ($("loginUser").value || "").trim();
  const p = $("loginPass").value || "";
  if (u === state.auth.username && p === state.auth.password) {
    session.loggedIn = true;
    $("loginPass").value = "";
    render();
  } else {
    alert("اسم المستخدم أو كلمة السر غلط.");
  }
};

$("btnLogout").onclick = () => { session.loggedIn = false; render(); };

$("btnAdd").onclick = openAdd;

$("modalClose").onclick = () => closeModal("modalBack");
$("modalCancel").onclick = () => closeModal("modalBack");
$("modalSave").onclick = saveExpense;

$("btnSettings").onclick = openSettings;
$("settingsClose").onclick = () => closeModal("settingsBack");
$("settingsSave").onclick = saveSettings;
$("settingsReset").onclick = resetAll;

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

// delegate list actions
$("listArea").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (act === "edit") openEdit(id);
  if (act === "del") deleteExpense(id);
});

// init
(function init(){
  // start at current month
  monthKey = ym(now());
  render();
})();
