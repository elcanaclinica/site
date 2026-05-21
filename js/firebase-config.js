/**
 * firebase-config.js — Clínica Elcana
 * =====================================================
 * INSTRUÇÕES DE CONFIGURAÇÃO (leia antes de publicar):
 *
 * 1. Acesse https://console.firebase.google.com
 * 2. Crie um projeto (ex: "clinica-elcana")
 * 3. Vá em "Configurações do projeto" > "Seus aplicativos" > ícone Web (</>)
 * 4. Registre o app e copie os valores abaixo
 * 5. Ative o Firestore: Build > Firestore Database > Create database (modo produção)
 * 6. Ative o Authentication: Build > Authentication > Sign-in method > Email/Senha
 * 7. Crie o usuário admin: Authentication > Users > Add user
 * 8. Configure as regras de segurança do Firestore (veja SECURITY_RULES.txt)
 * =====================================================
 */

const FIREBASE_CONFIG = {
  apiKey:            "COLE_AQUI_SUA_API_KEY",
  authDomain:        "COLE_AQUI.firebaseapp.com",
  projectId:         "COLE_AQUI_SEU_PROJECT_ID",
  storageBucket:     "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI_SENDER_ID",
  appId:             "COLE_AQUI_APP_ID"
};

// Domínios autorizados a usar este site (proteção contra uso indevido da config)
// Adicione aqui o domínio do seu site após publicar
const AUTHORIZED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "clinicaelcana.com.br",       // ← altere para o seu domínio
  "www.clinicaelcana.com.br"    // ← altere para o seu domínio
];
