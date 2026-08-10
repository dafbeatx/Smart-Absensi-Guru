# 🏛️ Architecture Decision Records (ADR) — Smart Absensi Guru

## ADR-001: Menggunakan Google Apps Script & Google Spreadsheet sebagai Initial Backend
* **Status:** Deprecated (Digantikan oleh ADR-007)
* **Context:** Sekolah membutuhkan sistem absensi tanpa biaya server bulanan dan mudah dikelola oleh operator.
* **Decision:** Menggunakan Google Apps Script Web App sebagai API dispatcher dan Google Spreadsheet sebagai database multi-sheet.
* **Consequences:**
  * (+) 0 Biaya Server & Infrastruktur (Free tier Google Workspace).
  * (+) Operator sekolah dapat melihat/mengedit data langsung di Spreadsheet jika terjadi keadaan darurat.
  * (-) Terbatas kuota harian execution time (6-30 menit) dan URL fetch.
  * (-) Diperlukan *Data Provider Abstraction Layer* agar frontend tidak terikat penuh pada GAS.

---

## ADR-002: Arsitektur Frontend Backend-Agnostic via Data Provider Pattern
* **Status:** Accepted
* **Context:** Suatu saat sistem dapat bermigrasi ke Firebase, Supabase, Node.js, atau Golang tanpa merombak UI.
* **Decision:** Membuat kontrak `IDataProvider` dengan implementasi `SupabaseProvider` dan `MockProvider`.
* **Consequences:**
  * (+) Frontend 100% terisolasi dari detail jaringan dan URL backend.
  * (+) Pengujian UI dan otomatisasi dapat berjalan offline menggunakan `MockProvider`.
  * (-) Memerlukan pembungkusan seluruh repositori melalui `ProviderFactory`.

---

## ADR-003: State Machine Pattern untuk QR Scanner & Approval Engine
* **Status:** Accepted
* **Context:** Alur absensi dan persetujuan izin memiliki banyak kondisi (kamera, GPS, TOTP, offline, role guard).
* **Decision:** Menggunakan State Machine deterministik (`IDLE` ➔ `SCANNING` ➔ `VALIDATING_QR` ➔ `VALIDATING_GPS` ➔ `SAVING` ➔ `SUCCESS`).
* **Consequences:**
  * (+) Mencegah UI crash / kondisi terbalik saat banyak proses berjalan bersamaan.
  * (+) Sangat mudah diuji dengan Unit Testing.
  * (-) Memerlukan pengelolaan state eksplisit di Zustand.

---

## ADR-004: Native IndexedDB Queue untuk Offline Synchronization Strategy
* **Status:** Accepted
* **Context:** Koneksi internet di lingkungan sekolah terkadang terputus saat jam masuk 06.45 WIB.
* **Decision:** Menggunakan IndexedDB native browser (bukan LocalStorage) untuk menyimpan antrean transaksi offline.
* **Consequences:**
  * (+) Mampu menyimpan data transaksi kompleks dan ukuran foto bukti tanpa batasan kuota 5MB LocalStorage.
  * (+) Mendukung sinkronisasi latar belakang otomatis saat internet terhubung kembali.
  * (-) Diperlukan service `SyncEngine` dan penyelesai konflik (`ConflictResolver`).

---

## ADR-005: Feature Flag System untuk Pengendalian Fitur Dinamis
* **Status:** Accepted
* **Context:** Pengujian pilot dan demo ke berbagai sekolah membutuhkan kemampuan menyalakan/mematikan modul tanpa re-deploy.
* **Decision:** Membuat `feature-flags.config.ts` dan `<FeatureGate>` wrapper berbasis variabel lingkungan `.env`.
* **Consequences:**
  * (+) Fleksibilitas penuh untuk demonstrasi dan penanganan bug secara instan.
  * (+) Dasar pengembangan aplikasi SaaS Multi-Tenant White-Label.

---

## ADR-006: Sinkronisasi Status Notifikasi & Profil Lintas Perangkat (Desktop/Laptop & Mobile HP)
* **Status:** Accepted
* **Context:** Pengguna yang membaca/menandai dibaca notifikasi di Laptop/Desktop atau HP mengharapkan status notifikasi tetap bertanda dibaca meskipun halaman di-refresh.
* **Decision:** Menggabungkan penyimpanan ID notifikasi terbaca di `NotificationPermissionService` (User-bound + Global cache), Provider State Sync, serta pemicu Custom Event (`smart_absensi_notifications_read_updated`).
* **Consequences:**
  * (+) Status notifikasi yang sudah ditandai dibaca 100% konsisten antara layar Laptop/Desktop dan Mobile HP.
  * (+) Notifikasi sintetis maupun DB tidak pernah muncul kembali sebagai belum dibaca setelah browser di-refresh.
  * (+) Sinkronisasi foto profil guru yang diubah Admin berlaku konsisten lintas tampilan.

---

## ADR-007: Migrasi Total Backend ke Supabase Cloud (PostgreSQL) & Depresiasi GAS
* **Status:** Accepted
* **Context:** Google Apps Script mengalami batasan kueri bersamaan (concurrency lock limit) dan respon latency (>1.5s) saat banyak guru presensi serentak di jam 06.45 WIB.
* **Decision:** Bermigrasi total dari GAS ke Supabase PostgreSQL Cloud via `@supabase/supabase-js` dengan `SupabaseProvider` sebagai provider utama, dilindungi oleh Row Level Security (RLS) policies.
* **Consequences:**
  * (+) Latensi API memangkas hingga <100ms per request.
  * (+) Skalabilitas tinggi dengan PostgreSQL, RLS, real-time subscriptions, dan ACID transactions.
  * (+) Menghapus folder usang `gas-backend/` (16 berkas script) dan `gas-provider.service.ts` (4.000+ baris kode usang).
  * (-) Memerlukan DDL SQL migration script yang konsisten dan RLS policy guard.

---

## ADR-008: Persistensi Catatan Alasan Keterlambatan & Ergonomi UI Scan QR Mobile
* **Status:** Accepted
* **Context:** Guru yang terlambat perlu memasukkan alasan keterlambatan yang dapat ditinjau oleh Admin/Kepsek. Tampilan modal QR juga perlu disesuaikan dengan ergonomi layar HP.
* **Decision:** Menambahkan atribut `notes`/`lateness_reason` pada skema presensi Supabase + `MockProvider`, serta meredesain modal sukses QR scan menjadi lebih kompak dan modern untuk perangkat seluler.
* **Consequences:**
  * (+) Catatan alasan keterlambatan tersimpan secara terstruktur dan dapat ditampilkan pada tabel Tracker Admin.
  * (+) Pengalaman pengguna di layar HP menjadi jauh lebih intuitif dan responsif tanpa hambatan scroll.
