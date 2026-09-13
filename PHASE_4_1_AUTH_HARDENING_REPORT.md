# PHASE 4.1 — AUTHENTICATION HARDENING ARCHITECTURE DECISION REPORT

**Project**: Smart Absensi Guru / SAGA Terpadu  
**Module**: Ruang Wali Kelas — Modul Pendataan Rencana Pendidikan Lanjutan Siswa Kelas 9  
**Status**: 🟡 **PHASE 4.1 COMPLETED — ARCHITECTURAL EVALUATION & DECISION READY**  
**Timestamp**: 2026-09-13T23:35:00+07:00  

---

## 1. LATAR BELAKANG & TEMUAN FORENSIK PHASE 4.0

Pada audit awal Phase 4.0, teridentifikasi celah arsitektural kritis:
1. **Penerbitan Token Klien**: Token sesi saat ini (`SB_JWT_<userId>_<timestamp>`) di-generate murni di sisi browser pada [src/providers/supabase-provider.service.ts](file:///c:/Smart-Absensi-Guru/src/providers/supabase-provider.service.ts#L139).
2. **Ketiadaan Tanda Tangan Kriptografis**: Token tidak memiliki HMAC, signature digital, atau verifikasi kriptografis.
3. **Ketiadaan Session Store Server**: Database Supabase tidak memiliki tabel pencatat sesi (`sessions` / `auth_tokens`).
4. **Resiko Penyamaran Identitas (Impersonation)**: Siapa pun dapat mengirim `Authorization: Bearer SB_JWT_usr_admin_001_9999999999999` dan serverless function lama (`api/push-subscriptions.ts`) akan mempercayainya sebagai `usr_admin_001` hanya karena user tersebut berstatus `ACTIVE` di `public.users`.

> **Prinsip Phase 4**: SAGA tidak boleh membiarkan backend mempercayai token yang dapat dipalsukan. Kita harus melakukan **Authentication Hardening** untuk menghasilkan *server-verifiable session* tanpa mengubah flow pengguna eksisting (NPP/WhatsApp + PIN + device binding tetap dipertahankan).

---

## 2. EVALUASI MENDALAM: OPSI A (HMAC-SHA256 SIGNED JWT)

### A. Konsep Kerja
* **Penerbitan Sesi (Server-Side Login)**: Klien mengirim kredensial login (WhatsApp/NPP + PIN + Device UUID) ke serverless endpoint `POST /api/auth/login`. Server memverifikasi hash PIN dan menandatangani JWT menggunakan rahasia server `AUTH_JWT_SECRET`.
* **Payload Token**:
  ```json
  {
    "sub": "usr_guru_002",
    "role": "GURU",
    "device_uuid": "f81d4fae-7dec-4xxx-yxxx-e4szym7ui8rmsi9vzsc",
    "iat": 1789316122,
    "exp": 1789920922,
    "iss": "saga-auth-engine",
    "aud": "saga-app"
  }
  ```
* **Verifikasi Server-Side**: Serverless function memverifikasi keaslian signature via `jwt.verify(token, AUTH_JWT_SECRET)`. Jika valid, server mengambil `sub` dan memverifikasi status aktif ke `public.users`.

### B. Analisis Kelebihan & Kelemahan Opsi A
* **Kelebihan**:
  1. *Stateless*: Verifikasi token tidak memerlukan pembacaan tabel session di database.
  2. *Tanpa Migrasi Database*: Tidak perlu menambahkan tabel baru pada Supabase PostgreSQL.
* **Kekurangan & Risiko pada Kasus SAGA**:
  1. **Pencabutan Sesi (Revocation / Logout) Lemah**: Karena JWT bersifat stateless, saat guru melakukan *Logout*, token yang tersimpan (atau dicuri) tetap sah secara kriptografis sampai masa `exp` habis, kecuali server menerapkan *blacklist store* di Redis/DB (yang menghilangkan esensi stateless-nya).
  2. **Force Logout & Pergantian HP Terkendala**: Jika HP guru hilang atau Admin mereset device binding guru, sesi lama tidak otomatis mati seketika.
  3. **Manajemen Secret di Vercel**: Bergantung 100% pada variabel lingkungan `AUTH_JWT_SECRET`. Jika secret bocor, seluruh token dapat dipalsukan secara global.

---

## 3. EVALUASI MENDALAM: OPSI B (DATABASE SESSION STORE)

### A. Konsep Kerja
* **Penerbitan Sesi (Server-Side Login)**:
  1. Klien mengirim kredensial login (WhatsApp/NPP + PIN + Device UUID) ke serverless endpoint `POST /api/auth/login`.
  2. Server memverifikasi PIN dan status `ACTIVE` di `public.users`.
  3. Server membangkitkan token acak berkekuatan tinggi (32-byte cryptographically secure random: `crypto.randomBytes(32).toString('hex')` → string acak 64 karakter).
  4. Server menghitung hash token: `token_hash = sha256(token)`.
  5. Server menyimpan **HANYA** `token_hash` ke tabel baru `public.user_sessions`. Plaintext token **TIDAK PERNAH** disimpan di database.
  6. Server mengembalikan plaintext token ke browser untuk disimpan di `useAuthStore.token`.
* **Verifikasi Server-Side**:
  1. Klien mengirim: `Authorization: Bearer <session_token>`.
  2. Server menghitung: `incoming_hash = sha256(session_token)`.
  3. Server melakukan query tunggal ke `user_sessions` via Service Role:
     ```sql
     SELECT s.*, u.role, u.account_status, u.full_name
     FROM public.user_sessions s
     JOIN public.users u ON s.user_id = u.id
     WHERE s.token_hash = incoming_hash
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW();
     ```
  4. Jika tidak ditemukan, kedaluwarsa, atau dicabut: langsung tolak `401 AUTH_SESSION_INVALID` / `AUTH_SESSION_EXPIRED`.
  5. Server memvalidasi kesesuaian `device_uuid` untuk mencegah pembajakan sesi lintas perangkat.

### B. Rancangan Skema Tabel `public.user_sessions`
```sql
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    device_uuid TEXT NOT NULL,
    device_model TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

-- Indexing Cepat untuk Autentikasi Setiap Request (< 1ms)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash 
    ON public.user_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup
    ON public.user_sessions (token_hash, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
    ON public.user_sessions (user_id)
    WHERE revoked_at IS NULL;

-- Hardening RLS: Zero-Trust Deny-by-Default
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Dilarang diakses langsung oleh anon/klien publik
CREATE POLICY "user_sessions_service_role_all" ON public.user_sessions
    FOR ALL
    TO public
    USING (
        current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
        OR auth.role() = 'service_role'
    );
```

### C. Analisis Kelebihan & Kelemahan Opsi B
* **Kelebihan**:
  1. **Instant Revocation (Pencabutan Sesi Real-Time)**: Logout seketika mematikan sesi (`revoked_at = NOW()`).
  2. **100% Selaras dengan Device Binding SAGA ("1 Akun = 1 HP")**: Sesi terikat permanen ke `device_uuid`. Akses dengan token curian dari HP lain langsung tertolak.
  3. **Zero-Knowledge Token Security**: Database hanya menyimpan `token_hash` SHA-256. Jika database ter-dump/leak, token mentah tidak dapat direkonstruksi oleh peretas.
  4. **Admin Force-Logout**: Admin sekolah dapat mencabut sesi seorang guru kapan pun (misal saat mutasi guru atau laporan kehilangan ponsel).
  5. **Kompatibilitas Penuh**: `useAuthStore` dan `LoginPage.tsx` tidak berubah kontraknya (`token` tetap bertipe string).
* **Kekurangan**:
  1. Membutuhkan 1 migration DDL aman: `sql/38_user_sessions.sql`.
  2. Memerlukan 1 query lookup database per request API (dapat dioptimasi dengan single JOIN dan index B-Tree).

---

## 4. MATRIKS THREAT MODEL (PERBANDINGAN KEAMANAN TERHADAP 11 SKENARIO SERANGAN)

| Skenario Serangan | Opsi A (HMAC JWT) | Opsi B (Session Store) | Pemenang |
|---|:---:|:---:|:---:|
| **ATTACK 1: Forged userId token** (`SB_JWT_usr_admin_001_...`) | 🛡️ **BLOCKED** (Signature invalid) | 🛡️ **BLOCKED** (Token hash tidak ada di DB) | **SERI** |
| **ATTACK 2: Forged admin token** | 🛡️ **BLOCKED** (Tanpa secret JWT) | 🛡️ **BLOCKED** (Hash tidak terdaftar di DB) | **SERI** |
| **ATTACK 3: Expired token replay** | 🛡️ **BLOCKED** (`exp` claim divalidasi) | 🛡️ **BLOCKED** (`expires_at > NOW()` divalidasi) | **SERI** |
| **ATTACK 4: Revoked session replay** (Token setelah logout) | ⚠️ **VULNERABLE** (JWT tetap valid sampai masa `exp` habis tanpa blacklist) | 🛡️ **BLOCKED** (`revoked_at` langsung terisi saat logout) | 🏆 **OPSI B** |
| **ATTACK 5: Stolen token** (Token dicuri dari localStorage) | ⚠️ **VULNERABLE** (Bisa dipakai dari perangkat penyerang sampai `exp`) | 🛡️ **BLOCKED** (Gagal karena verifikasi `device_uuid` tidak cocok; dapat di-revoke instan) | 🏆 **OPSI B** |
| **ATTACK 6: Locked account session** | 🛡️ **BLOCKED** (Server cek `users.account_status`) | 🛡️ **BLOCKED** (Server cek `users.account_status`) | **SERI** |
| **ATTACK 7: Inactive account session** | 🛡️ **BLOCKED** (Server cek `users.account_status`) | 🛡️ **BLOCKED** (Server cek `users.account_status`) | **SERI** |
| **ATTACK 8: Device mismatch** (1 Akun = 1 HP violation) | ⚠️ **LEMAH** (Harus query manual tabel terpisah) | 🛡️ **NATIVE & STRICT** (Tersimpan di baris sesi) | 🏆 **OPSI B** |
| **ATTACK 9: Role tampering** (Client ubah role ke ADMIN) | 🛡️ **BLOCKED** (Role di-resolve dari database) | 🛡️ **BLOCKED** (Role di-resolve dari database) | **SERI** |
| **ATTACK 10: Verifier impersonation** (Tamper `p_verifier_user_id`) | 🛡️ **BLOCKED** (Diambil dari session server) | 🛡️ **BLOCKED** (Diambil dari session server) | **SERI** |
| **ATTACK 11: Cross-homeroom access** (Guru 9A intip 9B) | 🛡️ **BLOCKED** (Di-assert oleh homeroom scope) | 🛡️ **BLOCKED** (Di-assert oleh homeroom scope) | **SERI** |

---

## 5. RENCANA MIGRASI & DAMPAK SISTEM (MIGRATION IMPACT)

### A. Dampak pada Basis Data (Database Impact)
* **Opsi A**: 0 perubahan database.
* **Opsi B**: Penambahan 1 file migration DDL baru [sql/38_user_sessions.sql](file:///c:/Smart-Absensi-Guru/sql/38_user_sessions.sql) (tabel terisolasi, RLS aktif, zero public exposure, tidak ada foreign key cascade yang merusak data eksisting).

### B. Dampak pada Sisi Serverless Backend (`api/`)
* **Endpoint Baru**:
  * `POST /api/auth/login`: Menerima `{ identity, pin, device_uuid, device_model }`, memvalidasi hash PIN via Service Role, menghasilkan token acak, menyimpan `token_hash`, dan mengembalikan `{ token, user }`.
  * `POST /api/auth/logout`: Menerima session token dan menandai `revoked_at = NOW()`.
* **Shared Helper**:
  * `api/_shared/homeroom-auth.ts`: Memvalidasi incoming bearer token dengan `token_hash`, mengambil `userId` dan profil asli dari DB, memverifikasi status `ACTIVE`, dan memvalidasi `device_uuid`.

### C. Dampak pada Sisi Frontend (`src/`)
* **`useAuthStore`**: **0% PERUBAHAN STRUKTUR**. Store tetap menyimpan `token`, `user`, dan `deviceUUID`.
* **`LoginPage.tsx`**: **0% PERUBAHAN UI**. Halaman login tetap memanggil `AuthRepository.login()`.
* **`SupabaseProvider.login()`**: Mengalihkan proses verifikasi login ke serverless endpoint `POST /api/auth/login` (atau mempertahankan fallback offline saat dev/mock).

### D. Rencana Rollback (Rollback Strategy)
* Jika terjadi kendala pada implementasi Session Store:
  1. Frontend dapat dialihkan kembali ke provider lokal secara instan tanpa merusak data absensi.
  2. Tabel `public.user_sessions` bersifat mandiri (standalone), sehingga penghapusan atau penonaktifannya tidak akan memicu kerusakan data pada `public.users` maupun tabel absensi.

---

## 6. REKOMENDASI ARSITEKTURAL FINAL: OPSI B (DATABASE SESSION STORE)

Kami merekomendasikan secara bulat **OPSI B (Database Session Store)** untuk SAGA Terpadu karena:

1. **Sesuai Filosofi Keamanan SAGA**: Smart Absensi Guru mengandalkan kebijakan ketat **"1 Akun = 1 HP (Device Binding)"** dan integritas kehadiran. Session store adalah satu-satunya mekanisme yang memungkinkan deteksi pembajakan token lintas HP secara deterministik.
2. **Instant Revocation**: Modul Ruang Wali Kelas menangani dokumen sensitif kependudukan (KK, KTP, Akta). Kemampuan untuk mencabut sesi seketika saat user logout atau saat akun diblokir oleh Admin adalah standar mutlak perbankan/keamanan data pribadi (*Data Privacy Act*).
3. **Zero-Knowledge Credential Storage**: Penyimpanan `token_hash` memastikan bahwa bahkan jika akses read-only database terbuka, tidak ada kredensial aktif yang dapat diekstrak oleh pihak ketiga.

---

## 🛑 KEPUTUSAN PHASE 4.1: GREEN & STOP

1. ✅ **Evaluasi arsitektur autentikasi selesai.**
2. ✅ **Threat model komprehensif terhadap 11 skenario serangan selesai.**
3. ✅ **Analisis dampak migrasi dan strategi rollback telah terdefinisi secara presisi.**
4. ✅ **Tidak ada perubahan database, frontend, atau endpoint yang dilakukan secara prematur.**

### 🟢 STATUS: **PHASE 4.1 = GREEN (READY FOR PHASE 4.2 IMPLEMENTATION DECISION)**

*(Sesuai Stop Condition, Agent BERHENTI di sini. Kami menunggu persetujuan resmi untuk melangkah ke **Phase 4.2: Auth Hardening Implementation**).*
