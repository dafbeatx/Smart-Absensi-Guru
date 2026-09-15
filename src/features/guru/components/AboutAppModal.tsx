import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { APP_VERSION_CONFIG } from '../../../config/version.config';

export interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ℹ️ Tentang Smart Absensi Guru"
      maxWidth="md"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-slate-700 text-sm max-w-[480px] mx-auto">
        {/* Hero Card: Developer Spotlight */}
        <div className="bg-gradient-to-br from-[#023246] via-[#1E5670] to-[#287094] text-white p-4 sm:p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10 pointer-events-none">
            <span className="text-8xl font-black">SAGA</span>
          </div>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Inovasi Mandiri • 100% Zero Budget
            </div>

            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                👨‍🏫
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug">
                  Dafa Maulana, S.Pd
                </h3>
                <p className="text-xs text-sky-200 font-semibold">
                  Guru Informatika &amp; Pengembang Aplikasi
                </p>
                <span className="inline-block mt-1 text-[11px] text-slate-200/90 font-medium">
                  Dedikasi untuk Kemajuan Digitalisasi Sekolah
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Story Section: Perjalanan & Latar Belakang */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#023246]">
            <span className="text-lg">🌱</span>
            <h4 className="font-extrabold text-sm sm:text-base">Kisah di Balik Aplikasi</h4>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            Aplikasi <strong>Smart Absensi Guru</strong> bermula dari penugasan resmi sekolah kepada <strong>Dafa Maulana, S.Pd</strong> selaku Guru Informatika untuk merancang sistem presensi guru mandiri yang andal dan transparan.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold shrink-0">1.</span>
              <span><strong>Fase Barcode:</strong> Pada mulanya, sistem dirancang sederhana menggunakan pemindaian Barcode &amp; QR Code statis pada kartu presensi.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold shrink-0">2.</span>
              <span><strong>Evolusi Biometrik Sidik Jari:</strong> Demi keamanan data dan mencegah kecurangan atau titip absen, sistem beradaptasi dengan menambahkan sensor <strong>Sidik Jari HP (WebAuthn Biometric)</strong> langsung dari perangkat masing-masing guru.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold shrink-0">3.</span>
              <span><strong>Ekosistem Lengkap:</strong> Dikembangkan lebih jauh mencakup Radius Geofence GPS presisi, Bel Alarm Cerdas KBM, Lencana Apresiasi &amp; Poin Disiplin, Rekapitulasi Nilai &amp; Ujian, hingga Ruang Wali Kelas.</span>
            </div>
          </div>
        </div>

        {/* AI Collaboration Card */}
        <div className="p-4 rounded-2xl bg-[#0D7A5F]/5 border border-[#0D7A5F]/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#0D7A5F]">
              <span className="text-lg">🤖</span>
              <h4 className="font-extrabold text-sm sm:text-base">Kolaborasi AI Agent Google</h4>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#0D7A5F]/15 text-[#0D7A5F] border border-[#0D7A5F]/30">
              Gemini &amp; Antigravity
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Seluruh arsitektur, optimasi kode, dan logika keamanan aplikasi ini dibangun berkat kolaborasi intensif bersama <strong>AI Agent dari Gemini / Antigravity by Google</strong>.
          </p>
          <div className="p-3 bg-white rounded-xl border border-[#0D7A5F]/20 space-y-1.5 text-xs text-slate-700">
            <div className="font-bold flex items-center gap-1 text-[#023246]">
              <span>💡</span> Pengalaman 1 Tahun Menggunakan AI Agent
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px] sm:text-xs">
              Berbekal pengalaman selama <strong>1 tahun</strong> membangun solusi web secara kolaboratif bersama AI Agent, pengembang membuktikan bahwa integrasi keahlian pendidik lokal dengan kecerdasan buatan Google mampu melahirkan perangkat lunak berstandar profesional tinggi.
            </p>
          </div>
        </div>

        {/* Zero Budget / Gratis Commitment */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
          <div className="flex items-center gap-2 text-amber-900">
            <span className="text-lg">🎁</span>
            <h4 className="font-extrabold text-sm sm:text-base">100% Gratis Tanpa Anggaran (Zero Budget)</h4>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Aplikasi ini dibangun secara murni tanpa menggunakan dana bantuan operasional sekolah (BOS), anggaran yayasan, ataupun biaya dari pihak manapun. Memanfaatkan ekosistem teknologi terbuka dan infrastruktur cloud modern secara optimal demi kemaslahatan seluruh rekan guru di sekolah.
          </p>
        </div>

        {/* Tech Stack Info */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">
            Spesifikasi Arsitektur Sistem
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <div className="bg-white p-2 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Frontend Platform</span>
              <span className="font-bold text-slate-800">React 19 • TypeScript • Vite PWA</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Database &amp; Cloud</span>
              <span className="font-bold text-slate-800">Supabase Dual Toren (Failover)</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Keamanan &amp; Autentikasi</span>
              <span className="font-bold text-slate-800">WebAuthn Biometric &amp; Device Lock</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200/70">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">AI Engineering Assistant</span>
              <span className="font-bold text-slate-800">Google Gemini &amp; Antigravity</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 text-center font-mono">
            Build ID: {APP_VERSION_CONFIG.BUILD_ID}
          </div>
        </div>

        {/* Close Button */}
        <div className="pt-2 border-t border-slate-200 flex justify-end">
          <Button
            variant="primary"
            onClick={onClose}
            className="w-full font-bold text-xs sm:text-sm h-11 sm:h-12 rounded-xl flex items-center justify-center gap-2 bg-[#023246] hover:bg-[#1E5670] text-white"
          >
            Tutup Informasi
          </Button>
        </div>
      </div>
    </Modal>
  );
};
