import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export interface TeacherEducationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'QR' | 'BIOMETRIC' | 'POINTS';
}

type TabType = 'QR' | 'BIOMETRIC' | 'POINTS';

export const TeacherEducationModal: React.FC<TeacherEducationModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'QR',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📚 Panduan & Edukasi Presensi Guru"
    >
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 text-slate-700 text-xs sm:text-sm">
        {/* Intro Alert */}
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex items-start gap-2.5 shadow-2xs">
          <span className="text-xl shrink-0">💡</span>
          <div className="space-y-0.5">
            <h4 className="font-extrabold text-[#023246] text-xs sm:text-sm">
              Panduan Praktis Penggunaan Aplikasi
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Pelajari cara kerja presensi, rahasia agar tidak ditolak GPS, keamanan sidik jari HP, dan cara meraih poin penghargaan.
            </p>
          </div>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('QR')}
            className={`flex-1 py-2 px-2 text-center text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-10 ${
              activeTab === 'QR'
                ? 'bg-white text-[#023246] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📷</span>
            <span>Scan QR &amp; GPS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BIOMETRIC')}
            className={`flex-1 py-2 px-2 text-center text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-10 ${
              activeTab === 'BIOMETRIC'
                ? 'bg-white text-[#023246] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>👆</span>
            <span>Sidik Jari HP</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('POINTS')}
            className={`flex-1 py-2 px-2 text-center text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-10 ${
              activeTab === 'POINTS'
                ? 'bg-white text-[#023246] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🏆</span>
            <span>Poin &amp; Lencana</span>
          </button>
        </div>

        {/* ── TAB 1: SCAN QR & TIPS GPS ──────────────────────────────────────── */}
        {activeTab === 'QR' && (
          <div className="space-y-3.5">
            {/* Cara Kerja */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <h4 className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                <span>1.</span> Bagaimana Cara Kerjanya?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Guru cukup membuka kamera pemindai di aplikasi, lalu mengarahkan ke <strong>QR Code resmi</strong> yang ada di layar monitor sekolah atau poster pintu gerbang.
              </p>
            </div>

            {/* Mengapa Sering Ditolak / Maps Loncat */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-2">
              <h4 className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-1.5">
                <span>⚠️</span> Mengapa Kadang Ditolak atau Maps Loncat-loncat?
              </h4>
              <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                Sistem memeriksa dua hal: <strong>jarak Anda ke sekolah</strong> dan <strong>kekuatan sinyal GPS HP</strong>.
              </p>
              <ul className="list-disc list-inside text-xs text-amber-800/90 space-y-1 pl-1 font-medium">
                <li>Jika HP berada di bawah kanopi/gedung, HP sering membaca <strong>menara sinyal seluler (BTS)</strong> yang letaknya bisa 1 hingga 3 kilometer jauhnya.</li>
                <li>Jika akurasi GPS HP terlalu buram (&gt; 50 meter), sistem menolak secara otomatis demi mencegah kecurangan lokasi.</li>
              </ul>
            </div>

            {/* Trik Ampuh */}
            <div className="p-3.5 rounded-2xl bg-[#0D7A5F]/5 border border-[#0D7A5F]/20 space-y-2.5">
              <h4 className="font-black text-[#0D7A5F] text-xs sm:text-sm flex items-center gap-1.5">
                <span>✨</span> 4 Langkah Ampuh Agar Selalu Diterima:
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span className="text-sm">📶</span>
                    <span>1. Nyalakan Wi-Fi di HP (Trik Paling Ampuh!)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Cukup <strong>nyalakan tombol Wi-Fi di HP Anda</strong>. Anda <strong>tidak harus tersambung</strong> ke internet sekolah. Dengan Wi-Fi aktif, HP akan mendeteksi gelombang router di sekitar sehingga posisi GPS terkunci akurat dalam hitungan detik.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span className="text-sm">🎯</span>
                    <span>2. Aktifkan Fitur &quot;Lokasi Tepat&quot;</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    • <strong>Pengguna iPhone (Safari):</strong> Buka Pengaturan &gt; Privasi &amp; Keamanan &gt; Layanan Lokasi &gt; Situs Web Safari &gt; aktifkan <strong>Lokasi Tepat</strong>.<br />
                    • <strong>Pengguna Android (Chrome):</strong> Buka Pengaturan &gt; Lokasi &gt; aktifkan <strong>Akurasi Lokasi Google</strong>.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span className="text-sm">⏳</span>
                    <span>3. Buka Aplikasi 5 Detik Sebelum Scan</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Beri waktu sejenak bagi HP untuk &quot;pemanasan GPS&quot;. Perhatikan badge di layar; jika sudah muncul 🟢 <strong>GPS Siap</strong>, pemindaian dijamin langsung berhasil.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span className="text-sm">🚪</span>
                    <span>4. Gunakan Poster QR Pintu Gerbang</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Jika Anda terburu-buru atau sinyal di dalam ruangan sulit, pindai <strong>Poster QR resmi di pintu gerbang</strong> sekolah yang memiliki toleransi radius lebih luas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: SIDIK JARI HP (BIOMETRIK) ────────────────────────────────── */}
        {activeTab === 'BIOMETRIC' && (
          <div className="space-y-3.5">
            {/* Apa itu Presensi Sidik Jari */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <h4 className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                <span>1.</span> Apa itu Presensi Sidik Jari HP?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Fitur modern yang memungkinkan Anda melakukan absensi masuk atau pulang <strong>hanya dengan menyentuh sensor sidik jari atau Face ID di HP Anda sendiri</strong>. Anda tidak perlu lagi antre di depan layar monitor atau menyalakan kamera untuk memindai QR.
              </p>
            </div>

            {/* Keamanan & Privasi (Bahasa Awam) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 shadow-2xs space-y-2">
              <h4 className="font-black text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                <span>🔒</span> Apakah Data Sidik Jari Saya Aman?
              </h4>
              <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                <strong>100% SANGAT AMAN!</strong> Data sidik jari Anda <strong>TIDAK PERNAH dikirim ke internet, server sekolah, maupun database manapun</strong>.
              </p>
              <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                Sistem menggunakan teknologi standar keamanan perbankan (<em>WebAuthn Biometric Passkey</em>). Sensor HP Anda hanya mengirimkan sinyal &quot;Ya, ini pemilik HP yang sah&quot; ke sistem absensi tanpa membocorkan bentuk fisik sidik jari Anda.
              </p>
            </div>

            {/* Cara Menggunakan */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
              <h4 className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                <span>📝</span> 3 Langkah Mudah Menggunakannya:
              </h4>

              <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2 pl-1 font-medium leading-relaxed">
                <li>
                  <strong>Daftarkan Sekali Saja:</strong> Buka halaman Profil di HP ini, lalu klik tombol <em>&quot;Daftarkan Sidik Jari Sekarang&quot;</em> dan sentuh sensor HP Anda.
                </li>
                <li>
                  <strong>Pastikan Berada di Sekolah:</strong> Saat tiba di sekolah, buka aplikasi dan klik ikon tombol sidik jari.
                </li>
                <li>
                  <strong>Sentuh Sensor:</strong> Cukup tempelkan jari pada sensor HP Anda, dan presensi masuk atau pulang langsung tercatat seketika.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* ── TAB 3: CARA PENGUMPULAN POIN & LENCANA ────────────────────────── */}
        {activeTab === 'POINTS' && (
          <div className="space-y-3.5">
            {/* Pengenalan Poin */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <h4 className="font-black text-[#023246] text-xs sm:text-sm flex items-center gap-1.5">
                <span>1.</span> Apa itu Poin Disiplin Guru?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Poin Disiplin adalah sistem <strong>penghargaan dan apresiasi otomatis</strong> atas kedisiplinan dan dedikasi Bapak/Ibu Guru. Setiap aktivitas presensi yang tepat waktu dan tertib akan dihitung menjadi poin performa.
              </p>
            </div>

            {/* Sumber-Sumber Poin */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF7] border border-amber-200/90 shadow-2xs space-y-2.5">
              <h4 className="font-black text-amber-950 text-xs sm:text-sm flex items-center gap-1.5">
                <span>⭐</span> Dari Mana Saja Poin Dikumpulkan?
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span>⏰</span>
                    <span>Presensi Masuk Tepat Waktu (+Poin Harian)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Melakukan absensi masuk sebelum batas jam kerja sekolah memberikan poin kedisiplinan penuh setiap pagi.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span>🏃</span>
                    <span>Presensi Pulang Tertib (+Poin)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Menyelesaikan absensi kepulangan sesuai jam operasional memastikan catatan kehadiran Anda berstatus lengkap (hadir penuh).
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span>🔥</span>
                    <span>Tantangan Konsistensi (Streak Presensi)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Hadir tepat waktu beberapa hari berturut-turut akan membuka <strong>Lencana Disiplin</strong> (Perunggu, Perak, Emas, hingga Teladan Utama) dengan bonus poin spesial.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                  <div className="font-extrabold text-[#023246] flex items-center gap-1.5">
                    <span>📚</span>
                    <span>Ketuntasan Jurnal &amp; Administrasi Mengajar</span>
                  </div>
                  <p className="text-slate-600 text-[11px] sm:text-xs leading-relaxed font-medium">
                    Mengisi jurnal kelas harian dan aktivitas akademik secara rutin menambah rekam jejak keaktifan guru.
                  </p>
                </div>
              </div>
            </div>

            {/* Manfaat Poin */}
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs space-y-1.5">
              <h4 className="font-black text-indigo-950 text-xs sm:text-sm flex items-center gap-1.5">
                <span>🎖️</span> Untuk Apa Poin Tersebut?
              </h4>
              <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                Poin dan lencana ini dipantau langsung oleh <strong>Kepala Sekolah</strong> pada <em>Dashboard Apresiasi Guru</em> sebagai dasar pertimbangan resmi penerbitan <strong>Piagam Penghargaan Guru Teladan</strong> dan apresiasi berkala dari sekolah.
              </p>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="pt-2 text-center text-[11px] text-slate-500 font-semibold border-t border-slate-200">
          Sistem Smart Absensi Guru &copy; 2026 — Panduan Resmi Pendidik &amp; Tenaga Kependidikan
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200 flex justify-end">
        <Button
          variant="primary"
          onClick={onClose}
          className="w-full sm:w-auto font-bold text-xs min-h-11"
        >
          Saya Sudah Paham
        </Button>
      </div>
    </Modal>
  );
};
