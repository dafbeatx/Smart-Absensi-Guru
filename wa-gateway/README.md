# 🚀 Smart Absensi Guru - WhatsApp Gateway Microservice (Baileys)

Microservice mandiri berbasis Node.js dan Baileys WhatsApp Multi-Device untuk mengirim notifikasi presensi otomatis langsung ke **Grup WhatsApp Sekolah**.

> 🔒 **Kebijakan Privasi Ketat (Text-Only):**  
> Sistem ini **100% hanya mengirimkan teks terstruktur** (Nama, NPP, Tanggal, Jam, Status Hadir/Pulang, Radius Lokasi). **DILARANG KERAS** dan dicegah secara otomatis dari pengiriman foto selfie, kamera tersembunyi, atau tangkapan visual pengguna.

> 🛡️ **Anti-Ban Architecture:**  
> Notifikasi dikirim khusus ke **Grup WhatsApp Sekolah (`xxxx@g.us`)**, bukan pesan japri ke nomor perorangan. Di dalam grup, tidak ada tombol "Laporkan Kontak", dan pesan dikirim dengan interval antrean aman (*rate limiter queue*), sehingga 100% aman dari pemblokiran Meta.

---

## 📋 Pilihan Tempat Menjalankan (100% Gratis)

Pilih salah satu cara di bawah ini yang paling mudah untuk sekolah Anda:

---

### OPSI 1: Komputer / Laptop Sekolah (Piket / Server TU / Lab) — *Paling Mudah & Rp 0*

Jika sekolah memiliki komputer atau laptop piket/TU yang tersambung internet:
1. Pastikan komputer sudah terinstall **Node.js** (versi 18 atau 20).
2. Buka Terminal / CMD di folder `wa-gateway`:
   ```bash
   cd wa-gateway
   npm install
   npm start
   ```
3. Buka browser di komputer tersebut: `http://localhost:3000/qr`
4. Buka **WhatsApp di HP Anda** > ketuk **Titik Tiga / Pengaturan** > **Perangkat Tertaut** > **Tautkan Perangkat**, lalu arahkan kamera ke layar monitor untuk scan QR.
5. Selesai! Bot WhatsApp sudah aktif dan tersambung.

---

### OPSI 2: Layanan Cloud Gratis Render.com — *Tanpa Komputer Nyala 24 Jam*

Render menyediakan paket *Free Web Service* yang bisa berjalan gratis:
1. Buat akun di [Render.com](https://render.com).
2. Buat **New Web Service**, hubungkan ke repositori GitHub sekolah Anda.
3. Atur konfigurasi:
   - **Root Directory:** `wa-gateway`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Tambahkan Environment Variable di Render:
   - `PORT`: `3000`
   - `GATEWAY_SECRET`: `(buat password rahasia bebas, misal: RahasiaSmata2026)`
5. Klik **Deploy Web Service**.
6. Setelah URL aktif (misal `https://wa-bot-smata.onrender.com`), buka:
   `https://wa-bot-smata.onrender.com/qr`
7. Buka WhatsApp di HP > Perangkat Tertaut > Scan QR pada halaman tersebut.

---

### OPSI 3: Railway.app (Free / Starter Tier)

1. Buat akun di [Railway.app](https://railway.app).
2. Klik **New Project** > **Deploy from GitHub repo**.
3. Atur *Root Directory* ke `/wa-gateway`.
4. Tambahkan Environment Variable `GATEWAY_SECRET`.
5. Buka domain publik yang diberikan Railway pada `/qr` untuk menautkan WhatsApp.

---

### OPSI 4: VPS Mini Gratis (Oracle Cloud Free Tier / VPS Linux)

1. Clone repositori ke server VPS.
2. Masuk ke folder `wa-gateway`:
   ```bash
   cd wa-gateway
   npm install
   ```
3. Jalankan menggunakan Process Manager (PM2) agar otomatis restart jika server reboot:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "wa-gateway"
   pm2 save
   pm2 startup
   ```
4. Buka `http://IP_VPS:3000/qr` untuk scan QR pertama kali.

---

## 🔍 Cara Menemukan "Group JID" WhatsApp Sekolah (`@g.us`)

Setelah bot terhubung ke WhatsApp:
1. Pastikan nomor bot Anda sudah diundang masuk ke dalam **Grup WhatsApp Sekolah** (misal grup *"Presensi Guru & Karyawan"*).
2. Buka endpoint `/groups` di browser Anda:
   - Jika lokal: `http://localhost:3000/groups?secret=RahasiaSmata2026`
   - Jika Render/VPS: `https://wa-bot-smata.onrender.com/groups?secret=RahasiaSmata2026`
3. Halaman akan menampilkan daftar grup dalam format JSON:
   ```json
   {
     "success": true,
     "count": 1,
     "groups": [
       {
         "id": "120363028192837192@g.us",
         "name": "Presensi Guru & Karyawan SMATA",
         "participantsCount": 28
       }
     ]
   }
   ```
4. Salin kode `id`-nya: **`120363028192837192@g.us`**.

---

## ⚙️ Menghubungkan ke Vercel (Smart-Absensi-Guru)

Buka dashboard proyek Vercel Anda di **Settings > Environment Variables**, lalu tambahkan:

| Nama Variabel | Nilai Contoh | Keterangan |
| :--- | :--- | :--- |
| `WA_GATEWAY_URL` | `https://wa-bot-smata.onrender.com` | URL endpoint bot Baileys Anda |
| `WA_GATEWAY_SECRET` | `RahasiaSmata2026` | Token autentikasi rahasia |
| `WA_GROUP_JID` | `120363028192837192@g.us` | ID grup WhatsApp sekolah target |

> 🔒 **Catatan Keamanan (Zero-Trust):**  
> Dilarang menambahkan prefix `VITE_` pada variabel di atas! Semua pemanggilan melewati fungsi serverless `/api/whatsapp` agar kredensial tidak bocor ke browser.

---

## 🧪 Menguji Pengiriman Manual via CURL / Postman

Anda dapat menguji pengiriman pesan teks ke grup menggunakan terminal:

```bash
curl -X POST http://localhost:3000/send-group-message \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Secret: RahasiaSmata2026" \
  -d '{
    "groupId": "120363028192837192@g.us",
    "message": "🔔 *TES KONEKSI BOT SMART-ABSENSI*\nWhatsApp Gateway berhasil terhubung!"
  }'
```
