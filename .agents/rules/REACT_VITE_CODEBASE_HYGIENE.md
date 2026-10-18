# React + Vite Codebase Hygiene

## Misi
Menjaga proyek tetap ramping, mudah dipahami, efisien untuk developer dan AI agent, serta stabil saat dibangun dan dijalankan. Kurangi kompleksitas, token konteks yang terbuang, ukuran bundle, request jaringan, dan pekerjaan berulang tanpa mengorbankan fitur, keamanan, keterbacaan, atau keandalan.

**Prinsip Inti**: Hapus hanya yang terbukti tidak diperlukan. Kode pendek tidak selalu lebih baik, dan pengurangan token prompt tidak otomatis berarti performa aplikasi meningkat.

---

## 1. Aturan Keselamatan Sebelum Membersihkan
1. **Baca Aturan & Konteks**: Baca `AGENTS.md`, `README.md`, dokumentasi, dan aturan repository yang relevan sebelum melakukan tindakan apapun.
2. **Periksa Status Git**: Periksa `git status` dan perubahan yang belum di-commit. Jangan menimpa atau membuang perubahan pengguna.
3. **Pahami Arsitektur**: Pahami struktur folder, `package.json`, lockfile, konfigurasi Vite/TypeScript/lint/test, serta entry point aplikasi.
4. **Verifikasi Referensi Menyeluruh**: Cari semua referensi dan cara penggunaan sebelum menghapus file, export, komponen, fungsi, dependency, atau konfigurasi.
5. **Perubahan Bertahap**: Buat perubahan bertahap, kecil, dan mudah ditinjau. Pisahkan refactor luas dari perubahan fitur bila memungkinkan.
6. **Berdasarkan Bukti, Bukan Asumsi**: Jangan menghapus berdasarkan nama file, jumlah baris, usia kode, atau perkiraan agent saja.
7. **Larangan Aksi Destruktif**: Jangan menjalankan perintah destruktif, menghapus database/data pengguna, mengubah secrets, atau memaksa perubahan dependency tanpa persetujuan.
8. **Prinsip Kehati-hatian**: Jika dampak penghapusan belum jelas, pertahankan item tersebut dan laporkan sebagai kandidat untuk pemeriksaan manual.

---

## 2. Kategori yang Harus Diaudit

### A. Kode Mati dan Duplikasi
Cari dan verifikasi:
- Import yang tidak digunakan.
- Variabel, fungsi, tipe, konstanta, dan export yang tidak digunakan.
- Komponen atau hook yang tidak pernah dipakai.
- File duplikat, helper dengan fungsi identik, dan implementasi fitur yang berulang.
- CSS selector, class, aset, ikon, gambar, atau font yang tidak lagi direferensikan.
- Komentar usang, blok kode yang sudah dikomentari, log debug sementara, dan TODO yang telah selesai.
- State yang dapat dihitung dari props/state lain dan tidak perlu disimpan terpisah (*derived state*).
- Abstraksi atau wrapper yang tidak memberi manfaat nyata.

> [!IMPORTANT]
> Sebelum menghapus, periksa dynamic import, lazy route, registrasi plugin, file yang diakses berdasarkan string/path, konfigurasi, public assets, test, script build, serta penggunaan oleh konsumen eksternal. Tidak semua referensi terlihat melalui import biasa.

### B. Dependensi dan Konfigurasi
- Periksa `dependencies` langsung dan `devDependencies` yang benar-benar digunakan.
- Cari paket yang fungsinya sudah disediakan platform modern atau dependency lain yang telah ada.
- Gunakan alat analisis dependency yang tersedia di proyek jika cocok; perlakukan hasilnya sebagai petunjuk, bukan bukti mutlak.
- Jangan menghapus paket yang dipakai melalui plugin, konfigurasi, CLI, script, atau tooling hanya karena tidak di-import di `src/`.
- Jangan memperbarui semua dependency sebagai bagian dari pembersihan rutin.
- Jangan menghapus atau membuat ulang lockfile demi "merapikan".
- Jangan menjalankan `npm audit fix --force` sebagai jalan pintas.
- Pertahankan versi runtime, konfigurasi Vite, alias, environment, dan toolchain kecuali ada alasan yang teruji.

