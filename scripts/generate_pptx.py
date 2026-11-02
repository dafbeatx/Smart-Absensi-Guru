import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

PPTX_PATH = os.path.abspath("SAGA_Terpadu_Presentasi.pptx")
SCREENSHOTS_DIR = os.path.abspath("screenshots")
VIDEO_PATH = os.path.abspath("intro_saga_terpadu.mp4")

prs = Presentation()
# Set 16:9 Widescreen dimensions
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]

# Brand Color Palette
C_NAVY_DARK = RGBColor(2, 50, 70)      # #023246
C_TEAL = RGBColor(40, 112, 148)        # #287094
C_EMERALD = RGBColor(16, 185, 129)     # #10b981
C_SLATE = RGBColor(100, 116, 139)      # #64748b
C_DARK = RGBColor(15, 23, 42)          # #0f172a
C_LIGHT_BG = RGBColor(248, 250, 252)   # #f8fafc
C_WHITE = RGBColor(255, 255, 255)      # #ffffff
C_BORDER = RGBColor(226, 232, 240)     # #e2e8f0

def add_header(slide, title_text, category_text="SAGA TERPADU — SMP TERPADU AL-ITTIHADIYAH"):
    # Header bar
    header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.9))
    tf = header_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p0 = tf.paragraphs[0]
    p0.text = category_text.upper()
    p0.font.size = Pt(11)
    p0.font.bold = True
    p0.font.color.rgb = C_EMERALD
    
    p1 = tf.add_paragraph()
    p1.text = title_text
    p1.font.size = Pt(22)
    p1.font.bold = True
    p1.font.color.rgb = C_NAVY_DARK

def add_card(slide, left, top, width, height, title, points, bg_color=C_LIGHT_BG, border_color=C_BORDER):
    # Shape card
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.color.rgb = border_color
    shape.line.width = Pt(1.5)
    
    # Text
    tf = shape.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.2)
    tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    tf.margin_bottom = Inches(0.2)
    
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_NAVY_DARK
    p.space_after = Pt(8)
    
    for pt in points:
        p_item = tf.add_paragraph()
        p_item.text = f"• {pt}"
        p_item.font.size = Pt(11)
        p_item.font.color.rgb = C_DARK
        p_item.space_after = Pt(4)

# ==========================================
# SLIDE 1: COVER
# ==========================================
s1 = prs.slides.add_slide(blank_layout)
# Dark background
bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
bg1.fill.solid()
bg1.fill.fore_color.rgb = C_NAVY_DARK
bg1.line.fill.background()

# Title text box
tb1 = s1.shapes.add_textbox(Inches(0.9), Inches(1.2), Inches(6.8), Inches(4.5))
tf1 = tb1.text_frame
tf1.word_wrap = True

p_badge = tf1.paragraphs[0]
p_badge.text = "INOVASI DIGITAL SEKOLAH MANDIRI"
p_badge.font.size = Pt(12)
p_badge.font.bold = True
p_badge.font.color.rgb = C_EMERALD
p_badge.space_after = Pt(14)

p_title = tf1.add_paragraph()
p_title.text = "SAGA TERPADU"
p_title.font.size = Pt(46)
p_title.font.bold = True
p_title.font.color.rgb = C_WHITE
p_title.space_after = Pt(10)

p_sub = tf1.add_paragraph()
p_sub.text = "Platform Administrasi dan Pengelolaan Sekolah Berbasis Digital"
p_sub.font.size = Pt(18)
p_sub.font.color.rgb = RGBColor(224, 242, 254)
p_sub.space_after = Pt(20)

p_school = tf1.add_paragraph()
p_school.text = "SMP Terpadu Al-Ittihadiyah"
p_school.font.size = Pt(20)
p_school.font.bold = True
p_school.font.color.rgb = RGBColor(56, 189, 248)
p_school.space_after = Pt(6)

p_theme = tf1.add_paragraph()
p_theme.text = "Bimtek Penguatan Digitalisasi & Pemanfaatan BOSP Kinerja Terbaik"
p_theme.font.size = Pt(13)
p_theme.font.color.rgb = C_SLATE

# Video Box on Right side
v_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.0), Inches(1.2), Inches(4.4), Inches(4.8))
v_card.fill.solid()
v_card.fill.fore_color.rgb = RGBColor(15, 35, 50)
v_card.line.color.rgb = C_TEAL
v_card.line.width = Pt(2)

