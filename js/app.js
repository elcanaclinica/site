/**
 * app.js — Clínica Elcana — versão final
 * Todas as funções declaradas no escopo global.
 */

var siteData        = null;
var editingProcIdx  = -1;
var editingBAIdx    = -1;
var isAdmin         = false;
var loginAttempts   = 0;
var loginBlockUntil = 0;
var pendingTheme    = null;
var animObserver    = null;

var VALID_THEMES = ["noir","rose","vogue","aurora","minimal","neon",
                    "obsidian","slate","carbon","lumiere","eclipse","studio"];

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
function cleanPhone(p)      { return String(p || "").replace(/\D/g,"").substring(0,15); }
function el(id)             { return document.getElementById(id); }

// ── TEMA ──
function applyTheme(theme) {
  var t = VALID_THEMES.indexOf(theme) >= 0 ? theme : "noir";
  document.getElementById("siteBody").className = "theme-" + t;
}

function previewTheme(theme, btn) {
  if (!isAdmin) return;
  pendingTheme = theme;
  applyTheme(theme);
  document.querySelectorAll(".theme-name-btn").forEach(function(b) { b.classList.remove("selected"); });
  if (btn) btn.classList.add("selected");
  var lbl = el("themePreviewLabel");
  if (lbl) {
    var name = theme.charAt(0).toUpperCase() + theme.slice(1);
    lbl.textContent = "Tema selecionado: " + name + " — clique em Salvar & Publicar para confirmar.";
  }
}

// ── ANIMAÇÕES ──
function initAnimObserver() {
  if (animObserver) animObserver.disconnect();
  animObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add("in-view"); animObserver.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".fade-up").forEach(function(elem) {
    elem.classList.remove("in-view");
    animObserver.observe(elem);
  });
}

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
  applyTheme(siteData.theme || "noir");
  renderHero();
  renderAbout();
  renderTreatments();
  renderBeforeAfter();
  renderContact();
  updateWppFloat();
  var fy = el("footerYear"); if (fy) fy.textContent = new Date().getFullYear();
  setTimeout(initAnimObserver, 150);
}

function renderHero() {
  var wp  = siteData.wallpaper || {};
  var idx = typeof wp.presetIndex === "number" ? wp.presetIndex : 0;
  var url = wp.customUrl || (ELCANA_DEFAULTS.wallpaperPresets[idx] || ELCANA_DEFAULTS.wallpaperPresets[0]).full;
  el("heroBg").style.backgroundImage = "url('" + url + "')";
  var t = siteData.texts || {};
  var titleEl = el("heroTitle");
  var subEl   = el("heroSub");
  titleEl.className = "hero-title fade-up";
  subEl.className   = "hero-sub fade-up";
  subEl.setAttribute("data-delay","2");
  var title = t.heroTitle || "";
  if (title.indexOf("você.") !== -1) {
    var parts = title.split("você.");
    titleEl.innerHTML = sanitize(parts[0]) + "<em>você.</em>" + sanitize(parts[1] || "");
  } else { titleEl.textContent = title; }
  subEl.textContent = t.heroSub || "";
}

function renderAbout() {
  var t = siteData.texts || {};
  var at = el("aboutTitle"); if (at) { at.className="section-title fade-up"; at.textContent = t.aboutTitle||""; }
  var ab = el("aboutText");  if (ab) { ab.className="fade-up"; ab.setAttribute("data-delay","2"); ab.textContent = t.aboutText||""; }
}

function renderTreatments() {
  var procs = siteData.procedures || [];
  var grid  = el("treatmentsGrid"); if (!grid) return;
  if (!procs.length) { grid.innerHTML='<p style="color:var(--text-muted);grid-column:1/-1">Nenhum procedimento cadastrado.</p>'; return; }
  grid.innerHTML = procs.map(function(p,i) {
    return '<div class="treatment-card fade-up" data-delay="'+(i%3+1)+'">' +
      '<span class="treatment-num">'+(i<9?"0":"")+(i+1)+'</span>' +
      '<h3 class="treatment-name">'+sanitize(p.name)+'</h3>' +
      '<p class="treatment-desc">'+sanitize(p.desc)+'</p></div>';
  }).join("");
}

