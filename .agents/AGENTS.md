# Project Rules for Smart-Absensi-Guru

## Git & Deployment Protocol
- **Auto Push to GitHub**: Setelah menyelesaikan tugas/perbaikan kode dan memverifikasi lint, test, serta build, **selalu lakukan commit dan push (`git push origin main`)** ke repositori GitHub tanpa menunggu instruksi push tambahan.

## Cross-Device Synchronization Protocol (Desktop / Laptop & Mobile HP)
- **Status Notifikasi (Tandai Dibaca)**: Status read/unread notifikasi dan pengumuman wajib tersimpan secara persistent (`localStorage` + backend provider) dan harus **100% tersinkronisasi secara real-time** antara tampilan Laptop/Desktop dan Mobile HP, serta bertahan tanpa reset saat browser di-refresh.
- **Foto Profil User**: Foto profil yang diset oleh Admin di HP/Desktop harus langsung tersinkronkan dan dapat dibaca secara seragam di seluruh perangkat tanpa perbedaan status.

## Backend Architecture & Security Protocol (Supabase PostgreSQL Cloud)
- **Provider Pattern Abstraction**: Seluruh pengambilan dan mutasi data WAJIB melalui `ProviderFactory.getProvider()` (`SupabaseProvider` untuk cloud mode, `MockProvider` untuk unit test/offline). Dilarang keras melakukan `fetch`, `axios`, atau query Supabase langsung dari komponen UI.
- **PostgreSQL Row Level Security (RLS)**: Setiap pembuatan atau pembaruan tabel di Supabase wajib disertai script DDL SQL dan policy RLS yang ketat.

## Attendance Safety Engine & Geofencing Protocol
- **5-Step State Machine**: Alur absensi masuk dan pulang WAJIB melewati pipa state machine deterministik di `src/services/attendance-engine.service.ts`.
- **Door Poster QR Mode**: Gunakan buffer radius 500m saat memindai QR Poster pintu sekolah agar absensi **langsung diterima**, sambil **tetap mencatat koordinat GPS fisik asli guru secara akurat ke database**.
- **Auto Coordinate Sanitization**: Koordinat GPS tanpa desimal (misal `-6613144`) wajib disanitasi secara otomatis menjadi desimal valid (`-6.613144`).

