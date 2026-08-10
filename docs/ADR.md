# 🏛️ Architecture Decision Records (ADR) — Smart Absensi Guru

## ADR-001: Menggunakan Google Apps Script & Google Spreadsheet sebagai Initial Backend
* **Status:** Accepted
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
* **Decision:** Membuat kontrak `IDataProvider` dengan implementasi `GasProvider` dan `MockProvider`.
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
