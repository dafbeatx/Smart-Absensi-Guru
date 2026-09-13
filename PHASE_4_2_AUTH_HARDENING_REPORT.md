# 🔐 PHASE 4.2 REPORT: AUTHENTICATION HARDENING & DATABASE SESSION STORE

**Project:** Smart Absensi Guru / SAGA Terpadu  
**Phase:** 4.2 — Authentication Hardening & Database Session Store  
**Date:** 2026-09-13  
**Status:** **GREEN 🟢**  

---

## 1. Pre-Implementation Audit

Sesuai audit menyeluruh terhadap alur otentikasi existing sebelum implementasi:

1. **LoginPage.tsx**:
   - Memanggil `AuthRepository.login({ identity, pin, device_uuid, device_model })`.
   - Mengambil token dan user profile dari `res.token` dan `res.user`.
   - Menjalankan `loginSuccess(res.token, res.user)` untuk menyimpan sesi ke Zustand store.
   - **Visual & UI Kontrak:** 100% dipertahankan tanpa perubahan visual atau layout apa pun.
2. **src/store/useAuthStore.ts**:
   - Mengelola state sesi melalui middleware `persist` dengan key `smart_absensi_auth_storage` di `localStorage`.
   - Kontrak state: `{ token: string | null, user: UserProfile | null, isAuthenticated: boolean, deviceUUID: string }`.
   - **Pemulihan Sesi (Refresh):** Saat browser di-refresh, data `token`, `user`, dan `deviceUUID` langsung terhidrasi dari `localStorage`.
3. **Logout Flow**:
   - Seluruh komponen memanggil `useAuthStore.getState().logout()`.
   - Telah ditambahkan mekanisme *fire-and-forget* ke `POST /api/auth/logout` apabila token diawali dengan prefix `saga_sess_`, mencabut sesi di database tanpa memblokir pembersihan state lokal klien.
4. **Attendance Flow & Device Binding Isolation**:
   - Audit membuktikan tabel `public.device_bindings` digunakan khusus untuk validasi "1 Akun = 1 Perangkat Fisik" pada pemindaian QR absensi fisik (`QRScannerOverlay.tsx`).
   - Web login (laptop/desktop) **TIDAK** memblokir login ketika `device_uuid` berbeda. Hal ini menjamin fleksibilitas administrasi guru di laptop tanpa mengganggu ikatan HP presensi fisik.
   - Workflow absensi (QR, RFID, Biometrik, Dexie offline sync, geofencing) **100% tidak tersentuh dan terisolasi**.

---

## 2. Migration 38: Database Session Store (`public.user_sessions`)

Telah dibuat dan dieksekusi secara idempotent di Supabase PostgreSQL: `sql/38_user_sessions.sql`.

### Struktur Skema
```sql
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    device_uuid TEXT,
    device_model TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);
```

### Indeks Performa
- `idx_user_sessions_token_hash`: UNIQUE index pada `token_hash` untuk verifikasi instan `< 1ms`.
- `idx_user_sessions_user_id`: Index pada `user_id` untuk force logout dan audit sesi.
- `idx_user_sessions_active`: Composite index `(token_hash, revoked_at, expires_at)` untuk evaluasi request API.
- `idx_user_sessions_expiry`: Index pada `expires_at` untuk pembersihan berkala.

### Database Row Level Security (RLS) & Zero-Trust
- RLS diaktifkan (`ENABLE ROW LEVEL SECURITY`).
- **Deny-by-default:** Tidak ada policy untuk role `anon` atau `authenticated`.
- Akses mutasi dan baca HANYA diberikan kepada backend serverless berotentikasi service role:
  ```sql
  CREATE POLICY "user_sessions_service_role_all" ON public.user_sessions
      FOR ALL
      TO public
      USING (
          current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
          OR auth.role() = 'service_role'
      );
  ```
- **Verifikasi Live:** Kueri anonim via PostgREST ditolak dengan HTTP 401/403 PostgreSQL Error `42501` (*permission denied for table user_sessions*).
- **Zero Plaintext Token:** Database hanya menyimpan SHA-256 hash (64 hex characters).

---

