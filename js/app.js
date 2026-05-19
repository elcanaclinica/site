/**
 * app.js — Clínica Elcana
 * Firebase Firestore + Authentication + Storage
 * Segurança: autenticação server-side, rate limiting, sanitização de inputs,
 * validação de tipos e tamanhos, proteção contra XSS.
 */

// ─────────────────────────────────────────────
// FIREBASE SDK (carregado via CDN no HTML)
// ─────────────────────────────────────────────
import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc,
         onSnapshot, serverTimestamp }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes,
         getDownloadURL, deleteObject }           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);
const storage     = getStorage(firebaseApp);

const SITE_DOC    = "config/site";   // único documento Firestore com todos os dados
const MAX_IMG_MB  = 5;               // tamanho máximo de upload de imagem
const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp"];

// ─────────────────────────────────────────────
// ESTADO LOCAL
// ─────────────────────────────────────────────
let siteData        = null;   // dados vindos do Firestore
let editingProcIdx  = -1;
let pendingImgFile  = null;   // arquivo de imagem aguardando upload
let isAdmin         = false;
let loginAttempts   = 0;
let loginBlockUntil = 0;
let unsubSnapshot   = null;   // listener em tempo real

// ─────────────────────────────────────────────
// SEGURANÇA — SANITIZAÇÃO
// ─────────────────────────────────────────────
/** Remove HTML/script de qualquer string. */
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

/** Valida URL: aceita apenas http/https e caminhos relativos. */
function safeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url, location.origin);
    if (!["https:", "http:"].includes(u.protocol)) return "";
    return u.href;
  } catch {
    // Caminho relativo (ex: img/foto.jpg)
    if (/^[a-zA-Z0-9\-_./]+$/.test(url)) return url;
    return "";
  }
}

/** Limita tamanho de string. */
function limitStr(str, max) {
  return String(str).substring(0, max);
}

/** Valida e limpa objeto de dados antes de salvar. */
function validateSiteData(data) {
  if (!data || typeof data !== "object") throw new Error("Dados inválidos.");
  return {
    wallpaper: {
      presetIndex: Number.isInteger(data.wallpaper?.presetIndex) ? Math.min(Math.max(data.wallpaper.presetIndex, -1), 3) : 0,
      customUrl:   safeUrl(data.wallpaper?.customUrl || "")
    },
    texts: {
      heroTitle:     limitStr(data.texts?.heroTitle     || "", 120),
      heroSub:       limitStr(data.texts?.heroSub       || "", 400),
      aboutTitle:    limitStr(data.texts?.aboutTitle    || "", 120),
      aboutText:     limitStr(data.texts?.aboutText     || "", 1000),
      contactPhrase: limitStr(data.texts?.contactPhrase || "", 400)
    },
    contact: {
      address:   limitStr(data.contact?.address   || "", 200),
      phone:     (data.contact?.phone || "").replace(/\D/g, "").substring(0, 15),
      instagram: limitStr((data.contact?.instagram || "").replace(/[^@a-zA-Z0-9._]/g, ""), 50),
      wppText:   limitStr(data.contact?.wppText   || "Falar no WhatsApp", 60)
    },
    procedures: Array.isArray(data.procedures)
      ? data.procedures.slice(0, 30).map(p => ({
          name: limitStr(p?.name || "", 80),
          desc: limitStr(p?.desc || "", 500)
        })).filter(p => p.name.trim())
      : [],
    updatedAt: serverTimestamp()
  };
}

// ─────────────────────────────────────────────
// FIRESTORE — LEITURA EM TEMPO REAL
// ─────────────────────────────────────────────
function startRealtimeListener() {
  if (unsubSnapshot) unsubSnapshot(); // cancela listener anterior se existir
  const docRef = doc(db, "config", "site");
  unsubSnapshot = onSnapshot(docRef,
    (snap) => {
      if (snap.exists()) {
        siteData = snap.data();
      } else {
        // Documento ainda não existe — usa defaults
        siteData = structuredClone(ELCANA_DEFAULTS.site);
      }
      renderSite();
    },
    (err) => {
      console.warn("Firestore listener error:", err.code);
      // Fallback para defaults caso offline
      if (!siteData) {
        siteData = structuredClone(ELCANA_DEFAULTS.site);
        renderSite();
      }
    }
  );
}

