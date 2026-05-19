/**
 * app.js — Clínica Elcana
 * Firebase Compat SDK
 */

// ── ESTADO ──
var siteData       = null;
var editingProcIdx = -1;
var isAdmin        = false;
var loginAttempts  = 0;
var loginBlockUntil = 0;

// ── FIREBASE ──
firebase.initializeApp(FIREBASE_CONFIG);
var db   = firebase.firestore();
var auth = firebase.auth();

// ── HELPERS ──
function sanitize(str) {
  if (typeof str !== "string") return "";
  var d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
function limitStr(str, max) { return String(str || "").substring(0, max); }
function cleanPhone(p) { return String(p || "").replace(/\D/g, "").substring(0, 15); }
function el(id) { return document.getElementById(id); }

// ── FIRESTORE ──
function startRealtimeListener() {
  db.collection("config").doc("site").onSnapshot(function(snap) {
    siteData = snap.exists ? snap.data() : JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
    renderSite();
  }, function(err) {
    console.warn("Firestore:", err.code);
    if (!siteData) { siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site)); renderSite(); }
  });
}

function saveToFirestore(data, cb) {
  if (!isAdmin) { cb(new Error("Não autorizado.")); return; }
  db.collection("config").doc("site").set(data, { merge: true })
    .then(function() { cb(null); }).catch(cb);
}

// ── RENDER ──
function renderSite() {
  if (!siteData) return;
  renderHero(); renderAbout(); renderTreatments(); renderContact();
  el("footerYear").textContent = new Date().getFullYear();
}

function renderHero() {
  var wp  = siteData.wallpaper || {};
  var idx = typeof wp.presetIndex === "number" ? wp.presetIndex : 0;
  var url = wp.customUrl || (ELCANA_DEFAULTS.wallpaperPresets[idx] || ELCANA_DEFAULTS.wallpaperPresets[0]).full;
  el("heroBg").style.backgroundImage = "url('" + url + "')";
  var t = siteData.texts || {};
  var titleEl = el("heroTitle");
  var title = t.heroTitle || "";
  if (title.indexOf("você.") !== -1) {
    var parts = title.split("você.");
    titleEl.innerHTML = sanitize(parts[0]) + "<em>você.</em>" + sanitize(parts[1] || "");
  } else { titleEl.textContent = title; }
  el("heroSub").textContent = t.heroSub || "";
}

function renderAbout() {
  var t = siteData.texts || {};
  el("aboutTitle").textContent = t.aboutTitle || "";
  el("aboutText").textContent  = t.aboutText  || "";
}

function renderTreatments() {
  var procs = siteData.procedures || [];
  var grid  = el("treatmentsGrid");
  if (!procs.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Nenhum procedimento cadastrado.</p>';
    return;
  }
  grid.innerHTML = procs.map(function(p, i) {
    return '<div class="treatment-card">' +
      '<span class="treatment-num">' + (i < 9 ? "0" : "") + (i+1) + '</span>' +
      '<h3 class="treatment-name">' + sanitize(p.name) + '</h3>' +
      '<p class="treatment-desc">'  + sanitize(p.desc)  + '</p></div>';
  }).join("");
}

function renderContact() {
  var c = siteData.contact || {}, t = siteData.texts || {};
  var ph = cleanPhone(c.phone);
  el("contactAddress").innerHTML = sanitize(c.address || "").replace(" — ", "<br>");
  el("contactPhrase").textContent = t.contactPhrase || "";
  var fmt = ph.length >= 10 ? "("+ph.substring(0,2)+") "+ph.substring(2,7)+"-"+ph.substring(7) : ph;
  var wppUrl = "https://api.whatsapp.com/send/?phone=55"+ph+"&text=Ol%C3%A1%2C+vim+pelo+site!";
  el("contactPhone").textContent = fmt;
  el("contactPhone").href = wppUrl;
  var insta = (c.instagram || "").replace("@","");
  el("contactInstagram").textContent = c.instagram || "";
  el("contactInstagram").href = "https://instagram.com/" + encodeURIComponent(insta);
  el("wppLink").href = wppUrl;
  el("wppLink").innerHTML = "<span>💬</span> " + sanitize(c.wppText || "Falar no WhatsApp");
  el("footerInsta").textContent = c.instagram || "";
  el("footerInsta").href = "https://instagram.com/" + encodeURIComponent(insta);
}

// ── NAV ──
window.addEventListener("scroll", function() {
  el("mainNav").classList.toggle("scrolled", window.scrollY > 60);
});
window.toggleMobileMenu = function() { el("mobileMenu").classList.toggle("open"); };
window.closeMobileMenu  = function() { el("mobileMenu").classList.remove("open"); };

// ── AUTH STATE ──
auth.onAuthStateChanged(function(user) {
  isAdmin = !!user;
});

