# React + Vite Codebase Hygiene

## Misi
Menjaga proyek ramping, mudah dipahami, efisien bagi developer & AI agent, serta stabil saat build dan runtime. Kurangi kompleksitas, pemborosan token, ukuran bundle, dan request tanpa mengorbankan fitur, keamanan, keterbacaan, atau keandalan.

**Prinsip Inti**: Hapus hanya yang terbukti 100% tidak diperlukan. Kode pendek tidak selalu lebih baik; pengurangan token tidak otomatis meningkatkan performa.

---

## 1. Aturan Keselamatan Sebelum Membersihkan
1. **Baca Konteks**: Baca `AGENTS.md`, `README.md`, dan aturan repository sebelum tindakan apa pun.
2. **Cek Git**: Periksa `git status`. Jangan menimpa atau membuang perubahan pengguna.
3. **Pahami Arsitektur**: Pahami folder, `package.json`, lockfile, konfigurasi Vite/TS/lint/test, serta entry point.
4. **Verifikasi Referensi**: Cari semua referensi sebelum menghapus file, export, komponen, fungsi, dependency, atau konfigurasi.
5. **Perubahan Bertahap**: Buat perubahan kecil, bertahap, dan mudah ditinjau. Pisahkan refactor dari perubahan fitur.
6. **Berdasarkan Bukti**: Dilarang menghapus hanya berdasarkan nama file, jumlah baris, usia kode, atau tebakan agent.
7. **Anti-Destruktif**: Dilarang menjalankan perintah destruktif, menghapus database/data pengguna, mengubah secrets, atau memaksakan dependency tanpa izin.
8. **Prinsip Kehati-hatian**: Jika dampak belum jelas, pertahankan item dan laporkan untuk tinjauan manual.

---

## 2. Kategori yang Harus Diaudit

### A. Kode Mati dan Duplikasi
Verifikasi sebelum menghapus:
- Import, variabel, fungsi, tipe, konstanta, dan export yang tidak terpakai.
- Komponen, hook, helper duplikat, serta implementasi fitur berulang.
- CSS selector, class, aset, ikon, gambar, atau font tak terpakai.
- Komentar usang, dead code blocks, log debug sementara, TODO selesai.
- State turunan (*derived state*) yang dapat dihitung langsung dari props/state lain.
- Abstraksi atau wrapper tanpa manfaat nyata.

> [!IMPORTANT]
> Selalu cek dynamic import, lazy route, plugin, path string, konfigurasi, public assets, test, script build, dan pemakaian eksternal. Referensi tidak selalu tampak via import statis.

### B. Dependensi dan Konfigurasi
- Periksa dependensi langsung & `devDependencies` yang benar-benar aktif.
- Identifikasi paket yang fungsinya sudah ada di web platform atau paket lain.
- Jangan hapus paket tooling, plugin Vite, script build, atau CLI hanya karena tidak di-import di `src/`.
- Jangan update massal dependensi saat pembersihan rutin.
- Jangan hapus/regenerate lockfile demi sekadar merapikan.
- Dilarang menjalankan `npm audit fix --force`.
- Pertahankan konfigurasi Vite, TS alias, dan environment yang sudah stabil.

### C. Struktur dan Kompleksitas
- Satukan logika identik jika mengurangi duplikasi tanpa merusak keterbacaan.
- Pecah komponen hanya saat ada pemisahan tanggung jawab atau reuse yang jelas.
- Hapus adapter/wrapper/context/hook artifisial yang over-engineered.
- Hindari membuat satu file raksasa hanya demi mengurangi jumlah file.
- Jangan ubah API publik tanpa verifikasi seluruh konsumen.

### D. State, Effect, dan Resource
- Hindari `useEffect` untuk derived state atau logic yang lebih tepat di event handler.
- Pastikan cleanup listener, timer, subscription, WebSocket, dan observer selalu dilepas saat unmount.
- Cegah loop render, stale closure, race condition, dan request ganda.
- Hindari `useMemo`/`useCallback` tanpa kebutuhan stabilitas referensi terukur.
- Hindari polling agresif; pilih mekanisme update sesuai kebutuhan backend.

### E. Network dan Data
- Eliminasi request duplikat, polling berlebih, payload raksasa, dan query N+1.
- Gunakan debounce, pagination, filtering, atau caching dengan invalidasi yang tepat.
- Jangan hapus validasi, otorisasi, error handling, atau audit log demi memendekkan kode.
- Jangan ubah kontrak API atau skema database sebagai efek samping pembersihan.
- **Zero Leak**: Dilarang mencatat token, password, atau data sensitif ke console/log.

### F. Aset dan Performa Frontend
- Audit gambar tak terpakai, aset duplikat, dan font berlebih.
- Terapkan lazy loading & format modern (WebP/AVIF) untuk gambar di luar viewport.
- Periksa route code splitting & dynamic import pada modal/fitur besar.
- Waspadai dynamic CSS class pada Tailwind/CSS modules sebelum menghapus selector.
- Hindari optimasi dini yang menambah kompleksitas tanpa metrik jelas.

---

