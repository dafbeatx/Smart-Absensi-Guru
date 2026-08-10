# UI DESIGN SYSTEM — ANTI AI-GENERIC / ANTI AI-SLOP

## Tujuan

Gunakan dokumen ini sebagai aturan wajib ketika membuat atau memperbaiki UI website.

Target utama:

- UI terasa dibuat oleh product designer, bukan hasil template AI generik.
- Visual memiliki identitas yang jelas dan konsisten.
- Tidak menggunakan pola "AI dashboard" yang terlalu umum.
- Tampilan nyaman pada mobile, terutama layar sekitar 720 × 1640 px seperti Infinix Note 8.
- Layout memiliki ruang bernapas dan tidak terasa sesak.
- Animasi halus, fungsional, dan tidak berlebihan.
- Semua keputusan visual harus memiliki alasan UX, bukan sekadar dekorasi.

---

# 1. PRINSIP VISUAL UTAMA

### Hindari

JANGAN membuat UI dengan kombinasi berikut secara default:

- Gradient ungu/biru yang generik.
- Background `#f8fafc` + card putih + shadow besar di seluruh halaman.
- Font Inter untuk semua hal tanpa pertimbangan.
- Terlalu banyak rounded card.
- Semua elemen berbentuk pill.
- Glassmorphism berlebihan.
- Icon Lucide/Heroicons yang ditempel di setiap label tanpa fungsi jelas.
- Dashboard dengan banyak card statistik yang semuanya terlihat sama.
- Tombol gradient.
- Border tipis di hampir setiap elemen.
- Shadow pada semua komponen.
- Animasi `fade-in` pada semua elemen ketika halaman dibuka.
- Emoji sebagai pengganti icon UI.
- Efek hover yang tidak relevan pada perangkat touch.
- Layout yang terlihat seperti template SaaS generik.
- Section dengan pola:
  `Icon → Heading → Description → Button`
  berulang-ulang.
- Hero section dengan heading besar generik seperti "Solusi Terbaik Untuk Anda".
- Copywriting yang terlalu sempurna, abstrak, atau terdengar seperti hasil AI.

### Gunakan

Prioritaskan:

- Hierarki tipografi yang kuat.
- Warna aksen yang spesifik dan tidak pasaran.
- Ruang kosong yang disengaja.
- Grid yang sederhana.
- Komponen dengan bentuk yang tidak semuanya sama.
- Kontras yang jelas.
- 1–2 gaya icon yang konsisten.
- Visual hierarchy sebelum dekorasi.
- Animasi kecil yang menjelaskan perubahan state.
- Detail mikro yang membuat UI terasa dirancang manusia.
- Elemen editorial, utility-first, atau product-oriented sesuai konteks website.

---

# 2. RESPONSIVE MOBILE FIRST

Target utama adalah mobile.

Jangan menganggap ukuran layar fisik sebagai ukuran CSS.

Gunakan pendekatan:

```css
width: 100%;
max-width: 480px;
margin-inline: auto;
padding-inline: 16px;
box-sizing: border-box;
```

### Breakpoint

Gunakan breakpoint secukupnya:

```text
< 380px     small mobile
380–639px   mobile
640–1023px  tablet
≥ 1024px    desktop
```

Jangan membuat terlalu banyak breakpoint jika tidak diperlukan.

### Mobile spacing

Gunakan baseline spacing:

```text
4px   micro
8px   tight
12px  compact
16px  standard
20px  comfortable
24px  section
32px  major section
40px+ hero / major separation
```

Pada mobile, hindari padding horizontal lebih dari 24px kecuali ada alasan desain.

---

# 3. CONTAINER DAN LAYOUT

Gunakan container yang terkontrol.

```css
.container {
    width: min(100% - 32px, 1120px);
    margin-inline: auto;
}
```

Untuk halaman yang fokus mobile:

```css
.mobile-content {
    width: min(100% - 32px, 480px);
    margin-inline: auto;
}
```

Jangan membuat konten memenuhi layar tanpa alasan.

### Prinsip

Satu layar tidak harus memuat semuanya.

Lebih baik:

```text
Header
↓
Primary content
↓
Secondary information
↓
Action
```

daripada:

```text
Header
↓
8 cards
↓
3 statistics
↓
banner
↓
table
↓
5 buttons
```

---

# 4. COLOR SYSTEM

Jangan langsung memilih warna dari tren UI.

Pilih satu warna utama yang memiliki karakter sesuai brand.

Gunakan sistem:

```css
:root {
    --bg: #F5F3EE;
    --surface: #FFFFFF;
    --text: #181818;
    --text-muted: #6F6B63;
    --border: #DDD9D0;

    --primary: #2457A6;
    --primary-hover: #1D4789;

    --success: #287A52;
    --warning: #A66A13;
    --danger: #B64040;
}
```

Warna contoh di atas hanya baseline. Sesuaikan dengan identitas website.

### Aturan warna

Gunakan:

- 1 warna brand utama.
- 1 warna background utama.
- 1 warna surface.
- 1 warna teks utama.
- 1 warna muted.
- Warna semantic untuk success/warning/error.

Jangan menggunakan 5 warna aksen hanya karena terlihat menarik.

### Rasio visual

Kira-kira:

```text
70–80% neutral
15–25% supporting color
5–10% accent
```

Accent harus terasa bernilai karena jarang digunakan.

---

# 5. TYPOGRAPHY

Font adalah salah satu pembeda utama dari UI AI generic.

Jangan otomatis memakai:

```text
Inter
Roboto
Arial
Poppins
```

untuk semua proyek.

Pilih font berdasarkan karakter produk.

### Contoh pasangan font

#### Editorial / modern

```text
Heading: Fraunces
Body: Manrope
```

#### Modern product

```text
Heading: Geist
Body: Geist
```

#### Human / friendly

```text
Heading: Plus Jakarta Sans
Body: Plus Jakarta Sans
```

#### Institutional / education

```text
Heading: Source Serif 4
Body: Source Sans 3
```

#### Technical

```text
Heading: IBM Plex Sans
Body: IBM Plex Sans
Mono: IBM Plex Mono
```

Jangan mencampur lebih dari 2 keluarga font tanpa alasan.

### Scale mobile

```text
Display: 32–40px
H1: 28–32px
H2: 22–26px
H3: 18–20px
Body: 14–16px
Small: 12–13px
Caption: 11–12px
```

Gunakan line-height:

```text
Heading: 1.1–1.25
Body: 1.45–1.65
```

Jangan membuat semua heading bold 700.

Gunakan variasi weight:

```text
400 regular
500 medium
600 semibold
700 bold
```

---

# 6. ICON SYSTEM

Pilih SATU sistem icon utama.

Contoh:

- Lucide
- Phosphor
- Tabler
- Material Symbols

Jangan mencampur icon dari banyak library.

### Aturan icon

Icon harus:

- memiliki fungsi.
- memiliki ukuran konsisten.
- memiliki stroke/weight konsisten.
- tidak sekadar dekorasi.

Ukuran:

```text
12px  metadata
16px  inline
18px  standard
20px  button/navigation
24px  primary action
28–32px special context
```

Jangan membuat icon 48px hanya agar card terlihat "lebih modern".

### Hindari

```text
[icon besar]
Judul
Deskripsi
```

untuk setiap card.

Itu salah satu pola paling mudah dikenali sebagai AI-generated UI.

---

# 7. BUTTON

Jangan semua button berbentuk pill.

Default:

```css
border-radius: 10px;
min-height: 44px;
padding-inline: 16px;
```

Gunakan pill hanya untuk:

- tag
- status
- filter
- kategori
- compact control

Primary button harus jelas.

Contoh:

```text
Simpan Perubahan
Daftar Sekarang
Lanjutkan
```

Bukan:

```text
Get Started
Learn More
Explore Now
```

jika website berbahasa Indonesia.

---

# 8. CARD

Card tidak harus selalu berupa kotak putih dengan shadow.

Gunakan beberapa pola:

### Flat

```css
background: var(--surface);
border: 1px solid var(--border);
```

### Section

Gunakan background berbeda tanpa border.

### Elevated

Gunakan shadow hanya untuk elemen yang benar-benar perlu terasa berada di atas layout.

### Rule

Jika setiap elemen adalah card, maka tidak ada lagi hierarki.

Tidak semua informasi harus dibungkus card.

---

# 9. BORDER DAN SHADOW

### Border

Gunakan border untuk:

- memisahkan area.
- input.
- table.
- navigation.
- state tertentu.

Jangan memberikan border ke semua elemen.

### Shadow

Shadow harus sangat subtle.

Hindari:

```css
box-shadow: 0 20px 50px rgba(...);
```

sebagai default.

Lebih baik:

```css
box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
```

Gunakan shadow sebagai informasi depth, bukan dekorasi.

---

# 10. NAVIGATION MOBILE

Navigation mobile harus sederhana.

Prioritaskan maksimal 4–5 menu utama.

Contoh:

```text
Beranda
Data
Aktivitas
Profil
```

Gunakan active state yang jelas.

Jangan membuat navbar penuh dengan:

```text
icon + label + badge + gradient + shadow + animation
```

semuanya sekaligus.

---

# 11. ANIMATION SYSTEM

Animasi harus menjelaskan perubahan.

Gunakan durasi:

```text
100–150ms  micro interaction
150–220ms  standard transition
220–350ms  modal / panel
350–500ms  page-level movement
```

Gunakan easing:

```css
cubic-bezier(0.2, 0.8, 0.2, 1)
```

### Animasi yang disarankan

- button press.
- hover desktop.
- dropdown.
- modal.
- drawer.
- tab switching.
- accordion.
- loading state.
- toast.
- perubahan status.
- skeleton loading.

### Hindari

Jangan membuat semua elemen:

```text
fade in
fade in
fade in
fade in
```

ketika halaman pertama dibuka.

Jangan menggunakan:

```text
bounce
spin
float
pulse
wiggle
```

tanpa alasan UX.

### Reduced motion

Wajib mendukung:

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

---

# 12. MICRO INTERACTION

UI yang terasa premium biasanya bukan karena animasi besar.

Gunakan detail kecil.

Contoh:

### Button

```text
Normal
↓
Hover
↓
Pressed
```

Pressed dapat sedikit berubah:

```css
transform: translateY(1px);
```

### Input

Saat focus:

- border berubah.
- label tetap jelas.
- tidak perlu glow besar.

### Toggle

Gunakan perubahan posisi yang cepat dan natural.

### Toast

Masuk dari arah yang masuk akal.

Jangan membuat toast terbang dari tengah layar.

---

# 13. FORM DESIGN

Form harus terasa ringan.

Gunakan:

```text
Label
Input
Helper text / error
```

Jangan:

```text
Icon besar
Label
Input
Badge
Description
Tooltip
```

untuk field sederhana.

Input mobile:

```css
min-height: 44px;
```

Untuk field penting:

```css
min-height: 48px;
```

---

# 14. EMPTY STATE

Jangan membuat empty state seperti template:

```text
[ilustrasi besar]
Nothing here yet!
Start exploring...
[Get Started]
```

Gunakan konteks nyata.

Contoh:

```text
Belum ada data absensi

Data kehadiran guru akan muncul setelah
proses absensi pertama dilakukan.

[Mulai Absensi]
```

Ringkas dan langsung.

---

# 15. LOADING STATE

Prioritaskan skeleton yang mengikuti bentuk konten sebenarnya.

Jangan membuat satu spinner besar di tengah layar jika sebagian halaman sebenarnya sudah dapat ditampilkan.

Gunakan:

```text
Skeleton header
Skeleton content
Skeleton action
```

Loading harus mempertahankan layout agar halaman tidak melompat.

---

# 16. ERROR STATE

Error message harus membantu pengguna.

Jangan:

```text
Something went wrong.
```

Gunakan:

```text
Data belum dapat dimuat.

Periksa koneksi internet lalu coba lagi.

[Coba Lagi]
```

---

# 17. CONTENT / COPY

UI bukan hanya CSS.

Hindari bahasa yang terasa seperti AI.

Jangan terlalu sering menggunakan:

```text
Temukan
Jelajahi
Tingkatkan produktivitas
Solusi terbaik
Pengalaman seamless
Transformasi digital
```

Gunakan bahasa yang sesuai fungsi.

Contoh:

```text
Tambah Guru
Lihat Absensi
Simpan Data
Export Excel
Perbarui Profil
```

UI yang baik berbicara seperti manusia yang sedang membantu pengguna, bukan seperti brosur startup.

---

# 18. DATA VISUALIZATION

Untuk statistik, jangan semua angka dimasukkan ke card.

Prioritaskan:

```text
angka utama
konteks
perubahan
periode
```

Contoh:

```text
96%

Kehadiran bulan ini
+4,2% dari bulan lalu
```

Jika chart tidak memberikan insight, jangan gunakan chart.

---

# 19. TABLE MOBILE

Jangan memaksa tabel desktop masuk ke layar mobile.

Gunakan:

- horizontal scroll jika tabel memang perlu.
- atau ubah menjadi list/card pada mobile.
- prioritaskan kolom paling penting.

Contoh:

```text
Nama Guru
Status       Hadir
Jam          07:12
```

daripada 10 kolom kecil yang tidak terbaca.

---

# 20. IMAGE DAN MEDIA

Jangan menggunakan gambar hanya untuk mengisi ruang.

Setiap gambar harus memiliki fungsi:

- identitas.
- konteks.
- informasi.
- visual storytelling.

Gunakan aspect ratio yang konsisten.

Contoh:

```css
aspect-ratio: 16 / 9;
object-fit: cover;
```