// ─────────────────────────────────────────────
// FIRESTORE — ESCRITA (apenas admin autenticado)
// ─────────────────────────────────────────────
async function saveToFirestore(data) {
  if (!isAdmin) throw new Error("Não autorizado.");
  const validated = validateSiteData(data);
  const docRef = doc(db, "config", "site");
  await setDoc(docRef, validated, { merge: true });
}

// ─────────────────────────────────────────────
// FIREBASE STORAGE — UPLOAD DE IMAGEM
// ─────────────────────────────────────────────
async function uploadHeroImage(file) {
  if (!isAdmin) throw new Error("Não autorizado.");

  // Validação de tipo
  if (!ALLOWED_IMG.includes(file.type)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }
  // Validação de tamanho
  if (file.size > MAX_IMG_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande. Máximo ${MAX_IMG_MB}MB.`);
  }
  // Geração de nome seguro (sem caracteres perigosos)
  const ext      = file.type.split("/")[1].replace("jpeg", "jpg");
  const safeName = `hero_${Date.now()}.${ext}`;
  const imgRef   = ref(storage, `site-images/${safeName}`);

  await uploadBytes(imgRef, file);
  const url = await getDownloadURL(imgRef);
  return url;
}

// ─────────────────────────────────────────────
// AUTENTICAÇÃO — LOGIN
// ─────────────────────────────────────────────
const RATE_LIMIT_ATTEMPTS = 5;     // tentativas antes de bloquear
const RATE_LIMIT_WINDOW   = 5 * 60 * 1000; // 5 minutos de bloqueio

async function doLogin() {
  const now = Date.now();

  // Rate limiting client-side (o Firebase também tem server-side)
  if (now < loginBlockUntil) {
    const mins = Math.ceil((loginBlockUntil - now) / 60000);
    showToast(`Muitas tentativas. Aguarde ${mins} minuto(s).`, "error");
    return;
  }

  const emailEl = document.getElementById("loginEmail");
  const passEl  = document.getElementById("loginPass");
  const errEl   = document.getElementById("loginError");
  const email   = emailEl.value.trim();
  const pass    = passEl.value;

  // Validação básica client-side
  if (!email || !pass) {
    errEl.textContent = "Preencha e-mail e senha.";
    errEl.classList.add("show");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = "E-mail inválido.";
    errEl.classList.add("show");
    return;
  }

  const btn = document.getElementById("btnLogin");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  errEl.classList.remove("show");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginAttempts = 0;
    // onAuthStateChanged cuida do resto
  } catch (err) {
    loginAttempts++;
    if (loginAttempts >= RATE_LIMIT_ATTEMPTS) {
      loginBlockUntil = Date.now() + RATE_LIMIT_WINDOW;
      loginAttempts   = 0;
      errEl.textContent = "Conta bloqueada temporariamente por excesso de tentativas.";
    } else {
      // Mensagem genérica — não revela se é e-mail ou senha errada
      errEl.textContent = "Credenciais inválidas. Tente novamente.";
    }
    errEl.classList.add("show");
    passEl.value = "";
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar no painel";
  }
}

async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Erro ao sair:", e);
  }
  closeAdminModal();
  showToast("Sessão encerrada com segurança.", "info");
}

// Monitora estado de autenticação (server-side — não pode ser forjado)
onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if (!user && document.getElementById("adminOverlay")?.classList.contains("active")) {
    closeAdminModal();
  }
});

// ─────────────────────────────────────────────
// RENDERIZAÇÃO DO SITE
// ─────────────────────────────────────────────
function renderSite() {
  if (!siteData) return;
  renderHero();
  renderAbout();
  renderTreatments();
  renderContact();
  document.getElementById("footerYear").textContent = new Date().getFullYear();
}

function renderHero() {
  const wp = siteData.wallpaper || {};
  let url = "";
  if (wp.customUrl) {
    url = wp.customUrl;
  } else {
    const idx = Number.isInteger(wp.presetIndex) ? wp.presetIndex : 0;
    url = ELCANA_DEFAULTS.wallpaperPresets[idx]?.full || ELCANA_DEFAULTS.wallpaperPresets[0].full;
  }
  document.getElementById("heroBg").style.backgroundImage = `url('${url}')`;

  const t = siteData.texts || {};
  // Título: última palavra "você." em itálico dourado
  const titleEl = document.getElementById("heroTitle");
  const title = sanitize(t.heroTitle || "");
  if (title.includes("você.")) {
    const parts = title.split("você.");
    titleEl.innerHTML = parts[0] + "<em>você.</em>" + sanitize(parts[1] || "");
  } else {
    titleEl.textContent = t.heroTitle || "";
  }
  document.getElementById("heroSub").textContent = t.heroSub || "";
}

function renderAbout() {
  const t = siteData.texts || {};
  document.getElementById("aboutTitle").textContent = t.aboutTitle || "";
  document.getElementById("aboutText").textContent  = t.aboutText  || "";
}

function renderTreatments() {
  const procs = siteData.procedures || [];
  const grid  = document.getElementById("treatmentsGrid");
  if (!procs.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1">Nenhum procedimento cadastrado.</p>`;
    return;
  }
  grid.innerHTML = procs.map((p, i) => `
    <div class="treatment-card">
      <span class="treatment-num">${String(i + 1).padStart(2, "0")}</span>
      <h3 class="treatment-name">${sanitize(p.name)}</h3>
      <p class="treatment-desc">${sanitize(p.desc)}</p>
    </div>
  `).join("");
}

