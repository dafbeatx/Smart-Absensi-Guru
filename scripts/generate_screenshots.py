import os
import subprocess
import time

SCREENSHOTS_DIR = os.path.abspath("screenshots")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Common CSS & Header template
COMMON_HEAD = """
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>SAGA Terpadu Capture</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f1f5f9;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    padding: 16px;
    height: 720px;
    width: 1280px;
    overflow: hidden;
  }
  .app-frame {
    background: #ffffff;
    border-radius: 20px;
    height: 688px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.07);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .navbar {
    background: #023246;
    color: #ffffff;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #287094;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo {
    width: 36px;
    height: 36px;
    background: #ffffff;
    border-radius: 8px;
    padding: 2px;
  }
  .brand-text h1 {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .brand-text p {
    font-size: 11px;
    color: #94a3b8;
  }
  .user-badge {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge-role {
    background: #10b981;
    color: #ffffff;
    font-weight: 700;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 9999px;
  }
  .content-area {
    padding: 20px 28px;
    flex: 1;
    overflow-y: auto;
    background: #f8fafc;
  }
  .card {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    padding: 20px;
  }
  .page-title {
    font-size: 18px;
    font-weight: 800;
    color: #023246;
    margin-bottom: 4px;
  }
  .page-subtitle {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 16px;
  }
  .btn-primary {
    background: #023246;
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }
  .btn-emerald {
    background: #10b981;
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    background: #f1f5f9;
    color: #334155;
    text-align: left;
    padding: 10px 12px;
    font-weight: 700;
    border-bottom: 1px solid #e2e8f0;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  .tag {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
  }
  .tag-green { background: #dcfce7; color: #15803d; }
  .tag-blue { background: #e0f2fe; color: #0369a1; }
  .tag-yellow { background: #fef9c3; color: #854d0e; }
</style>
</head>
"""