function renderBeforeAfter() {
  var items = siteData.beforeAfter || ELCANA_DEFAULTS.site.beforeAfter || [];
  var grid  = el("baGrid"); if (!grid) return;
  if (!items.length) {
    grid.innerHTML='<p style="color:var(--text-muted);grid-column:1/-1;font-size:0.85rem">Nenhum par cadastrado. Adicione pelo painel admin.</p>';
    return;
  }
  grid.innerHTML = items.map(function(item,i) {
    var hasBefore = item.before && item.before.trim();
    var hasAfter  = item.after  && item.after.trim();
    var bStyle = hasBefore ? 'background-image:url("'+item.before+'")' : '';
    var aStyle = hasAfter  ? 'background-image:url("'+item.after+'")'  : '';
    var bContent = hasBefore
      ? '<div class="ba-before" style="'+bStyle+'"></div>'
      : '<div class="ba-before"><div class="ba-placeholder"><div class="ba-placeholder-icon">📷</div><p>Adicione a imagem<br>na pasta img/</p></div></div>';
    var aContent = hasAfter
      ? '<div class="ba-after" style="'+aStyle+'"></div>'
      : '<div class="ba-after"><div class="ba-placeholder"><div class="ba-placeholder-icon">✨</div><p>Adicione a imagem<br>na pasta img/</p></div></div>';
    return '<div class="ba-card fade-up" data-delay="'+(i%3+1)+'" data-idx="'+i+'">' +
      bContent + aContent +
      '<div class="ba-divider"></div><div class="ba-handle">◀▶</div>' +
      '<div class="ba-labels"><span class="ba-label">Antes</span><span class="ba-label">Depois</span></div>' +
      '<div class="ba-card-footer">'+sanitize(item.label||"")+(item.desc?' · '+sanitize(item.desc):'')+'</div>' +
    '</div>';
  }).join("");
  initBeforeAfterDrag();
}

function initBeforeAfterDrag() {
  document.querySelectorAll(".ba-card").forEach(function(card) {
    var isDragging=false;
    var afterEl=card.querySelector(".ba-after");
    var dividerEl=card.querySelector(".ba-divider");
    var handleEl=card.querySelector(".ba-handle");
    function updatePos(cx) {
      var r=card.getBoundingClientRect();
      var pct=Math.min(Math.max((cx-r.left)/r.width*100,2),98);
      afterEl.style.clipPath="inset(0 "+(100-pct)+"% 0 0)";
      if(dividerEl) dividerEl.style.left=pct+"%";
      if(handleEl)  handleEl.style.left=pct+"%";
    }
    card.addEventListener("mousedown",function(e){isDragging=true;updatePos(e.clientX);});
    window.addEventListener("mousemove",function(e){if(isDragging)updatePos(e.clientX);});
    window.addEventListener("mouseup",function(){isDragging=false;});
    card.addEventListener("touchstart",function(e){isDragging=true;updatePos(e.touches[0].clientX);},{passive:true});
    window.addEventListener("touchmove",function(e){if(isDragging)updatePos(e.touches[0].clientX);},{passive:true});
    window.addEventListener("touchend",function(){isDragging=false;});
  });
}