### C. Struktur dan Kompleksitas
- Satukan logika yang benar-benar identik jika perubahan mengurangi duplikasi tanpa membuat abstraksi sulit dipahami.
- Pecah komponen besar hanya saat ada batas tanggung jawab yang jelas atau manfaat pengujian/reuse yang nyata.
- Hapus lapisan wrapper, adapter, context, hook, dan helper yang tidak memiliki alasan arsitektural.
- Hindari membuat sistem konfigurasi generik untuk satu kasus sederhana (*over-engineering*).
- Hindari satu file raksasa demi mengurangi jumlah file.
- Pertahankan batas tanggung jawab yang membuat kode lebih mudah ditelusuri dan diuji.
- Jangan mengganti nama, memindahkan, atau mengubah API publik tanpa mengecek semua konsumen dan kebutuhan kompatibilitas.

### D. State, Effect, dan Resource
- Cari `useEffect` yang dipakai untuk menghitung state turunan, memicu workflow yang lebih cocok berada di event handler, atau menyinkronkan state yang sama berulang kali.
- Periksa dependency effect, cleanup function, listener, subscription, observer, timer, dan interval.
- Cegah loop render/effect, stale closure, race condition, request ganda, dan update yang tidak lagi relevan.
- Hindari `useMemo`, `useCallback`, dan `React.memo` yang tidak memiliki manfaat terukur atau kebutuhan stabilitas referensi.
- Pastikan event listener, WebSocket/realtime, observer, dan subscription dilepas (*cleaned up*) saat unmount atau tidak lagi diperlukan.
- Hindari polling agresif. Pilih mekanisme update yang sesuai dengan kebutuhan dan backend.
- Jangan menghapus cleanup yang penting hanya untuk mengurangi jumlah baris.

### E. Network dan Data
- Cari request duplikat, polling berlebihan, payload besar, query yang mengambil terlalu banyak kolom, serta pola N+1.
- Periksa apakah beberapa komponen mengambil data yang sama tanpa koordinasi atau caching yang sudah tersedia.
- Gunakan pagination, filtering, debounce, caching, atau lazy loading ketika sesuai dengan pola dan kebutuhan aplikasi.
- Jangan menambahkan caching tanpa aturan invalidasi yang benar.
- Jangan menghapus validasi, otorisasi, penanganan error, atau audit log yang diperlukan demi mengurangi kode.
- Jangan mengubah kontrak API, skema database, atau kebijakan akses sebagai efek samping pembersihan.
- Jangan mencatat token, password, data sensitif, atau respons privat ke log (*zero data leak*).

### F. Aset dan Frontend Performance
- Cari gambar yang tidak digunakan, aset duplikat, file sumber besar yang ikut masuk build tanpa alasan, dan font yang tidak terpakai.
- Optimalkan ukuran/format gambar dan gunakan lazy loading untuk konten di luar viewport jika sesuai.
- Periksa dynamic import dan code splitting pada route/fitur besar.
- Hindari dependency UI berat untuk satu ikon atau fungsi kecil jika alternatif yang sudah tersedia memadai.
- Audit CSS yang tidak terpakai dengan memperhatikan class dinamis, CSS Modules, Tailwind, dan pemakaian dari file yang tidak terdeteksi alat.
- Jangan menghapus CSS hanya karena tidak ditemukan sebagai string literal; class dapat dibentuk secara dinamis atau dipakai dari template.
- Jangan melakukan optimasi sebelum ada indikasi yang jelas, terutama bila perubahan menambah kompleksitas.

---