// ── LOGIN MODAL ──
window.openLoginModal = function() {
  if (isAdmin) { openAdminModal(); return; }
  el("loginOverlay").classList.add("active");
  setTimeout(function() { if(el("loginEmail")) el("loginEmail").focus(); }, 150);
};
window.closeLoginModal = function() {
  el("loginOverlay").classList.remove("active");
  el("loginError").classList.remove("show");
  el("loginEmail").value = "";
  el("loginPass").value  = "";
};
el("loginOverlay").addEventListener("click", function(e) { if(e.target===this) window.closeLoginModal(); });
el("loginPass").addEventListener("keydown", function(e) { if(e.key==="Enter") window.doLogin(); });

window.doLogin = function() {
  var now = Date.now();
  if (now < loginBlockUntil) {
    showToast("Aguarde " + Math.ceil((loginBlockUntil-now)/60000) + " min.", "error"); return;
  }
  var email = el("loginEmail").value.trim();
  var pass  = el("loginPass").value;
  var errEl = el("loginError");
  var btn   = el("btnLogin");
  if (!email || !pass) { errEl.textContent="Preencha e-mail e senha."; errEl.classList.add("show"); return; }
  btn.disabled=true; btn.textContent="Entrando…"; errEl.classList.remove("show");
  auth.signInWithEmailAndPassword(email, pass)
    .then(function() {
      loginAttempts = 0;
      window.closeLoginModal();
      openAdminModal();
    })
    .catch(function() {
      loginAttempts++;
      if (loginAttempts >= 5) {
        loginBlockUntil = Date.now() + 5*60*1000; loginAttempts = 0;
        errEl.textContent = "Bloqueado por 5 minutos.";
      } else { errEl.textContent = "E-mail ou senha incorretos."; }
      errEl.classList.add("show");
      el("loginPass").value = "";
    })
    .finally(function() { btn.disabled=false; btn.textContent="Entrar no painel"; });
};

window.doLogout = function() {
  auth.signOut().then(function() { closeAdminModal(); showToast("Sessão encerrada.", "info"); });
};

// ── ADMIN MODAL ──
function openAdminModal() {
  if (!isAdmin) return;
  // Preenche campos com segurança
  var d = siteData || ELCANA_DEFAULTS.site;
  var t = d.texts || {}, c = d.contact || {}, w = d.wallpaper || {};
  var fields = {
    "edit-heroTitle": t.heroTitle || "",
    "edit-heroSub": t.heroSub || "",
    "edit-aboutTitle": t.aboutTitle || "",
    "edit-aboutText": t.aboutText || "",
    "edit-contactPhrase": t.contactPhrase || "",
    "edit-address": c.address || "",
    "edit-phone": c.phone || "",
    "edit-instagram": c.instagram || "",
    "edit-wppText": c.wppText || ""
  };
  Object.keys(fields).forEach(function(id) {
    var elem = el(id);
    if (elem) elem.value = fields[id];
  });
  document.querySelectorAll(".wallpaper-option").forEach(function(elem, i) {
    elem.classList.toggle("selected", i === w.presetIndex && !w.customUrl);
  });
  var un = el("uploadName");
  if (un) un.classList.remove("show");
  renderAdminProcList();
  el("adminOverlay").classList.add("active");
}

function closeAdminModal() { el("adminOverlay").classList.remove("active"); }
window.closeAdminModal = closeAdminModal;
el("adminOverlay").addEventListener("click", function(e) { if(e.target===this) closeAdminModal(); });

window.switchAdminTab = function(name, btn) {
  document.querySelectorAll(".admin-tab").forEach(function(t){t.classList.remove("active");});
  document.querySelectorAll(".modal-tab").forEach(function(t){t.classList.remove("active");});
  el("admin-"+name).classList.add("active");
  if (btn) btn.classList.add("active");
};

// ── WALLPAPER ──
window.selectWallpaper = function(idx) {
  if (!isAdmin) return;
  document.querySelectorAll(".wallpaper-option").forEach(function(e,i){e.classList.toggle("selected",i===idx);});
  var url = (ELCANA_DEFAULTS.wallpaperPresets[idx]||ELCANA_DEFAULTS.wallpaperPresets[0]).full;
  el("heroBg").style.backgroundImage = "url('"+url+"')";
  if (!siteData) siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  siteData.wallpaper = { presetIndex: idx, customUrl: "" };
  var un = el("uploadName"); if(un) un.classList.remove("show");
};
window.uploadWallpaper = function(e) {
  showToast("Upload requer upgrade do Firebase Storage. Use as opções prontas.", "info");
  e.target.value = "";
};

