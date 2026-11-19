# RUMAH SUNYI: TIGA KUNCI (Bundel Modular Three.js + Versi Mandiri)

Gim horor edukasi **First-Person POV 3D** yang dirancang khusus untuk layar sentuh besar **Papan Interaktif Digital (PID)** maupun komputer desktop.

## Struktur Berkas Bundel
```text
rumah_sunyi_tiga_kunci_bundle/
├── index.html                                     # Halaman utama (ES Module + ImportMap Three.js)
├── package.json                                   # Konfigurasi proyek Vite / Node.js dengan Three.js
├── README.md                                      # Dokumentasi & panduan integrasi AI Agent
├── src/
│   ├── main.js                                    # Titik masuk aplikasi & pengikat UI guru/siswa
│   ├── styles/
│   │   └── dossier.css                            # Antarmuka Survival Horror Analog / Dossier Investigasi
│   ├── data/
│   │   ├── quizPresets.js                         # 5 preset soal mata pelajaran & editor soal guru
│   │   └── mansionLayout.js                       # Denah 9 ruangan, koordinat laci/lemari, rekor waktu
│   ├── audio/
│   │   └── horrorAudio.js                         # Mesin Web Audio API (Backsound 3 lapis + Foley akustik)
│   ├── entities/
│   │   └── paleShadow.js                          # Entitas 3D "Sosok Bayangan Pucat" (AI penglihatan mata)
│   ├── world/
│   │   └── mansionBuilder.js                      # Pembangun mansion 9 ruangan & tekstur prosedural
│   └── game/
│       └── HorrorGameEngine.js                    # Mesin utama 3D POV, kompas arah, minimap & kontrol PID
└── standalone/
    └── rumah_sunyi_tiga_kunci_standalone.html     # Versi 1 berkas utuh siap buka langsung di peramban
```

## Cara Menjalankan
1. **Langsung di Peramban PID (Tanpa Instalasi):**
   - Buka berkas `standalone/rumah_sunyi_tiga_kunci_standalone.html` di peramban modern (Chrome/Edge), atau jalankan server statis lokal (`npx serve .` / VS Code Live Server) pada `index.html`.
2. **Integrasi ke Proyek Three.js / Vite yang Sudah Ada:**
   - Salin folder `src/` dan `index.html` ke proyek Anda yang sudah memiliki paket `three`.
   - Impor `HorrorGameEngine` dari `./src/game/HorrorGameEngine.js` jika ingin menanamkannya ke komponen React/Next.js atau kanvas kustom.

## Ringkasan Mekanika Utama
- **Pengaturan Soal Mata Pelajaran Guru:** Mendukung 5 paket preset (*Informatika*, *Matematika*, *IPA Terpadu*, *IPS*, *Bahasa Indonesia*) serta editor 3 soal kustom (`localStorage`).
- **Laci 2× Ketuk & Uji Kunci Kuningan:** Ketukan ke-1 membuka celah laci dengan riak suara; ketukan ke-2 menggeledah isi dan memunculkan modal pertanyaan guru apabila laci berisi kunci.
- **Persembunyian Lemari Berjalusi:** Masuk ke salah satu dari 9 lemari menjeda pergerakan hantu selama `6,0` / `5,0` / `3,5` detik sebelum entitas kembali berpatroli/mengawasi.
- **AI Penglihatan Mata (*Eye Line-of-Sight*):** *Sosok Bayangan Pucat* diam memindai (`0 m/s`) di lorong utara hingga kerucut tatapan matanya menangkap pemain secara langsung.
- **Navigasi Ramah Siswa & PID:** Dilengkapi pita Kompas Arah dinamis (`[KUNCI]`, `[LEMARI]`, `[PINTU KELUAR]`), kartu panduan langkah, denah cetak biru 9 ruangan, monitor detak jantung ECG, serta stik analog multi-sentuh yang dapat ditukar kiri/kanan.
