// Firebase Console থেকে আপনার config এখানে বসান
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyAedZQ41uziKYX6xjZgg73CNONOkVZ5yBM",
  authDomain: "online-data-storage-61782.firebaseapp.com",
  projectId: "online-data-storage-61782",
  storageBucket: "online-data-storage-61782.firebasestorage.app",
  messagingSenderId: "526470115008",
  appId: "1:526470115008:web:d4856e66feaf93999e4725"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null, records = [], editingId = null;

const $ = id => document.getElementById(id);
function formatDateTime(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("bn-BD", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true });
}
function updateClock(){ $("liveClock").textContent = new Date().toLocaleString("bn-BD", {year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true}); }
setInterval(updateClock, 1000); updateClock();
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");
const msg = (id, text, success=false) => { $(id).textContent=text; $(id).className = "message" + (success ? " success" : ""); };

$("googleLoginBtn").onclick = async () => {
  try { await signInWithPopup(auth, provider); }
  catch(e){ msg("loginMessage", e.message); }
};
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    show("loginSection"); hide("protectorSection"); hide("appSection"); hide("logoutBtn"); return;
  }
  hide("loginSection"); show("protectorSection"); show("logoutBtn");
  $("userEmail").textContent = `লগইন: ${user.email}`;
  $("protectorPassword").value = "";
  msg("protectorMessage", "প্রবেশের জন্য পাসওয়ার্ড দিন।");
});

async function getProtectorPassword() {
  const snap = await getDoc(doc(db, "userSettings", currentUser.uid));
  return snap.exists() ? (snap.data().protectorPassword || "") : "";
}
async function saveProtectorPassword(password) {
  await setDoc(doc(db, "userSettings", currentUser.uid), { protectorPassword: password, updatedAt: serverTimestamp() }, { merge: true });
}
function playCustomAudio(audioUrl) {
  try {
    const audio = new Audio(audioUrl);
    audio.volume = 1;
    audio.play().catch(e => console.warn("Custom audio unavailable", e));
  } catch (e) {
    console.warn("Custom audio unavailable", e);
  }
}

const WELCOME_AUDIO_URL = "https://masumbillah6778.github.io/tones/welcome-password.mp3";
const WRONG_PASSWORD_AUDIO_URL = "https://masumbillah6778.github.io/tones/warning-password.mp3";

async function unlock() {
  try {
    const password = $("protectorPassword").value;
    if (!password) return msg("protectorMessage", "পাসওয়ার্ড লিখুন।");
    const saved = await getProtectorPassword();
    if (!saved) {
      await saveProtectorPassword(password);
      msg("protectorMessage", "পাসওয়ার্ড সেট হয়েছে।", true);
      playCustomAudio(WELCOME_AUDIO_URL);
    } else if (saved !== password) {
      msg("protectorMessage", "ভুল পাসওয়ার্ড।");
      playCustomAudio(WRONG_PASSWORD_AUDIO_URL);
      return;
    } else {
      playCustomAudio(WELCOME_AUDIO_URL);
    }
    hide("protectorSection"); show("appSection"); await loadRecords();
  } catch (e) { msg("protectorMessage", "পাসওয়ার্ড যাচাই করা যায়নি। Firebase Rules/ইন্টারনেট সংযোগ পরীক্ষা করুন।"); console.error(e); }
}
$("unlockBtn").onclick = unlock;
$("setPasswordBtn").onclick = async () => {
  const p = prompt("নতুন প্রোটেক্টর পাসওয়ার্ড দিন:");
  if (p) { await saveProtectorPassword(p); msg("protectorMessage","পাসওয়ার্ড পরিবর্তন হয়েছে।",true); }
};
$("changePasswordBtn").onclick = async () => {
  const p = prompt("নতুন প্রোটেক্টর পাসওয়ার্ড দিন:");
  if (p) { await saveProtectorPassword(p); msg("settingsMessage", "পাসওয়ার্ড পরিবর্তন হয়েছে।", true); }
};