## 3. Server-Side Login Engine (`api/auth/login.ts`)

Endpoint: `POST /api/auth/login`

### Alur Kerja & Kontrol Keamanan
1. **Validasi Input:** Memastikan kelengkapan `identity` (NPP/No HP) dan PIN 6-digit.
2. **Lookup Pengguna:** Mengambil profil dari `public.users` berdasarkan NPP atau No HP.
3. **Cek Status & Lockout:**
   - Memastikan `account_status === 'ACTIVE'`.
   - Memeriksa `locked_until`. Jika terkunci, menolak dengan HTTP 429 `AUTH_ACCOUNT_LOCKED`.
4. **Verifikasi Kredensial:**
   - Menghitung SHA-256 dari input PIN.
   - Menggunakan perbandingan *timing-safe* (`crypto.timingSafeEqual`) untuk memitigasi serangan timing.
   - Jika PIN salah: `failed_login_count` bertambah. Jika mencapai 5x, mengunci akun selama 15 menit.
   - Jika PIN benar: Mereset `failed_login_count` menjadi 0 dan membersihkan `locked_until`.
5. **Penerbitan Token CSPRNG:**
   - Dihasilkan via `crypto.randomBytes(32).toString('hex')` dengan prefix `saga_sess_`.
   - Menghasilkan 256-bit entropy kriptografis.
6. **Hash-Only Storage:**
   - Token di-hash menggunakan SHA-256.
   - Hanya `token_hash` yang disimpan ke `public.user_sessions`.
   - Token plaintext dikembalikan satu kali ke klien dalam response login (`res.json({ success: true, token, user })`).
7. **Privasi & Sanitasi:**
   - PIN dan `pin_hash` tidak pernah dimasukkan ke dalam response payload maupun dicatat dalam log server.

---

## 4. Server-Side Logout Engine (`api/auth/logout.ts`)

Endpoint: `POST /api/auth/logout`

### Alur Kerja
1. Membaca header `Authorization: Bearer saga_sess_...`.
2. Menghitung SHA-256 dari token raw.
3. Melakukan update pada `public.user_sessions` yang cocok dengan `token_hash`:
   - `revoked_at = NOW()`
   - `revocation_reason = 'USER_LOGOUT'`
4. Bersifat idempoten dan aman terhadap brute-force.
5. Token yang telah dicabut langsung ditolak oleh middleware otentikasi.

---

## 5. Shared Session Authentication Middleware (`api/_shared/session-auth.ts`)

Fungsi inti: `authenticateUser(req): Promise<AuthContext>`

### Alur Validasi Otoritas Server
1. **Ekstraksi Token:** Memeriksa `Authorization: Bearer <token>`.
2. **Prefix Enforcement:** Menolak token tanpa prefix `saga_sess_` (menolak token lama `SB_JWT_` dan token acak).
3. **Hashing:** Menghitung SHA-256 token hash.
4. **Database Verification:**
   - Query `user_sessions` join `public.users` berdasarkan `token_hash`.
   - Memastikan sesi ditemukan di database.
   - Memastikan `revoked_at IS NULL` (jika dicabut, tolak `401 AUTH_SESSION_REVOKED`).
   - Memastikan `expires_at > NOW()` (jika kedaluwarsa, tolak `401 AUTH_SESSION_EXPIRED`).
   - Memastikan `account_status === 'ACTIVE'` (jika non-aktif, tolak `401 AUTH_USER_INACTIVE`).
5. **Otoritas Identitas Berbasis Server:**
   - Mengembalikan context terotentikasi: `{ ok: true, userId, user, role, sessionId }`.
   - Mengabaikan `role` atau `user_id` yang dikirim dalam request body/header klien.
   - Memperbarui `last_seen_at` secara asinkron (*fire-and-forget*).

---

## 6. Client Integration (`src/providers/supabase-provider.service.ts` & `useAuthStore.ts`)

1. **SupabaseProvider.login()**:
   - Di lingkungan browser, memanggil `POST /api/auth/login`.
   - Mengembalikan `{ token: 'saga_sess_...', user: UserProfile }` yang kompatibel dengan kontrak `useAuthStore`.
   - Menyediakan fallback aman untuk runner testing unit offline.