# Insert Video thumbnail / poster frame
thumb1 = os.path.join(SCREENSHOTS_DIR, "frame_1.png")
if os.path.exists(thumb1):
    s1.shapes.add_picture(thumb1, Inches(8.2), Inches(1.4), Inches(4.0), Inches(2.25))

# Video label
v_tb = s1.shapes.add_textbox(Inches(8.2), Inches(3.8), Inches(4.0), Inches(2.0))
v_tf = v_tb.text_frame
v_tf.word_wrap = True
v_p1 = v_tf.paragraphs[0]
v_p1.text = "🎬 Video Perkenalan Singkat (16s)"
v_p1.font.size = Pt(13)
v_p1.font.bold = True
v_p1.font.color.rgb = C_WHITE
v_p2 = v_tf.add_paragraph()
v_p2.text = "File video intro_saga_terpadu.mp4 siap diputar untuk memperkenalkan keutuhan platform di awal presentasi."
v_p2.font.size = Pt(10)
v_p2.font.color.rgb = RGBColor(148, 163, 184)

s1.notes_slide.notes_text_frame.text = (
    "Assalamu’alaikum Warahmatullahi Wabarakatuh, salam sejahtera bagi Bapak/Ibu narasumber dan rekan pendidik sekalian. "
    "Perkenankan kami dari SMP Terpadu Al-Ittihadiyah mempersembahkan SAGA Terpadu: Platform Administrasi dan Pengelolaan Sekolah Berbasis Digital. "
    "Sistem ini kami kembangkan secara mandiri untuk mengintegrasikan kebutuhan guru, akademik, kesiswaan, hingga tata kelola rapat sekolah dalam satu pintu."
)

# ==========================================
# SLIDE 2: LATAR BELAKANG
# ==========================================
s2 = prs.slides.add_slide(blank_layout)
add_header(s2, "Latar Belakang: Tantangan Pengelolaan Administrasi Sekolah", "1. LATAR BELAKANG PENGEMBANGAN")

add_card(s2, Inches(0.8), Inches(1.6), Inches(5.6), Inches(2.5),
         "📂 Pencatatan yang Terfragmentasi",
         ["Buku presensi di piket, map izin di lemari TU, dan notulen rapat di agenda pribadi.",
          "Jadwal mengawas ujian di mading dan lembar peminatan siswa tercecer terpisah-pisah.",
          "Data tidak terhubung sehingga sering terjadi penginputan ganda oleh staf."])

add_card(s2, Inches(6.8), Inches(1.6), Inches(5.6), Inches(2.5),
         "⏱️ Penelusuran Informasi yang Lama",
         ["Membutuhkan waktu lama saat mencari riwayat surat izin guru atau dokumen rapat lampau.",
          "Kroscek jadwal mengawas saat ada guru berhalangan membutuhkan koordinasi fisik berulang.",
          "Pencarian buku nilai dan kelanjutan studi siswa memerlukan pembongkaran arsip fisik."])

add_card(s2, Inches(0.8), Inches(4.4), Inches(5.6), Inches(2.4),
         "🤝 Kebutuhan Koordinasi Antar-Peran",
         ["Kepala Sekolah membutuhkan informasi harian yang cepat untuk memantau aktivitas sekolah.",
          "Wali kelas membutuhkan wadah terpusat untuk memetakan arah masa depan siswa binaan.",
          "Guru membutuhkan transparansi dalam catatan kehadiran dan hak perizinan."])

add_card(s2, Inches(6.8), Inches(4.4), Inches(5.6), Inches(2.4),
         "📋 Tuntutan Pengarsipan Rapi & Sah",
         ["Kebutuhan dokumen pelaporan yang teratur dan aman dari risiko fisik (rusak/terselip).",
          "Format laporan yang siap saji untuk evaluasi internal yayasan maupun dinas pendidikan.",
          "Mewujudkan tata kelola modern yang sejalan dengan semangat BOSP Kinerja Terbaik."])

s2.notes_slide.notes_text_frame.text = (
    "Di sekolah kita sehari-hari, bapak/ibu guru dan staf mengelola banyak sekali dokumen penting. "
    "Ada buku kehadiran, map izin, catatan rapat, jadwal mengawas, hingga formulir peminatan siswa. "
    "Seringkali data-data tersebut tersimpan terpisah-pisah sehingga menyita waktu saat ditelusuri. "
    "Dari sinilah kami merasa perlu membangun sebuah wadah digital bersama yang menyatukan seluruh tata kelola sekolah."
)

