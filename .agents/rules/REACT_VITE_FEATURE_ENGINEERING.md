# React + Vite Feature Engineering

## Misi
Tambahkan fitur yang benar-benar dibutuhkan, selaras dengan arsitektur yang sudah ada, mudah dirawat, aman, cepat, dan nyaman digunakan. Jangan sekadar membuat kode yang terlihat selesai. Pastikan fitur bekerja tuntas dari alur interaksi pengguna, penanganan data, hingga penanganan kondisi gagal (*error recovery*).

**Aturan Utama**:
1. **Pahami Sebelum Mengubah**: Telusuri struktur, alur data, dependensi, dan aturan repository sebelum menulis kode.
2. **Pertahankan Fondasi**: Dilarang mengganti framework, merombak arsitektur, mengganti library inti, atau mendesain ulang halaman tanpa kebutuhan jelas dan izin.
3. **Selesaikan Akar Masalah**: Dilarang menambal gejala dengan timeout acak, retry tanpa batas, state duplikat, atau conditional semu.
4. **Hindari Abstraksi Prematur**: Buat helper, hook, atau komponen reusable hanya ketika ada kebutuhan nyata, bukan demi terlihat rapi.
5. **Jaga Kompatibilitas Fitur Lama**: Pastikan perilaku dan fitur yang sudah berjalan tidak rusak.
6. **Dilarang Mengarang**: Dilarang membuat data dummy palsu di produksi, statistik tiruan, tombol tanpa aksi (*dead click*), atau link kosong.
7. **Transparan Terhadap Kegagalan**: Laporkan kegagalan pengujian, build, atau integrasi apa adanya tanpa ditutupi.
8. **Perubahan Terkecil yang Lengkap**: Utamakan perubahan terfokus dan minimal yang menyelesaikan masalah secara tuntas.

---

## 1. Tahap Inspeksi Wajib
Sebelum mulai mengimplementasikan kode:
- Baca `AGENTS.md`, aturan repository, dan dokumentasi terkait.
- Periksa `package.json`, versi React/Vite/TS, serta dependensi yang sudah terpasang.
- Petakan alur data menyeluruh: `Input Pengguna → Validasi → State/Request → Response Server → Render UI`.
- Identifikasi kontrak yang wajib dipertahankan: bentuk props, tipe database, endpoint API, permission, dan navigasi.
- Verifikasi baseline proyek awal agar error warisan tidak dikira regresi baru.

---

## 2. Perencanaan Fitur
Tetapkan sebelum coding:
- Masalah nyata pengguna yang diselesaikan & kriteria penerimaan (*acceptance criteria*).
- File dan modul yang terdampak.
- Kebutuhan data, permission, validasi, dan edge-cases.
- Penanganan 5 status UI: Normal, Loading, Empty, Error, dan Recovery.
- Jika ada ambiguitas besar, mintalah klarifikasi singkat. Untuk detail kecil, gunakan konvensi proyek yang ada.

---

## 3. Arsitektur & Kualitas Kode
- **Gunakan Fondasi yang Ada**: Tetap gunakan React + Vite tanpa migrasi ke framework lain.
- **Strict TypeScript**: Hindari `any`; gunakan tipe spesifik, domain types, atau `unknown` dengan narrowing.
- **Pemisahan Tanggung Jawab**: Pisahkan UI visual, state logic, validasi, dan data access layer.
- **Pragmatis**: Terapkan KISS, DRY, dan SOLID tanpa over-engineering.
- **Disiplin React Hooks**:
  - Hindari komponen raksasa atau prop-drilling berlebihan.
  - Gunakan `useEffect` hanya untuk sinkronisasi sistem eksternal, bukan pengganti event handler.
  - Pastikan dependency array lengkap dan sediakan cleanup function untuk listener, observer, timer, atau subscription.
  - Cegah race condition, stale closure, memory leak, dan infinite render loop.
- **Efisiensi Library**: Dilarang menambah library baru jika dependensi yang ada sudah mencukupi.

---

## 4. State, Data, dan API
- **Single Source of Truth**: Jangan menduplikasi nilai yang sama di beberapa state.
- **State Scope**: Bedakan state lokal komponen dan state global; gunakan state manager yang sudah ada di proyek.
- **Validasi Input**: Validasi ketat di batas sistem (form, URL params, local storage, API). Jangan percaya browser sebagai penentu izin.
- **Penanganan Jaringan**:
  - Tangani status loading, empty, success, dan error secara elegan.
  - Cegah double-submit pada tombol aksi dan request ganda.
  - Hindari polling agresif, query boros (`SELECT *`), pola N+1, dan payload raksasa.
  - Gunakan debounce, pagination, filtering, dan cache invalidation yang teruji.
- **Keamanan Backend**:
  - Verifikasi hak akses dan role di backend/database (RLS), bukan hanya menyembunyikan tombol di UI.
  - **Zero Leak**: Dilarang membocorkan password, secret key, atau data sensitif ke client atau console log.

---

