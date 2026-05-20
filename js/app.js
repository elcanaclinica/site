/**
 * app.js — Clínica Elcana v5
 * 12 temas + antes/depois + animações de entrada
 */

var siteData        = null;
var editingProcIdx  = -1;
var editingBAIdx    = -1;
var isAdmin         = false;
var loginAttempts   = 0;
var loginBlockUntil = 0;
var pendingTheme    = null;
var animObserver    = null;

firebase.initializeApp(FIREBASE_CONFIG);
var db   = firebase.firestore();
var auth = firebase.auth();

var VALID_THEMES = ["noir","rose","vogue","aurora","minimal","neon","obsidian","slate","carbon","lumiere","eclipse","studio"];

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

// ── TEMA ──
function applyTheme(theme) {
  var t = (VALID_THEMES.indexOf(theme) >= 0) ? theme : "noir";
  el("siteBody").className = "theme-" + t;
  // Reinicializa observer ao trocar tema (layouts mudam)
  initAnimObserver();
}

function previewTheme(theme, btn) {
  if (!isAdmin) return;
  pendingTheme = theme;
  applyTheme(theme);
  // highlight selected button
  document.querySelectorAll(".theme-name-btn").forEach(function(b) {
    b.classList.remove("selected");
  });
  if (btn) btn.classList.add("selected");
  // show preview label
  var lbl = el("themePreviewLabel");
  if (lbl) lbl.textContent = "Tema selecionado: " + theme.charAt(0).toUpperCase() + theme.slice(1) + " — clique em Salvar & Publicar para confirmar.";
}
window.previewTheme = previewTheme;

// ── ANIMAÇÕES DE ENTRADA ──
function initAnimObserver() {
  if (animObserver) animObserver.disconnect();
  animObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        animObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  // Observa elementos animados
  document.querySelectorAll(".fade-up, .word-reveal, .char-reveal").forEach(function(elem) {
    elem.classList.remove("in-view");
    animObserver.observe(elem);
  });
}

function wrapWordsForReveal(el) {
  if (!el) return;
  var text = el.textContent;
  var words = text.split(" ");
  el.innerHTML = words.map(function(w) {
    return '<span class="word-reveal"><span>' + w + '</span></span>';
  }).join(" ");
}

function wrapCharsForReveal(el) {
  if (!el) return;
  var text = el.textContent;
  el.innerHTML = '<span class="char-reveal">' +
    text.split("").map(function(c, i) {
      var delay = Math.min(i * 0.035, 0.6);
      return '<span class="char" style="transition-delay:' + delay + 's">' +
        (c === " " ? "&nbsp;" : c) + '</span>';
    }).join("") +
    '</span>';
}

// ── RENDER SITE ──
function renderSite() {
  if (!siteData) return;
  applyTheme(siteData.theme || "noir");
  renderHero();
  renderAbout();
  renderTreatments();
  renderBeforeAfter();
  renderContact();
  updateWppFloat();
  el("footerYear").textContent = new Date().getFullYear();
  // Anima após render
  setTimeout(initAnimObserver, 100);
}