# ==========================================
# SLIDE 3: MENGENAL SAGA TERPADU
# ==========================================
s3 = prs.slides.add_slide(blank_layout)
add_header(s3, "Mengenal SAGA Terpadu: Satu Platform, Lima Pilar Layanan", "2. MENGENAL PLATFORM")

pillars = [
    ("1. Manajemen Guru & SDM", ["Presensi mandiri ponsel", "Layanan izin & cuti digital", "Koreksi presensi mandiri", "Rekapitulasi kehadiran"], Inches(0.8), Inches(1.6)),
    ("2. Administrasi Akademik", ["Distribusi pengawas ujian", "Tukar pengawas (Proctor Swap)", "Cetak kartu ujian barcode", "Format nilai semester Excel"], Inches(4.8), Inches(1.6)),
    ("3. Ruang Wali Kelas", ["Direktori induk siswa", "Pemetaan kelanjutan studi", "Verifikasi persetujuan ortu", "Pencatatan karakter siswa"], Inches(8.8), Inches(1.6)),
    ("4. Tata Kelola Sekolah", ["Notulen rapat digital", "Penugasan PIC & deadline", "Inventaris sarpras belajar", "Kalender kegiatan sekolah"], Inches(2.8), Inches(4.4)),
    ("5. Komunikasi & Informasi", ["Kotak aspirasi terlindungi", "Papan siaran pengumuman", "Monitoring pimpinan sekolah", "Laporan rekapitulasi terpadu"], Inches(6.8), Inches(4.4)),
]

for title, pts, left, top in pillars:
    add_card(s3, left, top, Inches(3.7), Inches(2.5), title, pts)

s3.notes_slide.notes_text_frame.text = (
    "SAGA Terpadu kami bangun sebagai rumah besar administrasi sekolah yang menaungi 5 pilar layanan utama. "
    "Layanan guru, administrasi akademik, ruang wali kelas, tata kelola rapat dan sarpras, serta saluran komunikasi internal. "
    "Semua berada dalam satu aplikasi sehingga bapak/ibu guru tidak perlu berpindah-pindah sistem."
)

# ==========================================
# SLIDE 4: MANAJEMEN GURU & SDM
# ==========================================
s4 = prs.slides.add_slide(blank_layout)
add_header(s4, "Manajemen Guru & SDM: Tertib, Adil, dan Tanpa Kertas", "3. LAYANAN PENDIDIK & TENAGA KEPENDIDIKAN")

add_card(s4, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
         "Fasilitas Terpadu bagi Pendidik:",
         ["Presensi Mandiri Cepat: Verifikasi lokasi lingkungan sekolah & pemindaian kode poster dari HP.",
          "Toleransi Area Sekolah: Guru dapat memindai dari selasar atau ruang guru tanpa antre di gerbang.",
          "Layanan Izin Digital: Pengajuan izin, sakit, cuti, atau tugas luar disertai unggahan foto surat.",
          "Koreksi Presensi Mandiri: Jalur resmi konfirmasi jika lupa absen atau terkendala tugas piket.",
          "Rekapitulasi Kehadiran Otomatis: Sekali klik menghasilkan rekap PDF dan lembar Excel siap pakai.",
          "Transparansi Penuh: Guru dapat melihat riwayat kehadiran pribadi kapan saja secara tenang."])

# Image on right
img1 = os.path.join(SCREENSHOTS_DIR, "screen_01_leave_permit.png")
if os.path.exists(img1):
    s4.shapes.add_picture(img1, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.2))

s4.notes_slide.notes_text_frame.text = (
    "Pada pilar Manajemen Guru, fokus kami adalah membangun kedisiplinan yang adil sekaligus memanusiakan. "
    "Guru melakukan presensi mandiri dengan toleransi area sekolah yang memadai agar tidak berdesakan di gerbang. "
    "Pengajuan izin dilakukan tanpa kertas cukup dengan mengunggah foto surat tugas atau surat dokter. "
    "Jika lupa absen karena menyambut siswa, guru dapat mengajukan koreksi resmi. Rekap kehadiran pun terbit otomatis di akhir bulan."
)