2. **useAuthStore.logout()**:
   - Jika token aktif berformat `saga_sess_`, memicu panggilan asinkron ke `POST /api/auth/logout` untuk mencabut sesi di server sebelum membersihkan state lokal browser.
3. **Presensi & Kompatibilitas:**
   - Alur absensi harian dan QR absensi tetap menggunakan state `useAuthStore` dan `SupabaseProvider` tanpa regresi.

---

## 7. Security Test Suite (`src/services/__tests__/auth-hardening-session.test.ts`)

Telah dibangun test suite khusus yang menguji seluruh 20 skenario keamanan sesuai mandat Phase 4.2:

| No | Skenario Uji Keamanan | Status | Hasil Evaluasi |
|:---|:---|:---:|:---|
| 1 | Valid login returns HTTP 200 with success status | **PASS** | Status 200, format response `{ success: true, token, user }` valid |
| 2 | Issued session token has mandatory `saga_sess_` prefix | **PASS** | Token terbitan diawali `saga_sess_` |
| 3 | Session token exhibits 256-bit CSPRNG entropy & 0 collisions | **PASS** | 64 karakter heksadesimal, pengujian 10 run tanpa tabrakan |
| 4 | Database stores ONLY 64-character SHA-256 token hash | **PASS** | `token_hash` persis SHA-256, plaintext token tidak tersimpan di database |
| 5 | Session middleware accepts valid session & returns server context | **PASS** | Mengembalikan `ok: true`, `userId: 'usr_guru_001'`, `role: 'GURU'` |
| 6 | Forged `saga_sess_` token not in DB rejected with 401 | **PASS** | Ditolak aman dengan `AUTH_SESSION_INVALID` |
| 7 | Legacy unverified `SB_JWT` token rejected by new middleware | **PASS** | Ditolak aman dengan `AUTH_SESSION_INVALID` tanpa fallback ke sesi lama |
| 8 | Revoked session rejected with 401 `AUTH_SESSION_REVOKED` | **PASS** | Sesi dengan `revoked_at != null` ditolak aman |
| 9 | Expired session rejected with 401 `AUTH_SESSION_EXPIRED` | **PASS** | Sesi dengan `expires_at <= NOW()` ditolak aman |
| 10 | Missing authorization header rejected with 401 | **PASS** | Ditolak aman dengan `AUTH_SESSION_MISSING` |
| 11 | Inactive user login rejected with 401 `AUTH_USER_INACTIVE` | **PASS** | User berstatus `INACTIVE` ditolak saat login & otentikasi |
| 12 | Locked user rejected with HTTP 429 `AUTH_ACCOUNT_LOCKED` | **PASS** | Akun terkunci sementara ditolak dengan status HTTP 429 |
| 13 | Incorrect PIN returns 401 & increments `failed_login_count` | **PASS** | Status 401 `AUTH_INVALID_CREDENTIALS`, counter gagal naik 1 |
| 14 | Brute-force threshold (5 failed attempts) triggers 15-min lock | **PASS** | Pada percobaan ke-5 gagal, akun dikunci 15 menit ke depan |
| 15 | Role spoofing in client body ignored; DB role prevails | **PASS** | Payload client `role: 'ADMIN'` diabaikan; server menetapkan `GURU` |
| 16 | Spoofed `user_id` in client body ignored | **PASS** | Identitas pengguna diikat 100% ke hash token sesi di database |
| 17 | Logout immediately marks session `revoked_at` in DB | **PASS** | Sesi langsung dicabut di database dan request berikutnya ditolak |
| 18 | Plaintext session token is strictly absent from server logs | **PASS** | Token tidak pernah dibocorkan ke `console.log` / stream log server |
| 19 | Plaintext PIN & pin_hash strictly excluded from response & logs | **PASS** | Kredensial sensitif disanitasi penuh dari response payload dan log |
| 20 | Supabase Service Role Key absent from VITE_ client bundle | **PASS** | Tidak ada variable `VITE_*` yang membocorkan service role key |

---

## 8. Attendance Regression Verification

