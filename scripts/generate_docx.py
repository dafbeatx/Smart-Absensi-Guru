import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

DOCX_PATH = os.path.abspath("Naskah_Presenter_SAGA_Terpadu.docx")
doc = Document()

# Page Margins (Normal 1 inch)
for section in doc.sections:
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)

# Color Constants
HEX_NAVY = "023246"
HEX_TEAL = "287094"
HEX_EMERALD = "10B981"
HEX_SLATE = "64748B"
HEX_LIGHT = "F1F5F9"

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

# Title & Metadata
title_p = doc.add_paragraph()
title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run_badge = title_p.add_run("PANDUAN LISAN & BUKU SAKU PRESENTER\n")
run_badge.font.size = Pt(11)
run_badge.font.bold = True
run_badge.font.color.rgb = RGBColor(16, 185, 129)

run_title = title_p.add_run("SAGA TERPADU\n")
run_title.font.size = Pt(26)
run_title.font.bold = True
run_title.font.color.rgb = RGBColor(2, 50, 70)

run_sub = title_p.add_run("Platform Administrasi dan Pengelolaan Sekolah Berbasis Digital\n")
run_sub.font.size = Pt(14)
run_sub.font.italic = True
run_sub.font.color.rgb = RGBColor(40, 112, 148)

run_inst = title_p.add_run("SMP Terpadu Al-Ittihadiyah\n")
run_inst.font.size = Pt(16)
run_inst.font.bold = True
run_inst.font.color.rgb = RGBColor(2, 50, 70)

run_event = title_p.add_run("Kegiatan: Bimtek Penguatan Digitalisasi Pembelajaran & Pemanfaatan Dana BOSP Kinerja Terbaik\n")
run_event.font.size = Pt(10)
run_event.font.color.rgb = RGBColor(100, 116, 139)

doc.add_paragraph().paragraph_format.space_after = Pt(12)

# Divider Line
def add_divider():
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    p_run = p.add_run("―" * 55)
    p_run.font.color.rgb = RGBColor(203, 213, 225)
    p_run.font.size = Pt(10)

add_divider()

# Section 1: Petunjuk Presenter
h1 = doc.add_heading(level=1)
r_h1 = h1.add_run("1. PETUNJUK TEKNIS BAGI PRESENTER")
r_h1.font.color.rgb = RGBColor(2, 50, 70)
r_h1.font.size = Pt(16)

tips = [
    ("Estimasi Total Waktu", "15 – 20 Menit (Alokasi: Presentasi Slide 8–10 menit, Demonstrasi Langsung 5 menit, Tanya Jawab 5 menit)."),
    ("Gaya Bahasa & Nada Bicara", "Gunakan bahasa Indonesia yang santun, bersahaja, lugas, dan hangat. Posisikan diri sebagai rekan sejawat yang berbagi praktik baik di sekolah swasta terpadu."),
    ("Hindari Istilah Pemrograman", "Jangan menyebut istilah teknis seperti 'PostgreSQL', 'PWA', 'State Machine', 'RLS', atau 'API'. Terjemahkan ke istilah fungsional: basis data awan terpusat, aplikasi web ramah ponsel, sistem pengaman lokasi, dll."),
    ("Penggunaan Naskah", "Naskah ini disusun kata-demi-kata. Anda dapat membacanya secara alami atau menjadikannya panduan poin lisan saat melihat Presenter View di laptop."),
]

for title, desc in tips:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r1 = p.add_run(f"• {title}: ")
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(2, 50, 70)
    p.add_run(desc)

add_divider()

# Section 2: Naskah Lengkap Slide per Slide
h2 = doc.add_heading(level=1)
r_h2 = h2.add_run("2. NASKAH LENGKAP PRESENTER SLIDE PER SLIDE (SLIDE 1 – 9)")
r_h2.font.color.rgb = RGBColor(2, 50, 70)
r_h2.font.size = Pt(16)