# ==========================================
# SLIDE 5: ADMINISTRASI AKADEMIK
# ==========================================
s5 = prs.slides.add_slide(blank_layout)
add_header(s5, "Administrasi Akademik: Kelancaran Evaluasi & Ujian Sekolah", "4. ADMINISTRASI AKADEMIK & UJIAN")

add_card(s5, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
         "Dukungan Panitia & Evaluasi Belajar:",
         ["Penataan Jadwal Pengawas: Distribusi ruang, sesi, dan jadwal mengawas tersusun transparan.",
          "Fitur Tukar Pengawas (Proctor Swap): Fasilitas pertukaran jadwal jaga resmi antarguru di sistem.",
          "Administrasi Ujian Siap Cetak: Otomatisasi lembar Berita Acara, Daftar Hadir, dan Pakta Integritas.",
          "Kartu Peserta Ujian Siswa: Penerbitan kartu ujian berbarcode unik per siswa.",
          "Format Penilaian Semester Standar: Ekspor template nilai ASTS/ASAS Excel dengan rumus terkunci.",
          "Buku Nilai Terstruktur: Kompatibel multi-jenjang (Kelas 7, 8, 9, dan SMA) tanpa risiko rumus tertimpa."])

img2 = os.path.join(SCREENSHOTS_DIR, "screen_02_exam_proctor_swap.png")
img3 = os.path.join(SCREENSHOTS_DIR, "screen_03_exam_card_grading.png")
if os.path.exists(img2):
    s5.shapes.add_picture(img2, Inches(6.8), Inches(1.6), Inches(5.7), Inches(2.5))
if os.path.exists(img3):
    s5.shapes.add_picture(img3, Inches(6.8), Inches(4.3), Inches(5.7), Inches(2.5))

s5.notes_slide.notes_text_frame.text = (
    "Saat masa asesmen atau ujian sekolah tiba, panitia ujian dan bapak/ibu guru biasanya menghadapi beban administrasi yang padat. "
    "Di SAGA Terpadu, jadwal mengawas diatur terpusat, dan jika guru berhalangan, tersedia fitur pertukaran jadwal jaga resmi. "
    "Kartu peserta berbarcode dan berita acara ujian terbit otomatis, lengkap dengan format buku nilai Excel yang rumusnya sudah terkunci rapi."
)

# ==========================================
# SLIDE 6: TATA KELOLA & WALI KELAS
# ==========================================
s6 = prs.slides.add_slide(blank_layout)
add_header(s6, "Tata Kelola Sekolah, Ruang Wali Kelas, & Sarana Prasarana", "5. TATA KELOLA & PEMBINAAN SISWA")

add_card(s6, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
         "Kolaborasi & Keteraturan Sekolah:",
         ["Notulen Rapat Digital: Hasil musyawarah dewan guru tercatat rapi dan dapat diakses kapan saja.",
          "Penugasan PIC & Deadline: Keputusan rapat langsung memiliki penanggung jawab dan batas waktu.",
          "Ruang Wali Kelas (Peminatan Siswa): Pendataan arah kelanjutan studi siswa kelas akhir (SMA/SMK/MA/Pesantren).",
          "Verifikasi Persetujuan Orang Tua: Arsip kepastian persetujuan wali murid untuk pendampingan BK.",
          "Katalog Inventaris Sarpras: Pencatatan fasilitas ruang belajar dan pemantauan kondisi barang.",
          "Kalender Kegiatan & Pengumuman: Acuan agenda bersama agar seluruh warga sekolah selaras."])

img4 = os.path.join(SCREENSHOTS_DIR, "screen_04_meeting_minutes.png")
img5 = os.path.join(SCREENSHOTS_DIR, "screen_05_homeroom_plan.png")
if os.path.exists(img4):
    s6.shapes.add_picture(img4, Inches(6.8), Inches(1.6), Inches(5.7), Inches(2.5))
if os.path.exists(img5):
    s6.shapes.add_picture(img5, Inches(6.8), Inches(4.3), Inches(5.7), Inches(2.5))

s6.notes_slide.notes_text_frame.text = (
    "Melalui modul Notulen Rapat Digital, hasil musyawarah dewan guru langsung memiliki guru penanggung jawab dan tenggat waktu terpantau. "
    "Wali kelas 9 memiliki ruang khusus untuk mendata peminatan studi lanjut anak didiknya beserta persetujuan orang tua. "
    "Ditambah modul inventaris sarpras dan kalender bersama, seluruh denyut kegiatan sekolah tertata secara kolaboratif."
)