function renderContact() {
  var c=siteData.contact||{}, t=siteData.texts||{};
  var ph=cleanPhone(c.phone);
  var addrEl=el("contactAddress"); if(addrEl) addrEl.innerHTML=sanitize(c.address||"").replace(" — ","<br>");
  var phraseEl=el("contactPhrase"); if(phraseEl) phraseEl.textContent=t.contactPhrase||"";
  var fmt=ph.length>=10?"("+ph.substring(0,2)+") "+ph.substring(2,7)+"-"+ph.substring(7):ph;
  var wppUrl="https://api.whatsapp.com/send/?phone=55"+ph+"&text=Ol%C3%A1%2C+vim+pelo+site+da+Cl%C3%ADnica+Elcana!";
  var phoneEl=el("contactPhone"); if(phoneEl){phoneEl.textContent=fmt;phoneEl.href=wppUrl;}
  var insta=(c.instagram||"").replace("@","");
  var instaEl=el("contactInstagram"); if(instaEl){instaEl.textContent=c.instagram||"";instaEl.href="https://instagram.com/"+encodeURIComponent(insta);}
  var wppBtn=el("wppLink"); if(wppBtn){wppBtn.href=wppUrl;wppBtn.innerHTML="<span>💬</span> "+sanitize(c.wppText||"Falar no WhatsApp");}
  var fi=el("footerInsta"); if(fi){fi.textContent=c.instagram||"";fi.href="https://instagram.com/"+encodeURIComponent(insta);}
}

function updateWppFloat() {
  var c=siteData.contact||{};
  var ph=cleanPhone(c.phone);
  var f=el("wppFloat"); if(f) f.href="https://api.whatsapp.com/send/?phone=55"+ph+"&text=Ol%C3%A1!";
}

// ── NAV ──
function scrollHandler() {
  var nav=el("mainNav"); if(nav) nav.classList.toggle("scrolled",window.scrollY>60);
}
function toggleMobileMenu() { var m=el("mobileMenu"); if(m) m.classList.toggle("open"); }
function closeMobileMenu()  { var m=el("mobileMenu"); if(m) m.classList.remove("open"); }

// ── AUTH ──
auth.onAuthStateChanged(function(user) { isAdmin=!!user; });

// ── LOGIN ──
function openLoginModal() {
  if (isAdmin) { openAdminModal(); return; }
  var o=el("loginOverlay"); if(o) o.classList.add("active");
  setTimeout(function(){var e=el("loginEmail");if(e)e.focus();},150);
}
function closeLoginModal() {
  var o=el("loginOverlay"); if(o) o.classList.remove("active");
  var err=el("loginError"); if(err) err.classList.remove("show");
  var em=el("loginEmail"); if(em) em.value="";
  var ps=el("loginPass");  if(ps) ps.value="";
}
function doLogin() {
  var now=Date.now();
  if(now<loginBlockUntil){showToast("Aguarde "+Math.ceil((loginBlockUntil-now)/60000)+" min.","error");return;}
  var email=el("loginEmail").value.trim();
  var pass=el("loginPass").value;
  var errEl=el("loginError");
  var btn=el("btnLogin");
  if(!email||!pass){errEl.textContent="Preencha e-mail e senha.";errEl.classList.add("show");return;}
  btn.disabled=true;btn.textContent="Entrando…";errEl.classList.remove("show");
  auth.signInWithEmailAndPassword(email,pass)
    .then(function(){loginAttempts=0;closeLoginModal();openAdminModal();})
    .catch(function(){
      loginAttempts++;
      if(loginAttempts>=5){loginBlockUntil=Date.now()+5*60*1000;loginAttempts=0;errEl.textContent="Bloqueado por 5 minutos.";}
      else{errEl.textContent="E-mail ou senha incorretos.";}
      errEl.classList.add("show");
      el("loginPass").value="";
    })
    .finally(function(){btn.disabled=false;btn.textContent="Entrar no painel";});
}
function doLogout() {
  auth.signOut().then(function(){closeAdminModal();showToast("Sessão encerrada.","info");});
}