// ── SALVAR ──
window.saveAll = function() {
  if (!isAdmin) { showToast("Sessão expirada. Faça login.", "error"); return; }
  var btn = el("btnSave");
  btn.disabled = true; btn.textContent = "Salvando…";
  var newData = JSON.parse(JSON.stringify(siteData || ELCANA_DEFAULTS.site));
  newData.texts = {
    heroTitle:     limitStr(el("edit-heroTitle").value.trim(), 120),
    heroSub:       limitStr(el("edit-heroSub").value.trim(), 400),
    aboutTitle:    limitStr(el("edit-aboutTitle").value.trim(), 120),
    aboutText:     limitStr(el("edit-aboutText").value.trim(), 1000),
    contactPhrase: limitStr(el("edit-contactPhrase").value.trim(), 400)
  };
  newData.contact = {
    address:   limitStr(el("edit-address").value.trim(), 200),
    phone:     cleanPhone(el("edit-phone").value),
    instagram: limitStr(el("edit-instagram").value.trim(), 50),
    wppText:   limitStr(el("edit-wppText").value.trim(), 60)
  };
  saveToFirestore(newData, function(err) {
    btn.disabled = false; btn.textContent = "💾 Salvar & Publicar";
    if (err) { showToast("Erro: "+(err.message||"tente novamente."), "error"); }
    else { closeAdminModal(); showToast("✓ Salvo e publicado para todos!"); }
  });
};

// ── PROCEDIMENTOS ──
function renderAdminProcList() {
  var list  = el("procedureList");
  var procs = (siteData || ELCANA_DEFAULTS.site).procedures || [];
  if (!list) return;
  if (!procs.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum procedimento. Clique em "Adicionar".</p>';
    return;
  }
  list.innerHTML = procs.map(function(p, i) {
    return '<div class="procedure-item"><div class="procedure-info">'+
      '<div class="procedure-name">'+sanitize(p.name)+'</div>'+
      '<div class="procedure-desc-short">'+sanitize(p.desc.substring(0,80))+(p.desc.length>80?"…":"")+'</div></div>'+
      '<button class="btn-icon" onclick="openProcModal('+i+')" title="Editar">✏️</button>'+
      '<button class="btn-icon delete" onclick="deleteProcedure('+i+')" title="Excluir">🗑</button></div>';
  }).join("");
}

window.openProcModal = function(idx) {
  if (!isAdmin) return;
  editingProcIdx = idx;
  var procs = (siteData || ELCANA_DEFAULTS.site).procedures || [];
  el("procModalTitle").textContent = idx >= 0 ? "Editar Procedimento" : "Novo Procedimento";
  el("procName").value = (idx >= 0 && procs[idx]) ? procs[idx].name : "";
  el("procDesc").value = (idx >= 0 && procs[idx]) ? procs[idx].desc : "";
  el("procOverlay").classList.add("active");
  setTimeout(function(){ el("procName").focus(); }, 100);
};
window.closeProcModal = function() { el("procOverlay").classList.remove("active"); };
el("procOverlay").addEventListener("click", function(e){ if(e.target===this) window.closeProcModal(); });

window.saveProcedure = function() {
  if (!isAdmin) return;
  var name = limitStr(el("procName").value.trim(), 80);
  var desc = limitStr(el("procDesc").value.trim(), 500);
  if (!name) { el("procName").focus(); return; }
  if (!siteData) siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  if (!siteData.procedures) siteData.procedures = [];
  if (editingProcIdx >= 0) { siteData.procedures[editingProcIdx] = {name:name,desc:desc}; }
  else { siteData.procedures.push({name:name,desc:desc}); }
  window.closeProcModal(); renderAdminProcList();
  showToast("Procedimento salvo. Clique em 'Salvar & Publicar'.");
};

window.deleteProcedure = function(i) {
  if (!isAdmin) return;
  var name = (siteData&&siteData.procedures&&siteData.procedures[i]) ? siteData.procedures[i].name : "";
  if (confirm('Remover "'+name+'"?')) {
    siteData.procedures.splice(i,1); renderAdminProcList();
    showToast('"'+name+'" removido. Clique em \'Salvar & Publicar\'.');
  }
};

// ── TOAST ──
var toastTimer = null;
function showToast(msg, type) {
  type = type||"success";
  var t = el("toast");
  var colors = {success:{b:"rgba(99,153,34,0.5)",c:"#97c459"},error:{b:"rgba(226,75,74,0.5)",c:"#f09595"},info:{b:"rgba(184,149,106,0.5)",c:"var(--gold)"}};
  var cv = colors[type]||colors.success;
  t.style.borderColor=cv.b; t.style.color=cv.c; t.textContent=msg;
  t.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){t.classList.remove("show");}, 5000);
}
window.showToast = showToast;

// ── INIT ──
document.addEventListener("DOMContentLoaded", function() {
  el("footerYear").textContent = new Date().getFullYear();
  startRealtimeListener();
});