Jangan membuat setiap gambar menjadi lingkaran.

---

# 21. ACCESSIBILITY

Minimal:

- kontras teks cukup.
- tombol memiliki ukuran touch target minimal sekitar 44px.
- focus state terlihat.
- jangan hanya mengandalkan warna untuk status.
- icon-only button memiliki `aria-label`.
- input memiliki label.
- gunakan semantic HTML.
- keyboard navigation harus masuk akal.

---

# 22. RESPONSIVE QUALITY CHECK

Sebelum dianggap selesai, cek minimal:

```text
320px
360px
390px
430px
480px
768px
1024px
1280px
1440px
```

Khusus mobile:

- Tidak ada horizontal overflow.
- Tidak ada teks terpotong.
- Button tidak terlalu kecil.
- Navbar tidak bertabrakan.
- Modal tidak keluar layar.
- Input tidak menyebabkan layout pecah.
- Card tidak terlalu padat.
- Jarak antar elemen tetap konsisten.

---

# 23. DESIGN TOKENS

Gunakan CSS variables atau Tailwind theme.

Contoh:

```css
:root {
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 18px;

    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
}
```

Jangan menggunakan radius acak seperti:

```text
7px
13px
17px
23px
```

tanpa alasan.

---

# 24. RULE UNTUK AI CODING AGENT

Jika kamu adalah AI coding agent yang mengimplementasikan UI ini:

1. Baca struktur project terlebih dahulu.
2. Jangan mengubah arsitektur tanpa alasan.
3. Identifikasi design language yang sudah ada.
4. Pertahankan branding yang memang sudah digunakan.
5. Jangan membuat komponen baru jika komponen existing masih dapat digunakan.
6. Jangan menambahkan dependency hanya untuk dekorasi.
7. Jangan mengganti seluruh UI sekaligus tanpa kebutuhan.
8. Gunakan existing icon library jika project sudah memilikinya.
9. Gunakan existing font jika sudah ditentukan project.
10. Jangan memasukkan gradient hanya karena area terlihat kosong.
11. Jangan menambahkan animasi pada semua elemen.
12. Jangan membuat semua section menjadi card.
13. Jangan membuat semua button menjadi pill.
14. Jangan membuat semua heading terlalu besar.
15. Jangan menggunakan emoji sebagai icon UI.
16. Jangan menggunakan placeholder copy generik.
17. Pastikan responsive sebelum menambahkan dekorasi.
18. Prioritaskan hierarchy, readability, spacing, dan interaction.
19. Setiap perubahan visual harus konsisten dengan design system.
20. Jika ada dua solusi visual yang sama-sama valid, pilih yang lebih sederhana.

---

# 25. DEFINITION OF DONE

UI dianggap selesai jika:

- [ ] Tidak terlihat seperti template SaaS generik.
- [ ] Warna memiliki identitas.
- [ ] Typography memiliki hierarchy.
- [ ] Icon konsisten.
- [ ] Tidak semua elemen berbentuk card.
- [ ] Tidak semua elemen menggunakan shadow.
- [ ] Tidak ada gradient dekoratif yang tidak diperlukan.
- [ ] Animasi memiliki fungsi.
- [ ] Mobile nyaman digunakan.
- [ ] Tidak ada horizontal overflow.
- [ ] Touch target cukup besar.
- [ ] Loading dan error state tersedia.
- [ ] Focus state tersedia.
- [ ] Reduced motion didukung.
- [ ] Copywriting terasa natural.
- [ ] Visual hierarchy tetap jelas tanpa dekorasi berlebihan.

---

# 26. PRIORITAS IMPLEMENTASI

Jika waktu terbatas, kerjakan dalam urutan:

```text
1. Layout
2. Responsive
3. Typography
4. Color
5. Spacing
6. Component hierarchy
7. Icon
8. Interaction
9. Animation
10. Decorative details
```

Jangan membalik urutan menjadi:

```text
Gradient → Glow → Animation → Shadow → Layout
```

Karena hasilnya biasanya menjadi UI yang terlihat keren di screenshot tetapi menyebalkan ketika dipakai.

---

# FINAL DIRECTIVE

Buat UI yang memiliki karakter.

Jangan mengejar tampilan "modern" hanya dengan:

- gradient,
- rounded card,
- shadow,
- glassmorphism,
- icon,
- animation.

Modern UI yang baik berasal dari keputusan desain yang konsisten.

Jika sebuah elemen tidak membantu pengguna memahami, memilih, membaca, atau melakukan sesuatu, pertimbangkan untuk menghapusnya.

**Less decoration. More intention.**