// ── ADMIN ──
function openAdminModal() {
  if(!isAdmin) return;
  pendingTheme=null;
  var d=siteData||ELCANA_DEFAULTS.site;
  var t=d.texts||{},c=d.contact||{},w=d.wallpaper||{};
  var fields={
    "edit-heroTitle":t.heroTitle||"","edit-heroSub":t.heroSub||"",
    "edit-aboutTitle":t.aboutTitle||"","edit-aboutText":t.aboutText||"",
    "edit-contactPhrase":t.contactPhrase||"","edit-address":c.address||"",
    "edit-phone":c.phone||"","edit-instagram":c.instagram||"","edit-wppText":c.wppText||""
  };
  Object.keys(fields).forEach(function(id){var e=el(id);if(e)e.value=fields[id];});
  var ct=d.theme||"noir";
  document.querySelectorAll(".theme-name-btn").forEach(function(b){
    b.classList.remove("selected");
    if(b.getAttribute("onclick")&&b.getAttribute("onclick").indexOf("'"+ct+"'")!==-1) b.classList.add("selected");
  });
  var lbl=el("themePreviewLabel"); if(lbl) lbl.textContent="";
  document.querySelectorAll(".wallpaper-option").forEach(function(e,i){
    e.classList.toggle("selected",i===w.presetIndex&&!w.customUrl);
  });
  var un=el("uploadName"); if(un) un.classList.remove("show");
  renderAdminProcList();
  renderAdminBAList();
  var o=el("adminOverlay"); if(o) o.classList.add("active");
}
function closeAdminModal() {
  if(pendingTheme&&siteData){
    applyTheme(siteData.theme||"noir");
    var ct=siteData.theme||"noir";
    document.querySelectorAll(".theme-name-btn").forEach(function(b){
      b.classList.remove("selected");
      if(b.getAttribute("onclick")&&b.getAttribute("onclick").indexOf("'"+ct+"'")!==-1) b.classList.add("selected");
    });
    pendingTheme=null;
  }
  var o=el("adminOverlay"); if(o) o.classList.remove("active");
}
function switchAdminTab(name,btn) {
  document.querySelectorAll(".admin-tab").forEach(function(t){t.classList.remove("active");});
  document.querySelectorAll(".modal-tab").forEach(function(t){t.classList.remove("active");});
  var tab=el("admin-"+name); if(tab) tab.classList.add("active");
  if(btn) btn.classList.add("active");
}

// ── WALLPAPER ──
function selectWallpaper(idx,url) {
  if(!isAdmin) return;
  document.querySelectorAll(".wallpaper-option").forEach(function(e,i){e.classList.toggle("selected",i===idx);});
  el("heroBg").style.backgroundImage="url('"+url+"')";
  if(!siteData) siteData=JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  siteData.wallpaper={presetIndex:idx,customUrl:""};
  var un=el("uploadName"); if(un) un.classList.remove("show");
}

// ── SALVAR ──
function saveAll() {
  if(!isAdmin){showToast("Sessão expirada.","error");return;}
  var btn=el("btnSave"); btn.disabled=true;btn.textContent="Salvando…";
  var newData=JSON.parse(JSON.stringify(siteData||ELCANA_DEFAULTS.site));
  if(pendingTheme) newData.theme=pendingTheme;
  newData.texts={
    heroTitle:limitStr(el("edit-heroTitle").value.trim(),120),
    heroSub:limitStr(el("edit-heroSub").value.trim(),400),
    aboutTitle:limitStr(el("edit-aboutTitle").value.trim(),120),
    aboutText:limitStr(el("edit-aboutText").value.trim(),1000),
    contactPhrase:limitStr(el("edit-contactPhrase").value.trim(),400)
  };
  newData.contact={
    address:limitStr(el("edit-address").value.trim(),200),
    phone:cleanPhone(el("edit-phone").value),
    instagram:limitStr(el("edit-instagram").value.trim(),50),
    wppText:limitStr(el("edit-wppText").value.trim(),60)
  };
  saveToFirestore(newData,function(err){
    btn.disabled=false;btn.textContent="💾 Salvar & Publicar";
    if(err){showToast("Erro: "+(err.message||"tente novamente."),"error");}
    else{pendingTheme=null;el("adminOverlay").classList.remove("active");showToast("✓ Salvo e publicado para todos!");}
  });
}

