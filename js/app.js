/**
 * app.js — Clínica Elcana
 * Firebase Compat SDK — funciona sem bundler no GitHub Pages
 */

var siteData        = null;
var editingProcIdx  = -1;
var isAdmin         = false;
var loginAttempts   = 0;
var loginBlockUntil = 0;

// Inicialização Firebase Compat
firebase.initializeApp(FIREBASE_CONFIG);
var db   = firebase.firestore();
var auth = firebase.auth();

function sanitize(str) {
  if (typeof str !== "string") return "";
  var d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
function limitStr(str, max) { return String(str || "").substring(0, max); }
function cleanPhone(p) { return String(p || "").replace(/\D/g, "").substring(0, 15); }

// ── FIRESTORE LISTENER ──
function startRealtimeListener() {
  db.collection("config").doc("site").onSnapshot(function(snap) {
    if (snap.exists) {
      siteData = snap.data();
    } else {
      siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
    }
    renderSite();
  }, function(err) {
    console.warn("Firestore erro:", err.code);
    if (!siteData) { siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site)); renderSite(); }
  });
}

function saveToFirestore(data, callback) {
  if (!isAdmin) { callback(new Error("Não autorizado.")); return; }
  db.collection("config").doc("site").set(data, { merge: true })
    .then(function() { callback(null); })
    .catch(function(e) { callback(e); });
}

// ── RENDER ──
function renderSite() {
  if (!siteData) return;
  renderHero(); renderAbout(); renderTreatments(); renderContact();
  document.getElementById("footerYear").textContent = new Date().getFullYear();
}

function renderHero() {
  var wp  = siteData.wallpaper || {};
  var idx = typeof wp.presetIndex === "number" ? wp.presetIndex : 0;
  var url = wp.customUrl || (ELCANA_DEFAULTS.wallpaperPresets[idx] || ELCANA_DEFAULTS.wallpaperPresets[0]).full;
  document.getElementById("heroBg").style.backgroundImage = "url('" + url + "')";
  var t = siteData.texts || {};
  var titleEl = document.getElementById("heroTitle");
  var title = t.heroTitle || "";
  if (title.indexOf("você.") !== -1) {
    var parts = title.split("você.");
    titleEl.innerHTML = sanitize(parts[0]) + "<em>você.</em>" + sanitize(parts[1] || "");
  } else { titleEl.textContent = title; }
  document.getElementById("heroSub").textContent = t.heroSub || "";
}

function renderAbout() {
  var t = siteData.texts || {};
  document.getElementById("aboutTitle").textContent = t.aboutTitle || "";
  document.getElementById("aboutText").textContent  = t.aboutText  || "";
}

function renderTreatments() {
  var procs = siteData.procedures || [];
  var grid  = document.getElementById("treatmentsGrid");
  if (!procs.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Nenhum procedimento cadastrado.</p>';
    return;
  }
  grid.innerHTML = procs.map(function(p, i) {
    return '<div class="treatment-card">' +
      '<span class="treatment-num">' + (i < 9 ? "0" : "") + (i+1) + '</span>' +
      '<h3 class="treatment-name">' + sanitize(p.name) + '</h3>' +
      '<p class="treatment-desc">'  + sanitize(p.desc) + '</p></div>';
  }).join("");
}

function renderContact() {
  var c = siteData.contact || {};
  var t = siteData.texts   || {};
  var ph = cleanPhone(c.phone);
  document.getElementById("contactAddress").innerHTML = sanitize(c.address || "").replace(" — ", "<br>");
  document.getElementById("contactPhrase").textContent = t.contactPhrase || "";
  var fmt = ph.length >= 10 ? "("+ph.substring(0,2)+") "+ph.substring(2,7)+"-"+ph.substring(7) : ph;
  var wppUrl = "https://api.whatsapp.com/send/?phone=55" + ph + "&text=Ol%C3%A1%2C+vim+pelo+site+da+Cl%C3%ADnica+Elcana!";
  var phoneEl = document.getElementById("contactPhone");
  phoneEl.textContent = fmt; phoneEl.href = wppUrl;
  var instaHandle = (c.instagram || "").replace("@","");
  var instaEl = document.getElementById("contactInstagram");
  instaEl.textContent = c.instagram || "";
  instaEl.href = "https://instagram.com/" + encodeURIComponent(instaHandle);
  var wppBtn = document.getElementById("wppLink");
  wppBtn.href = wppUrl;
  wppBtn.innerHTML = "<span>💬</span> " + sanitize(c.wppText || "Falar no WhatsApp");
  var fi = document.getElementById("footerInsta");
  fi.textContent = c.instagram || "";
  fi.href = "https://instagram.com/" + encodeURIComponent(instaHandle);
}

// ── NAV ──
window.addEventListener("scroll", function() {
  document.getElementById("mainNav").classList.toggle("scrolled", window.scrollY > 60);
});
window.toggleMobileMenu = function() { document.getElementById("mobileMenu").classList.toggle("open"); };
window.closeMobileMenu  = function() { document.getElementById("mobileMenu").classList.remove("open"); };