function renderContact() {
  const c  = siteData.contact || {};
  const t  = siteData.texts   || {};
  const ph = (c.phone || "").replace(/\D/g, "");

  document.getElementById("contactAddress").innerHTML =
    sanitize(c.address || "").replace(" — ", "<br>");
  document.getElementById("contactPhrase").textContent = t.contactPhrase || "";

  const fmtPhone = ph.length >= 10
    ? `(${ph.substring(0,2)}) ${ph.substring(2,7)}-${ph.substring(7)}`
    : ph;

  const phoneEl = document.getElementById("contactPhone");
  phoneEl.textContent = fmtPhone;
  phoneEl.href = `https://api.whatsapp.com/send/?phone=${ph}`;

  const instaHandle = (c.instagram || "").replace("@", "");
  const instaEl = document.getElementById("contactInstagram");
  instaEl.textContent = c.instagram || "";
  instaEl.href = `https://instagram.com/${encodeURIComponent(instaHandle)}`;

  const wppBtn = document.getElementById("wppLink");
  wppBtn.href  = `https://api.whatsapp.com/send/?phone=${ph}`;
  wppBtn.innerHTML = `<span>💬</span> ${sanitize(c.wppText || "Falar no WhatsApp")}`;

  const footerInsta = document.getElementById("footerInsta");
  footerInsta.textContent = c.instagram || "";
  footerInsta.href = `https://instagram.com/${encodeURIComponent(instaHandle)}`;
}

// ─────────────────────────────────────────────
// NAV — scroll & mobile
// ─────────────────────────────────────────────
window.addEventListener("scroll", () => {
  document.getElementById("mainNav").classList.toggle("scrolled", window.scrollY > 60);
});
window.toggleMobileMenu = () => document.getElementById("mobileMenu").classList.toggle("open");
window.closeMobileMenu  = () => document.getElementById("mobileMenu").classList.remove("open");

// ─────────────────────────────────────────────
// MODAIS — LOGIN
// ─────────────────────────────────────────────
window.openLoginModal = function () {
  if (isAdmin) { openAdminModal(); return; }
  document.getElementById("loginOverlay").classList.add("active");
  setTimeout(() => document.getElementById("loginEmail").focus(), 100);
};
window.closeLoginModal = function () {
  document.getElementById("loginOverlay").classList.remove("active");
  document.getElementById("loginError").classList.remove("show");
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPass").value  = "";
};
document.getElementById("loginOverlay").addEventListener("click", function (e) {
  if (e.target === this) window.closeLoginModal();
});
document.getElementById("loginPass").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
window.doLogin = doLogin;

// ─────────────────────────────────────────────
// MODAIS — ADMIN
// ─────────────────────────────────────────────
function openAdminModal() {
  if (!isAdmin) return;
  populateAdminFields();
  renderAdminProcList();
  document.getElementById("adminOverlay").classList.add("active");
}
function closeAdminModal() {
  document.getElementById("adminOverlay").classList.remove("active");
  pendingImgFile = null;
}
window.closeAdminModal = closeAdminModal;
window.doLogout        = doLogout;

document.getElementById("adminOverlay").addEventListener("click", function (e) {
  if (e.target === this) closeAdminModal();
});