## 3. Mengurangi Pemborosan Token AI
- **Baca Selektif**: Buka hanya file dan line range relevan; gunakan grep/symbol search sebelum membuka banyak file.
- **Hindari Dump Besar**: Dilarang memasukkan lockfile, node_modules, build bundle, atau file minified ke konteks prompt.
- **Rujuk, Jangan Duplikasi**: Rujuk aturan `AGENTS.md` daripada menyalin ulang seluruh teksnya.
- **Diff Fokus**: Tampilkan diff atau potongan kode esensial, bukan file utuh ribuan baris.
- **Log Ringkas**: Tampilkan ringkasan error atau status terminal, bukan ribuan baris log mentah.
- **Komentar Bermakna**: Jangan tulis komentar yang hanya menarasikan ulang kode. Jelaskan *mengapa*, batasan, atau konteks tak terduga.
- **Rencana Proporsional**: Sesuaikan panjang rencana dengan risiko dan kompleksitas tugas.
- **Simpan Aturan di Satu Sumber**: Hindari membuat banyak file aturan lokal yang tumpang tindih.

---

## 4. Strategi Audit 8 Langkah
1. **Baseline**: Cek status Git, script proyek, test, lint, dan build awal.
2. **Inventory**: Petakan kandidat kode mati, duplikasi, dependensi, dan resource leak.
3. **Evidence**: Cari bukti penggunaan via referensi, routes, konfigurasi, dan tests.
4. **Prioritize**: Dahulukan yang manfaatnya tinggi dan risikonya rendah.
5. **Change**: Ubah dalam batch kecil yang terisolasi.
6. **Verify**: Jalankan test dan build setelah setiap kelompok perubahan.
7. **Review**: Periksa diff untuk mencegah perubahan tidak disengaja.
8. **Report**: Laporkan item yang dibersihkan, bukti verifikasi, dan apa yang dipertahankan.

---

## 5. Skala Prioritas
1. **Bug Nyata**: Infinite loop, request ganda, memory leak, crash.
2. **Kode Mati Terverifikasi**: Yang 100% terbukti tidak dipakai.
3. **Duplikasi Kritis**: Logika ganda yang memicu bug berulang.
4. **Aset & Paket Berat**: Yang membebani ukuran bundle tanpa dipakai.
5. **Query / Payload Boros**: Yang terbukti memperlambat respon.
6. **Kompleksitas Penghambat**: Abstraksi rumit yang menyulitkan perbaikan.
7. **Konteks AI**: Reduksi token prompt dan dokumen berulang.

*Ukur keberhasilan dari kompleksitas yang turun dan kestabilan sistem, bukan sekadar jumlah baris yang dihapus.*

---

## 6. Pemeriksaan Pasca-Pembersihan
Wajib jalankan script proyek yang relevan:
- Unit / Integration Test: `cmd /c "npm test"`
- Lint & Typecheck: `tsc -b`
- Production Build: `cmd /c "npm run build"`
- Verifikasi rute, auth, dan form yang terdampak.
- Verifikasi responsivitas mobile (Infinix Note 8 viewport).

> [!CAUTION]
> Dilarang mengklaim hasil lulus tanpa benar-benar menjalankannya. Dilarang mengarang angka metrik tanpa pengukuran nyata.

---

## 7. Larangan Keras
- Dilarang menghapus file hanya karena sekilas tampak tidak dipakai.
- Dilarang pembersihan massal tanpa inventaris dan verifikasi referensi.
- Dilarang menghapus test agar build lulus.
- Dilarang mematikan lint / TypeScript strictness demi menghilangkan error.
- Dilarang menghapus validasi, izin, error handling, atau cleanup penting.
- Dilarang menambah dependency baru untuk tugas pembersihan sederhana.
- Dilarang auto-format seluruh repo jika hanya beberapa baris yang diubah.
- Dilarang menyentuh `.env`, database, secrets, atau data pengguna tanpa izin.
- Dilarang mengklaim kode 100% bersih tanpa bukti cakupan audit.

---

## 8. Format Laporan Akhir
Laporkan secara ringkas:
- **Dibersihkan**: File, fungsi, aset, atau dependensi yang diubah.
- **Alasan & Bukti**: Bukti konkret ketiadaan referensi atau masalah performa.
- **Manfaat Nyata**: Metrik terukur (misal test lulus, bundle mengecil).
- **Verifikasi**: Perintah yang dijalankan dan status exit code.
- **Dipertahankan**: Item yang ditunda karena masih berisiko / berelasi.
- **Tindak Lanjut**: Temuan nyata yang butuh konfirmasi.

---

## Checklist Akhir
- [ ] Aturan proyek & status Git diperiksa.
- [ ] Seluruh kandidat hapus terbukti bebas referensi (termasuk dynamic & config).
- [ ] Tidak ada perubahan pengguna yang terhapus / tertimpa.
- [ ] Validasi, izin, error handling, dan cleanup tetap utuh.
- [ ] Efek samping, listener, dan subscription sudah diverifikasi.
- [ ] Test (`npm test`), typecheck, dan build (`npm run build`) lulus 100%.
- [ ] Diff terfokus hanya pada item pembersihan.
- [ ] Tidak ada klaim metrik tanpa bukti empiris.
