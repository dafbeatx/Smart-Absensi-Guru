# 🧪 Mode Tes Developer (Developer Test Mode)

Fitur **Mode Tes Developer** dirancang khusus untuk internal developer, admin, dan operator sekolah guna memverifikasi readiness (kesiapan) aplikasi Smart-Absensi-Guru sebelum diluncurkan kepada guru-guru.

---

## 🔒 Akses & Security Guard

1. **Persyaratan Lingkungan (Environment)**:
   - Aktif secara otomatis pada `import.meta.env.DEV === true` (Local Development), ATAU
   - Diaktifkan secara eksplisit melalui Environment Variable:
     ```env
     VITE_ENABLE_DEV_TEST_MODE=true
     ```

2. **Hak Akses Pengguna (Role Security)**:
   - **Hanya Diizinkan**: Role `ADMIN` dan `OPERATOR`.
   - **Dilarang keras**: Role `GURU`, `KEPSEK`, atau pengguna guest tanpa login.
   - Komponen UI akan menampilkan **404 — Akses Ditolak** jika diakses oleh akun Guru.

---

## ⚡ Fitur Utama Panel Mode Tes

1. **Warning Banner Prominens**:
   - `⚠️ MODE TES DEVELOPER — Jangan gunakan untuk absensi nyata.`

2. **Diagnostik 10-Step Automated Checklist**:
   - **App Config & Env**: Verifikasi `MODE` dan `VITE_DATA_PROVIDER`.
   - **Auth & Role Security**: Verifikasi sesi login dan hak akses Admin/Operator.
   - **Storage Readiness**: Verifikasi `localStorage` & cache read/write.
   - **GPS Sensor & Geofence**: Verifikasi koordinat GPS dan kalkulasi radius geofence. (Izin ditolak ➔ Warning aman, tidak crash).
   - **Camera Access**: Verifikasi `navigator.mediaDevices.getUserMedia`. (Izin ditolak ➔ Warning aman, tidak crash).
   - **Official QR Code**: Validasi QR Poster Official (`SMART_ABSENSI_OFFICIAL_QR_2026`) ➔ PASS, QR Random ➔ REJECT.
   - **Provider Connectivity**: Check konektivitas backend provider aktif (Supabase / Mock).
   - **Payload Dry-Run**: Validasi skema DTO absensi tanpa menyimpan ke database.
   - **Real-Time Event Dispatcher**: Emisi & dengarkan event `smart_absensi_scanned` untuk refresh dashboard.
   - **UI Notification System**: Uji coba Toast & Modal feedback.

3. **Tes Simpan Absensi Dummy (Dev Test Only)**:
   - Memasukkan catatan absensi uji coba dengan identifikasi khusus `DEV_TEST` secara aman.
   - Membutuhkan modal konfirmasi eksplisit dari operator.

4. **📋 Salin Laporan Tes (Markdown Report)**:
   - Menghasilkan laporan diagnostik lengkap berformat Markdown yang dapat disalin ke clipboard untuk melampirkan bukti pengujian pada dokumentasi rilis.

---

## 🛠️ Cara Mengaktifkan di Staging/Testing Environment

Tambahkan variabel berikut pada file `.env.staging` atau pengaturan environment server Anda:

```env
VITE_ENABLE_DEV_TEST_MODE=true
```