SLIDES_DATA = [
    {
        "num": "SLIDE 1",
        "title": "COVER — SAGA TERPADU",
        "aim": "Membuka presentasi dengan santun, memperkenalkan sekolah, tema BOSP Kinerja, dan menegaskan bahwa SAGA Terpadu adalah platform tata kelola terpadu (bukan hanya absensi).",
        "screen_text": "SAGA TERPADU — Platform Administrasi dan Pengelolaan Sekolah Berbasis Digital • SMP Terpadu Al-Ittihadiyah • Praktik Baik Transformasi Digital Menuju Tata Kelola Sekolah yang Terorganisasi, Transparan, dan Kolaboratif.",
        "visual": "Slide 16:9 bernuansa biru dongker (#023246), logo resmi sekolah, dan thumbnail pemutar video intro singkat (intro_saga_terpadu.mp4).",
        "speech": (
            "Assalamu’alaikum Warahmatullahi Wabarakatuh, selamat pagi dan salam sejahtera untuk Bapak/Ibu narasumber "
            "serta sahabat pendidik peserta Bimtek yang saya hormati.\n\n"
            "Perkenankan kami dari SMP Terpadu Al-Ittihadiyah berbagi cerita mengenai sebuah inisiatif dan praktik baik di sekolah kami, "
            "yaitu SAGA Terpadu: Platform Administrasi dan Pengelolaan Sekolah Berbasis Digital.\n\n"
            "Melalui forum penguatan digitalisasi dan pemanfaatan dana BOSP Kinerja ini, kami ingin memperlihatkan bahwa "
            "digitalisasi di sekolah tidak harus rumit atau berbiaya mahal. SAGA Terpadu kami kembangkan secara mandiri "
            "bukan sekadar sebagai aplikasi absensi guru, melainkan sebagai ekosistem terpadu yang membantu mengelola "
            "administrasi guru, pelaksanaan ujian, ruang wali kelas, hingga notulen rapat sekolah dalam satu pintu."
        ),
        "transition": "Mari kita lihat bersama, latar belakang nyata apa di sekolah kami yang mendorong lahirnya sistem ini."
    },
    {
        "num": "SLIDE 2",
        "title": "LATAR BELAKANG PENGEMBANGAN: KEBUTUHAN SISTEM TERPADU",
        "aim": "Menjelaskan tantangan nyata pengelolaan administrasi sekolah yang terpisah-pisah tanpa menggunakan cerita yang dilebih-lebihkan.",
        "screen_text": "Tantangan Administrasi Sekolah: Pencatatan Terfragmentasi (buku & map terpisah) • Penelusuran Informasi yang Menyita Waktu • Kebutuhan Koordinasi Cepat Antar-Peran • Tuntutan Pengarsipan Rapi & Siap Saji.",
        "visual": "Diagram alur tantangan administrasi fisik menuju solusi integrasi satu pintu terpusat.",
        "speech": (
            "Bapak dan Ibu sekalian, di sekolah kita sehari-hari, bapak/ibu guru dan staf tata usaha mengelola banyak sekali dokumen fisik. "
            "Ada buku paraf kehadiran di meja piket, map perizinan terpisah di lemari TU, catatan notulen rapat yang tersimpan di agenda pribadi masing-masing guru, "
            "jadwal mengawas ujian di mading, hingga lembar peminatan studi siswa kelas akhir.\n\n"
            "Ketika Kepala Sekolah membutuhkan data cepat untuk mengisi kelas kosong atau ketika ada guru yang berhalangan hadir saat jadwal ujian, "
            "kita sering kali harus memeriksa berkas fisik satu per satu. Dari sinilah kami menyadari, sekolah membutuhkan satu wadah bersama yang rapi, "
            "aman, dan dapat diakses bersama sesuai peran masing-masing tanpa ada data yang tercecer."
        ),
        "transition": "Lalu, apa saja kelompok layanan yang ada di dalam SAGA Terpadu?"
    },
    {
        "num": "SLIDE 3",
        "title": "MENGENAL SAGA TERPADU: SATU PLATFORM, LIMA PILAR LAYANAN",
        "aim": "Memperkenalkan ekosistem SAGA Terpadu yang terdiri atas lima pilar layanan operasional sekolah.",
        "screen_text": "5 Pilar Layanan: 1. Manajemen Guru & SDM • 2. Administrasi Akademik & Ujian • 3. Ruang Wali Kelas & Siswa • 4. Tata Kelola Rapat & Sarpras • 5. Komunikasi & Informasi Terpadu.",
        "visual": "Bagan lingkaran sentral yang menghubungkan logo SAGA Terpadu dengan 5 pilar layanan sekolah.",
        "speech": (
            "Bapak dan Ibu, inilah gambaran menyeluruh dari SAGA Terpadu. Sistem ini kami rancang seperti rumah besar administrasi sekolah.\n\n"
            "Di dalamnya terdapat lima pilar layanan utama: Pertama, layanan manajemen guru dan kepegawaian. "
            "Kedua, layanan akademik untuk membantu kepanitiaan ujian dan penyiapan buku nilai. "
            "Ketiga, ruang khusus bagi wali kelas untuk mendampingi masa depan peserta didik. "
            "Keempat, tata kelola rapat dewan guru dan inventaris sarana prasarana sekolah. "
            "Dan kelima, saluran komunikasi internal serta papan pengumuman resmi.\n\n"
            "Semuanya berada dalam satu sistem, sehingga bapak/ibu guru tidak perlu mengingat banyak akun atau membuka aplikasi yang berbeda-beda."
        ),
        "transition": "Mari kita lihat modul yang pertama, yaitu manajemen guru dan tenaga kependidikan."
    },
    {
        "num": "SLIDE 4",
        "title": "MANAJEMEN GURU & SDM: TERTIB, ADIL, DAN TANPA KERTAS",
        "aim": "Menunjukkan pengelolaan guru secara menyeluruh dan adil, di mana absensi hanyalah salah satu instrumen kerja.",
        "screen_text": "Fasilitas Pendidik: Presensi Mandiri Ponsel Cepat • Toleransi Area Sekolah (bebas antre gerbang) • Layanan Izin & Cuti Digital Berbukti Surat • Koreksi Presensi Mandiri Transparan • Rekapitulasi Kehadiran Otomatis PDF/Excel.",
        "visual": "Screenshot asli formulir pengajuan izin dengan bukti surat dokter bersanding dengan pratinjau rekapitulasi kehadiran sekolah.",
        "speech": (
            "Pada pilar Manajemen Guru, fokus utama kami adalah membangun kedisiplinan yang adil sekaligus memanusiakan.\n\n"
            "Presensi dilakukan mandiri dari ponsel masing-masing menggunakan lokasi lingkungan sekolah dan poster di sekolah. "
            "Kami memberikan toleransi area sekolah yang memadai agar bapak/ibu guru dapat memindai dari selasar atau ruang guru tanpa perlu berdesakan di gerbang.\n\n"
            "Jika guru berhalangan hadir karena sakit atau tugas dinas, cukup foto surat keterangan resmi dari ponsel dan ajukan lewat aplikasi. "
            "Bahkan jika ada guru yang lupa absen karena langsung mengurus upacara pagi, tersedia formulir koreksi presensi resmi yang dapat disetujui pimpinan. "
            "Di akhir bulan, rekapitulasi kehadiran bulanan sudah terbit otomatis tanpa perlu menghitung paraf kertas secara manual."
        ),
        "transition": "Sekarang mari kita beralih ke pilar kedua yang sangat penting bagi pembelajaran, yaitu Administrasi Akademik."
    },
    {
        "num": "SLIDE 5",
        "title": "ADMINISTRASI AKADEMIK & PELAKSANAAN UJIAN",
        "aim": "Mempresentasikan fitur akademik yang membantu kepanitiaan ujian dan pengelolaan nilai semester guru.",
        "screen_text": "Dukungan Evaluasi Belajar: Distribusi Jadwal Pengawas Ujian • Fitur Tukar Pengawas (Proctor Swap) • Berita Acara Ujian Siap Cetak • Kartu Peserta Ujian Siswa Berbarcode • Format Penilaian Semester Standar Excel (Rumus Terkunci).",
        "visual": "Screenshot asli layar pertukaran jadwal jaga pengawas ujian (Proctor Swap), kartu ujian siswa ber-barcode, dan format nilai semester Excel.",
        "speech": (
            "Bapak dan Ibu pendidik, setiap kali musim asesmen atau ujian sekolah tiba, panitia ujian dan bapak/ibu guru menghadapi tugas administrasi yang cukup padat.\n\n"
            "Di SAGA Terpadu, panitia ujian dapat mendistribusikan jadwal mengawas dengan jelas. Jika ada guru yang mendadak harus dinas luar pada hari ujian, "
            "beliau dapat mengajukan 'Tukar Jadwal Pengawas' dengan rekan sejawat secara resmi di sistem tanpa membuat panitia kebingungan.\n\n"
            "Aplikasi ini juga otomatis menerbitkan Kartu Peserta Ujian berbarcode unik per siswa dan lembar Berita Acara Ujian siap cetak. "
            "Untuk pengumpulan nilai, kami menyediakan format buku nilai resmi Excel multi-sheet yang rumusnya sudah terkunci rapi per jenjang kelas. "
            "Guru tinggal mengisi angka, dan nilai akhir langsung tersusun rapi tanpa khawatir formula rumusnya rusak."
        ),
        "transition": "Bagaimana dengan peran wali kelas dan tata kelola kegiatan sekolah lainnya?"
    },
    {
        "num": "SLIDE 6",
        "title": "TATA KELOLA SEKOLAH, RUANG WALI KELAS, & SARANA PRASARANA",
        "aim": "Memperlihatkan modul tata kelola rapat, pendataan peminatan oleh wali kelas, kalender akademik, dan inventaris sarpras.",
        "screen_text": "Kolaborasi & Keteraturan Sekolah: Notulen Rapat Digital & Penugasan PIC • Ruang Wali Kelas (Pemetaan Studi Lanjut Siswa) • Verifikasi Persetujuan Orang Tua • Katalog Inventaris Sarpras Belajar • Kalender Kegiatan Bersama.",
        "visual": "Screenshot asli notulen rapat dengan penanggung jawab tugas, layar pemetaan kelanjutan studi siswa kelas 9, dan katalog sarpras.",
        "speech": (
            "Bapak dan Ibu yang berbahagia, kekuatan sebuah sekolah terletak pada keteraturan tata kelolanya.\n\n"
            "Melalui modul Notulen Rapat Digital, hasil musyawarah dewan guru tidak berhenti sebagai catatan di buku agenda. "
            "Keputusan rapat dicatat di sistem, ditentukan siapa guru yang bertanggung jawab, dan dicantumkan tenggat waktunya sehingga tindak lanjut rapat dapat dipantau bersama.\n\n"
            "Bagi wali kelas, khususnya kelas 9, tersedia 'Ruang Wali Kelas' untuk mendata arah kelanjutan studi siswa: "
            "apakah siswa berminat melanjutkan ke SMA, SMK, Aliyah, atau Pesantren, serta apakah orang tua sudah menyetujui. "
            "Data ini sangat mempermudah guru BK dalam memberikan bimbingan yang tepat sasaran.\n\n"
            "Selain itu, terdapat modul Inventaris Sarpras untuk memantau fasilitas kelas, serta Kalender Akademik agar seluruh warga sekolah memiliki acuan jadwal yang sama."
        ),
        "transition": "Mari kita saksikan demonstrasi langsung bagaimana modul-modul ini bekerja secara terpadu."
    },
    {
        "num": "SLIDE 7",
        "title": "SIMULASI DEMONSTRASI: KETERPADUAN LINTAS LAYANAN",
        "aim": "Menyajikan alur simulasi langsung penggunaan aplikasi lintas 4 kelompok layanan yang berbeda secara berimbang.",
        "screen_text": "Alur Demonstrasi: 1. Beranda Guru & Informasi di HP • 2. Modul Jadwal Pengawas & Tukar Jaga • 3. Notulen Rapat & Pembagian Tugas • 4. Ruang Wali Kelas Peminatan Siswa • 5. Dashboard Pimpinan & Laporan Rekapitulasi.",
        "visual": "Kolase tangkapan layar asli bernomor urut memperlihatkan transisi modul yang selaras.",
        "speech": (
            "Bapak/Ibu sekalian, pada layar proyektor dapat kita saksikan alur kerja nyata dari aplikasi SAGA Terpadu.\n\n"
            "Pertama, guru membuka aplikasi di ponsel: langsung terlihat kalender sekolah dan pengumuman penting hari ini.\n\n"
            "Kedua, kita beralih ke modul akademik: panitia ujian dan guru dapat memantau jadwal mengawas ruang, serta mengajukan pertukaran jadwal jika berhalangan secara tertib.\n\n"
            "Ketiga, kita melihat modul notulen rapat: arsip keputusan rapat tersusun rapi dengan nama guru penanggung jawab kegiatan.\n\n"
            "Keempat, pada ruang wali kelas: guru memeriksa data kelanjutan studi siswa binaannya.\n\n"
            "Dan kelima, Kepala Sekolah dapat melihat potret keseluruhan kegiatan sekolah serta mengunduh dokumen laporan yang dibutuhkan. "
            "Seluruh modul ini bergerak serentak dalam satu sistem yang sama."
        ),
        "transition": "Lalu, manfaat nyata apa yang dirasakan oleh warga sekolah setelah menggunakan platform terpadu ini?"
    },
    {
        "num": "SLIDE 8",
        "title": "MANFAAT BAGI PENGELOLAAN DAN WARGA SEKOLAH",
        "aim": "Menjelaskan manfaat praktis bagi setiap peran di sekolah secara wajar, objektif, dan tanpa angka klaim fiktif.",
        "screen_text": "Manfaat Nyata: Pimpinan (evaluasi objektif & pemantauan tugas) • Guru (kepastian hak izin, mengawas, & ketenangan mengajar) • Tata Usaha (arsip terpusat & bebas lembur rekap manual) • Lembaga (budaya disiplin & ramah lingkungan).",
        "visual": "Matriks 4 kuadran manfaat bagi Kepala Sekolah, Guru, Tata Usaha, dan Lembaga Satuan Pendidikan.",
        "speech": (
            "Bapak dan Ibu yang kami hormati, manfaat terbesar dari integrasi sistem ini adalah terciptanya iklim kerja yang tenang, teratur, dan saling mendukung.\n\n"
            "Bagi Kepala Sekolah, kepemimpinan menjadi lebih efektif karena informasi terkini selalu tersedia. Keputusan rapat pun dapat dikawal bersama.\n\n"
            "Bagi bapak dan ibu guru, waktu yang biasanya habis untuk urusan surat izin manual atau mencari jadwal mengawas kini dapat digunakan untuk fokus mendampingi peserta didik.\n\n"
            "Bagi rekan-rekan staf Tata Usaha, berkas sekolah tersimpan rapi dalam arsip digital yang aman dan mudah dicari saat dibutuhkan.\n\n"
            "Dan bagi sekolah kami secara keseluruhan, terbangun budaya keterbukaan dan kerapian tata kelola yang mendukung terciptanya iklim belajar yang bermutu."
        ),
        "transition": "Sebagai penutup, bagaimana tahap pengembangan SAGA Terpadu saat ini dan arahnya ke depan?"
    },
    {
        "num": "SLIDE 9",
        "title": "TAHAP PENGEMBANGAN BERKELANJUTAN & PENUTUP",
        "aim": "Menyampaikan status pengembangan fitur secara jujur, rencana penyempurnaan ke depan, serta pesan filosofis tentang digitalisasi pendidikan.",
        "screen_text": "Kondisi Pengembangan: Sudah Beroperasi Stabil (SDM, Ujian, Wali Kelas, Notulen, Sarpras, Laporan) • Sedang Disempurnakan (Draf soal kurikulum merdeka & koreksi nilai terpadu) • Rencana Masa Depan (Presensi mandiri siswa & aplikasi mobile) • Refleksi: Digitalisasi mempermudah manusia agar pendidik fokus pada anak didik.",
        "visual": "Foto bersama dewan guru SMP Terpadu Al-Ittihadiyah dan kotak penutup sesi diskusi tanya jawab.",
        "speech": (
            "Bapak/Ibu narasumber dan rekan-rekan pendidik yang kami muliakan,\n\n"
            "Sebagai bentuk kejujuran profesional, kami sampaikan bahwa SAGA Terpadu terus berproses. "
            "Modul-modul tata kelola utama seperti administrasi guru, ujian, notulen rapat, ruang wali kelas, dan sarpras saat ini telah berjalan stabil di sekolah kami.\n\n"
            "Saat ini kami sedang menyempurnakan modul bantu perumusan kisi-kisi soal ujian, dan ke depan kami berencana memperluas pencatatan mandiri untuk siswa.\n\n"
            "Bagi kami di SMP Terpadu Al-Ittihadiyah, digitalisasi yang didorong melalui program BOSP Kinerja ini adalah amanah untuk membenahi tata kelola sekolah. "
            "Teknologi hadir bukan untuk menggantikan peran bapak/ibu guru, melainkan menjadi alat bantu agar para pendidik terbebas dari beban administrasi yang rumit "
            "dan dapat kembali fokus pada tugas utamanya: mendidik, menginspirasi, dan membimbing generasi penerus bangsa.\n\n"
            "Demikian presentasi yang dapat kami bagikan. Kami sangat menantikan masukan, arahan, dan saran dari Bapak/Ibu narasumber serta rekan-rekan sekalian. "
            "Terima kasih. Wassalamu’alaikum Warahmatullahi Wabarakatuh."
        ),
        "transition": "Selesai — Membuka sesi tanya jawab bersama audiens."
    }
]