function populateAdminFields() {
  const d = siteData || ELCANA_DEFAULTS.site;
  const t = d.texts   || {};
  const c = d.contact || {};
  const w = d.wallpaper || {};

  document.getElementById("edit-heroTitle").value     = t.heroTitle     || "";
  document.getElementById("edit-heroSub").value       = t.heroSub       || "";
  document.getElementById("edit-aboutTitle").value    = t.aboutTitle    || "";
  document.getElementById("edit-aboutText").value     = t.aboutText     || "";
  document.getElementById("edit-contactPhrase").value = t.contactPhrase || "";
  document.getElementById("edit-address").value   = c.address   || "";
  document.getElementById("edit-phone").value     = c.phone     || "";
  document.getElementById("edit-instagram").value = c.instagram || "";
  document.getElementById("edit-wppText").value   = c.wppText   || "";

  // Marca preset selecionado
  document.querySelectorAll(".wallpaper-option").forEach((el, i) => {
    el.classList.toggle("selected", i === w.presetIndex && !w.customUrl);
  });
  document.getElementById("uploadName").classList.remove("show");
}

// ─────────────────────────────────────────────
// ADMIN TABS
// ─────────────────────────────────────────────
window.switchAdminTab = function (name, btn) {
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("admin-" + name).classList.add("active");
  if (btn) btn.classList.add("active");
};

// ─────────────────────────────────────────────
// WALLPAPER
// ─────────────────────────────────────────────
window.selectWallpaper = function (idx) {
  if (!isAdmin) return;
  document.querySelectorAll(".wallpaper-option").forEach((el, i) => {
    el.classList.toggle("selected", i === idx);
  });
  // Aplica preview imediato
  const url = ELCANA_DEFAULTS.wallpaperPresets[idx]?.full || "";
  document.getElementById("heroBg").style.backgroundImage = `url('${url}')`;
  pendingImgFile = null; // cancela upload pendente
  document.getElementById("uploadName").classList.remove("show");
  // Guarda temporariamente no siteData local (só persiste ao salvar)
  if (!siteData) siteData = structuredClone(ELCANA_DEFAULTS.site);
  siteData.wallpaper = { presetIndex: idx, customUrl: "" };
};

window.uploadWallpaper = function (e) {
  if (!isAdmin) return;
  const file = e.target.files[0];
  if (!file) return;
  if (!ALLOWED_IMG.includes(file.type)) {
    showToast("Formato inválido. Use JPG, PNG ou WEBP.", "error"); return;
  }
  if (file.size > MAX_IMG_MB * 1024 * 1024) {
    showToast(`Arquivo muito grande. Máximo ${MAX_IMG_MB}MB.`, "error"); return;
  }
  pendingImgFile = file;
  // Preview local imediato antes do upload
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById("heroBg").style.backgroundImage = `url('${ev.target.result}')`;
    document.querySelectorAll(".wallpaper-option").forEach(el => el.classList.remove("selected"));
    const nm = document.getElementById("uploadName");
    nm.textContent = `📷 Pronta para salvar: ${file.name}`;
    nm.classList.add("show");
  };
  reader.readAsDataURL(file);
};