# ==========================================
# SLIDE 7: DEMONSTRASI SAGA TERPADU
# ==========================================
s7 = prs.slides.add_slide(blank_layout)
add_header(s7, "Simulasi Demonstrasi: Keterpaduan Lintas Layanan", "6. DEMONSTRASI SISTEM")

steps = [
    ("1. Beranda Guru & Informasi", "Akses cepat jadwal mengajar, pengumuman sekolah, dan status harian di HP.", Inches(0.8), Inches(1.6)),
    ("2. Administrasi Akademik", "Jadwal mengawas ruang ujian dan simulasi tukar pengawas (Proctor Swap).", Inches(0.8), Inches(2.9)),
    ("3. Notulen Rapat & Tugas", "Pencatatan keputusan musyawarah guru dan pembagian tugas penanggung jawab.", Inches(0.8), Inches(4.2)),
    ("4. Ruang Wali Kelas", "Pemetaan kelanjutan studi siswa kelas 9 dan verifikasi persetujuan orang tua.", Inches(0.8), Inches(5.5)),
]

for title, desc, left, top in steps:
    add_card(s7, left, top, Inches(5.6), Inches(1.15), title, [desc])

img7 = os.path.join(SCREENSHOTS_DIR, "screen_07_dashboard_report.png")
img6 = os.path.join(SCREENSHOTS_DIR, "screen_06_sarpras_calendar.png")
if os.path.exists(img7):
    s7.shapes.add_picture(img7, Inches(6.8), Inches(1.6), Inches(5.7), Inches(2.5))
if os.path.exists(img6):
    s7.shapes.add_picture(img6, Inches(6.8), Inches(4.3), Inches(5.7), Inches(2.5))

s7.notes_slide.notes_text_frame.text = (
    "Bapak/Ibu sekalian, pada layar dapat kita saksikan alur kerja nyata lintas modul di SAGA Terpadu. "
    "Dari beranda guru di ponsel, jadwal mengawas di modul ujian, penugasan di notulen rapat, data kesiswaan di ruang wali kelas, "
    "hingga dashboard pimpinan yang menyajikan laporan siap unduh. Seluruh sistem bekerja serentak dalam satu pintu."
)

# ==========================================
# SLIDE 8: MANFAAT BAGI WARGA SEKOLAH
# ==========================================
s8 = prs.slides.add_slide(blank_layout)
add_header(s8, "Manfaat Nyata bagi Seluruh Warga Sekolah", "7. DAMPAK IMPLEMENTASI")

add_card(s8, Inches(0.8), Inches(1.6), Inches(5.6), Inches(2.5),
         "👔 Bagi Kepala Sekolah",
         ["Gambaran utuh dinamika harian sekolah secara terpusat untuk evaluasi program.",
          "Pemantauan tindak lanjut keputusan rapat dan perizinan guru secara objektif.",
          "Mempermudah koordinasi penanganan kelas kosong sebelum bel pertama berbunyi."])

add_card(s8, Inches(6.8), Inches(1.6), Inches(5.6), Inches(2.5),
         "👨‍🏫 Bagi Bapak & Ibu Guru",
         ["Kepastian catatan kehadiran, jadwal mengajar, dan hak perizinan tanpa rasa was-was.",
          "Kemudahan berkoordinasi jadwal mengawas dan menyampaikan aspirasi sarana belajar.",
          "Waktu administrasi berkurang sehingga dapat lebih fokus membimbing peserta didik."])

add_card(s8, Inches(0.8), Inches(4.4), Inches(5.6), Inches(2.5),
         "📁 Bagi Tenaga Administrasi (TU)",
         ["Pengarsipan dokumen surat izin, data guru, dan berita acara ujian terpusat rapi.",
          "Menghindari pekerjaan lembur berulang dalam menyusun lembar rekapitulasi kehadiran.",
          "Penyajian data sekolah saat monitoring atau supervisi menjadi cepat dan siap saji."])

