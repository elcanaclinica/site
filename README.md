# Clínica Elcana — Site com Firebase

Site institucional com painel de administração integrado ao Firebase.
Alterações feitas pelo painel são **permanentes e instantâneas** para todos os visitantes.

---

## 📁 Estrutura de Arquivos

```
elcana-firebase/
├── index.html                ← Página principal
├── css/
│   └── style.css             ← Todo o visual do site
├── js/
│   ├── firebase-config.js    ← ⚠️ VOCÊ PREENCHE SUAS CREDENCIAIS AQUI
│   ├── data.js               ← Conteúdo padrão (fallback)
│   └── app.js                ← Toda a lógica do site e painel admin
├── img/
│   └── (suas fotos aqui)
├── FIRESTORE_RULES.txt       ← Regras de segurança do banco de dados
├── STORAGE_RULES.txt         ← Regras de segurança do armazenamento de imagens
└── README.md                 ← Este arquivo
```

---

## 🔥 PASSO 1 — Configurar o Firebase (faça isso primeiro)

### 1.1 Criar projeto

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Nomeie: `clinica-elcana` (ou qualquer nome)
4. Desative o Google Analytics (opcional) e conclua

---

### 1.2 Registrar o app Web

1. No painel do projeto, clique no ícone **`</>`** (Web)
2. Nome do app: `site-elcana`
3. **NÃO** marque "Firebase Hosting" (usaremos GitHub Pages)
4. Clique em **"Registrar app"**
5. Copie os valores que aparecem em `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

6. Abra o arquivo `js/firebase-config.js` e cole cada valor no lugar indicado

---

### 1.3 Ativar o Firestore (banco de dados)

1. No menu esquerdo: **Build → Firestore Database**
2. Clique em **"Create database"**
3. Escolha **"Start in production mode"** (mais seguro)
4. Escolha a região: `southamerica-east1` (São Paulo)
5. Clique em **"Enable"**
6. Vá na aba **"Rules"** e substitua todo o conteúdo pelo que está em `FIRESTORE_RULES.txt`
7. Clique em **"Publish"**

---

### 1.4 Ativar o Firebase Storage (armazenamento de imagens)

1. No menu esquerdo: **Build → Storage**
2. Clique em **"Get started"**
3. Escolha **"Start in production mode"**
4. Mesma região: `southamerica-east1`
5. Vá na aba **"Rules"** e substitua pelo conteúdo de `STORAGE_RULES.txt`
6. Clique em **"Publish"**

---

### 1.5 Ativar o Authentication (login seguro)

1. No menu esquerdo: **Build → Authentication**
2. Clique em **"Get started"**
3. Em **"Sign-in method"**, ative **"E-mail/senha"**
4. Vá em **"Users"** → clique em **"Add user"**
5. Digite o e-mail e senha da administradora da clínica
6. Clique em **"Add user"**

> ⚠️ **Anote bem o e-mail e senha** — eles são usados para entrar no painel admin do site.
> Para redefinir a senha: Firebase Console → Authentication → Users → clique no usuário → "Reset password".

---

### 1.6 Autorizar o domínio no Firebase

1. Authentication → **Settings** → **Authorized domains**
2. Clique em **"Add domain"** e adicione:
   - `localhost` (para testar localmente)
   - `seuusuario.github.io`
   - `www.clinicaelcana.com.br` (após ter o domínio)

---

## 🚀 PASSO 2 — Publicar no GitHub Pages

### 2.1 Criar repositório

1. Acesse [github.com](https://github.com) e faça login
2. Clique em **"New repository"**
3. Nome: `clinica-elcana`
4. Deixe **Public**
5. Clique em **"Create repository"**

### 2.2 Fazer upload dos arquivos

1. No repositório, clique em **"uploading an existing file"**
2. Arraste todos os arquivos da pasta `elcana-firebase/`
3. Mensagem de commit: `"Publicação inicial do site"`
4. Clique em **"Commit changes"**

### 2.3 Ativar GitHub Pages

1. No repositório: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / pasta: **/ (root)**
4. Clique em **Save**
5. Aguarde ~2 minutos. O site estará em:
   ```
   https://SEUUSUARIO.github.io/clinica-elcana/
   ```

---

## 🌐 PASSO 3 — Conectar seu domínio próprio

### No GitHub Pages:
1. Settings → Pages → **Custom domain**
2. Digite: `www.clinicaelcana.com.br`
3. Marque **"Enforce HTTPS"**

### No provedor de domínio (Registro.br, Hostinger, etc.):

Adicione os registros DNS abaixo:

| Tipo  | Nome | Valor                  |
|-------|------|------------------------|
| A     | @    | `185.199.108.153`      |
| A     | @    | `185.199.109.153`      |
| A     | @    | `185.199.110.153`      |
| A     | @    | `185.199.111.153`      |
| CNAME | www  | `seuusuario.github.io` |

> A propagação do DNS pode levar até 24h.

---

## 🔐 Segurança implementada

| Camada | Proteção |
|--------|----------|
| **Firebase Auth** | Login com e-mail/senha criptografado — somente usuários cadastrados acessam o painel |
| **Firestore Rules** | Escrita no banco exige autenticação server-side — não pode ser burlada pelo navegador |
| **Storage Rules** | Upload de imagens exige autenticação, valida tipo (JPG/PNG/WEBP) e tamanho (máx. 5MB) |
| **Content Security Policy** | Cabeçalho HTTP que bloqueia scripts externos não autorizados (proteção XSS) |
| **Sanitização de inputs** | Todo texto inserido pelo admin é sanitizado antes de ser exibido no site |
| **Validação de dados** | Todos os campos têm limite de tamanho e tipo validados no cliente E no servidor |
| **Rate limiting** | Após 5 tentativas de login erradas, o painel bloqueia por 5 minutos |
| **URL validation** | URLs de imagem são validadas para aceitar apenas http/https |
| **X-Frame-Options: DENY** | Impede que o site seja embutido em iframes (proteção contra clickjacking) |
| **X-Content-Type-Options** | Impede que o navegador interprete arquivos com tipo errado |

---

## 🛠️ Manutenção

### Alterar a senha do painel admin:
Firebase Console → Authentication → Users → clique no usuário → Reset password

### Ver histórico de alterações:
Firebase Console → Firestore → config → site → clique em "View version history"

### Adicionar um segundo admin:
Firebase Console → Authentication → Users → Add user

---

## ❓ Perguntas frequentes

**As alterações somem quando fecho o navegador?**
Não. Tudo é salvo no Firebase. Qualquer pessoa que acessar o site verá as alterações.

**Quanto custa o Firebase?**
O plano gratuito (Spark) é suficiente para sites de clínicas pequenas e médias. Inclui:
- 1 GB de banco de dados
- 5 GB de armazenamento de imagens
- 50.000 leituras por dia
- 20.000 escritas por dia

**O que acontece se eu exceder o limite gratuito?**
O Firebase bloqueia as operações até o próximo mês — o site continua funcionando normalmente para os visitantes.

---

*Desenvolvido para a Clínica Elcana — Curitiba, PR*