function renderHero() {
  var wp  = siteData.wallpaper || {};
  var idx = typeof wp.presetIndex === "number" ? wp.presetIndex : 0;
  var url = wp.customUrl || (ELCANA_DEFAULTS.wallpaperPresets[idx] || ELCANA_DEFAULTS.wallpaperPresets[0]).full;
  el("heroBg").style.backgroundImage = "url('" + url + "')";

  var t = siteData.texts || {};
  var titleEl = el("heroTitle");
  var subEl   = el("heroSub");
  var title   = t.heroTitle || "";

  // Limpa classes de animação anteriores
  titleEl.className = "";
  subEl.className   = "hero-sub fade-up";
  subEl.setAttribute("data-delay","2");

  var theme = siteData.theme || "noir";

  if (["lumiere","studio"].indexOf(theme) >= 0) {
    // Animação letra a letra
    titleEl.className = "hero-title";
    if (title.indexOf("você.") !== -1) {
      var parts = title.split("você.");
      titleEl.innerHTML = sanitize(parts[0]) + '<em>você.</em>' + sanitize(parts[1] || "");
    } else {
      titleEl.textContent = title;
    }
    wrapCharsForReveal(titleEl);
  } else if (["eclipse","obsidian","carbon","slate"].indexOf(theme) >= 0) {
    // Animação palavra a palavra
    titleEl.className = "hero-title";
    if (title.indexOf("você.") !== -1) {
      var p2 = title.split("você.");
      titleEl.innerHTML = sanitize(p2[0]) + '<em>você.</em>' + sanitize(p2[1] || "");
    } else {
      titleEl.textContent = title;
    }
    titleEl.classList.add("fade-up");
  } else {
    titleEl.className = "hero-title fade-up";
    if (title.indexOf("você.") !== -1) {
      var p3 = title.split("você.");
      titleEl.innerHTML = sanitize(p3[0]) + "<em>você.</em>" + sanitize(p3[1] || "");
    } else { titleEl.textContent = title; }
  }

  subEl.textContent = t.heroSub || "";
}

function renderAbout() {
  var t = siteData.texts || {};
  var aboutTitle = el("aboutTitle");
  var aboutText  = el("aboutText");
  aboutTitle.className = "section-title fade-up";
  aboutText.className  = "fade-up";
  aboutText.setAttribute("data-delay","2");
  aboutTitle.textContent = t.aboutTitle || "";
  aboutText.textContent  = t.aboutText  || "";
}

function renderTreatments() {
  var procs = siteData.procedures || [];
  var grid  = el("treatmentsGrid");
  if (!procs.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Nenhum procedimento cadastrado.</p>';
    return;
  }
  grid.innerHTML = procs.map(function(p, i) {
    var delay = (i % 3) + 1;
    return '<div class="treatment-card fade-up" data-delay="' + delay + '">' +
      '<span class="treatment-num">' + (i < 9 ? "0" : "") + (i+1) + '</span>' +
      '<h3 class="treatment-name">' + sanitize(p.name) + '</h3>' +
      '<p class="treatment-desc">'  + sanitize(p.desc)  + '</p></div>';
  }).join("");
}

// ── ANTES & DEPOIS ──
function renderBeforeAfter() {
  var items = (siteData.beforeAfter) || (ELCANA_DEFAULTS.site.beforeAfter) || [];
  var grid  = el("baGrid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;font-size:0.85rem">Nenhum par cadastrado. Adicione pelo painel admin.</p>';
    return;
  }

  grid.innerHTML = items.map(function(item, i) {
    var hasBefore = item.before && item.before.trim();
    var hasAfter  = item.after  && item.after.trim();
    var beforeStyle = hasBefore ? 'background-image:url("' + item.before + '")' : '';
    var afterStyle  = hasAfter  ? 'background-image:url("' + item.after  + '")' : '';

    var beforeContent = hasBefore
      ? '<div class="ba-before" style="' + beforeStyle + '"></div>'
      : '<div class="ba-before"><div class="ba-placeholder"><div class="ba-placeholder-icon">📷</div><p>Adicione a imagem<br>na pasta img/</p></div></div>';

    var afterContent = hasAfter
      ? '<div class="ba-after" style="' + afterStyle + '"></div>'
      : '<div class="ba-after"><div class="ba-placeholder"><div class="ba-placeholder-icon">✨</div><p>Adicione a imagem<br>na pasta img/</p></div></div>';

    return '<div class="ba-card fade-up" data-delay="' + ((i%3)+1) + '" data-idx="' + i + '">' +
      beforeContent +
      afterContent +
      '<div class="ba-divider"></div>' +
      '<div class="ba-handle"></div>' +
      '<div class="ba-labels">' +
        '<span class="ba-label">Antes</span>' +
        '<span class="ba-label">Depois</span>' +
      '</div>' +
      '<div class="ba-card-footer">' + sanitize(item.label || "") + (item.desc ? ' · ' + sanitize(item.desc) : '') + '</div>' +
    '</div>';
  }).join("");

  // Inicializa drag nos cards
  initBeforeAfterDrag();
}