// ─────────────────────────────────────────────
// SALVAR TUDO
// ─────────────────────────────────────────────
window.saveAll = async function () {
  if (!isAdmin) { showToast("Sessão expirada. Faça login novamente.", "error"); return; }

  const btn = document.getElementById("btnSave");
  btn.disabled    = true;
  btn.textContent = "Salvando…";

  try {
    // Coleta dados do formulário
    const newData = structuredClone(siteData || ELCANA_DEFAULTS.site);

    newData.texts = {
      heroTitle:     document.getElementById("edit-heroTitle").value.trim(),
      heroSub:       document.getElementById("edit-heroSub").value.trim(),
      aboutTitle:    document.getElementById("edit-aboutTitle").value.trim(),
      aboutText:     document.getElementById("edit-aboutText").value.trim(),
      contactPhrase: document.getElementById("edit-contactPhrase").value.trim()
    };
    newData.contact = {
      address:   document.getElementById("edit-address").value.trim(),
      phone:     document.getElementById("edit-phone").value.replace(/\D/g, ""),
      instagram: document.getElementById("edit-instagram").value.trim(),
      wppText:   document.getElementById("edit-wppText").value.trim()
    };

    // Se há imagem pendente de upload, envia primeiro para o Storage
    if (pendingImgFile) {
      showToast("Enviando imagem… aguarde.", "info");
      const url = await uploadHeroImage(pendingImgFile);
      newData.wallpaper = { presetIndex: -1, customUrl: url };
      pendingImgFile = null;
    }

    // Valida e salva no Firestore
    await saveToFirestore(newData);
    closeAdminModal();
    showToast("✓ Alterações salvas e publicadas para todos!");
  } catch (err) {
    console.error("Erro ao salvar:", err);
    showToast("Erro ao salvar: " + (err.message || "tente novamente."), "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "💾 Salvar & Publicar";
  }
};

// ─────────────────────────────────────────────
// PROCEDIMENTOS — ADMIN
// ─────────────────────────────────────────────
function renderAdminProcList() {
  const list  = document.getElementById("procedureList");
  const procs = (siteData || ELCANA_DEFAULTS.site).procedures || [];
  if (!procs.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0">Nenhum procedimento. Clique em "Adicionar" abaixo.</p>`;
    return;
  }
  list.innerHTML = procs.map((p, i) => `
    <div class="procedure-item">
      <div class="procedure-info">
        <div class="procedure-name">${sanitize(p.name)}</div>
        <div class="procedure-desc-short">${sanitize(p.desc.substring(0, 80))}${p.desc.length > 80 ? "…" : ""}</div>
      </div>
      <button class="btn-icon" onclick="openProcModal(${i})" title="Editar">✏️</button>
      <button class="btn-icon delete" onclick="deleteProcedure(${i})" title="Excluir">🗑</button>
    </div>
  `).join("");
}

window.openProcModal = function (idx) {
  if (!isAdmin) return;
  editingProcIdx = idx;
  const procs = (siteData || ELCANA_DEFAULTS.site).procedures || [];
  if (idx >= 0 && procs[idx]) {
    document.getElementById("procModalTitle").textContent = "Editar Procedimento";
    document.getElementById("procName").value = procs[idx].name;
    document.getElementById("procDesc").value = procs[idx].desc;
  } else {
    document.getElementById("procModalTitle").textContent = "Novo Procedimento";
    document.getElementById("procName").value = "";
    document.getElementById("procDesc").value = "";
  }
  document.getElementById("procOverlay").classList.add("active");
  setTimeout(() => document.getElementById("procName").focus(), 100);
};
window.closeProcModal = function () {
  document.getElementById("procOverlay").classList.remove("active");
};
document.getElementById("procOverlay").addEventListener("click", function (e) {
  if (e.target === this) window.closeProcModal();
});

window.saveProcedure = function () {
  if (!isAdmin) return;
  const name = document.getElementById("procName").value.trim();
  const desc = document.getElementById("procDesc").value.trim();
  if (!name) { document.getElementById("procName").focus(); return; }
  if (!siteData) siteData = structuredClone(ELCANA_DEFAULTS.site);
  if (!siteData.procedures) siteData.procedures = [];
  if (editingProcIdx >= 0) {
    siteData.procedures[editingProcIdx] = { name, desc };
  } else {
    siteData.procedures.push({ name, desc });
  }
  window.closeProcModal();
  renderAdminProcList();
  showToast("Procedimento atualizado. Clique em 'Salvar & Publicar'.");
};

window.deleteProcedure = function (i) {
  if (!isAdmin) return;
  const name = (siteData?.procedures || [])[i]?.name || "";
  if (confirm(`Remover o procedimento "${name}"?`)) {
    siteData.procedures.splice(i, 1);
    renderAdminProcList();
    showToast(`"${name}" removido. Clique em 'Salvar & Publicar'.`);
  }
};

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  const colors = {
    success: { border: "rgba(99,153,34,0.5)",      text: "#97c459" },
    error:   { border: "rgba(226,75,74,0.5)",       text: "#f09595" },
    info:    { border: "rgba(184,149,106,0.5)",      text: "var(--gold)" },
    warning: { border: "rgba(184,149,106,0.5)",      text: "var(--gold)" }
  };
  const c = colors[type] || colors.success;
  t.style.borderColor = c.border;
  t.style.color       = c.text;
  t.textContent       = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 5000);
}
window.showToast = showToast;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("footerYear").textContent = new Date().getFullYear();
  startRealtimeListener(); // busca dados do Firestore e renderiza
});