## 5. UI dan UX
Setiap fitur wajib memiliki status tampilan yang lengkap:
- **Loading**: Tampilkan skeleton atau spinner proporsional tanpa memblokir tanpa batas.
- **Success**: Berikan konfirmasi visual hanya setelah mutasi data benar-benar berhasil di server.
- **Empty**: Sampaikan pesan informatif jika belum ada data serta panduan tindakan selanjutnya.
- **Error**: Sajikan pesan ramah pengguna tanpa membocorkan detail teknis internal dan beri tombol pemulihan.
- **Retry**: Gunakan batasan percobaan ulang yang wajar.
- **Destructive Action**: Wajib konfirmasi eksplisit sebelum menghapus data penting.
- **Formulir**: Label jelas, pesan error per-field, pencegahan submit ganda, dan navigasi keyboard.
- **Konsistensi Desain**: Ikuti token warna, tipografi, radius, dan spacing proyek. Hindari dekorasi generik berlebih tanpa fungsi.

---

## 6. Responsivitas dan Aksesibilitas
- **Mobile-First & Infinix Note 8**: Dukung layar 320–430px hingga desktop. Hindari horizontal overflow dan teks terpotong.
- **Viewport Ergonomis**: Gunakan safe-area dan dynamic viewport units (`100dvh`) pada alur kerja mobile penuh.
- **Touch Target**: Pastikan tombol aksi sentuh berukuran minimal 44–48px.
- **Aksesibilitas**: Gunakan elemen semantik HTML5, alt text, focus state, navigasi keyboard, dan kontras warna yang memadai.

---

## 7. Performa Frontend
- **Optimasi Terukur**: Ukur masalah sebelum melakukan optimasi kompleks.
- **Hindari Render Berlebih**: Gunakan `useMemo` / `useCallback` hanya saat ada beban komputasi berat atau kebutuhan stabilitas referensi.
- **Code Splitting**: Terapkan dynamic import (`React.lazy`) untuk modal atau modul besar.
- **Aset Ringan**: Gunakan format gambar efisien (WebP/SVG), lazy loading, dan hindari string Base64 raksasa.
- **Resource Cleanup**: Pastikan timer, interval, dan event listener dilepas saat unmount.

---

## 8. Keamanan Aplikasi
- Validasi dan sanitasi seluruh input eksternal; hindari `dangerouslySetInnerHTML` tanpa sanitasi teruji.
- Cegah kerentanan XSS, open redirect, CSRF, dan kebocoran kredensial.
- Dilarang menonaktifkan lint, typecheck, atau security policy demi memaksakan status hijau.
- Dilarang menjalankan perintah destruktif pada database atau konfigurasi produksi.

---

## 9. Pengujian & Quality Gates
Setelah implementasi, wajib melalui tahapan verifikasi:
1. Jalankan unit/integration test proyek (`npm test`).
2. Jalankan typecheck / lint (`tsc -b`).
3. Jalankan production build (`npm run build`).
4. Uji alur sukses, input salah, loading, data kosong, dan penanganan error.
5. Uji responsivitas pada viewport mobile dan desktop.
6. Periksa console dari error runtime atau warning bentrok.
7. Tinjau `git diff` untuk memastikan tidak ada file nyasar atau perubahan tak disengaja.

---

## 10. Batasan Perubahan & Larangan Keras
Dilarang tanpa kebutuhan eksplisit dan izin:
- Mengganti arsitektur inti (React, Vite, TypeScript, routing, styling).
- Mengubah desain halaman lain di luar lingkup tugas.
- Menghapus lockfile atau folder dependensi sebagai jalan pintas error.
- Menjalankan `npm audit fix --force`.
- Memasukkan data mock ke alur produksi untuk menutupi integrasi yang belum rampung.
- Mengubah `.env`, database, secrets, atau deployment secara diam-diam.

---

## 11. Alur Kerja 7 Langkah
1. **Inspect**: Baca aturan, dependensi, dan kode eksisting.
2. **Trace**: Pahami alur data hulu ke hilir.
3. **Plan**: Tentukan kriteria penerimaan, file target, dan skenario edge-case.
4. **Implement**: Buat perubahan terfokus dan minimal yang bekerja tuntas.
5. **Verify**: Jalankan test suite dan build lokal.
6. **Review**: Periksa diff, keamanan, responsivitas, dan regresi.
7. **Report**: Laporkan fakta hasil verifikasi secara jujur dan transparan.

---

## 12. Format Laporan Akhir & Checklist
Laporkan secara ringkas:
- **Fitur / Solusi**: Masalah yang diselesaikan dan solusi yang dibangun.
- **File Terdampak**: Daftar file yang dimodifikasi beserta tujuannya.
- **Keputusan Teknis**: Validasi, state, otorisasi, atau arsitektur yang dipilih.
- **Verifikasi Nyata**: Hasil pengujian (`npm test`, `npm run build`) dengan status exit code.
- **Keterbatasan / Temuan**: Hal yang belum teruji atau temuan terpisah di luar ruang lingkup.

### Checklist Akhir Sebelum Selesai
- [ ] Aturan proyek & implementasi yang ada sudah dipelajari.
- [ ] Alur fungsional, data, loading, empty, dan error state tertangani lengkap.
- [ ] Tidak ada penambahan dependensi baru yang tidak perlu.
- [ ] UI konsisten dengan design system, responsif, dan bebas overflow.
- [ ] Otorisasi dan validasi diverifikasi hingga level server/database.
- [ ] Seluruh unit test, typecheck, dan build terverifikasi lulus.
- [ ] Diff bersih dari kode mati, console log debug, dan mock data palsu.
- [ ] Laporan akhir menyajikan data dan bukti empiris secara jujur.