// ── AUTH ──
auth.onAuthStateChanged(function(user) {
  isAdmin = !!user;
  if (!user && document.getElementById("adminOverlay").classList.contains("active")) closeAdminModal();
});

// ── LOGIN ──
window.openLoginModal = function() {
  if (isAdmin) { openAdminModal(); return; }
  document.getElementById("loginOverlay").classList.add("active");
  setTimeout(function() { document.getElementById("loginEmail").focus(); }, 100);
};
window.closeLoginModal = function() {
  document.getElementById("loginOverlay").classList.remove("active");
  document.getElementById("loginError").classList.remove("show");
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPass").value  = "";
};
document.getElementById("loginOverlay").addEventListener("click", function(e) { if(e.target===this) window.closeLoginModal(); });
document.getElementById("loginPass").addEventListener("keydown", function(e) { if(e.key==="Enter") window.doLogin(); });

window.doLogin = function() {
  var now = Date.now();
  if (now < loginBlockUntil) {
    showToast("Muitas tentativas. Aguarde " + Math.ceil((loginBlockUntil-now)/60000) + " minuto(s).", "error"); return;
  }
  var email = document.getElementById("loginEmail").value.trim();
  var pass  = document.getElementById("loginPass").value;
  var errEl = document.getElementById("loginError");
  var btn   = document.getElementById("btnLogin");
  if (!email || !pass) { errEl.textContent="Preencha e-mail e senha."; errEl.classList.add("show"); return; }
  btn.disabled=true; btn.textContent="Entrando…"; errEl.classList.remove("show");
  auth.signInWithEmailAndPassword(email, pass)
    .then(function() {
      loginAttempts=0; window.closeLoginModal(); openAdminModal();
    })
    .catch(function() {
      loginAttempts++;
      if (loginAttempts>=5) { loginBlockUntil=Date.now()+5*60*1000; loginAttempts=0; errEl.textContent="Bloqueado por excesso de tentativas. Aguarde 5 minutos."; }
      else { errEl.textContent="E-mail ou senha incorretos."; }
      errEl.classList.add("show");
      document.getElementById("loginPass").value="";
    })
    .finally(function() { btn.disabled=false; btn.textContent="Entrar no painel"; });
};

window.doLogout = function() {
  auth.signOut().then(function() { closeAdminModal(); showToast("Sessão encerrada.", "info"); });
};

// ── ADMIN ──
function openAdminModal() {
  if (!isAdmin) return;
  populateAdminFields(); renderAdminProcList();
  document.getElementById("adminOverlay").classList.add("active");
}
function closeAdminModal() { document.getElementById("adminOverlay").classList.remove("active"); }
window.closeAdminModal = closeAdminModal;
document.getElementById("adminOverlay").addEventListener("click", function(e) { if(e.target===this) closeAdminModal(); });

function populateAdminFields() {
  var d=siteData||ELCANA_DEFAULTS.site, t=d.texts||{}, c=d.contact||{}, w=d.wallpaper||{};
  document.getElementById("edit-heroTitle").value     = t.heroTitle||"";
  document.getElementById("edit-heroSub").value       = t.heroSub||"";
  document.getElementById("edit-aboutTitle").value    = t.aboutTitle||"";
  document.getElementById("edit-aboutText").value     = t.aboutText||"";
  document.getElementById("edit-contactPhrase").value = t.contactPhrase||"";
  document.getElementById("edit-address").value   = c.address||"";
  document.getElementById("edit-phone").value     = c.phone||"";
  document.getElementById("edit-instagram").value = c.instagram||"";
  document.getElementById("edit-wppText").value   = c.wppText||"";
  document.querySelectorAll(".wallpaper-option").forEach(function(el,i) {
    el.classList.toggle("selected", i===w.presetIndex && !w.customUrl);
  });
  document.getElementById("uploadName").classList.remove("show");
}

window.switchAdminTab = function(name, btn) {
  document.querySelectorAll(".admin-tab").forEach(function(t){t.classList.remove("active");});
  document.querySelectorAll(".modal-tab").forEach(function(t){t.classList.remove("active");});
  document.getElementById("admin-"+name).classList.add("active");
  if(btn) btn.classList.add("active");
};

window.selectWallpaper = function(idx) {
  if(!isAdmin) return;
  document.querySelectorAll(".wallpaper-option").forEach(function(el,i){el.classList.toggle("selected",i===idx);});
  var url=(ELCANA_DEFAULTS.wallpaperPresets[idx]||ELCANA_DEFAULTS.wallpaperPresets[0]).full;
  document.getElementById("heroBg").style.backgroundImage="url('"+url+"')";
  if(!siteData) siteData=JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  siteData.wallpaper={presetIndex:idx,customUrl:""};
  document.getElementById("uploadName").classList.remove("show");
};

window.uploadWallpaper = function(e) {
  showToast("Upload de imagem requer upgrade do Firebase Storage. Use as 4 opções prontas por enquanto.", "info");
  e.target.value="";
};