// ── PROCEDIMENTOS ──
function renderAdminProcList() {
  var list=el("procedureList"),procs=(siteData||ELCANA_DEFAULTS.site).procedures||[];
  if(!list) return;
  if(!procs.length){list.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum procedimento.</p>';return;}
  list.innerHTML=procs.map(function(p,i){
    return '<div class="procedure-item"><div class="procedure-info">'+
      '<div class="procedure-name">'+sanitize(p.name)+'</div>'+
      '<div class="procedure-desc-short">'+sanitize(p.desc.substring(0,80))+(p.desc.length>80?"…":"")+'</div></div>'+
      '<button class="btn-icon" onclick="openProcModal('+i+')">✏️</button>'+
      '<button class="btn-icon delete" onclick="deleteProcedure('+i+')">🗑</button></div>';
  }).join("");
}
function openProcModal(idx) {
  if(!isAdmin) return; editingProcIdx=idx;
  var procs=(siteData||ELCANA_DEFAULTS.site).procedures||[];
  var t=el("procModalTitle"); if(t) t.textContent=idx>=0?"Editar Procedimento":"Novo Procedimento";
  var n=el("procName"); if(n) n.value=(idx>=0&&procs[idx])?procs[idx].name:"";
  var d=el("procDesc"); if(d) d.value=(idx>=0&&procs[idx])?procs[idx].desc:"";
  var o=el("procOverlay"); if(o) o.classList.add("active");
  setTimeout(function(){var n=el("procName");if(n)n.focus();},100);
}
function closeProcModal() { var o=el("procOverlay"); if(o) o.classList.remove("active"); }
function saveProcedure() {
  if(!isAdmin) return;
  var name=limitStr(el("procName").value.trim(),80);
  var desc=limitStr(el("procDesc").value.trim(),500);
  if(!name){el("procName").focus();return;}
  if(!siteData) siteData=JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  if(!siteData.procedures) siteData.procedures=[];
  if(editingProcIdx>=0){siteData.procedures[editingProcIdx]={name:name,desc:desc};}
  else{siteData.procedures.push({name:name,desc:desc});}
  closeProcModal();renderAdminProcList();
  showToast("Salvo. Clique em 'Salvar & Publicar'.");
}
function deleteProcedure(i) {
  if(!isAdmin) return;
  var name=(siteData&&siteData.procedures&&siteData.procedures[i])?siteData.procedures[i].name:"";
  if(confirm('Remover "'+name+'"?')){siteData.procedures.splice(i,1);renderAdminProcList();showToast('"'+name+'" removido.');}
}

// ── ANTES & DEPOIS ──
function renderAdminBAList() {
  var list=el("baAdminList"); if(!list) return;
  var items=(siteData&&siteData.beforeAfter)?siteData.beforeAfter:[];
  if(!items.length){list.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum par cadastrado.</p>';return;}
  list.innerHTML=items.map(function(item,i){
    return '<div class="procedure-item"><div class="procedure-info">'+
      '<div class="procedure-name">'+sanitize(item.label||"Sem título")+'</div>'+
      '<div class="procedure-desc-short">Antes: '+sanitize(item.before||"—")+' · Depois: '+sanitize(item.after||"—")+'</div>'+
    '</div>'+
    '<button class="btn-icon" onclick="openBAModal('+i+')">✏️</button>'+
    '<button class="btn-icon delete" onclick="deleteBAItem('+i+')">🗑</button></div>';
  }).join("");
}
function openBAModal(idx) {
  if(!isAdmin) return; editingBAIdx=idx;
  var items=(siteData&&siteData.beforeAfter)?siteData.beforeAfter:[];
  var t=el("baModalTitle"); if(t) t.textContent=idx>=0?"Editar Par":"Novo Par Antes/Depois";
  var l=el("baLabel");  if(l) l.value=(idx>=0&&items[idx])?items[idx].label||"":"";
  var b=el("baBefore"); if(b) b.value=(idx>=0&&items[idx])?items[idx].before||"":"";
  var a=el("baAfter");  if(a) a.value=(idx>=0&&items[idx])?items[idx].after||"":"";
  var d=el("baDesc");   if(d) d.value=(idx>=0&&items[idx])?items[idx].desc||"":"";
  var o=el("baOverlay"); if(o) o.classList.add("active");
  setTimeout(function(){var l=el("baLabel");if(l)l.focus();},100);
}
function closeBAModal() { var o=el("baOverlay"); if(o) o.classList.remove("active"); }
function saveBAItem() {
  if(!isAdmin) return;
  var item={
    label:limitStr(el("baLabel").value.trim(),60),
    before:limitStr(el("baBefore").value.trim(),120),
    after:limitStr(el("baAfter").value.trim(),120),
    desc:limitStr(el("baDesc").value.trim(),80)
  };
  if(!siteData) siteData=JSON.parse(JSON.stringify(ELCANA_DEFAULTS.site));
  if(!siteData.beforeAfter) siteData.beforeAfter=[];
  if(editingBAIdx>=0){siteData.beforeAfter[editingBAIdx]=item;}
  else{siteData.beforeAfter.push(item);}
  closeBAModal();renderAdminBAList();
  showToast("Par salvo. Clique em 'Salvar & Publicar'.");
}
function deleteBAItem(i) {
  if(!isAdmin) return;
  var label=(siteData&&siteData.beforeAfter&&siteData.beforeAfter[i])?siteData.beforeAfter[i].label:"";
  if(confirm('Remover "'+label+'"?')){siteData.beforeAfter.splice(i,1);renderAdminBAList();showToast('"'+label+'" removido.');}
}

// ── TOAST ──
var toastTimer=null;
function showToast(msg,type) {
  type=type||"success";
  var t=el("toast"); if(!t) return;
  var colors={success:{b:"rgba(99,153,34,0.6)",c:"#97c459"},error:{b:"rgba(226,75,74,0.6)",c:"#f09595"},info:{b:"rgba(184,149,106,0.6)",c:"var(--primary,#b8956a)"}};
  var cv=colors[type]||colors.success;
  t.style.borderColor=cv.b;t.style.color=cv.c;t.textContent=msg;
  t.classList.add("show");clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove("show");},5000);
}