function initBeforeAfterDrag() {
  document.querySelectorAll(".ba-card").forEach(function(card) {
    var isDragging = false;
    var afterEl    = card.querySelector(".ba-after");
    var dividerEl  = card.querySelector(".ba-divider");
    var handleEl   = card.querySelector(".ba-handle");

    function updatePosition(clientX) {
      var rect   = card.getBoundingClientRect();
      var pct    = Math.min(Math.max((clientX - rect.left) / rect.width * 100, 2), 98);
      afterEl.style.clipPath   = "inset(0 " + (100 - pct) + "% 0 0)";
      dividerEl.style.left     = pct + "%";
      handleEl.style.left      = pct + "%";
    }

    card.addEventListener("mousedown", function(e) { isDragging = true; afterEl.classList.add("dragging"); updatePosition(e.clientX); });
    window.addEventListener("mousemove", function(e) { if (isDragging) updatePosition(e.clientX); });
    window.addEventListener("mouseup",   function()  { isDragging = false; afterEl.classList.remove("dragging"); });

    card.addEventListener("touchstart", function(e) { isDragging = true; afterEl.classList.add("dragging"); updatePosition(e.touches[0].clientX); }, {passive:true});
    window.addEventListener("touchmove", function(e) { if (isDragging) updatePosition(e.touches[0].clientX); }, {passive:true});
    window.addEventListener("touchend",  function()  { isDragging = false; afterEl.classList.remove("dragging"); });
  });
}

function renderContact() {
  var c = siteData.contact || {}, t = siteData.texts || {};
  var ph = cleanPhone(c.phone);
  el("contactAddress").innerHTML = sanitize(c.address || "").replace(" — ", "<br>");
  el("contactPhrase").textContent = t.contactPhrase || "";
  var fmt = ph.length >= 10 ? "("+ph.substring(0,2)+") "+ph.substring(2,7)+"-"+ph.substring(7) : ph;
  var wppUrl = "https://api.whatsapp.com/send/?phone=55"+ph+"&text=Ol%C3%A1%2C+vim+pelo+site+da+Cl%C3%ADnica+Elcana!";
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

function updateWppFloat() {
  var c = siteData.contact || {};
  var ph = cleanPhone(c.phone);
  var wppUrl = "https://api.whatsapp.com/send/?phone=55"+ph+"&text=Ol%C3%A1%2C+vim+pelo+site+da+Cl%C3%ADnica+Elcana!";
  var f = el("wppFloat"); if (f) f.href = wppUrl;
}

// ── NAV ──
window.addEventListener("scroll", function() {
  el("mainNav").classList.toggle("scrolled", window.scrollY > 60);
});
window.toggleMobileMenu = function() { el("mobileMenu").classList.toggle("open"); };
window.closeMobileMenu  = function() { el("mobileMenu").classList.remove("open"); };

// ── AUTH ──
auth.onAuthStateChanged(function(user) {
  isAdmin = !!user;
});

// ── LOGIN ──
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
  if (now < loginBlockUntil) { showToast("Aguarde " + Math.ceil((loginBlockUntil-now)/60000) + " min.", "error"); return; }
  var email = el("loginEmail").value.trim();
  var pass  = el("loginPass").value;
  var errEl = el("loginError");
  var btn   = el("btnLogin");
  if (!email || !pass) { errEl.textContent="Preencha e-mail e senha."; errEl.classList.add("show"); return; }
  btn.disabled=true; btn.textContent="Entrando…"; errEl.classList.remove("show");
  auth.signInWithEmailAndPassword(email, pass)
    .then(function() { loginAttempts=0; window.closeLoginModal(); openAdminModal(); })
    .catch(function() {
      loginAttempts++;
      if (loginAttempts >= 5) { loginBlockUntil=Date.now()+5*60*1000; loginAttempts=0; errEl.textContent="Bloqueado por 5 minutos."; }
      else { errEl.textContent="E-mail ou senha incorretos."; }
      errEl.classList.add("show");
      el("loginPass").value = "";
    })
    .finally(function() { btn.disabled=false; btn.textContent="Entrar no painel"; });
};

