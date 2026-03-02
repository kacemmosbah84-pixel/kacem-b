// app.js (TEST)
console.log("app.js loaded ✅");
alert("app.js loaded ✅");

const loginCard = document.getElementById("loginCard");
const homeArea  = document.getElementById("homeArea");

const btnLogin  = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");
const btnLogout = document.getElementById("btnLogout");

function showHome(){
  loginCard.style.display = "none";
  homeArea.style.display = "block";
}

function showLogin(){
  homeArea.style.display = "none";
  loginCard.style.display = "block";
}

btnLogin?.addEventListener("click", () => {
  alert("ضغطت دخول ✅");
  showHome();
});

btnSignup?.addEventListener("click", () => {
  alert("ضغطت إنشاء حساب ✅");
  showHome();
});

btnLogout?.addEventListener("click", () => {
  alert("ضغطت خروج ✅");
  showLogin();
});

// بداية
showLogin();