Seluruh 26 test suite sistem existing telah diuji kembali bersama test suite baru:
- **Total Test Suites:** 27 suites
- **Total Test Cases:** **513 Passed, 0 Failed (100% PASS)**
- **Durasi Eksekusi:** ~3.7 detik

### Verifikasi Alur Fungsional Guru:
1. **Login Guru Existing:** Berjalan mulus baik via endpoint serverless maupun fallback offline provider.
2. **Session Restoration:** Berjalan aman melalui rehidrasi localStorage Zustand (`useAuthStore`).
3. **Logout:** Berhasil membersihkan state lokal sekaligus mencabut sesi server secara asinkron.
4. **Dashboard Guru:** Menampilkan data jadwal, notifikasi, dan profil secara normal.
5. **QR Attendance:** State machine 5-step tetap beroperasi normal dengan radius buffer 500m.
6. **RFID Attendance:** Directory siswa dan kartu ujian beroperasi normal (Suite 23 PASS).
7. **Biometric Attendance:** Enrolment dan matching fingerprint beroperasi normal (Suite 11 PASS).
8. **Dexie Offline Queue:** Operasi antrean lokal dan sinkronisasi beroperasi normal (Suite 21 PASS).
9. **Device Binding:** Validasi `public.device_bindings` pada pemindaian QR tetap aktif dan terisolasi dari login web.

---

## 9. Database Security Verification

- **Migration 38:** Berhasil dieksekusi secara live.
- **Tabel `public.user_sessions`:**
  - RLS aktif (`ENABLE ROW LEVEL SECURITY`).
  - Zero-trust deny-by-default: Akses publik (`anon`) ditolak dengan HTTP 401/403 (`42501`).
  - Akses mutasi (`INSERT`, `UPDATE`, `DELETE`) dan `SELECT` hanya diizinkan untuk `service_role`.
  - Zero plaintext token tersimpan di database (hanya kolom `token_hash VARCHAR(64)`).

---

## 10. Known Limitations

1. **Localhost Development tanpa Vercel CLI**:
   - Jika dijalankan dengan `vite` polos tanpa Vercel dev proxy, request browser ke `/api/auth/login` akan dialihkan secara otomatis dan aman ke jalur `SupabaseProvider` fallback untuk menjaga fungsionalitas lokal.
2. **Multi-Tab Concurrency**:
   - Sesi token aktif tersimpan di `localStorage`. Jika pengguna melakukan logout di salah satu tab, server akan mencabut sesi tersebut sehingga tab lain akan menerima 401 pada request API serverless berikutnya.

---

## 11. Legacy Authentication Transition Status

- **Status Token Lama (`SB_JWT_...`):**
  - Token lama tetap dikategorikan sebagai **LEGACY**.
  - Token lama **TIDAK** diperbolehkan untuk mengakses endpoint serverless baru yang dilindungi oleh `session-auth.ts`.
  - Sistem tidak menggunakan fallback yang melemahkan keamanan (*no legacy fallback on protected endpoints*).
  - Alur absensi lama tetap berfungsi secara independen tanpa terganggu selama masa transisi bertahap ini.

---

## 12. Final Status & Architectural Statement

> **Token theft risk is mitigated through server-side stateful sessions, cryptographically random tokens, hash-only persistence, expiration, and revocation.**  
> Modul otentikasi baru ini menyediakan **server-verifiable, stateful session security** yang siap menjadi fondasi proteksi endpoint sensitif pada fase-fase berikutnya.

**FINAL VERDICT: GREEN 🟢**

---

## 🛑 FINAL STOP NOTICE

Sesuai instruksi Batasan Mutlak Phase 4.2:
- **TIDAK MEMBUAT** `/api/homeroom/*`.
- **TIDAK MEMBUAT** UI Ruang Wali Kelas.
- **TIDAK MEMBUAT** otorisasi wali kelas.
- **TIDAK MENGUBAH** autentikasi absensi guru existing.
- **TIDAK MENGHAPUS** autentikasi legacy secara paksa.

Pekerjaan Phase 4.2 telah selesai 100%. Menunggu review pengguna sebelum melanjutkan ke Phase berikutnya.