async function loadRecords() {
  records = [];
  const q = query(collection(db, "records"), where("ownerUid", "==", currentUser.uid));
  const snap = await getDocs(q);
  snap.forEach(d => records.push({id:d.id, ...d.data()}));
  records.sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
  updateAutocompleteSuggestions();
  render();
  updateDashboard();
}

function updateAutocompleteSuggestions() {
  const fields = [
    ["personalNumber", "personalNumberSuggestions"],
    ["rabId", "rabIdSuggestions"],
    ["rationNumber", "rationNumberSuggestions"],
    ["rank", "rankSuggestions"],
    ["name", "nameSuggestions"],
    ["workplace", "workplaceSuggestions"],
    ["transferPlace", "transferSuggestions"],
    ["date", "dateSuggestions"],
    ["memorandumNumber", "memorandumSuggestions"],
    ["mobileNumber", "mobileNumberSuggestions"]
  ];
  for (const [field, listId] of fields) {
    const values = [...new Set(records.map(r => String(r[field] || "").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, "bn"));
    const list = $(listId);
    if (list) list.innerHTML = values.map(value => `<option value="${escapeHtml(value)}"></option>`).join("");
  }
}

function getTodayViewKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `ordms_views_${currentUser.uid}_${today}`;
}
function getTodayViewCount() {
  return Number(localStorage.getItem(getTodayViewKey()) || 0);
}
function updateDashboard() {
  $("totalCount").textContent = records.length.toLocaleString("bn-BD");
  const workplaces = new Set(records.map(r => (r.workplace || "").trim()).filter(Boolean));
  const transfers = new Set(records.map(r => (r.transferPlace || "").trim()).filter(Boolean));
  $("workplaceCount").textContent = workplaces.size.toLocaleString("bn-BD");
  $("transferCount").textContent = transfers.size.toLocaleString("bn-BD");
  $("viewCount").textContent = getTodayViewCount().toLocaleString("bn-BD");
  renderRecentEntries();
}
function renderRecentEntries() {
  const box = $("recentEntries");
  if (!box) return;
  const recent = [...records].sort((a,b) => {
    const at = a.createdAt?.seconds || 0;
    const bt = b.createdAt?.seconds || 0;
    return bt - at;
  }).slice(0, 5);
  if (!recent.length) {
    box.innerHTML = '<p class="empty-recent">এখনও কোনো তথ্য নেই।</p>';
    return;
  }
  box.innerHTML = recent.map((r, i) => `
    <div class="recent-entry-row">
      <span class="recent-number">${i + 1}</span>
      <div class="recent-entry-main"><strong>${r.name || 'নাম নেই'}</strong><small>${r.rank || 'পদবী নেই'}${r.workplace ? ' • ' + r.workplace : ''}</small></div>
      <span class="recent-entry-date">${r.date || 'তারিখ নেই'}</span>
    </div>`).join('');
}
function registerRecordView() {
  const key = getTodayViewKey();
  const count = Number(localStorage.getItem(key) || 0) + 1;
  localStorage.setItem(key, String(count));
  updateDashboard();
}

function render() {
  const term = $("searchInput").value.toLowerCase();
  const list = records.filter(r => JSON.stringify(r).toLowerCase().includes(term));
  $("recordsCount").textContent = `${list.length.toLocaleString("bn-BD")} টি রেকর্ড`;
  $("recordsBody").innerHTML = list.map((r,i)=>`
    <tr>
      <td>${i+1}</td><td>${r.photoUrl?`<img src="${r.photoUrl}" alt="ছবি">`:"ছবি আপলোড বন্ধ"}</td>
      <td>${r.personalNumber||""}</td><td>${r.rabId||""}</td><td>${r.rationNumber||""}</td>
      <td>${r.rank||""}</td><td>${r.name||""}</td><td>${r.workplace||""}</td>
      <td>${r.transferPlace||""}</td><td>${r.date||""}</td><td>${formatDateTime(r.createdAt)}</td><td>${r.memorandumNumber||""}</td>
      <td>${r.mobileNumber||""}</td>
      <td>
        <button class="action-btn view" onclick="viewRecord('${r.id}')">ভিউ</button>
        <button class="action-btn edit" onclick="editRecord('${r.id}')">ইডিট</button>
        <button class="action-btn delete" onclick="deleteRecord('${r.id}')">ডিলেট</button>
      </td>
    </tr>`).join("");
}
$("searchInput").oninput = render;
$("cancelBtn").onclick = () => hide("formCard");

