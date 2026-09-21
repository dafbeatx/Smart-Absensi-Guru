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

          <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-xl text-left">
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
          {/* Card: Cara Kerja */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl p-2 bg-emerald-50 rounded-xl">📷</span>
                <h3 className="text-base font-bold text-slate-800 leading-snug">
                  Bagaimana Cara Kerja Presensi QR?
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed text-left">
                Bapak/Ibu Guru cukup membuka kamera pemindai di aplikasi, lalu mengarahkan ke <span className="font-semibold text-slate-800">QR Code resmi</span> yang ditampilkan di layar monitor sekolah atau poster QR di pintu gerbang.
              </p>
            </div>
          </div>

          {/* Card: Mengapa Sering Ditolak / Maps Loncat */}
          <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-200/80 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl p-2 bg-amber-100 rounded-xl">⚠️</span>
              <div>
                <h3 className="text-base font-bold text-amber-950 leading-snug">
                  Mengapa Kadang Ditolak atau Maps Terlihat Loncat-loncat?
                </h3>
                <p className="text-xs text-amber-800/80 font-medium pt-0.5">
                  Sistem memeriksa jarak fisik dan akurasi GPS sebelum menyetujui absensi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-800 mb-1">🏢 Di Bawah Kanopi / Gedung</h4>
                <p className="text-xs text-slate-600 leading-relaxed text-left">
                  HP sering beralih membaca sinyal menara BTS seluler yang letaknya <span className="font-semibold text-amber-800">1–3 km</span> dari sekolah saat satelit terhalang.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-800 mb-1">🎯 Akurasi Masih Buram</h4>
                <p className="text-xs text-slate-600 leading-relaxed text-left">
                  Bila perkiraan radius HP masih <span className="font-semibold text-amber-800">&gt; 50 meter</span>, sistem menolak sementara demi memastikan keabsahan lokasi Anda.
                </p>
              </div>
            </div>
          </div>

          {/* Grid 4 Langkah Ampuh (Sesuai Panduan Layout Rapi) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0D7A5F]" />
                <span>4 Langkah Ampuh Agar Presensi Selalu Diterima</span>
              </h3>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                Terbukti Efektif
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Item 1 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-blue-50 rounded-xl">📶</span>
                    <h3 className="text-base font-bold text-slate-800 leading-snug">
                      1. Nyalakan Wi-Fi di HP <span className="text-xs text-blue-600 font-normal block sm:inline">(Trik Paling Ampuh!)</span>
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Cukup aktifkan tombol Wi-Fi di HP. Anda <span className="font-semibold text-slate-800">tidak harus tersambung</span> ke internet sekolah. HP akan mendeteksi sinyal router di sekitar sehingga GPS langsung terkunci presisi <span className="font-semibold text-emerald-600">&lt; 15 meter</span> dalam 2 detik.
                  </p>
                </div>
              </div>

              {/* Card Item 2 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-emerald-50 rounded-xl">🎯</span>
                    <h3 className="text-base font-bold text-slate-800 leading-snug">
                      2. Aktifkan &quot;Lokasi Tepat&quot; <span className="text-xs text-emerald-700 font-normal block sm:inline">(Precise Location)</span>
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    • <strong>iPhone (Safari):</strong> Buka Pengaturan &gt; Privasi &amp; Keamanan &gt; Layanan Lokasi &gt; Situs Web Safari &gt; aktifkan <span className="font-semibold text-slate-800">Lokasi Tepat</span>.<br />
                    • <strong>Android (Chrome):</strong> Buka Pengaturan &gt; Lokasi &gt; aktifkan <span className="font-semibold text-slate-800">Akurasi Lokasi Google</span>.
                  </p>
                </div>
              </div>

              {/* Card Item 3 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-amber-50 rounded-xl">⏳</span>
                    <h3 className="text-base font-bold text-slate-800 leading-snug">
                      3. Buka Aplikasi 5 Detik Sebelum Scan <span className="text-xs text-amber-700 font-normal block sm:inline">(Kunci Satelit)</span>
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Beri waktu sejenak bagi HP untuk mengunci sinyal GPS. Saat indikator di sudut layar berubah <span className="font-semibold text-emerald-600">🟢 GPS Siap</span>, pemindaian QR dijamin langsung sukses.
                  </p>
                </div>
              </div>

              {/* Card Item 4 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-purple-50 rounded-xl">🚪</span>
                    <h3 className="text-base font-bold text-slate-800 leading-snug">
                      4. Gunakan Poster QR Gerbang <span className="text-xs text-purple-700 font-normal block sm:inline">(Solusi Cadangan)</span>
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Jika sedang buru-buru atau sinyal di dalam ruangan lemah, pindai <span className="font-semibold text-slate-800">Poster QR Pintu Gerbang</span> sekolah yang memiliki toleransi radius lebih luas (<span className="font-semibold text-emerald-600">500 meter</span>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SIDIK JARI HP (BIOMETRIK) ────────────────────────────────── */}
      {activeTab === 'BIOMETRIC' && (
        <div className="space-y-4">
          {/* Card: Apa itu Presensi Sidik Jari */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl p-2 bg-sky-50 rounded-xl">👆</span>
                <h3 className="text-base font-bold text-slate-800 leading-snug">
                  Apa itu Presensi Sidik Jari HP?
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed text-left">
                Fitur canggih yang memungkinkan Bapak/Ibu melakukan absensi masuk atau pulang <span className="font-semibold text-slate-800">hanya dengan menyentuh sensor sidik jari atau Face ID di HP masing-masing</span>. Anda tidak perlu antre di monitor atau membuka kamera sama sekali.
              </p>
            </div>
          </div>

          {/* Card: Jaminan Keamanan */}
          <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl p-2 bg-emerald-100 rounded-xl">🔒</span>
                <div>
                  <h3 className="text-base font-bold text-emerald-950 leading-snug">
                    Apakah Data Sidik Jari Saya Aman dari Kebocoran?
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium pt-0.5">
                    100% Sangat Aman &amp; Terlindungi Enkripsi Perbankan
                  </p>
                </div>
              </div>
              <p className="text-sm text-emerald-900/90 leading-relaxed text-left">
                Data sidik jari Anda <span className="font-semibold text-emerald-950">TIDAK PERNAH dikirim ke internet, server sekolah, maupun database manapun</span>. Sistem menggunakan protokol keamanan perbankan (<em>WebAuthn Passkey</em>). Chip sensor HP Anda hanya memberikan konfirmasi digital <em>&quot;Ya, ini pemilik HP yang sah&quot;</em> tanpa membagikan bentuk fisik sidik jari ke aplikasi.
              </p>
            </div>
          </div>

          {/* Card: 3 Langkah Praktis */}
          <div className="space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug px-1">
              3 Langkah Praktis Menggunakannya:
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-base font-black px-2.5 py-1 bg-sky-100 text-sky-800 rounded-xl">1</span>
                    <h4 className="text-sm font-bold text-slate-800 leading-snug">
                      Daftarkan Sekali di HP
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Buka menu <span className="font-semibold text-slate-800">Profil</span> di HP ini, lalu sentuh sensor fingerprint untuk pendaftaran awal.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-base font-black px-2.5 py-1 bg-sky-100 text-sky-800 rounded-xl">2</span>
                    <h4 className="text-sm font-bold text-slate-800 leading-snug">
                      Tiba di Area Sekolah
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Saat tiba di lingkungan sekolah, buka aplikasi Smart Absensi Guru di HP Anda.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-base font-black px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl">3</span>
                    <h4 className="text-sm font-bold text-slate-800 leading-snug">
                      Sentuh Sensor HP
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Cukup tempelkan jari pada sensor HP Anda, presensi langsung <span className="font-semibold text-emerald-700">sukses tercatat seketika</span>!
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Button for Biometric */}
            {onOpenBiometricEnroll && (
              <div className="pt-2 flex justify-center">
                <Button
                  onClick={onOpenBiometricEnroll}
                  variant="primary"
                  className="w-full sm:w-auto px-6 py-3 font-bold text-xs min-h-11 rounded-xl shadow-xs"
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
          {/* Card: Pengenalan Poin */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl p-2 bg-amber-50 rounded-xl">⭐</span>
                <h3 className="text-base font-bold text-slate-800 leading-snug">
                  Apa itu Poin Disiplin Guru?
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed text-left">
                Poin Disiplin adalah sistem <span className="font-semibold text-slate-800">penghargaan dan apresiasi otomatis</span> atas kedisiplinan dan dedikasi Bapak/Ibu Guru. Setiap aktivitas presensi yang tepat waktu dan tertib akan dihitung menjadi poin performa guru.
              </p>
            </div>
          </div>

          {/* Grid 4 Sumber Poin */}
          <div className="space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug px-1 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Dari Mana Saja Poin Dikumpulkan?</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-emerald-50 rounded-xl">⏰</span>
                    <h4 className="text-base font-bold text-slate-800 leading-snug">
                      Presensi Masuk Tepat Waktu <span className="text-xs text-emerald-600 font-normal block sm:inline">(+Poin Harian)</span>
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Melakukan absensi masuk sebelum batas toleransi jam kerja memberikan <span className="font-semibold text-slate-800">poin penuh</span> setiap hari kerja.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-blue-50 rounded-xl">🏃</span>
                    <h4 className="text-base font-bold text-slate-800 leading-snug">
                      Presensi Pulang Tertib <span className="text-xs text-blue-600 font-normal block sm:inline">(+Poin Kehadiran)</span>
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Melengkapi absensi pulang saat jam kerja berakhir memastikan status hadir penuh dan rekam jejak tertib.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-amber-50 rounded-xl">🔥</span>
                    <h4 className="text-base font-bold text-slate-800 leading-snug">
                      Tantangan Konsistensi <span className="text-xs text-amber-600 font-normal block sm:inline">(Streak Presensi)</span>
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Hadir tepat waktu berturut-turut membuka <span className="font-semibold text-slate-800">Lencana Disiplin</span> (Perunggu, Perak, Emas, hingga Teladan Utama) dengan bonus poin spesial.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl p-2 bg-purple-50 rounded-xl">📚</span>
                    <h4 className="text-base font-bold text-slate-800 leading-snug">
                      Ketuntasan Jurnal <span className="text-xs text-purple-600 font-normal block sm:inline">(Administrasi Mengajar)</span>
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed text-left">
                    Mengisi jurnal kelas harian dan kelengkapan administrasi mengajar memperkaya rekam jejak profesional guru.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Manfaat Poin */}
          <div className="bg-indigo-50/60 rounded-2xl p-5 border border-indigo-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl p-2 bg-indigo-100 rounded-xl">🎖️</span>
                <h3 className="text-base font-bold text-indigo-950 leading-snug">
                  Untuk Apa Poin Tersebut?
                </h3>
              </div>
              <p className="text-sm text-indigo-900/90 leading-relaxed text-left">
                Poin dan lencana ini dipantau langsung oleh <span className="font-semibold text-indigo-950">Kepala Sekolah</span> pada <em>Dashboard Apresiasi Guru</em> sebagai dasar pertimbangan resmi penerbitan <span className="font-semibold text-indigo-950">Piagam Penghargaan Guru Teladan</span> dan apresiasi berkala dari sekolah.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: KEAMANAN & PRIVASI GURU (CARA 1 RESMI) ──────────────────── */}
      {activeTab === 'SECURITY' && (
        <div className="space-y-4">
          {/* Banner Jaminan Privasi */}
          <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200/80 shadow-sm space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl p-2 bg-emerald-100 rounded-xl">🛡️</span>
              <div>
                <h3 className="text-base font-bold text-emerald-950 leading-snug">
                  Jaminan Privasi &amp; Keamanan Data Guru
                </h3>
                <p className="text-xs text-emerald-800 font-semibold pt-0.5">
                  100% Aman, Bebas Sadap, &amp; Tidak Melacak Aktivitas Pribadi
                </p>
              </div>
            </div>
            <p className="text-sm text-emerald-900/90 leading-relaxed text-left">
              Aplikasi <span className="font-semibold text-emerald-950">Smart Absensi Guru</span> dirancang dengan memprioritaskan rasa aman, kenyamanan, dan perlindungan privasi seluruh Dewan Guru dan Tenaga Kependidikan.
            </p>
          </div>

          {/* Grid 4 Pilar Keamanan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pilar 1: GPS */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl p-2 bg-blue-50 rounded-xl">🔒</span>
                  <h4 className="text-base font-bold text-slate-800 leading-snug">
                    1. Mengapa Aplikasi Meminta Izin Lokasi (GPS)?
                  </h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed text-left space-y-1.5">
                  • GPS <span className="font-semibold text-slate-800">hanya aktif selama 2–3 detik saat menekan tombol absen</span> untuk memastikan Anda berada di lingkungan sekolah.<br />
                  • Sistem <span className="font-semibold text-slate-800">tidak pernah melacak perjalanan, rumah, atau aktivitas di luar sekolah</span>. Begitu proses absen selesai, GPS langsung nonaktif otomatis.
                </p>
              </div>
            </div>

            {/* Pilar 2: Kamera */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl p-2 bg-purple-50 rounded-xl">📷</span>
                  <h4 className="text-base font-bold text-slate-800 leading-snug">
                    2. Mengapa Aplikasi Meminta Izin Kamera?
                  </h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed text-left space-y-1.5">
                  • Kamera <span className="font-semibold text-slate-800">hanya digunakan sebagai pemindai kode QR</span> (sama seperti kasir memindai barcode belanjaan di minimarket).<br />
                  • Kamera <span className="font-semibold text-slate-800">otomatis tertutup seketika</span> setelah kode QR berhasil dibaca.
                </p>
              </div>
            </div>

            {/* Pilar 3: Sidik Jari */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl p-2 bg-emerald-50 rounded-xl">👆</span>
                  <h4 className="text-base font-bold text-slate-800 leading-snug">
                    3. Apakah Sidik Jari (Fingerprint) Aman?
                  </h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed text-left space-y-1.5">
                  • <span className="font-semibold text-emerald-700">100% Sangat Aman.</span> Menggunakan teknologi enkripsi standar perbankan (<em>WebAuthn Passkey</em>).<br />
                  • Sidik jari Anda <span className="font-semibold text-slate-800">tidak pernah dikirim ke internet, server sekolah, maupun database</span>. Sensor HP hanya memberi sinyal validasi digital.
                </p>
              </div>
            </div>

            {/* Pilar 4: Web PWA */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl p-2 bg-sky-50 rounded-xl">📱</span>
                  <h4 className="text-base font-bold text-slate-800 leading-snug">
                    4. Kenapa Memakai Web/PWA (Bukan Play Store)?
                  </h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed text-left space-y-1.5">
                  • Berbasis PWA resmi sekolah agar <span className="font-semibold text-slate-800">sangat ringan (hanya beberapa MB), hemat memori HP, dan hemat kuota</span>.<br />
                  • Dijamin <span className="font-semibold text-slate-800">100% bebas dari iklan komersial, malware, atau virus</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Bagian Salin Pesan untuk Grup WA Guru */}
          <div className="bg-sky-50/60 rounded-2xl p-5 border border-sky-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <h4 className="font-bold text-sky-950 text-sm sm:text-base leading-snug">
                  Pesan Resmi untuk Grup WhatsApp Guru
                </h4>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 shrink-0">
                Siap Dibagikan
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed text-left">
              Anda dapat menyalin atau langsung membagikan teks pengumuman resmi ini ke grup WhatsApp Dewan Guru agar seluruh guru paham dan merasa tenang:
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopyText}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-11 ${
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
                className="py-3 px-5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs active:scale-98 cursor-pointer min-h-11 shrink-0"
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