## Naming Standards & UI Design System Protocol
- **Anti AI-Generic / Anti AI-Slop UI Protocol**: Setiap kali diminta membuat, memperbarui, atau memperbaiki antarmuka (UI/UX), WAJIB selalu merujuk dan mematuhi pedoman di [.ai/UI_DESIGN_SYSTEM_ANTI_AI_SLOP.md](file:///c:/Smart-Absensi-Guru/.ai/UI_DESIGN_SYSTEM_ANTI_AI_SLOP.md).
- **Always-On Infinix Note 8 & Mobile Full-Screen Mandate**: DILARANG KERAS membuat fitur, formulir, atau panel alur kerja sebagai floating popup / centered modal melayang di layar mobile. Di perangkat mobile (terutama smartphone **Infinix Note 8** rasio 20.5:9, 720×1640 px), fitur WAJIB menggunakan **Full-Screen Viewport (`100dvh`)** tanpa celah margin luar, dilengkapi sticky header dan sticky bottom action bar yang ergonomis bagi jempol. Panduan teknis lengkap & template wajib: [.agents/rules/INFINIX_NOTE_8_FULLSCREEN_RULE.md](file:///c:/Smart-Absensi-Guru/.agents/rules/INFINIX_NOTE_8_FULLSCREEN_RULE.md).
- **NPP Naming Standard**: Seluruh penamaan ID pegawai di UI, modal, pencarian, dan laporan PDF/CSV wajib menggunakan istilah **NPP (Nomor Pokok Pegawai)**.
- **Time Input Sanitizer**: Input HTML5 `type="time"` wajib diformat `HH:mm` menggunakan `formatTimeForInput` dari `src/utils/time.utils.ts`.
- **Single Typography & Theme**: Wajib mengunci font family global menggunakan **Inter** dan menggunakan design tokens warna yang didefinisikan di `src/index.css`.

### Mobile UI Layout & Element Sizing Standard
| Elemen                |      Ukuran mobile |
| --------------------- | -----------------: |
| Padding halaman       |           **16px** |
| Padding card          |           **16px** |
| Jarak antar elemen    |        **12–16px** |
| Judul utama           |        **24–28px** |
| Subjudul              |        **18–20px** |
| Teks biasa            |        **14–16px** |
| Tombol                | tinggi **44–48px** |
| Radius card           |        **12–16px** |
| Lebar maksimal konten |          **480px** |

## Zero-Trust Secret Management & Anti-Credential Leak Protocol
- **The VITE_ Prefix Trap**: Dilarang keras menambahkan prefix `VITE_` pada kunci rahasia/private tokens (`GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `VAPID_PRIVATE_KEY`). Prefix `VITE_` membocorkan nilai variabel secara publik ke bundle browser (`dist/assets/*.js`).
- **Serverless Proxy Mandate**: Seluruh integrasi pihak ketiga yang membutuhkan secret key WAJIB melalui Vercel Serverless Functions di folder `api/` (misal `/api/ai` untuk Groq, `/api/telegram` untuk notifikasi/foto bot). Komponen atau service di `src/` dilarang keras melakukan fetch langsung dengan secret key dari browser.
- **Strict Gitignore**: File `.env`, `.env.local`, dan file kredensial lainnya wajib selalu diabaikan oleh `.gitignore`.
- **Rujukan Lengkap**: Wajib mematuhi panduan teknis mendalam di [.agents/rules/ZERO_TRUST_SECRETS_SECURITY.md](file:///c:/Smart-Absensi-Guru/.agents/rules/ZERO_TRUST_SECRETS_SECURITY.md).

## Windows CLI Execution Protocol
- Pada lingkungan Windows PowerShell di mana eksekusi script `.ps1` diblokir, selalu jalankan perintah build dan pengujian melalui shell `cmd /c "npm run build"`.

## React + Vite Codebase Hygiene & Agent Token Protocol
- **Codebase Hygiene Mandate**: Seluruh pembersihan, refactoring, audit kode mati, manajemen dependensi, effect/resource cleanup, dan optimasi bundle WAJIB mematuhi panduan di [.agents/rules/REACT_VITE_CODEBASE_HYGIENE.md](file:///c:/Smart-Absensi-Guru/.agents/rules/REACT_VITE_CODEBASE_HYGIENE.md).
- **Prinsip Hapus Terbukti**: Hanya hapus kode, fungsi, file, atau paket yang terbukti 100% tidak diperlukan setelah memverifikasi dynamic import, konfigurasi, test, dan entry point. Kode pendek tidak selalu lebih baik.
- **Efisiensi Token AI Agent**: Terapkan pembacaan selektif, hindari dump file besar (lockfile, bundle, node_modules) ke konteks agent, hindari repetisi aturan, dan sajikan diff atau ringkasan fokus.
- **Larangan Destruktif**: Dilarang menghapus test demi meloloskan build, dilarang melonggarkan typecheck/lint untuk menyembunyikan error, dilarang menyentuh secrets/.env/database tanpa izin, dan dilarang menjalankan `npm audit fix --force`.

## React + Vite Feature Engineering Protocol
- **Feature Engineering Mandate**: Seluruh penambahan dan penyempurnaan fitur WAJIB mematuhi panduan teknis mendalam di [.agents/rules/REACT_VITE_FEATURE_ENGINEERING.md](file:///c:/Smart-Absensi-Guru/.agents/rules/REACT_VITE_FEATURE_ENGINEERING.md).
- **Arsitektur Tuntas**: Fitur harus bekerja tuntas dari alur input, validasi, state/jaringan, hingga 5 status antarmuka (Normal, Loading, Empty, Error, Recovery). Dilarang menyisakan tombol tanpa aksi atau data palsu di produksi.
- **Kualitas & Quality Gates**: Wajib mematuhi alur 7 langkah (*Inspect → Trace → Plan → Implement → Verify → Review → Report*), tidak merusak fondasi/library yang ada, dan memvalidasi test (`npm test`) serta production build (`npm run build`).