window.doLogout = function() {
  auth.signOut().then(function() { closeAdminModal(); showToast("Sessão encerrada.", "info"); });
};

// ── ADMIN ──
function openAdminModal() {
  if (!isAdmin) return;
  pendingTheme = null;
  var d = siteData || ELCANA_DEFAULTS.site;
  var t = d.texts || {}, c = d.contact || {}, w = d.wallpaper || {};
  var fields = {
    "edit-heroTitle": t.heroTitle||"", "edit-heroSub": t.heroSub||"",
    "edit-aboutTitle": t.aboutTitle||"", "edit-aboutText": t.aboutText||"",
    "edit-contactPhrase": t.contactPhrase||"", "edit-address": c.address||"",
    "edit-phone": c.phone||"", "edit-instagram": c.instagram||"", "edit-wppText": c.wppText||""
  };
  Object.keys(fields).forEach(function(id) { var e=el(id); if(e) e.value=fields[id]; });
  var ct = d.theme || "noir";
  document.querySelectorAll(".theme-name-btn").forEach(function(btn) {
    btn.classList.remove("selected");
    if (btn.textContent.toLowerCase().replace("è","e").replace("ê","e") === ct.toLowerCase() ||
        btn.getAttribute("onclick") && btn.getAttribute("onclick").indexOf("'" + ct + "'") !== -1) {
      btn.classList.add("selected");
    }
  });
  var lbl = el("themePreviewLabel");
  if (lbl) lbl.textContent = "";
  document.querySelectorAll(".wallpaper-option").forEach(function(elem, i) {
    elem.classList.toggle("selected", i === w.presetIndex && !w.customUrl);
  });
  var un = el("uploadName"); if(un) un.classList.remove("show");
  renderAdminProcList();
  renderAdminBAList();
  el("adminOverlay").classList.add("active");
}

function closeAdminModal() {
  if (pendingTheme && siteData) {
    applyTheme(siteData.theme || "noir");
    // re-mark correct button
    var ct = siteData.theme || "noir";
    document.querySelectorAll(".theme-name-btn").forEach(function(b) {
      b.classList.remove("selected");
      if (b.getAttribute("onclick") && b.getAttribute("onclick").indexOf("'" + ct + "'") !== -1) b.classList.add("selected");
    });
    pendingTheme = null;
  }
  el("adminOverlay").classList.remove("active");
}
window.closeAdminModal = closeAdminModal;
el("adminOverlay").addEventListener("click", function(e) { if(e.target===this) closeAdminModal(); });

window.switchAdminTab = function(name, btn) {
  document.querySelectorAll(".admin-tab").forEach(function(t){t.classList.remove("active");});
  document.querySelectorAll(".modal-tab").forEach(function(t){t.classList.remove("active");});
  el("admin-"+name).classList.add("active");
  if(btn) btn.classList.add("active");
};

// ── WALLPAPER ──
window.selectWallpaper = function(idx, url) {
  if (!isAdmin) return;
  document.querySelectorAll(".wallpaper-option").forEach(function(e,i){e.classList.toggle("selected",i===idx);});
  el("heroBg").style.backgroundImage = "url('"+url+"')";
  if (!siteData) siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  siteData.wallpaper = { presetIndex: idx, customUrl: "" };
  var un = el("uploadName"); if(un) un.classList.remove("show");
};