// ── EXPÕE TUDO GLOBALMENTE (necessário para onclick no HTML) ──
window.previewTheme    = previewTheme;
window.selectWallpaper = selectWallpaper;
window.switchAdminTab  = switchAdminTab;
window.saveAll         = saveAll;
window.doLogin         = doLogin;
window.doLogout        = doLogout;
window.openLoginModal  = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openAdminModal  = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.openProcModal   = openProcModal;
window.closeProcModal  = closeProcModal;
window.saveProcedure   = saveProcedure;
window.deleteProcedure = deleteProcedure;
window.openBAModal     = openBAModal;
window.closeBAModal    = closeBAModal;
window.saveBAItem      = saveBAItem;
window.deleteBAItem    = deleteBAItem;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu  = closeMobileMenu;
window.showToast        = showToast;

// ── EVENTOS ESTÁTICOS ──
document.addEventListener("DOMContentLoaded", function() {
  var fy=el("footerYear"); if(fy) fy.textContent=new Date().getFullYear();

  window.addEventListener("scroll", scrollHandler);

  var lo=el("loginOverlay");
  if(lo) lo.addEventListener("click",function(e){if(e.target===this)closeLoginModal();});

  var lp=el("loginPass");
  if(lp) lp.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});

  var ao=el("adminOverlay");
  if(ao) ao.addEventListener("click",function(e){if(e.target===this)closeAdminModal();});

  var po=el("procOverlay");
  if(po) po.addEventListener("click",function(e){if(e.target===this)closeProcModal();});

  var bo=el("baOverlay");
  if(bo) bo.addEventListener("click",function(e){if(e.target===this)closeBAModal();});

  startRealtimeListener();
});