for item in SLIDES_DATA:
    # Table box for each slide
    table = doc.add_table(rows=6, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # Set widths
    for row in table.rows:
        row.cells[0].width = Inches(1.8)
        row.cells[1].width = Inches(4.7)
    
    # Headers
    hdr_cell = table.rows[0].cells[0]
    hdr_cell.merge(table.rows[0].cells[1])
    set_cell_background(hdr_cell, HEX_NAVY)
    p_hdr = hdr_cell.paragraphs[0]
    r_hdr = p_hdr.add_run(f"📌 {item['num']} : {item['title']}")
    r_hdr.font.bold = True
    r_hdr.font.size = Pt(12)
    r_hdr.font.color.rgb = RGBColor(255, 255, 255)
    
    fields = [
        ("Tujuan Slide", item["aim"]),
        ("Isi Layar PPT", item["screen_text"]),
        ("Visual & Screenshot", item["visual"]),
        ("Naskah Lisan Presenter", item["speech"]),
        ("Kalimat Transisi", item["transition"]),
    ]
    
    for idx, (lbl, val) in enumerate(fields, start=1):
        cell_lbl = table.rows[idx].cells[0]
        cell_val = table.rows[idx].cells[1]
        
        set_cell_background(cell_lbl, HEX_LIGHT)
        set_cell_margins(cell_lbl, 80, 80, 100, 100)
        set_cell_margins(cell_val, 80, 80, 100, 100)
        
        p_l = cell_lbl.paragraphs[0]
        r_l = p_l.add_run(lbl)
        r_l.font.bold = True
        r_l.font.size = Pt(10)
        r_l.font.color.rgb = RGBColor(2, 50, 70)
        
        p_v = cell_val.paragraphs[0]
        r_v = p_v.add_run(val)
        r_v.font.size = Pt(10)
        if lbl == "Naskah Lisan Presenter":
            r_v.font.color.rgb = RGBColor(15, 23, 42)
            p_v.paragraph_format.line_spacing = 1.2
        elif lbl == "Kalimat Transisi":
            r_v.font.italic = True
            r_v.font.color.rgb = RGBColor(40, 112, 148)
            
    doc.add_paragraph().paragraph_format.space_after = Pt(14)

add_divider()

# Section 3: Panduan Q&A
h3 = doc.add_heading(level=1)
r_h3 = h3.add_run("3. PANDUAN JAWABAN TANYA JAWAB (Q&A) KRITIS")
r_h3.font.color.rgb = RGBColor(2, 50, 70)
r_h3.font.size = Pt(16)

QA_LIST = [
    ("Mengapa sekolah memilih membangun platform sendiri daripada menggunakan aplikasi gratisan terpisah di internet?",
     "Sebagian besar aplikasi gratis di internet dirancang terpisah-pisah: aplikasi absensi sendiri, form rapat sendiri, dan ujian sendiri. Akibatnya guru harus memiliki banyak akun dan data sekolah tersimpan di server pihak ketiga yang berbeda. Melalui SAGA Terpadu, kami menyatukannya dalam satu rumah: data guru, notulen rapat, jadwal pengawas, dan peminatan siswa saling terhubung secara aman dan mandiri tanpa iklan komersial."),
    
    ("Bagaimana platform ini membantu peran wali kelas dan bimbingan konseling?",
     "Di SAGA Terpadu tersedia modul 'Ruang Wali Kelas'. Pada siswa kelas 9, wali kelas dapat mendata rencana kelanjutan studi siswa: apakah ingin melanjutkan ke SMA, SMK, Aliyah, atau Pesantren, lengkap dengan jurusan yang diminati dan konfirmasi persetujuan orang tua. Data ini langsung terangkum rapi untuk guru BP/BK dan Kepala Sekolah dalam memberikan pendampingan yang tepat sasaran."),
    
    ("Bagaimana keabsahan laporan yang dihasilkan oleh sistem ini?",
     "Seluruh keluaran dokumen dari SAGA Terpadu disesuaikan dengan tata naskah sekolah: mencantumkan kop surat resmi, Nomor Pokok Pegawai (NPP), titimangsa resmi, kolom pengesahan Kepala Sekolah, serta stempel pengaman berupa QR Code Autentikasi Dokumen digital. Format buku nilai yang dihasilkan pun berupa file Microsoft Excel resmi yang rumus perhitungannya persis dengan pedoman kurikulum sekolah."),
    
    ("Apakah ada biaya langganan bulanan yang memberatkan anggaran sekolah?",
     "Tidak ada biaya lisensi pihak ketiga yang memberatkan. Karena aplikasi ini dikembangkan secara mandiri menggunakan teknologi web modern dan penyimpanan basis data awan yang efisien, biaya operasionalnya sangat terjangkau bagi sekolah swasta. Inilah wujud nyata efektivitas pemanfaatan dukungan digitalisasi dan dana BOSP Kinerja: menghasilkan aset sistem mandiri yang berkelanjutan.")
]

for q, a in QA_LIST:
    p_q = doc.add_paragraph()
    p_q.paragraph_format.space_after = Pt(2)
    rq = p_q.add_run(f"❓ Pertanyaan: “{q}”")
    rq.font.bold = True
    rq.font.color.rgb = RGBColor(2, 50, 70)
    
    p_a = doc.add_paragraph()
    p_a.paragraph_format.space_after = Pt(10)
    ra = p_a.add_run(f"💡 Jawaban Rekomendasi:\n{a}")
    ra.font.size = Pt(10)
    ra.font.color.rgb = RGBColor(51, 65, 85)

add_divider()

# Section 4: Catatan Verifikasi Mandiri
h4 = doc.add_heading(level=1)
r_h4 = h4.add_run("4. CATATAN VERIFIKASI INTERNAL SEBELUM TAMPIL")
r_h4.font.color.rgb = RGBColor(2, 50, 70)
r_h4.font.size = Pt(16)

c_notes = [
    "Pastikan kop surat, nama kepala sekolah, dan NPP pada lembar laporan cetak telah sesuai dengan data yayasan/sekolah terkini.",
    "Saat sesi demonstrasi langsung di proyektor, gunakan data contoh (dummy) atau samarkan data kontak pribadi siswa demi kepatuhan privasi peserta didik.",
    "Siapkan file video intro_saga_terpadu.mp4 di desktop laptop cadangan jika proyektor membutuhkan pemutaran mandiri sebelum slide dimulai.",
    "Pastikan laptop presenter tersambung ke jaringan hotspot cadangan jika koneksi aula Bimtek mengalami kepadatan."
]

for cn in c_notes:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.add_run(f"☑️ {cn}")

doc.save(DOCX_PATH)
print(f"Word Document generated successfully: {DOCX_PATH} ({os.path.getsize(DOCX_PATH)} bytes)")