// ── SALVAR ──
window.saveAll = function() {
  if (!isAdmin) { showToast("Sessão expirada. Faça login.", "error"); return; }
  var btn = el("btnSave");
  btn.disabled=true; btn.textContent="Salvando…";
  var newData = JSON.parse(JSON.stringify(siteData || ELCANA_DEFAULTS.site));
  if (pendingTheme) newData.theme = pendingTheme;
  newData.texts = {
    heroTitle:     limitStr(el("edit-heroTitle").value.trim(),120),
    heroSub:       limitStr(el("edit-heroSub").value.trim(),400),
    aboutTitle:    limitStr(el("edit-aboutTitle").value.trim(),120),
    aboutText:     limitStr(el("edit-aboutText").value.trim(),1000),
    contactPhrase: limitStr(el("edit-contactPhrase").value.trim(),400)
  };
  newData.contact = {
    address:   limitStr(el("edit-address").value.trim(),200),
    phone:     cleanPhone(el("edit-phone").value),
    instagram: limitStr(el("edit-instagram").value.trim(),50),
    wppText:   limitStr(el("edit-wppText").value.trim(),60)
  };
  saveToFirestore(newData, function(err) {
    btn.disabled=false; btn.textContent="💾 Salvar & Publicar";
    if (err) { showToast("Erro: "+(err.message||"tente novamente."),"error"); }
    else { pendingTheme=null; el("adminOverlay").classList.remove("active"); showToast("✓ Salvo e publicado para todos!"); }
  });
};

