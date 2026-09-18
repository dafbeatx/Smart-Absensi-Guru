# 🛡️ Zero-Trust Secret Management & Anti-Credential Leak Protocol

> **Target Audience**: AI Agents (Antigravity/Gemini/Claude), Frontend/Fullstack Developers.  
> **Mission**: Memastikan TIDAK ADA token rahasia, master key, atau private credential yang pernah bocor ke sisi browser/klien (`dist/assets/*.js`) melalui prefix `VITE_`.

---

## 1. Pemahaman Kritis: Mekanisme Bundling Vite (`The VITE_ Trap`)

Vite menggunakan aturan ketat:
- Semua variabel di `.env` yang diawali dengan **`VITE_`** akan **di-injeksi langsung (hardcoded) ke dalam bundle JavaScript klien** saat `npm run build`.
- Siapa pun yang membuka website dapat menekan **F12 / DevTools &rarr; Network / Sources / Console** dan melihat nilai variabel `VITE_` secara transparan tanpa enkripsi.
- Variabel yang **TIDAK diawali `VITE_`** (misal `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) aman diabaikan oleh bundler Vite dan hanya dapat dibaca oleh runtime server (Node.js / Vercel Serverless Functions via `process.env`).

---

## 2. Matriks Klasifikasi Kunci (Public vs Secret)

| Nama Variabel | Sifat | Prefix yang Benar | Alasan & Mekanisme Pengamanan |
| :--- | :---: | :---: | :--- |
| `SUPABASE_URL` | Public | `VITE_SUPABASE_URL` | Endpoint publik Supabase. |
| `SUPABASE_ANON_KEY` | Public | `VITE_SUPABASE_ANON_KEY` | Kunci anonim browser; diamankan oleh Row Level Security (RLS) PostgreSQL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **RAHASIA MUTLAK** | `SUPABASE_SERVICE_ROLE_KEY` *(HARAM VITE_)* | **Bypass RLS!** Memberikan hak akses superadmin penuh ke database. Hanya boleh di `api/`. |
| `TELEGRAM_BOT_TOKEN` | **RAHASIA MUTLAK** | `TELEGRAM_BOT_TOKEN` *(HARAM VITE_)* | Memberikan hak akses penuh ke bot Telegram. Hanya boleh di `api/telegram.ts`. |
| `TELEGRAM_CHAT_ID` | Public ID | `VITE_TELEGRAM_CHAT_ID` / `TELEGRAM_CHAT_ID` | Identifier ruang obrolan (bukan kunci autentikasi). |
| `GROQ_API_KEY` | **RAHASIA MUTLAK** | `GROQ_API_KEY` *(HARAM VITE_)* | Memberikan hak akses penuh ke kuota LLM Groq. Hanya boleh di `api/ai.ts` & `api/telegram.ts`. |
| `TURNSTILE_SITE_KEY` | Public | `VITE_TURNSTILE_SITE_KEY` | Public key untuk widget captcha Cloudflare di browser. |
| `TURNSTILE_SECRET_KEY` | **RAHASIA MUTLAK** | `TURNSTILE_SECRET_KEY` *(HARAM VITE_)* | Kunci validasi response token Turnstile di sisi server. |
| `VAPID_PUBLIC_KEY` | Public | `VITE_VAPID_PUBLIC_KEY` | Kunci kurva P-256 untuk registrasi service worker Web Push di browser. |
| `VAPID_PRIVATE_KEY` | **RAHASIA MUTLAK** | `VAPID_PRIVATE_KEY` *(HARAM VITE_)* | Kunci penandatanganan payload push notification di sisi server. |

---

## 3. Pola Arsitektur: Backend-for-Frontend (BFF) Serverless Proxy

Setiap kali aplikasi membutuhkan integrasi pihak ketiga yang memerlukan Secret Key, **AI Agent WAJIB menggunakan pola Serverless Proxy**:

```
[ Browser / HP Guru ]
       │
       │ 1. POST /api/ai (hanya kirim messages payload, ZERO secrets)
       ▼
[ Vercel Serverless Function (api/ai.ts) ]
       │
       │ 2. Membaca process.env.GROQ_API_KEY (100% di server)
       │ 3. POST https://api.groq.com/openai/v1/chat/completions (Bearer Secret)
       ▼
[ Groq AI Cloud Engine ]
```

### Aturan Implementasi di Sisi Frontend (`src/`):
```typescript
// ✅ BENAR: Panggil proxy serverless internal
if (typeof window !== 'undefined') {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }),
  });
  const data = await res.json();
  return data.content;
}

// ❌ HARAM: Membaca VITE_GROQ_API_KEY dan fetch langsung ke api.groq.com dari browser
const apiKey = import.meta.env.VITE_GROQ_API_KEY; // BOCOR KE PUBLIK!
await fetch('https://api.groq.com/...', {
  headers: { Authorization: `Bearer ${apiKey}` }
});
```

---

## 4. Checklist Wajib AI Agent Sebelum Melakukan Perubahan Kode

Setiap AI Agent yang bertugas di repositori ini WAJIB memverifikasi checklist berikut:

1. [ ] **Apakah variabel baru adalah kunci rahasia/private?**
   Jika YA &rarr; **JANGAN PERNAH** menambahkan prefix `VITE_`.
2. [ ] **Apakah ada panggilan API langsung dari `src/` ke server pihak ketiga menggunakan secret key?**
   Jika YA &rarr; Pindahkan panggilan tersebut ke Vercel Serverless Function di folder `api/`.
3. [ ] **Apakah `.env` diabaikan oleh Git?**
   Pastikan `.env`, `.env.local`, `*.env.local` selalu terdaftar di `.gitignore`.
4. [ ] **Apakah `dist/` bundle bersih dari token?**
   Setelah `npm run build`, pastikan token rahasia (`gsk_`, bot token) tidak muncul di output `dist/assets/*.js`.

---

## 5. Konsekuensi Pelanggaran

Jika AI Agent secara sengaja atau tidak sengaja menambahkan `VITE_` pada secret token atau mengekspos token rahasia ke browser klien, tindakan tersebut dianggap sebagai **Severe Security Regression** yang melanggar arsitektur pertahanan *Zero-Trust* Smart Absensi Guru.
