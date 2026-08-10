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

## Windows CLI Execution Protocol
- Pada lingkungan Windows PowerShell di mana eksekusi script `.ps1` diblokir, selalu jalankan perintah build dan pengujian melalui shell `cmd /c "npm run build"`.