## 3. Mengurangi Pemborosan Token AI
Token konteks AI berbeda dari performa runtime aplikasi. Terapkan aturan berikut agar agent tidak membaca, menghasilkan, atau mengulang informasi yang tidak diperlukan:
- **Baca Selektif**: Baca hanya file dan bagian yang relevan terlebih dahulu; perluas pemeriksaan jika ada dependensi atau risiko yang ditemukan.
- **Pencarian Tertarget**: Gunakan pencarian simbol, import, route, dan referensi untuk menemukan lokasi kode sebelum membuka banyak file.
- **Hindari Dump Besar**: Jangan menyalin seluruh repository, file lock, output build, `node_modules`, source map, atau file minified ke konteks tanpa kebutuhan spesifik.
- **Rujuk, Jangan Duplikasi**: Jangan mengulang isi `AGENTS.md` atau dokumentasi yang sudah dipahami; simpan aturan permanen di satu sumber yang jelas dan rujuk seperlunya.
- **Cegah Aturan Tumpang Tindih**: Hindari membuat banyak file aturan yang isinya tumpang tindih atau saling bertentangan.
- **Ringkasan Kerja Terfokus**: Gunakan ringkasan kerja singkat yang berisi tujuan, keputusan, file relevan, hasil test, dan pekerjaan yang tersisa.
- **Gunakan Diff / Slice**: Jangan mengeluarkan ulang file penuh jika cukup memberi diff atau bagian yang berubah.
- **Dokumentasi Efisien**: Jangan menghasilkan dokumentasi panjang untuk perubahan kecil. Dokumentasikan keputusan yang memengaruhi pemeliharaan, kontrak, keamanan, atau operasi.
- **Komentar Bermakna**: Hindari komentar yang hanya menerjemahkan kode baris demi baris. Pertahankan komentar yang menjelaskan alasan, batasan, atau perilaku tidak jelas.
- **Filter Log Output**: Jangan menampilkan output terminal yang sangat panjang jika ringkasan dan bagian error sudah cukup.
- **Verifikasi Efektif**: Gunakan output test, lint, dan build secara selektif; jangan mengulang pemeriksaan yang sama tanpa perubahan kode atau alasan baru.
- **Rencana Proporsional**: Hindari rencana panjang untuk perubahan kecil. Buat rencana sesuai kompleksitas dan risiko.
- **Hindari Boilerplate Buatan**: Jangan membuat helper, abstraksi, dokumen, atau test duplikat hanya untuk memenuhi checklist secara mekanis.
- **Pertahankan Konteks Kunci**: Jangan menghapus konteks penting yang diperlukan agent berikutnya demi membuat prompt tampak pendek.

### Aturan untuk Konteks Repository
Jika proyek menggunakan file instruksi agent:
- Simpan aturan lintas proyek yang benar-benar penting di satu file utama yang mudah ditemukan (`AGENTS.md`).
- Pecah instruksi per direktori hanya jika aturan lokal berbeda secara material.
- Hindari menaruh salinan lengkap aturan global di banyak file.
- Buat dokumentasi arsitektur singkat: struktur inti, sumber kebenaran data, cara menjalankan test/build, dan batasan berisiko tinggi.
- Jangan menambahkan instruksi yang hanya menyatakan hal umum tanpa memengaruhi keputusan agent.
- Jangan menyimpan rahasia, token, kredensial, data pribadi, atau dump lingkungan dalam dokumentasi maupun konteks agent.

---

## 4. Strategi Audit yang Aman
Lakukan audit dengan urutan berikut:
1. **Baseline**: Periksa status Git, script proyek, test, lint, typecheck, dan build yang tersedia.
2. **Inventory**: Identifikasi kandidat kode mati, duplikasi, dependency berlebih, request ganda, resource yang tidak dibersihkan, dan konteks yang berulang.
3. **Evidence**: Cari referensi, import, route, konfigurasi, script, test, dan pemakaian dinamis.
4. **Prioritize**: Dahulukan item yang manfaatnya jelas, risikonya rendah, dan mudah diverifikasi.
5. **Change**: Hapus atau sederhanakan satu kelompok kecil dalam satu waktu.
6. **Verify**: Jalankan pemeriksaan relevan setelah setiap kelompok perubahan.
7. **Review**: Tinjau diff, perilaku aplikasi, bundle/network jika alat tersedia, serta perubahan yang tidak disengaja.
8. **Report**: Laporkan apa yang dibersihkan, manfaat yang terbukti, item yang belum aman dihapus, dan pemeriksaan yang benar-benar dijalankan.

> [!NOTE]
> Jika baseline sudah gagal, catat kegagalan awal agar tidak diklaim sebagai regresi baru tanpa bukti.

---

## 5. Cara Menentukan Prioritas
Prioritaskan:
1. **Bug Nyata**: Infinite loop, request berulang, memory leak, dan crash.
2. **Kode Mati Terverifikasi**: Yang telah diverifikasi 100% tidak digunakan di mana pun.
3. **Duplikasi Berulang**: Duplikasi yang membuat perbaikan bug harus dilakukan berkali-kali.
4. **Aset & Dependency Berlebih**: Yang terbukti tidak terpakai dan membebani bundle.
5. **Query / Payload Boros**: Yang terukur memperlambat jaringan atau membebani database.
6. **Kompleksitas Penghambat**: Abstraksi rumit yang benar-benar menghambat pemeliharaan.
7. **Konteks AI yang Boros**: Pengurangan konteks dan dokumentasi berulang yang menghabiskan token prompt.