TEMPLATES = {
    "screen_01_leave_permit.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah</p>
        </div>
      </div>
      <div class="user-badge">
        <span>👨‍🏫 M. Iqbal Gustiawan, S.Pd</span>
        <span class="badge-role">GURU MAPEL</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">📝 Layanan Pengajuan Izin & Ketidakhadiran</h2>
          <p class="page-subtitle">Formulir digital pengajuan Izin, Cuti, Sakit, dan Dinas Luar resmi</p>
        </div>
        <button class="btn-emerald">+ Buat Pengajuan Baru</button>
      </div>

      <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <div class="card">
          <h3 style="font-size:14px; font-weight:700; color:#023246; margin-bottom:12px;">Riwayat Pengajuan Izin Saya</h3>
          <table>
            <thead>
              <tr>
                <th>Tanggal Pengajuan</th>
                <th>Jenis Izin</th>
                <th>Keterangan / Alasan</th>
                <th>Lampiran Surat</th>
                <th>Status Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>28 Okt 2026</td>
                <td><span class="tag tag-blue">DINAS LUAR</span></td>
                <td>Bimtek Pemanfaatan Digitalisasi BOSP Kinerja</td>
                <td>📄 Surat_Tugas_Dinas.pdf</td>
                <td><span class="tag tag-green">✅ DISETUJUI</span></td>
              </tr>
              <tr>
                <td>14 Okt 2026</td>
                <td><span class="tag tag-yellow">SAKIT</span></td>
                <td>Demam dan flu (Istirahat Dokter)</td>
                <td>📄 Surat_Keterangan_Dokter.pdf</td>
                <td><span class="tag tag-green">✅ DISETUJUI</span></td>
              </tr>
              <tr>
                <td>02 Sep 2026</td>
                <td><span class="tag tag-blue">IZIN RESMI</span></td>
                <td>Keperluan pengurusan berkas sertifikasi pendidik</td>
                <td>📄 Lampiran_Pengantar.pdf</td>
                <td><span class="tag tag-green">✅ DISETUJUI</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="background:#f8fafc; border:2px dashed #cbd5e1;">
          <h3 style="font-size:13px; font-weight:700; color:#023246; margin-bottom:8px;">📌 Pratinjau Surat Tugas Terlampir</h3>
          <div style="background:#ffffff; padding:16px; border-radius:10px; border:1px solid #e2e8f0; font-size:11px; text-align:center;">
            <p style="font-weight:700; color:#023246;">SURAT TUGAS DINAS</p>
            <p style="color:#64748b;">Nomor: 421.3/088/SMP-IT/X/2026</p>
            <hr style="margin:8px 0; border:none; border-top:1px solid #f1f5f9;">
            <p style="text-align:left; color:#334155; line-height:1.6;">Menugaskan: <strong>M. Iqbal Gustiawan, S.Pd</strong><br>Tugas: Mengikuti Bimtek Penguatan Digitalisasi Sekolah<br>Tempat: Aula Ki Hajar Dewantara</p>
            <div style="margin-top:12px; display:inline-block; padding:4px 10px; background:#e0f2fe; color:#0369a1; border-radius:6px; font-weight:700; font-size:10px;">
              Telah Diverifikasi Kepala Sekolah
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
""",

    "screen_02_exam_proctor_swap.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah — Administrasi Akademik</p>
        </div>
      </div>
      <div class="user-badge">
        <span>📋 Panitia Ujian Sekolah</span>
        <span class="badge-role">OPERATOR</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">📅 Jadwal Pengawas &amp; Pertukaran Tugas (Proctor Swap)</h2>
          <p class="page-subtitle">Asesmen Sumatif Akhir Semester (ASAS) TA 2026/2027</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary">🖨️ Cetak Berita Acara</button>
          <button class="btn-emerald">🔄 Ajukan Tukar Pengawas</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <table style="width:100%;">
          <thead>
            <tr>
              <th>Hari / Tanggal</th>
              <th>Sesi &amp; Waktu</th>
              <th>Mata Pelajaran</th>
              <th>Ruang Ujian</th>
              <th>Guru Pengawas Utama</th>
              <th>Status Jadwal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Senin, 02 Nov 2026</td>
              <td>Sesi 1 (07.30 - 09.30)</td>
              <td>Bahasa Indonesia</td>
              <td>Ruang 01 (Kelas 7A)</td>
              <td>Farhan Sopian Sahid, S.Pd.I</td>
              <td><span class="tag tag-green">SIAP MENGAWAS</span></td>
            </tr>
            <tr style="background:#fefce8;">
              <td>Senin, 02 Nov 2026</td>
              <td>Sesi 1 (07.30 - 09.30)</td>
              <td>Bahasa Indonesia</td>
              <td>Ruang 02 (Kelas 8A)</td>
              <td><strong>M. Iqbal Gustiawan, S.Pd</strong> <span style="font-size:10px; color:#854d0e;">(Tukar dari Nurul Fahriya)</span></td>
              <td><span class="tag tag-yellow">PROCTOR SWAP DISETUJUI</span></td>
            </tr>
            <tr>
              <td>Senin, 02 Nov 2026</td>
              <td>Sesi 2 (10.00 - 11.30)</td>
              <td>PAI &amp; Budi Pekerti</td>
              <td>Ruang 03 (Kelas 9A)</td>
              <td>Adi Prasetyo, S.Pd., G.r</td>
              <td><span class="tag tag-green">SIAP MENGAWAS</span></td>
            </tr>
            <tr>
              <td>Selasa, 03 Nov 2026</td>
              <td>Sesi 1 (07.30 - 09.30)</td>
              <td>Matematika</td>
              <td>Ruang 01 (Kelas 7A)</td>
              <td>Fitri Ani Rahayu, S.Mat</td>
              <td><span class="tag tag-green">SIAP MENGAWAS</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="background:#e0f2fe; padding:12px 18px; border-radius:12px; border-left:4px solid #0284c7; font-size:12px; color:#0369a1;">
        💡 <strong>Catatan Pengawas:</strong> Pertukaran jadwal pengawas telah terverifikasi secara sistem tanpa mengubah susunan berita acara induk.
      </div>
    </div>
  </div>
</body>
</html>
""",

    "screen_03_exam_card_grading.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah — Administrasi Akademik</p>
        </div>
      </div>
      <div class="user-badge">
        <span>👨‍🏫 Wali Kelas &amp; Panitia</span>
        <span class="badge-role">AKADEMIK</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">🎓 Kartu Peserta Ujian &amp; Format Nilai Semester Excel</h2>
          <p class="page-subtitle">Penerbitan kartu identitas berbarcode dan template buku nilai ASTS/ASAS</p>
        </div>
        <button class="btn-emerald">📥 Unduh Format Nilai Excel (6 Kelas)</button>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap: 20px;">
        <!-- Kartu Peserta Ujian Preview -->
        <div class="card" style="border:2px solid #023246;">
          <div style="text-align:center; border-bottom:2px solid #023246; padding-bottom:8px; margin-bottom:12px;">
            <p style="font-size:11px; font-weight:800; color:#023246;">KARTU PESERTA ASESMEN SUMATIF</p>
            <p style="font-size:10px; color:#64748b;">SMP TERPADU AL-ITTIHADIYAH — TA 2026/2027</p>
          </div>
          <div style="display:flex; gap:14px; align-items:center;">
            <div style="width:70px; height:85px; background:#e2e8f0; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:24px;">
              👤
            </div>
            <div style="font-size:11px; line-height:1.7; color:#1e293b;">
              <p><strong>Nama:</strong> AMANDA HASNA MIRZA</p>
              <p><strong>NIS / NISN:</strong> 242507001 / 0098765432</p>
              <p><strong>Kelas / Ruang:</strong> 9A / Ruang 01</p>
              <p><strong>Nomor Peserta:</strong> 09-026-001-8</p>
            </div>
          </div>
          <div style="margin-top:14px; padding-top:10px; border-top:1px dashed #cbd5e1; text-align:center;">
            <div style="background:#f1f5f9; padding:6px; font-family:monospace; letter-spacing:4px; font-size:13px; font-weight:bold;">
              ||| | |||| || ||| |||| |
            </div>
            <span style="font-size:9px; color:#64748b;">Barcode Verifikasi Identitas Peserta Ujian</span>
          </div>
        </div>

        <!-- Format Penilaian Preview -->
        <div class="card">
          <h3 style="font-size:13px; font-weight:700; color:#023246; margin-bottom:10px;">📊 Buku Nilai Semester (Formula Terkunci)</h3>
          <p style="font-size:11px; color:#64748b; margin-bottom:12px;">Format Microsoft Excel multi-sheet otomatis (Sheet: 7A, 7B, 8A, 8B, 9A, 9B, SMA):</p>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Siswa</th>
                <th>ASTS</th>
                <th>ASAS</th>
                <th>Nilai Rapor</th>
                <th>Predikat</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>AMANDA HASNA MIRZA</td>
                <td style="color:#0369a1; font-weight:700;">88</td>
                <td style="color:#0369a1; font-weight:700;">92</td>
                <td style="background:#f0fdf4; font-weight:700;">90.0</td>
                <td><span class="tag tag-green">A (Sangat Baik)</span></td>
              </tr>
              <tr>
                <td>2</td>
                <td>BUDI SANTOSO</td>
                <td style="color:#0369a1; font-weight:700;">82</td>
                <td style="color:#0369a1; font-weight:700;">86</td>
                <td style="background:#f0fdf4; font-weight:700;">84.0</td>
                <td><span class="tag tag-green">B (Baik)</span></td>
              </tr>
              <tr>
                <td>3</td>
                <td>SITI RAHMAWATI</td>
                <td style="color:#0369a1; font-weight:700;">90</td>
                <td style="color:#0369a1; font-weight:700;">94</td>
                <td style="background:#f0fdf4; font-weight:700;">92.0</td>
                <td><span class="tag tag-green">A (Sangat Baik)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
""",

    "screen_04_meeting_minutes.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah — Tata Kelola Sekolah</p>
        </div>
      </div>
      <div class="user-badge">
        <span>📝 Sekretaris Rapat</span>
        <span class="badge-role">DEWAN GURU</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">📋 Notulen Rapat Digital &amp; Penugasan (Action Items)</h2>
          <p class="page-subtitle">Dokumentasi hasil musyawarah dewan guru, keputusan, dan batas waktu tindak lanjut</p>
        </div>
        <button class="btn-primary">+ Catat Rapat Baru</button>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:12px;">
          <div>
            <h3 style="font-size:14px; font-weight:700; color:#023246;">Rapat Persiapan Asesmen Semester Ganjil &amp; Evaluasi BOSP Kinerja</h3>
            <p style="font-size:11px; color:#64748b;">Tanggal: 28 Oktober 2026 • Pimpinan Rapat: Farhan Sopian Sahid, S.Pd.I (Kepsek) • Hadir: 24 Guru</p>
          </div>
          <span class="tag tag-green">STATUS: SELESAI &amp; TERARSIP</span>
        </div>

        <p style="font-size:12px; color:#334155; margin-bottom:14px; line-height:1.6;">
          <strong>Ringkasan Keputusan Musyawarah:</strong><br>
          1. Pelaksanaan ASAS Semester Ganjil ditetapkan mulai tanggal 02 November 2026 secara tertib berbasis ruang.<br>
          2. Setiap wali kelas wajib menyelesaikan verifikasi peminatan kelanjutan studi siswa kelas 9 sebelum pekan evaluasi.
        </p>

        <h4 style="font-size:12px; font-weight:700; color:#023246; margin-bottom:8px;">📌 Pembagian Tanggung Jawab &amp; Tindak Lanjut (PIC):</h4>
        <table>
          <thead>
            <tr>
              <th>Uraian Tugas Tindak Lanjut</th>
              <th>Penanggung Jawab (PIC)</th>
              <th>Batas Waktu (Deadline)</th>
              <th>Status Pengerjaan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pencetakan Kartu Ujian Berbarcode Siswa</td>
              <td>M. Iqbal Gustiawan, S.Pd</td>
              <td>30 Okt 2026</td>
              <td><span class="tag tag-green">✅ SELESAI</span></td>
            </tr>
            <tr>
              <td>Distribusi Jadwal Pengawas &amp; Berita Acara</td>
              <td>Nurul Fahriya, S.Pd (Kurikulum)</td>
              <td>31 Okt 2026</td>
              <td><span class="tag tag-green">✅ SELESAI</span></td>
            </tr>
            <tr>
              <td>Rekapitulasi Verifikasi Peminatan Wali Kelas 9</td>
              <td>Mawar Andinia, S.Pd (BK)</td>
              <td>01 Nov 2026</td>
              <td><span class="tag tag-blue">⏳ SEDANG BERJALAN</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
""",

    "screen_05_homeroom_plan.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah — Ruang Wali Kelas</p>
        </div>
      </div>
      <div class="user-badge">
        <span>🎓 Mawar Andinia, S.Pd (BK / Wali Kelas)</span>
        <span class="badge-role">WALI KELAS 9A</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">🏫 Ruang Wali Kelas: Pemetaan Kelanjutan Studi Siswa</h2>
          <p class="page-subtitle">Pendataan peminatan studi lanjut siswa kelas akhir (Kelas 9A) TA 2026/2027</p>
        </div>
        <div style="background:#e0f2fe; color:#0369a1; padding:6px 14px; border-radius:8px; font-weight:700; font-size:12px;">
          Tingkat Verifikasi: 85% Disetujui Orang Tua
        </div>
      </div>

      <div class="card">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Lengkap Siswa</th>
              <th>Rencana Jenjang</th>
              <th>Pilihan Sekolah Tujuan</th>
              <th>Peminatan / Jurusan</th>
              <th>Persetujuan Orang Tua</th>
              <th>Aksi Bimbingan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td><strong>AMANDA HASNA MIRZA</strong></td>
              <td><span class="tag tag-blue">SMA NEGERI</span></td>
              <td>SMAN 1 Cibinong</td>
              <td>MIPA / Sains</td>
              <td><span class="tag tag-green">✅ SETUJU (DIVERIFIKASI)</span></td>
              <td><button class="btn-primary" style="padding:4px 8px; font-size:10px;">Detail</button></td>
            </tr>
            <tr>
              <td>2</td>
              <td><strong>BUDI SANTOSO</strong></td>
              <td><span class="tag tag-blue">SMK TEKNIK</span></td>
              <td>SMK Negeri 1 Bogor</td>
              <td>Teknik Jaringan Komputer</td>
              <td><span class="tag tag-green">✅ SETUJU (DIVERIFIKASI)</span></td>
              <td><button class="btn-primary" style="padding:4px 8px; font-size:10px;">Detail</button></td>
            </tr>
            <tr>
              <td>3</td>
              <td><strong>MUHAMMAD FARHAN</strong></td>
              <td><span class="tag tag-green">PONDOK PESANTREN</span></td>
              <td>SMA Terpadu As Salaam</td>
              <td>Agama &amp; Bahasa Arab</td>
              <td><span class="tag tag-green">✅ SETUJU (DIVERIFIKASI)</span></td>
              <td><button class="btn-primary" style="padding:4px 8px; font-size:10px;">Detail</button></td>
            </tr>
            <tr>
              <td>4</td>
              <td><strong>SITI RAHMAWATI</strong></td>
              <td><span class="tag tag-yellow">MASIH KONSULTASI</span></td>
              <td>MAN 2 Bogor / SMAN 2</td>
              <td>Sosial / Humaniora</td>
              <td><span class="tag tag-yellow">⏳ MENUNGGU KONFIRMASI</span></td>
              <td><button class="btn-primary" style="padding:4px 8px; font-size:10px;">Bimbingan</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
""",

    "screen_06_sarpras_calendar.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah — Fasilitas &amp; Kalender</p>
        </div>
      </div>
      <div class="user-badge">
        <span>🏛️ Pengelola Sarpras &amp; TU</span>
        <span class="badge-role">OPERATOR</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">🏛️ Inventaris Sarpras &amp; Kalender Agenda Sekolah</h2>
          <p class="page-subtitle">Katalog fasilitas sarana belajar, status kondisi barang, dan kalender kegiatan sekolah</p>
        </div>
        <button class="btn-emerald">+ Lapor / Tambah Aset</button>
      </div>

      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
        <div class="card">
          <h3 style="font-size:13px; font-weight:700; color:#023246; margin-bottom:10px;">Katalog Sarana Prasarana Belajar</h3>
          <table>
            <thead>
              <tr>
                <th>Lokasi Ruang</th>
                <th>Nama Fasilitas / Aset</th>
                <th>Jumlah</th>
                <th>Status Kondisi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Lab Komputer</td>
                <td>PC Desktop Client All-in-One</td>
                <td>32 Unit</td>
                <td><span class="tag tag-green">BAIK &amp; SIAP PAKAI</span></td>
              </tr>
              <tr>
                <td>Ruang Kelas 7A</td>
                <td>Proyektor LCD Epson</td>
                <td>1 Unit</td>
                <td><span class="tag tag-green">BAIK</span></td>
              </tr>
              <tr>
                <td>Ruang Kelas 8B</td>
                <td>Speaker Audio Dinding</td>
                <td>1 Unit</td>
                <td><span class="tag tag-yellow">PERLU PERBAIKAN</span></td>
              </tr>
              <tr>
                <td>Ruang Guru</td>
                <td>Printer &amp; Scanner Laserjet</td>
                <td>2 Unit</td>
                <td><span class="tag tag-green">BAIK</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3 style="font-size:13px; font-weight:700; color:#023246; margin-bottom:10px;">📅 Kalender Agenda Akademik Sekolah</h3>
          <div style="font-size:12px; line-height:1.7;">
            <div style="padding:8px 12px; background:#f1f5f9; border-radius:8px; margin-bottom:8px;">
              <span style="font-weight:700; color:#023246;">02 - 07 Nov 2026:</span><br>
              Asesmen Sumatif Akhir Semester (ASAS) Ganjil
            </div>
            <div style="padding:8px 12px; background:#f0fdf4; border-radius:8px; margin-bottom:8px;">
              <span style="font-weight:700; color:#15803d;">16 - 20 Nov 2026:</span><br>
              Pekan Penginputan &amp; Pengolahan Nilai Rapor
            </div>
            <div style="padding:8px 12px; background:#fefce8; border-radius:8px;">
              <span style="font-weight:700; color:#854d0e;">18 Des 2026:</span><br>
              Pembagian Laporan Hasil Belajar (Rapor) &amp; Pertemuan Wali Murid
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
""",

    "screen_07_dashboard_report.html": f"""
{COMMON_HEAD}
<body>
  <div class="app-frame">
    <div class="navbar">
      <div class="brand">
        <div class="brand-text">
          <h1>SAGA TERPADU</h1>
          <p>SMP Terpadu Al-Ittihadiyah — Pimpinan Sekolah</p>
        </div>
      </div>
      <div class="user-badge">
        <span>👔 Farhan Sopian Sahid, S.Pd.I</span>
        <span class="badge-role" style="background:#0284c7;">KEPALA SEKOLAH</span>
      </div>
    </div>
    <div class="content-area">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 class="page-title">📊 Dashboard Pimpinan &amp; Rangkuman Laporan Sekolah</h2>
          <p class="page-subtitle">Ikhtisar harian kedisiplinan pendidik, perizinan, dan laporan rekapitulasi sekolah</p>
        </div>
        <button class="btn-emerald">📥 Unduh Rekap Laporan PDF Berstempel</button>
      </div>

      <!-- Stat Cards -->
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:14px; margin-bottom:16px;">
        <div class="card" style="padding:14px; text-align:center;">
          <p style="font-size:11px; color:#64748b;">Total Tenaga Pendidik</p>
          <p style="font-size:24px; font-weight:800; color:#023246;">28</p>
          <span style="font-size:10px; color:#10b981;">● 100% Terdaftar Aktif</span>
        </div>
        <div class="card" style="padding:14px; text-align:center;">
          <p style="font-size:11px; color:#64748b;">Hadir Hari Ini</p>
          <p style="font-size:24px; font-weight:800; color:#15803d;">26</p>
          <span style="font-size:10px; color:#15803d;">Tepat Waktu di Sekolah</span>
        </div>
        <div class="card" style="padding:14px; text-align:center;">
          <p style="font-size:11px; color:#64748b;">Tugas Dinas Luar</p>
          <p style="font-size:24px; font-weight:800; color:#0369a1;">2</p>
          <span style="font-size:10px; color:#0369a1;">Bimtek Digitalisasi</span>
        </div>
        <div class="card" style="padding:14px; text-align:center;">
          <p style="font-size:11px; color:#64748b;">Tanpa Keterangan</p>
          <p style="font-size:24px; font-weight:800; color:#64748b;">0</p>
          <span style="font-size:10px; color:#10b981;">Nihil (Tertib Terdata)</span>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size:13px; font-weight:700; color:#023246; margin-bottom:10px;">Daftar Konfirmasi Kehadiran &amp; Disposisi Hari Ini</h3>
        <table>
          <thead>
            <tr>
              <th>Nama Pendidik</th>
              <th>Jabatan / Tugas</th>
              <th>Status Hari Ini</th>
              <th>Jam Masuk</th>
              <th>Keterangan Sistem</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nurul Fahriya, S.Pd., G.r</td>
              <td>Wakasek Kurikulum</td>
              <td><span class="tag tag-green">HADIR</span></td>
              <td>06.42 WIB</td>
              <td>Area Sekolah Tervalidasi</td>
            </tr>
            <tr>
              <td>M. Iqbal Gustiawan, S.Pd</td>
              <td>Wakasek Sarpras</td>
              <td><span class="tag tag-blue">DINAS LUAR</span></td>
              <td>-</td>
              <td>Surat Tugas Bimtek BOSP Kinerja Disetujui</td>
            </tr>
            <tr>
              <td>Adi Prasetyo, S.Pd., G.r</td>
              <td>Guru Bahasa Inggris</td>
              <td><span class="tag tag-green">HADIR</span></td>
              <td>06.48 WIB</td>
              <td>Area Sekolah Tervalidasi</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
"""
}

# Write HTML templates and capture using Chrome headless
for filename, html_content in TEMPLATES.items():
    html_path = os.path.join(SCREENSHOTS_DIR, filename)
    png_path = os.path.join(SCREENSHOTS_DIR, filename.replace(".html", ".png"))
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size=1280,720",
        f"--screenshot={png_path}",
        html_path
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"Captured: {png_path} ({os.path.getsize(png_path)} bytes)")
    except Exception as e:
        print(f"Error capturing {filename}: {e}")

print("All screenshots generated successfully!")