$("recordForm").onsubmit = async e => {
  e.preventDefault();
  const numeric = [["personalNumber",10],["rabId",6],["rationNumber",6],["mobileNumber",11]];
  for (const [id,max] of numeric) { const v=$(id).value; const min=id==="personalNumber"?4:max; if (!/^\d+$/.test(v) || v.length<min || v.length>max) return msg("formMessage", `${id} সঠিকভাবে লিখুন।`); }
  const data = {
    ownerUid: currentUser.uid, personalNumber:$("personalNumber").value, rabId:$("rabId").value,
    rationNumber:$("rationNumber").value, rank:$("rank").value, name:$("name").value,
    workplace:$("workplace").value, transferPlace:$("transferPlace").value, date:$("date").value,
    memorandumNumber:$("memorandumNumber").value, mobileNumber:$("mobileNumber").value
  };
  // Firebase Storage আপাতত Billing ছাড়া ব্যবহার করা হচ্ছে না।
  // ছবি নির্বাচন করা হলেও এখন শুধু ফাইলের নাম রাখা হবে না; ছবি আপলোড হবে না।
  if (editingId) await updateDoc(doc(db,"records",editingId),data); else { data.createdAt=serverTimestamp(); await addDoc(collection(db,"records"),data); }
  hide("formCard"); await loadRecords(); msg("formMessage","সংরক্ষিত হয়েছে।",true);
};
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}
function openProfileModal(r) {
  const modal = $("profileModal");
  if (!modal) return;
  const fields = [
    ["ব্যক্তিগত নং", r.personalNumber],
    ["RAB নং", r.rabId],
    ["রেশন নং", r.rationNumber],
    ["পদবী", r.rank],
    ["নাম", r.name],
    ["কর্মস্থল", r.workplace],
    ["বদলীস্থল", r.transferPlace],
    ["তারিখ", r.date],
    ["স্মারক নং", r.memorandumNumber],
    ["মোবাইল নং", r.mobileNumber]
  ];
  $("profileModalBody").innerHTML = `
    <div class="profile-photo-box">${r.photoUrl ? `<img src="${escapeHtml(r.photoUrl)}" alt="ছবি">` : '<span>ছবি নেই</span>'}</div>
    <div class="profile-details">
      ${fields.map(([label, value]) => `<div class="profile-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}
    </div>`;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
function closeProfileModal() {
  const modal = $("profileModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}
window.viewRecord = id => {
  const r = records.find(x => x.id === id);
  if (!r) return;
  registerRecordView();
  openProfileModal(r);
};
$("profileModalClose").onclick = closeProfileModal;
$("profileModalBackdrop").onclick = closeProfileModal;
$("profilePrintBtn").onclick = () => { document.body.classList.remove("print-records"); window.print(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") closeProfileModal(); });
window.editRecord = id => { const r=records.find(x=>x.id===id); editingId=id; for(const k of ["personalNumber","rabId","rationNumber","rank","name","workplace","transferPlace","date","memorandumNumber","mobileNumber"]) $(k).value=r[k]||""; $("formTitle").textContent="ডাটা সম্পাদনা"; show("formCard"); };
window.deleteRecord = async id => { if(confirm("এই ডাটা মুছে ফেলবেন?")) { await deleteDoc(doc(db,"records",id)); await loadRecords(); } };
function downloadFile(name, content, type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
$("jsonBackupBtn").onclick=()=>downloadFile('ordms-backup.json',JSON.stringify(records,null,2),'application/json');
$("jsonRestoreBtn").onclick=()=>$("restoreFile").click();
$("restoreFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;const data=JSON.parse(await f.text());for(const r of data){delete r.id;await addDoc(collection(db,'records'),{...r,ownerUid:currentUser.uid,createdAt:serverTimestamp()})}await loadRecords();alert('Backup Restore সম্পন্ন হয়েছে।')};
$("csvExportBtn").onclick=()=>{const keys=['personalNumber','rabId','rationNumber','rank','name','workplace','transferPlace','date','memorandumNumber','mobileNumber','createdAt'];downloadFile('ordms-data.csv',keys.join(',')+'\n'+records.map(r=>keys.map(k=>'"'+String(k==='createdAt'?formatDateTime(r[k]):(r[k]||'')).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv')};
$("printBtn").onclick=()=>window.print();
if($("recordsPrintBtn")) $("recordsPrintBtn").onclick=()=>{
  const sourceTable = document.querySelector(".table-card table");
  if (!sourceTable) return;
  const clone = sourceTable.cloneNode(true);
  clone.querySelectorAll("th:last-child, td:last-child").forEach(el => el.remove());
  clone.querySelectorAll("button").forEach(el => el.remove());
  const count = $("recordsCount")?.textContent || "";
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) { alert("প্রিন্ট করার জন্য পপআপ অনুমতি দিন।"); return; }
  w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>সকল ব্যক্তির তথ্য</title>
  <style>body{font-family:Arial,"Noto Sans Bengali",sans-serif;margin:18px;color:#111}h2{margin:0 0 6px;text-align:center}p{margin:0 0 14px;text-align:center;color:#555}table{width:100%;border-collapse:collapse;table-layout:auto}th,td{border:1px solid #555;padding:6px 7px;text-align:center;white-space:nowrap;font-size:11px}th{background:#e7e7e7;font-weight:700}img{max-width:38px;max-height:38px}@media print{body{margin:8mm}table{font-size:9px}th,td{padding:4px}}</style></head><body>
  <h2>সকল ব্যক্তির তথ্য</h2><p>${count}</p>${clone.outerHTML}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script></body></html>`);
  w.document.close();
};
window.addEventListener("afterprint", () => document.body.classList.remove("print-records"));$("clearBtn").onclick=async()=>{if(confirm('সব ডাটা মুছবেন?')){for(const r of records)await deleteDoc(doc(db,'records',r.id));await loadRecords()}};
const sidebarToggle = $("sidebarToggle");
const sidebar = document.querySelector(".sidebar");
if (sidebarToggle && sidebar) {
  if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) {
    document.body.classList.add("sidebar-collapsed");
    sidebarToggle.textContent = "☰";
    sidebarToggle.setAttribute("aria-expanded", "false");
  }
  sidebarToggle.onclick = () => {
    const closed = document.body.classList.toggle("sidebar-collapsed");
    sidebarToggle.setAttribute("aria-expanded", String(!closed));
    sidebarToggle.textContent = closed ? "☰" : "✕";
  };
}

const pageButtons = document.querySelectorAll('.sidebar button[data-page]');
function setActivePage(page){ pageButtons.forEach(btn=>btn.classList.toggle('active', btn.dataset.page===page)); }
pageButtons.forEach(b=>b.onclick=()=>{ document.querySelectorAll('#appSection>section, #appSection>.dashboard, #appSection>.toolbar').forEach(x=>x.classList.add('hidden')); const p=b.dataset.page; setActivePage(p); if(p==='backup') show('backupPage'); else if(p==='form') show('formCard'); else if(p==='settings') show('settingsPage'); else if(p==='records'){ show('recordsToolbar'); document.querySelector('.table-card').classList.remove('hidden'); } else { document.querySelector('.dashboard').classList.remove('hidden'); } });
setActivePage('dashboard');
$("lockBtn").onclick=()=>{hide('appSection');show('protectorSection')};