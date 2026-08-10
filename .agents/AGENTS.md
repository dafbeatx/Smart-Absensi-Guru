# Project Rules for Smart-Absensi-Guru

## Git & Deployment Protocol
- **Auto Push to GitHub**: Setelah menyelesaikan tugas/perbaikan kode dan memverifikasi lint, test, serta build, **selalu lakukan commit dan push (`git push origin main`)** ke repositori GitHub tanpa menunggu instruksi push tambahan.

## Cross-Device Synchronization Protocol (Desktop / Laptop & Mobile HP)
- **Status Notifikasi (Tandai Dibaca)**: Status read/unread notifikasi dan pengumuman wajib tersimpan secara persistent (`localStorage` + backend provider) dan harus **100% tersinkronisasi secara real-time** antara tampilan Laptop/Desktop dan Mobile HP, serta bertahan tanpa reset saat browser di-refresh.
- **Foto Profil User**: Foto profil yang diset oleh Admin di HP/Desktop harus langsung tersinkronkan dan dapat dibaca secara seragam di seluruh perangkat tanpa perbedaan status.