*Jangan mengejar jumlah baris kode yang dihapus. Ukur keberhasilan berdasarkan kompleksitas yang berkurang, perilaku yang tetap benar, risiko yang turun, serta manfaat yang dapat dibuktikan.*

---

## 6. Pemeriksaan Setelah Pembersihan
Jalankan script yang benar-benar ada di `package.json`:
- Test unit / integration yang relevan (`npm test`).
- Lint / Typecheck (`tsc -b`).
- Production build (`npm run build`).
- Pemeriksaan route, navigasi, autentikasi, form, dan alur data yang terdampak.
- Pemeriksaan console / network dan request berulang jika alat tersedia.
- Pemeriksaan responsivitas jika UI berubah (termasuk standar Mobile Infinix Note 8).
- Perbandingan bundle atau aset sebelum/sesudah jika tersedia dan relevan.

> [!CAUTION]
> Jangan menyatakan pemeriksaan lulus jika tidak dijalankan. Jangan mengarang angka penghematan token, ukuran bundle, waktu muat, atau penggunaan memori. Jika tidak diukur, nyatakan bahwa manfaatnya masih berupa perkiraan atau belum diverifikasi.

---

## 7. Larangan Keras
- **Dilarang** menghapus file hanya karena terlihat tidak dipakai tanpa pembuktian referensi.
- **Dilarang** membersihkan seluruh proyek secara massal tanpa inventaris dan verifikasi.
- **Dilarang** menghapus test untuk membuat build hijau.
- **Dilarang** menonaktifkan lint, TypeScript strictness, atau pemeriksaan keamanan untuk menghilangkan error.
- **Dilarang** menghapus validasi, permission check, error handling, logging penting, atau cleanup yang dibutuhkan.
- **Dilarang** menambahkan dependency baru untuk pekerjaan pembersihan sederhana tanpa alasan kuat.
- **Dilarang** menjalankan format otomatis pada seluruh repository jika hanya beberapa file yang perlu berubah.
- **Dilarang** mengubah desain atau fitur yang tidak berkaitan dengan pembersihan.
- **Dilarang** menyentuh `.env`, secrets, database, data pengguna, atau konfigurasi produksi tanpa kebutuhan dan izin.
- **Dilarang** mengklaim kode sudah bersih seluruhnya; audit selalu bergantung pada cakupan dan bukti yang tersedia.

---

## 8. Format Laporan Akhir
Laporkan secara ringkas:
- **Yang Dibersihkan**: File, fungsi, dependency, aset, effect, atau request yang diubah.
- **Alasan & Bukti**: Bukti bahwa item tersebut tidak diperlukan atau menimbulkan masalah.
- **Manfaat Nyata**: Hasil yang benar-benar diukur (misal build lulus, bundle berkurang, atau request turun). Jika tidak diukur, jangan membuat klaim kuantitatif.
- **Verifikasi**: Perintah yang dijalankan (`npm test`, `npm run build`) dan hasilnya.
- **Yang Dipertahankan**: Kandidat yang tidak dihapus karena masih memiliki referensi atau risiko.
- **Risiko / Tindak Lanjut**: Hanya temuan nyata yang belum diselesaikan.

---

## Checklist Akhir
- [ ] Aturan proyek dan status Git sudah diperiksa.
- [ ] Kandidat yang dihapus sudah diverifikasi referensi dan penggunaannya.
- [ ] Tidak ada perubahan pengguna yang tertimpa.
- [ ] Tidak ada kontrak, izin, validasi, atau cleanup penting yang hilang.
- [ ] Request, effect, listener, dan resource yang relevan sudah ditinjau.
- [ ] Pengurangan konteks AI tidak menghilangkan informasi penting.
- [ ] Test, lint, typecheck, dan build yang tersedia sudah dijalankan atau keterbatasannya dicatat.
- [ ] Diff hanya berisi perubahan yang relevan.
- [ ] Tidak ada klaim penghematan yang tidak didukung bukti.