add_card(s8, Inches(6.8), Inches(4.4), Inches(5.6), Inches(2.5),
         "🏫 Bagi Satuan Pendidikan",
         ["Membangun budaya kerja sekolah yang disiplin, transparan, dan saling percaya.",
          "Pengurangan penggunaan kertas fisik secara bertahap menuju tata kelola ramah lingkungan.",
          "Bukti kemandirian digital sekolah dalam mendukung program BOSP Kinerja Terbaik."])

s8.notes_slide.notes_text_frame.text = (
    "Manfaat terbesar dari sistem terpadu ini adalah terciptanya iklim kerja yang tenang, teratur, dan saling percaya. "
    "Kepala Sekolah memimpin dengan data yang obyektif, guru bekerja dengan kepastian hak dan tugas, "
    "staf tata usaha terbebas dari rutinitas rekap manual yang melelahkan, dan sekolah melangkah maju dengan tata kelola modern."
)

# ==========================================
# SLIDE 9: TAHAP PENGEMBANGAN & PENUTUP
# ==========================================
s9 = prs.slides.add_slide(blank_layout)
add_header(s9, "Tahap Pengembangan Berkelanjutan & Penutup", "8. KESIMPULAN & ARAH PENGEMBANGAN")

add_card(s9, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2),
         "Kejujuran Status & Arah Pengembangan:",
         ["Sudah Beroperasi Stabil: Manajemen SDM & Izin, Administrasi Ujian & Pengawas, Ruang Wali Kelas, Notulen Rapat, Inventaris Sarpras, Kalender, dan Laporan.",
          "Sedang Disempurnakan: Modul bantu penyusunan draf soal kurikulum merdeka dan integrasi koreksi nilai ujian digital.",
          "Rencana Masa Depan: Penjajakan pencatatan mandiri kehadiran siswa di kelas dan penyediaan aplikasi mobile langsung.",
          "Kemandirian Sistem: Aset sistem mandiri yang dapat terus dirawat tanpa ketergantungan biaya pihak ketiga."])

# Right box - Inspirational Quote
quote_shape = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.2))
quote_shape.fill.solid()
quote_shape.fill.fore_color.rgb = C_NAVY_DARK
quote_shape.line.fill.background()

q_tf = quote_shape.text_frame
q_tf.word_wrap = True
q_tf.margin_left = Inches(0.4)
q_tf.margin_right = Inches(0.4)
q_tf.margin_top = Inches(0.6)

qp1 = q_tf.paragraphs[0]
qp1.text = "REFLEKSI DIGITALISASI SEKOLAH"
qp1.font.size = Pt(12)
qp1.font.bold = True
qp1.font.color.rgb = C_EMERALD
qp1.space_after = Pt(20)

qp2 = q_tf.add_paragraph()
qp2.text = "“Digitalisasi sekolah bukan tentang membuat sistem yang rumit, melainkan tentang mempermudah pekerjaan manusia di dalamnya agar para pendidik dapat mencurahkan ketulusan terbaiknya bagi anak didik.”"
qp2.font.size = Pt(17)
qp2.font.italic = True
qp2.font.color.rgb = RGBColor(224, 242, 254)
qp2.space_after = Pt(28)

qp3 = q_tf.add_paragraph()
qp3.text = "SMP Terpadu Al-Ittihadiyah"
qp3.font.size = Pt(18)
qp3.font.bold = True
qp3.font.color.rgb = C_WHITE

qp4 = q_tf.add_paragraph()
qp4.text = "Terima Kasih — Sesi Tanya Jawab & Diskusi"
qp4.font.size = Pt(13)
qp4.font.color.rgb = RGBColor(56, 189, 248)

s9.notes_slide.notes_text_frame.text = (
    "Sebagai penutup, kami menegaskan bahwa SAGA Terpadu terus berproses. Modul utama tata kelola telah berjalan stabil, "
    "dan kami terus menyempurnakan fitur-fitur pembelajaran berikutnya. "
    "Bagi kami di SMP Terpadu Al-Ittihadiyah, esensi digitalisasi adalah membebaskan para pendidik dari kerumitan administrasi, "
    "agar energi terbaik bapak/ibu guru seutuhnya tertuju untuk mendidik dan mencerdaskan anak bangsa. Terima kasih. Wassalamu’alaikum Warahmatullahi Wabarakatuh."
)

prs.save(PPTX_PATH)
print(f"PowerPoint Presentation generated successfully: {PPTX_PATH} ({os.path.getsize(PPTX_PATH)} bytes)")

