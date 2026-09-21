import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles, Smartphone, QrCode, Award, Share2, Copy } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface TeacherEducationViewProps {
  onBack?: () => void;
  backLabel?: string;
  defaultTab?: 'QR' | 'BIOMETRIC' | 'POINTS' | 'SECURITY';
  onOpenBiometricEnroll?: () => void;
  isBioEnrolled?: boolean;
  className?: string;
}

type TabType = 'QR' | 'BIOMETRIC' | 'POINTS' | 'SECURITY';

export const TeacherEducationView: React.FC<TeacherEducationViewProps> = ({
  onBack,
  backLabel = 'Kembali ke Profil',
  defaultTab = 'QR',
  onOpenBiometricEnroll,
  isBioEnrolled = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const WA_EDUCATION_TEXT = `📢 *INFORMASI RESMI & EDUKASI KEAMANAN APLIKASI SMART ABSENSI GURU*
━━━━━━━━━━━━━━━━━━━━━━━━━
Yth. Bapak/Ibu Dewan Guru & Tenaga Kependidikan,

Sehubungan dengan penerapan sistem presensi digital sekolah, kami ingin menyampaikan bahwa aplikasi *Smart Absensi Guru* dirancang dengan standar privasi dan perlindungan data tingkat tinggi:

🔒 *1. Mengapa Aplikasi Meminta Izin Lokasi (GPS)?*
• GPS *HANYA aktif selama 2–3 detik saat Bapak/Ibu menekan tombol absen* untuk memastikan posisi berada di lingkungan sekolah.
• Sistem *TIDAK PERNAH melacak perjalanan, rumah, atau aktivitas di luar sekolah*. Begitu selesai absen, pelacakan GPS otomatis mati seketika.

📷 *2. Mengapa Aplikasi Meminta Izin Kamera?*
• Kamera *HANYA digunakan sebagai pemindai kode QR* (seperti kasir memindai barcode belanjaan) dan langsung otomatis tertutup setelah kode terbaca.

👆 *3. Apakah Sidik Jari (Fingerprint) Aman?*
• *100% Sangat Aman.* Sistem menggunakan teknologi enkripsi standar perbankan (WebAuthn).
• Sidik jari *TIDAK PERNAH dikirim ke internet atau server sekolah*, melainkan hanya diverifikasi di dalam chip keamanan HP masing-masing.

📱 *4. Kenapa Memakai Web/PWA (Bukan Download di Play Store)?*
• Berbasis PWA resmi sekolah agar *sangat ringan (hanya beberapa MB), hemat memori HP, bebas iklan, dan bebas virus/malware*.

💡 *Bapak/Ibu juga dapat membaca panduan lengkapnya langsung di aplikasi pada menu Profil > Pusat Edukasi & Panduan Presensi.*

Terima kasih atas kerja sama dan dedikasi Bapak/Ibu dalam memajukan digitalisasi sekolah kita. 🙏✨`;

  const handleCopyText = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(WA_EDUCATION_TEXT);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = WA_EDUCATION_TEXT;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(WA_EDUCATION_TEXT);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <section className={`space-y-4 pb-12 animate-fadeIn ${className}`}>
      {/* ── TOP BAR NAVIGATION ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-black text-[#023246] transition-all cursor-pointer min-h-11"
          >
            <ArrowLeft className="w-4 h-4 text-[#023246]" />
            <span>{backLabel}</span>
          </button>
        ) : (
          <div />
        )}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Panduan Resmi Guru</span>
        </div>
      </div>

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="bg-linear-to-br from-[#023246] via-[#18536B] to-[#0D7A5F] text-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 pointer-events-none select-none">
          <span className="text-8xl sm:text-9xl font-black">EDUKASI</span>
        </div>

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-bold text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Pusat Edukasi, Bantuan &amp; Privasi Presensi</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
            Panduan Presensi &amp; Solusi Kendala Guru
          </h2>

          <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-xl">
            Solusi praktis mengatasi GPS loncat, cara presensi instan dengan sidik jari HP, transparansi keamanan data, serta cara meraih poin apresiasi kedisiplinan.
          </p>
        </div>
      </div>

      {/* ── TAB SELECTOR ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('QR')}
          className={`py-2.5 px-2 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
            activeTab === 'QR'
              ? 'bg-white text-[#023246] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-[#0D7A5F]" />
          <span>Scan &amp; GPS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BIOMETRIC')}
          className={`py-2.5 px-2 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
            activeTab === 'BIOMETRIC'
              ? 'bg-white text-[#023246] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-4 h-4 text-sky-600" />
          <span>Sidik Jari HP</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('POINTS')}
          className={`py-2.5 px-2 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
            activeTab === 'POINTS'
              ? 'bg-white text-[#023246] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Poin Disiplin</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SECURITY')}
          className={`py-2.5 px-2 text-center text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 ${
            activeTab === 'SECURITY'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 font-black'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Privasi &amp; Aman</span>
        </button>
      </div>

      {/* ── TAB 1: SCAN QR & TIPS GPS ──────────────────────────────────────── */}
      {activeTab === 'QR' && (
        <div className="space-y-4">
          {/* Cara Kerja */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <h4 className="font-black text-[#023246] text-sm sm:text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#023246] text-white flex items-center justify-center text-xs">1</span>
              Bagaimana Cara Kerja Presensi QR?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Bapak/Ibu Guru cukup membuka kamera pemindai di aplikasi, lalu mengarahkan ke <strong>QR Code resmi</strong> yang ditampilkan di layar monitor sekolah atau poster QR di gerbang sekolah.
            </p>
          </div>

          {/* Mengapa Sering Ditolak / Maps Loncat */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-2.5">
            <h4 className="font-black text-amber-900 text-sm sm:text-base flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              Mengapa Kadang Ditolak atau Maps Terlihat Loncat-loncat?
            </h4>
            <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed font-medium">
              Sistem memeriksa dua hal sebelum menerima presensi: <strong>jarak fisik Anda ke titik sekolah</strong> dan <strong>tingkat akurasi GPS HP Anda</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
                🏢 <strong>Di Bawah Kanopi / Gedung:</strong> HP membaca sinyal menara BTS operator seluler yang jaraknya bisa 1–3 km dari sekolah jika sinyal satelit terhalang.
              </div>
              <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
                🎯 <strong>Akurasi Masih Buram:</strong> Bila akurasi GPS masih &gt; 50 meter, sistem menolak sementara demi memastikan keabsahan lokasi Anda.
              </div>
            </div>
          </div>

          {/* 4 Langkah Ampuh */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#0D7A5F]/5 border border-[#0D7A5F]/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-[#0D7A5F] text-sm sm:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0D7A5F]" />
                4 Langkah Ampuh Agar Presensi Selalu Diterima:
              </h4>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Terbukti Efektif
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Langkah 1 */}
              <div className="p-3.5 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="text-base">📶</span>
                  <span>1. Nyalakan Wi-Fi di HP (Trik Paling Ampuh!)</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Cukup <strong>aktifkan tombol Wi-Fi di HP</strong>. Anda <strong>tidak harus tersambung</strong> ke internet sekolah. HP akan mendeteksi sinyal router di sekitar sehingga GPS langsung terkunci presisi &lt; 15 meter dalam 2 detik.
                </p>
              </div>

              {/* Langkah 2 */}
              <div className="p-3.5 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="text-base">🎯</span>
                  <span>2. Aktifkan &quot;Lokasi Tepat&quot;</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  • <strong>iPhone (Safari):</strong> Buka Pengaturan &gt; Privasi &amp; Keamanan &gt; Layanan Lokasi &gt; Situs Web Safari &gt; aktifkan <strong>Lokasi Tepat</strong>.<br />
                  • <strong>Android (Chrome):</strong> Buka Pengaturan &gt; Lokasi &gt; aktifkan <strong>Akurasi Lokasi Google</strong>.
                </p>
              </div>

              {/* Langkah 3 */}
              <div className="p-3.5 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="text-base">⏳</span>
                  <span>3. Buka Aplikasi 5 Detik Sebelum Scan</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Beri waktu sejenak bagi HP untuk mengunci satelit. Saat indikator di sudut layar berubah 🟢 <strong>GPS Siap</strong>, pemindaian QR dijamin langsung sukses.
                </p>
              </div>

              {/* Langkah 4 */}
              <div className="p-3.5 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1.5">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="text-base">🚪</span>
                  <span>4. Gunakan Poster QR Pintu Gerbang</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Jika sedang buru-buru atau sinyal seluler di ruang guru lemah, pindai <strong>Poster QR Pintu Gerbang</strong> yang memiliki toleransi radius lebih luas (500 meter).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SIDIK JARI HP (BIOMETRIK) ────────────────────────────────── */}
      {activeTab === 'BIOMETRIC' && (
        <div className="space-y-4">
          {/* Penjelasan */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <h4 className="font-black text-[#023246] text-sm sm:text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#023246] text-white flex items-center justify-center text-xs">1</span>
              Apa itu Presensi Sidik Jari HP?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Fitur canggih yang memungkinkan Bapak/Ibu melakukan absensi masuk atau pulang <strong>hanya dengan menyentuh sensor sidik jari atau Face ID di HP masing-masing</strong>. Anda tidak perlu antre di monitor atau membuka kamera sama sekali.
            </p>
          </div>

          {/* Jaminan Keamanan */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-emerald-50 border border-emerald-200/90 shadow-2xs space-y-2.5">
            <h4 className="font-black text-emerald-950 text-sm sm:text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              Apakah Data Sidik Jari Saya Aman dari Kebocoran?
            </h4>
            <p className="text-xs sm:text-sm text-emerald-900 font-bold leading-relaxed">
              100% SANGAT AMAN! Data sidik jari Anda TIDAK PERNAH dikirim ke internet, server sekolah, maupun database manapun.
            </p>
            <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
              Sistem menggunakan protokol keamanan perbankan (<em>WebAuthn Passkey</em>). Chip sensor HP Anda hanya memberikan konfirmasi digital <em>&quot;Ya, ini pemilik HP yang sah&quot;</em> tanpa membagikan bentuk fisik sidik jari ke aplikasi.
            </p>
          </div>

          {/* 3 Langkah Pakai */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-black text-[#023246] text-sm sm:text-base flex items-center gap-2">
              <span className="text-xl">📝</span>
              3 Langkah Praktis Menggunakannya:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="w-7 h-7 rounded-xl bg-sky-100 text-sky-800 font-black text-xs flex items-center justify-center">1</span>
                <h5 className="font-black text-[#023246] text-xs">Daftarkan Sekali di HP</h5>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Buka menu Profil di HP ini, lalu sentuh sensor fingerprint untuk pendaftaran awal.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="w-7 h-7 rounded-xl bg-sky-100 text-sky-800 font-black text-xs flex items-center justify-center">2</span>
                <h5 className="font-black text-[#023246] text-xs">Tiba di Sekolah</h5>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Saat tiba di area sekolah, buka aplikasi Smart Absensi Guru di HP Anda.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">3</span>
                <h5 className="font-black text-[#023246] text-xs">Sentuh Sensor HP</h5>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Cukup tempelkan jari pada sensor HP Anda, presensi langsung sukses tercatat!
                </p>
              </div>
            </div>

            {/* Quick Action Button for Biometric */}
            {onOpenBiometricEnroll && (
              <div className="pt-2 flex justify-center">
                <Button
                  onClick={onOpenBiometricEnroll}
                  variant="primary"
                  className="w-full sm:w-auto px-6 py-3 font-black text-xs min-h-11 rounded-xl shadow-xs"
                >
                  <Smartphone className="w-4 h-4 mr-1.5" />
                  {isBioEnrolled ? 'Uji Coba Sidik Jari Sekarang' : 'Daftarkan Sidik Jari di HP Ini Sekarang'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: CARA PENGUMPULAN POIN & LENCANA ────────────────────────── */}
      {activeTab === 'POINTS' && (
        <div className="space-y-4">
          {/* Pengenalan Poin */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <h4 className="font-black text-[#023246] text-sm sm:text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#023246] text-white flex items-center justify-center text-xs">1</span>
              Apa itu Poin Disiplin Guru?
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Poin Disiplin adalah sistem <strong>penghargaan dan apresiasi otomatis</strong> atas kedisiplinan dan dedikasi Bapak/Ibu Guru. Setiap aktivitas presensi yang tepat waktu dan tertib akan dihitung menjadi poin performa guru.
            </p>
          </div>

          {/* Sumber Poin */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFFDF7] border border-amber-200/90 shadow-2xs space-y-3">
            <h4 className="font-black text-amber-950 text-sm sm:text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Dari Mana Saja Poin Dikumpulkan?
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-white rounded-2xl border border-amber-200/70 shadow-2xs space-y-1">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span>⏰</span>
                  <span>Presensi Masuk Tepat Waktu (+Poin Harian)</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Melakukan absensi masuk sebelum batas toleransi jam kerja memberikan poin penuh setiap hari kerja.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-amber-200/70 shadow-2xs space-y-1">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span>🏃</span>
                  <span>Presensi Pulang Tertib (+Poin)</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Melengkapi absensi pulang saat jam kerja berakhir memastikan status hadir penuh dan rekam jejak tertib.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-amber-200/70 shadow-2xs space-y-1">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span>🔥</span>
                  <span>Tantangan Konsistensi (Streak)</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Hadir tepat waktu berturut-turut membuka <strong>Lencana Disiplin</strong> (Perunggu, Perak, Emas, hingga Teladan Utama) dengan bonus poin spesial.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-amber-200/70 shadow-2xs space-y-1">
                <div className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                  <span>📚</span>
                  <span>Ketuntasan Jurnal &amp; Administrasi</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Mengisi jurnal kelas harian dan kelengkapan administrasi mengajar memperkaya rekam jejak profesional guru.
                </p>
              </div>
            </div>
          </div>

          {/* Manfaat Poin */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-indigo-50 border border-indigo-200/80 shadow-2xs space-y-2">
            <h4 className="font-black text-indigo-950 text-sm sm:text-base flex items-center gap-2">
              <span className="text-xl">🎖️</span>
              Untuk Apa Poin Tersebut?
            </h4>
            <p className="text-xs sm:text-sm text-indigo-900 leading-relaxed font-medium">
              Poin dan lencana ini dipantau langsung oleh <strong>Kepala Sekolah</strong> pada <em>Dashboard Apresiasi Guru</em> sebagai dasar pertimbangan resmi penerbitan <strong>Piagam Penghargaan Guru Teladan</strong> dan apresiasi berkala dari sekolah.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB 4: KEAMANAN & PRIVASI GURU (CARA 1 RESMI) ──────────────────── */}
      {activeTab === 'SECURITY' && (
        <div className="space-y-4">
          {/* Banner Jaminan Privasi */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-emerald-50 border border-emerald-300 shadow-2xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">🛡️</span>
              <div>
                <h4 className="font-black text-emerald-950 text-sm sm:text-base">
                  Jaminan Privasi &amp; Keamanan Data Guru
                </h4>
                <p className="text-xs text-emerald-800 font-bold">
                  100% Aman, Bebas Sadap, &amp; Tidak Melacak Aktivitas Pribadi
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-emerald-900/90 leading-relaxed font-medium">
              Aplikasi <strong>Smart Absensi Guru</strong> dirancang dengan memprioritaskan rasa aman, kenyamanan, dan perlindungan privasi seluruh Dewan Guru dan Tenaga Kependidikan.
            </p>
          </div>

          {/* 4 Pilar Keamanan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Pilar 1: GPS */}
            <div className="p-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔒</span>
                <h5 className="font-black text-[#023246] text-xs sm:text-sm">
                  1. Mengapa Aplikasi Meminta Izin Lokasi (GPS)?
                </h5>
              </div>
              <ul className="list-disc list-inside text-xs text-slate-600 space-y-1.5 pl-1 font-medium leading-relaxed">
                <li>GPS <strong>HANYA aktif selama 2–3 detik saat Anda menekan tombol absen</strong> untuk memastikan Anda berada di lingkungan sekolah.</li>
                <li>Sistem <strong>TIDAK PERNAH melacak perjalanan, rumah, atau aktivitas Anda di luar jam sekolah</strong>. Begitu proses absen selesai, pelacakan GPS otomatis mati seketika.</li>
              </ul>
            </div>

            {/* Pilar 2: Kamera */}
            <div className="p-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📷</span>
                <h5 className="font-black text-[#023246] text-xs sm:text-sm">
                  2. Mengapa Aplikasi Meminta Izin Kamera?
                </h5>
              </div>
              <ul className="list-disc list-inside text-xs text-slate-600 space-y-1.5 pl-1 font-medium leading-relaxed">
                <li>Kamera <strong>HANYA digunakan sebagai pemindai kode QR</strong> (sama persis seperti alat kasir memindai barcode belanjaan di minimarket).</li>
                <li>Kamera <strong>otomatis tertutup seketika</strong> setelah kode QR berhasil dibaca oleh aplikasi.</li>
              </ul>
            </div>

            {/* Pilar 3: Sidik Jari */}
            <div className="p-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">👆</span>
                <h5 className="font-black text-[#023246] text-xs sm:text-sm">
                  3. Apakah Sidik Jari (Fingerprint) Aman?
                </h5>
              </div>
              <ul className="list-disc list-inside text-xs text-slate-600 space-y-1.5 pl-1 font-medium leading-relaxed">
                <li><strong>100% Sangat Aman.</strong> Menggunakan teknologi enkripsi standar keamanan perbankan (<em>WebAuthn Passkey</em>).</li>
                <li>Sidik jari Anda <strong>TIDAK PERNAH dikirim ke internet, server sekolah, maupun database manapun</strong>. Sensor HP hanya memberi sinyal <em>&quot;Ya, ini pemilik HP yang sah&quot;</em>.</li>
              </ul>
            </div>

            {/* Pilar 4: Web PWA */}
            <div className="p-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <h5 className="font-black text-[#023246] text-xs sm:text-sm">
                  4. Kenapa Memakai Web/PWA (Bukan Play Store)?
                </h5>
              </div>
              <ul className="list-disc list-inside text-xs text-slate-600 space-y-1.5 pl-1 font-medium leading-relaxed">
                <li>Aplikasi berbasis PWA resmi sekolah agar <strong>sangat ringan (hanya beberapa MB), hemat memori HP, dan tidak menguras kuota</strong>.</li>
                <li>Dijamin <strong>100% bebas dari iklan komersial, malware, atau virus</strong>.</li>
              </ul>
            </div>
          </div>

          {/* Bagian Salin Pesan untuk Grup WA Guru */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-sky-50/80 border border-sky-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <h5 className="font-black text-sky-950 text-xs sm:text-sm">
                  Pesan Resmi untuk Grup WhatsApp Guru
                </h5>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 shrink-0">
                Siap Dibagikan
              </span>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Anda dapat menyalin atau langsung membagikan teks pengumuman resmi ini ke grup WhatsApp Dewan Guru agar seluruh guru paham dan merasa tenang:
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopyText}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-11 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#023246] hover:bg-[#0D7A5F] text-white active:scale-98'
                }`}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Teks Edukasi Berhasil Disalin!' : 'Salin Teks untuk Grup WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-3 px-5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs active:scale-98 cursor-pointer min-h-11 shrink-0"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan ke WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM RETURN BUTTON (Mobile Friendly Thumb Reach) ──────────── */}
      {onBack && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-black text-slate-700 transition-all cursor-pointer min-h-11 border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>{backLabel}</span>
          </button>
        </div>
      )}
    </section>
  );
};