window.saveAll = function() {
  if(!isAdmin){showToast("Sessão expirada. Faça login novamente.","error");return;}
  var btn=document.getElementById("btnSave");
  btn.disabled=true; btn.textContent="Salvando…";
  var newData=JSON.parse(JSON.stringify(siteData||ELCANA_DEFAULTS.site));
  newData.texts={
    heroTitle:     limitStr(document.getElementById("edit-heroTitle").value.trim(),120),
    heroSub:       limitStr(document.getElementById("edit-heroSub").value.trim(),400),
    aboutTitle:    limitStr(document.getElementById("edit-aboutTitle").value.trim(),120),
    aboutText:     limitStr(document.getElementById("edit-aboutText").value.trim(),1000),
    contactPhrase: limitStr(document.getElementById("edit-contactPhrase").value.trim(),400)
  };
  newData.contact={
    address:   limitStr(document.getElementById("edit-address").value.trim(),200),
    phone:     cleanPhone(document.getElementById("edit-phone").value),
    instagram: limitStr(document.getElementById("edit-instagram").value.trim(),50),
    wppText:   limitStr(document.getElementById("edit-wppText").value.trim(),60)
  };
  saveToFirestore(newData, function(err) {
    btn.disabled=false; btn.textContent="💾 Salvar & Publicar";
    if(err){showToast("Erro: "+(err.message||"tente novamente."),"error");}
    else{closeAdminModal();showToast("✓ Alterações salvas e publicadas para todos!");}
  });
};

// ── PROCEDIMENTOS ──
function renderAdminProcList() {
  var list=document.getElementById("procedureList");
  var procs=(siteData||ELCANA_DEFAULTS.site).procedures||[];
  if(!procs.length){list.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum procedimento. Clique em "Adicionar" abaixo.</p>';return;}
  list.innerHTML=procs.map(function(p,i){
    return '<div class="procedure-item"><div class="procedure-info">'+
      '<div class="procedure-name">'+sanitize(p.name)+'</div>'+
      '<div class="procedure-desc-short">'+sanitize(p.desc.substring(0,80))+(p.desc.length>80?"…":"")+'</div></div>'+
      '<button class="btn-icon" onclick="openProcModal('+i+')" title="Editar">✏️</button>'+
      '<button class="btn-icon delete" onclick="deleteProcedure('+i+')" title="Excluir">🗑</button></div>';
  }).join("");
}

window.openProcModal = function(idx) {
  if(!isAdmin) return;
  editingProcIdx=idx;
  var procs=(siteData||ELCANA_DEFAULTS.site).procedures||[];
  if(idx>=0&&procs[idx]){
    document.getElementById("procModalTitle").textContent="Editar Procedimento";
    document.getElementById("procName").value=procs[idx].name;
    document.getElementById("procDesc").value=procs[idx].desc;
  } else {
    document.getElementById("procModalTitle").textContent="Novo Procedimento";
    document.getElementById("procName").value="";
    document.getElementById("procDesc").value="";
  }
  document.getElementById("procOverlay").classList.add("active");
  setTimeout(function(){document.getElementById("procName").focus();},100);
};
window.closeProcModal=function(){document.getElementById("procOverlay").classList.remove("active");};
document.getElementById("procOverlay").addEventListener("click",function(e){if(e.target===this)window.closeProcModal();});

window.saveProcedure=function(){
  if(!isAdmin) return;
  var name=limitStr(document.getElementById("procName").value.trim(),80);
  var desc=limitStr(document.getElementById("procDesc").value.trim(),500);
  if(!name){document.getElementById("procName").focus();return;}
  if(!siteData) siteData=JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  if(!siteData.procedures) siteData.procedures=[];
  if(editingProcIdx>=0){siteData.procedures[editingProcIdx]={name:name,desc:desc};}
  else{siteData.procedures.push({name:name,desc:desc});}
  window.closeProcModal(); renderAdminProcList();
  showToast("Procedimento atualizado. Clique em 'Salvar & Publicar'.");
};

window.deleteProcedure=function(i){
  if(!isAdmin) return;
  var name=(siteData&&siteData.procedures&&siteData.procedures[i])?siteData.procedures[i].name:"";
  if(confirm('Remover "'+name+'"?')){
    siteData.procedures.splice(i,1); renderAdminProcList();
    showToast('"'+name+'" removido. Clique em \'Salvar & Publicar\'.');
  }
};

// ── TOAST ──
var toastTimer=null;
function showToast(msg,type){
  type=type||"success";
  var t=document.getElementById("toast");
  var colors={success:{border:"rgba(99,153,34,0.5)",color:"#97c459"},error:{border:"rgba(226,75,74,0.5)",color:"#f09595"},info:{border:"rgba(184,149,106,0.5)",color:"var(--gold)"}};
  var c=colors[type]||colors.success;
  t.style.borderColor=c.border; t.style.color=c.color; t.textContent=msg;
  t.classList.add("show"); clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove("show");},5000);
}
window.showToast=showToast;

// ── INIT ──
document.addEventListener("DOMContentLoaded",function(){
  document.getElementById("footerYear").textContent=new Date().getFullYear();
  startRealtimeListener();
});