// ── PROCEDIMENTOS ──
function renderAdminProcList() {
  var list=el("procedureList"), procs=(siteData||ELCANA_DEFAULTS.site).procedures||[];
  if(!list) return;
  if(!procs.length){ list.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum procedimento.</p>'; return; }
  list.innerHTML=procs.map(function(p,i){
    return '<div class="procedure-item"><div class="procedure-info">'+
      '<div class="procedure-name">'+sanitize(p.name)+'</div>'+
      '<div class="procedure-desc-short">'+sanitize(p.desc.substring(0,80))+(p.desc.length>80?"…":"")+'</div></div>'+
      '<button class="btn-icon" onclick="openProcModal('+i+')">✏️</button>'+
      '<button class="btn-icon delete" onclick="deleteProcedure('+i+')">🗑</button></div>';
  }).join("");
}
window.openProcModal=function(idx){
  if(!isAdmin) return; editingProcIdx=idx;
  var procs=(siteData||ELCANA_DEFAULTS.site).procedures||[];
  el("procModalTitle").textContent=idx>=0?"Editar Procedimento":"Novo Procedimento";
  el("procName").value=(idx>=0&&procs[idx])?procs[idx].name:"";
  el("procDesc").value=(idx>=0&&procs[idx])?procs[idx].desc:"";
  el("procOverlay").classList.add("active");
  setTimeout(function(){el("procName").focus();},100);
};
window.closeProcModal=function(){el("procOverlay").classList.remove("active");};
el("procOverlay").addEventListener("click",function(e){if(e.target===this)window.closeProcModal();});
window.saveProcedure=function(){
  if(!isAdmin) return;
  var name=limitStr(el("procName").value.trim(),80), desc=limitStr(el("procDesc").value.trim(),500);
  if(!name){el("procName").focus();return;}
  if(!siteData) siteData=JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  if(!siteData.procedures) siteData.procedures=[];
  if(editingProcIdx>=0){siteData.procedures[editingProcIdx]={name:name,desc:desc};}
  else{siteData.procedures.push({name:name,desc:desc});}
  window.closeProcModal(); renderAdminProcList();
  showToast("Salvo. Clique em 'Salvar & Publicar'.");
};
window.deleteProcedure=function(i){
  if(!isAdmin) return;
  var name=(siteData&&siteData.procedures&&siteData.procedures[i])?siteData.procedures[i].name:"";
  if(confirm('Remover "'+name+'"?')){ siteData.procedures.splice(i,1); renderAdminProcList(); showToast('"'+name+'" removido.'); }
};

// ── ANTES & DEPOIS ADMIN ──
function renderAdminBAList() {
  var list = el("baAdminList");
  if (!list) return;
  var items = (siteData && siteData.beforeAfter) ? siteData.beforeAfter : [];
  if (!items.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum par cadastrado.</p>';
    return;
  }
  list.innerHTML = items.map(function(item, i) {
    return '<div class="procedure-item"><div class="procedure-info">' +
      '<div class="procedure-name">' + sanitize(item.label || "Sem título") + '</div>' +
      '<div class="procedure-desc-short">Antes: ' + sanitize(item.before||"—") + ' · Depois: ' + sanitize(item.after||"—") + '</div>' +
    '</div>' +
    '<button class="btn-icon" onclick="openBAModal('+i+')">✏️</button>' +
    '<button class="btn-icon delete" onclick="deleteBAItem('+i+')">🗑</button></div>';
  }).join("");
}

window.openBAModal = function(idx) {
  if (!isAdmin) return;
  editingBAIdx = idx;
  var items = (siteData && siteData.beforeAfter) ? siteData.beforeAfter : [];
  el("baModalTitle").textContent = idx >= 0 ? "Editar Par" : "Novo Par Antes/Depois";
  el("baLabel").value  = (idx >= 0 && items[idx]) ? items[idx].label  || "" : "";
  el("baBefore").value = (idx >= 0 && items[idx]) ? items[idx].before || "" : "";
  el("baAfter").value  = (idx >= 0 && items[idx]) ? items[idx].after  || "" : "";
  el("baDesc").value   = (idx >= 0 && items[idx]) ? items[idx].desc   || "" : "";
  el("baOverlay").classList.add("active");
  setTimeout(function(){el("baLabel").focus();}, 100);
};
window.closeBAModal = function() { el("baOverlay").classList.remove("active"); };
el("baOverlay").addEventListener("click", function(e) { if(e.target===this) window.closeBAModal(); });

window.saveBAItem = function() {
  if (!isAdmin) return;
  var item = {
    label:  limitStr(el("baLabel").value.trim(), 60),
    before: limitStr(el("baBefore").value.trim(), 120),
    after:  limitStr(el("baAfter").value.trim(), 120),
    desc:   limitStr(el("baDesc").value.trim(), 80)
  };
  if (!siteData) siteData = JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  if (!siteData.beforeAfter) siteData.beforeAfter = [];
  if (editingBAIdx >= 0) { siteData.beforeAfter[editingBAIdx] = item; }
  else { siteData.beforeAfter.push(item); }
  window.closeBAModal();
  renderAdminBAList();
  showToast("Par salvo. Clique em 'Salvar & Publicar'.");
};

window.deleteBAItem = function(i) {
  if (!isAdmin) return;
  var label = (siteData && siteData.beforeAfter && siteData.beforeAfter[i]) ? siteData.beforeAfter[i].label : "";
  if (confirm('Remover "' + label + '"?')) {
    siteData.beforeAfter.splice(i, 1);
    renderAdminBAList();
    showToast('"' + label + '" removido.');
  }
};

// ── TOAST ──
var toastTimer = null;
function showToast(msg, type) {
  type = type||"success";
  var t = el("toast");
  var colors = {
    success:{b:"rgba(99,153,34,0.6)",c:"#97c459"},
    error:  {b:"rgba(226,75,74,0.6)",c:"#f09595"},
    info:   {b:"rgba(184,149,106,0.6)",c:"var(--primary)"}
  };
  var cv = colors[type]||colors.success;
  t.style.borderColor=cv.b; t.style.color=cv.c; t.textContent=msg;
  t.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){t.classList.remove("show");},5000);
}
window.showToast = showToast;
// Expõe funções globais antecipadamente
window.previewTheme = previewTheme;
window.selectWallpaper = selectWallpaper;
window.switchAdminTab = switchAdminTab;
window.saveAll = saveAll;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.closeAdminModal = closeAdminModal;
window.openProcModal = openProcModal;
window.closeProcModal = closeProcModal;
window.saveProcedure = saveProcedure;
window.deleteProcedure = deleteProcedure;
window.openBAModal = openBAModal;
window.closeBAModal = closeBAModal;
window.saveBAItem = saveBAItem;
window.deleteBAItem = deleteBAItem;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
// ── INIT ──
document.addEventListener("DOMContentLoaded", function() {
  el("footerYear").textContent = new Date().getFullYear();
  startRealtimeListener();
});
