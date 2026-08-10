# 🏫 Smart Absensi Guru (SAG) — Supabase PostgreSQL Cloud v1.1

> **Sistem Absensi Guru Cepat (<100ms), Akurat berbasis GPS + QR Code Dynamic Poster, Terhubung 100% ke Cloud Supabase PostgreSQL.**
> *Sub-Branding: SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam*

---

## ⚡ Ringkasan Proyek

**Smart Absensi Guru (SAG)** adalah platform web presensi terpadu yang dirancang khusus untuk tenaga pendidik dan kependidikan di lingkungan sekolah. Sistem ini mengombinasikan **validasi geofencing GPS**, **pemindaian QR Code poster gerbang**, **state machine persetujuan izin/cuti multi-role**, dan **sinkronisasi notifikasi & profil real-time lintas perangkat (Desktop/HP)** dengan performa tinggi.

---

## ✨ Fitur-Fitur Utama

### 🔒 1. Multi-Role Access & Identity Security
- **Admin / Operator**: Kelola master data guru (NPP, Nama, WA, Role, Jabatan), ubah foto profil, reset PIN, pengaturan jam kerja, geofence, dan audit log.
- **Kepala Sekolah (Kepsek)**: Monitoring dashboard kehadiran harian, statistik persentase kehadiran, dan persetujuan pengajuan izin/cuti/sakit.
- **Guru**: Presensi masuk/pulang via GPS & QR Poster, pengajuan izin/cuti dengan lampiran PDF, riwayat kehadiran pribadi, serta catatan alasan keterlambatan.

### 📍 2. Dual-Validation Attendance Engine (GPS + Door Poster QR)
- **Geofence GPS Radius Guard**: Memastikan presensi hanya dapat dilakukan jika berada di radius sekolah (contoh: 50m).
- **Door Poster QR Mode (Buffer 500m)**: Mode pemindaian poster pintu sekolah dengan toleransi buffer radius agar guru tidak terhalang di pintu gerbang, sambil **tetap mencatat koordinat GPS asli guru secara akurat di database**.
- **Sanitasi Koordinat Otomatis**: Sistem otomatis mengoreksi format koordinat GPS yang tidak valid (misal `-6613144` ➔ `-6.613144`).

### 📱 3. Responsive UI & Cross-Device Synchronization
- **Mobile-First Glassmorphic Design**: Antarmuka modern dengan warna semantik, modal QR intuitif, dan ergonomi layar sentuh HP.
- **Real-Time Notification Sync**: Status notifikasi yang ditandai dibaca di Laptop/Desktop langsung tersinkronkan 100% ke HP dan tidak akan reset saat browser di-refresh.
- **Persistent Profile Pictures**: Foto profil guru dikelola penuh oleh Admin dan tersimpan konsisten di seluruh perangkat tanpa perbedaan status.
- **Lateness Reason Notes**: Catatan alasan keterlambatan tersimpan secara permanen di database dan ditampilkan pada tabel kehadiran Admin.

---

## 🛠️ Teknologi & Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Vanilla CSS Custom Utilities
- **State Management**: Zustand
- **Database Backend**: Supabase Cloud (PostgreSQL dengan Row Level Security - RLS)
- **Provider Pattern**: `SupabaseProvider` (Cloud Mode) dengan fallback `MockProvider` (Offline / Unit Test)
- **Icons**: Lucide React

---

## 📂 Struktur Direktori Proyek

```text
Smart-Absensi-Guru/
├── .ai/                    # Dokumen memori & arsitektur AI (CURRENT_STATE, TRACKING, dll)
├── docs/                   # Dokumentasi teknis (ADR, BIG, DEV_TEST_MODE, PILOT_REPORT)
├── public/                 # Assets statis (Favicon, PWA icons)
├── src/
│   ├── components/         # Komponen UI generik & layout (Sidebar, Navbar, Input, Modal)
│   ├── config/             # Konfigurasi aplikasi & feature flags
│   ├── features/           # Modul fitur berbasis role (admin, kepsek, guru)
│   ├── lib/                # Client Supabase & API Client
│   ├── providers/          # Data Provider Pattern (SupabaseProvider & MockProvider)
│   ├── services/           # Business logic engines (Attendance, Notification, Settings)
│   ├── types/              # Definitions TypeScript & DTOs
│   └── utils/              # Helper utilitas (Time sanitizer, Haversine GPS, Export CSV/PDF)
├── index.html
├── package.json
└── vite.config.ts
```

---

## 🚀 Cara Menjalankan Aplikasi (Local Development)

### 1. Prasyarat
Pastikan Anda telah menginstal **Node.js (v18+)** dan **npm**.

### 2. Kloning Repositori & Instal Dependensi
```bash
git clone https://github.com/dafbeatx/Smart-Absensi-Guru.git
cd Smart-Absensi-Guru
npm install
```

### 3. Konfigurasi Environment Variables
Buat file `.env` di direktori utama:
```env
VITE_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENABLE_DEV_TEST_MODE=true
```

### 4. Jalankan Dev Server
```bash
npm run dev
```
Akses aplikasi melalui browser di `http://localhost:5173`.

### 5. Build untuk Produksi
```bash
npm run build
```

---

## 🧪 Testing & Diagnostik

Aplikasi dilengkapi dengan **Developer Test Mode** (akses khusus Admin/Operator) yang memiliki 10-Step Automated Checklist untuk menguji GPS, kamera, QR Poster, dan integrasi Supabase.

---

## 📜 Lisensi & Pengembang

Dikembangkan untuk **SMP Terpadu Al-Ittihadiyah** & **SMA Terpadu As Salaam**.  
Hak Cipta © 2026. All Rights Reserved.
