import os
import subprocess

SCREENSHOTS_DIR = os.path.abspath("screenshots")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FFMPEG_PATH = r"C:\ffmpeg\bin\ffmpeg.exe"
OUTPUT_VIDEO = os.path.abspath("intro_saga_terpadu.mp4")

# Create 4 presentation teaser frames
FRAMES = [
    ("frame_1.html", """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; width:1920px; height:1080px; background:linear-gradient(135deg, #023246 0%, #18536B 60%, #287094 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:'Segoe UI', Arial, sans-serif; text-align:center; }
  .badge { background:rgba(16, 185, 129, 0.2); border:2px solid #10b981; color:#a7f3d0; padding:10px 28px; border-radius:9999px; font-size:22px; font-weight:800; text-transform:uppercase; letter-spacing:2px; margin-bottom:28px; }
  h1 { font-size:88px; font-weight:900; letter-spacing:4px; margin:0 0 16px 0; text-shadow:0 8px 30px rgba(0,0,0,0.3); }
  h2 { font-size:36px; font-weight:600; color:#e0f2fe; margin:0 0 40px 0; max-width:1400px; line-height:1.4; }
  .school { font-size:32px; font-weight:800; color:#38bdf8; border-top:2px solid rgba(255,255,255,0.2); padding-top:28px; width:800px; }
</style>
</head>
<body>
  <div class="badge">Inovasi Digital Sekolah Mandiri</div>
  <h1>SAGA TERPADU</h1>
  <h2>Platform Administrasi dan Pengelolaan Sekolah Berbasis Digital</h2>
  <div class="school">SMP Terpadu Al-Ittihadiyah</div>
</body>
</html>
"""),
    ("frame_2.html", """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; width:1920px; height:1080px; background:#023246; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:'Segoe UI', Arial, sans-serif; text-align:center; }
  h1 { font-size:52px; font-weight:800; color:#38bdf8; margin-bottom:12px; }
  p { font-size:24px; color:#cbd5e1; margin-bottom:50px; }
  .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:30px; width:1500px; }
  .card { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:24px; padding:36px 28px; text-align:center; }
  .card-icon { font-size:54px; margin-bottom:14px; }
  .card-title { font-size:28px; font-weight:800; color:#ffffff; margin-bottom:8px; }
  .card-desc { font-size:18px; color:#94a3b8; line-height:1.5; }
</style>
</head>
<body>
  <h1>EKOSISTEM LAYANAN TERPADU</h1>
  <p>Menyatukan tata kelola harian seluruh warga sekolah dalam satu pintu</p>
  <div class="grid">
    <div class="card">
      <div class="card-icon">👨‍🏫</div>
      <div class="card-title">Manajemen Guru & SDM</div>
      <div class="card-desc">Presensi adil, izin online tanpa kertas, dan rekapitulasi kehadiran otomatis.</div>
    </div>
    <div class="card">
      <div class="card-icon">📅</div>
      <div class="card-title">Administrasi Akademik</div>
      <div class="card-desc">Jadwal pengawas, tukar jaga (Proctor Swap), kartu ujian barcode, & format nilai.</div>
    </div>
    <div class="card">
      <div class="card-icon">🎓</div>
      <div class="card-title">Ruang Wali Kelas</div>
      <div class="card-desc">Pendataan peminatan studi lanjut siswa kelas akhir & verifikasi orang tua.</div>
    </div>
  </div>
</body>
</html>
"""),
    ("frame_3.html", """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; width:1920px; height:1080px; background:#023246; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:'Segoe UI', Arial, sans-serif; text-align:center; }
  h1 { font-size:52px; font-weight:800; color:#38bdf8; margin-bottom:12px; }
  p { font-size:24px; color:#cbd5e1; margin-bottom:50px; }
  .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:40px; width:1300px; }
  .card { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:24px; padding:40px 32px; text-align:left; display:flex; gap:24px; align-items:center; }
  .card-icon { font-size:64px; }
  .card-title { font-size:28px; font-weight:800; color:#ffffff; margin-bottom:6px; }
  .card-desc { font-size:18px; color:#94a3b8; line-height:1.5; }
</style>
</head>
<body>
  <h1>TATA KELOLA MODERN & TRANSPARAN</h1>
  <p>Mendukung akuntabilitas dan efisiensi pengelolaan satuan pendidikan</p>
  <div class="grid">
    <div class="card">
      <div class="card-icon">📋</div>
      <div>
        <div class="card-title">Notulen Rapat Digital & PIC</div>
        <div class="card-desc">Keputusan musyawarah terdata rapi dengan penanggung jawab dan tenggat waktu terpantau.</div>
      </div>
    </div>
    <div class="card">
      <div class="card-icon">🏛️</div>
      <div>
        <div class="card-title">Inventaris Sarpras & Kalender</div>
        <div class="card-desc">Pencatatan fasilitas belajar sekolah dan sinkronisasi agenda akademik sekolah harian.</div>
      </div>
    </div>
  </div>
</body>
</html>
"""),
    ("frame_4.html", """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; width:1920px; height:1080px; background:linear-gradient(135deg, #023246 0%, #18536B 60%, #287094 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:'Segoe UI', Arial, sans-serif; text-align:center; }
  .quote { font-size:38px; font-weight:600; font-style:italic; max-width:1400px; line-height:1.6; color:#e0f2fe; margin-bottom:48px; }
  .school-logo-text { font-size:42px; font-weight:900; letter-spacing:2px; color:#ffffff; }
  .subtitle { font-size:24px; color:#38bdf8; font-weight:700; margin-top:8px; }
</style>
</head>
<body>
  <div class="quote">"Teknologi terbaik adalah yang mempermudah langkah para pendidik agar fokus mencurahkan ketulusan terbaiknya bagi anak didik."</div>
  <div class="school-logo-text">SMP TERPADU AL-ITTIHADIYAH</div>
  <div class="subtitle">Bimtek Penguatan Digitalisasi & Pemanfaatan BOSP Kinerja Terbaik</div>
</body>
</html>
""")
]

# Generate 1080p frames with Chrome
img_paths = []
for filename, html in FRAMES:
    html_path = os.path.join(SCREENSHOTS_DIR, filename)
    png_path = os.path.join(SCREENSHOTS_DIR, filename.replace(".html", ".png"))
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1920,1080",
        f"--screenshot={png_path}",
        html_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    img_paths.append(png_path)
    print(f"Generated video frame: {png_path}")

# Build video with FFmpeg: 4 frames x 4 seconds = 16 seconds total with smooth crossfades
concat_file = os.path.join(SCREENSHOTS_DIR, "concat_video.txt")
with open(concat_file, "w", encoding="utf-8") as f:
    for img in img_paths:
        escaped = img.replace("\\", "/")
        f.write(f"file '{escaped}'\n")
        f.write("duration 4\n")
    # Last file must be written twice for concat demuxer
    f.write(f"file '{img_paths[-1].replace(chr(92), '/')}'\n")

cmd_ffmpeg = [
    FFMPEG_PATH,
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat_file,
    "-pix_fmt", "yuv420p",
    "-c:v", "libx264",
    OUTPUT_VIDEO
]
print("Running FFmpeg render...")
subprocess.run(cmd_ffmpeg, check=True)
print(f"Video generated successfully: {OUTPUT_VIDEO} ({os.path.getsize(OUTPUT_VIDEO)} bytes)")
