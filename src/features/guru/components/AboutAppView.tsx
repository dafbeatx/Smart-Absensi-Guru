import React from 'react';
import { ArrowLeft, Sparkles, Cpu, ShieldCheck, HeartHandshake } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { APP_VERSION_CONFIG } from '../../../config/version.config';

export interface AboutAppViewProps {
  onBack?: () => void;
  backLabel?: string;
  role?: 'GURU' | 'ADMIN' | 'KEPSEK';
  className?: string;
}

export const AboutAppView: React.FC<AboutAppViewProps> = ({
  onBack,
  backLabel = 'Kembali ke Beranda',
  role = 'GURU',
  className = '',
}) => {
  return (
    <section className={`space-y-3.5 pb-8 animate-fadeIn ${className}`}>
      {/* ── TOP NAVIGATION BAR ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-[#023246] transition-all cursor-pointer min-h-11"
          >
            <ArrowLeft className="w-4 h-4 text-[#023246]" />
            <span>{backLabel}</span>
          </button>
        ) : (
          <div />
        )}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#023246]/10 text-[#023246] text-[11px] font-extrabold uppercase tracking-wider">
          <span>ℹ️</span>
          <span>Tentang Aplikasi &amp; Pengembang</span>
        </div>
      </div>

      {/* ── HERO BANNER: DEVELOPER SPOTLIGHT ─────────────────────────────── */}
      <div className="bg-linear-to-br from-[#023246] via-[#18536B] to-[#287094] text-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 pointer-events-none select-none">
          <span className="text-8xl sm:text-9xl font-black">SAGA</span>
        </div>

        <div className="relative z-10 space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Inovasi Mandiri Pendidik • 100% Zero Budget
          </div>

          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              👨‍🏫
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                Dafa Maulana, S.Pd
              </h2>
              <p className="text-xs sm:text-sm text-sky-200 font-semibold mt-0.5">
                Guru Informatika &amp; Pengembang Smart Absensi Guru (SAGA)
              </p>
              <span className="inline-block mt-1 text-[11px] sm:text-xs text-slate-200/90 font-medium">
                Dedikasi untuk Kemajuan Digitalisasi, Transparansi, &amp; Kemandirian Sekolah
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STORY SECTION: KISAH PERJALANAN ──────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-[#023246]">
          <span className="text-xl">🌱</span>
          <h3 className="font-extrabold text-base sm:text-lg">Kisah di Balik Aplikasi</h3>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
          Aplikasi <strong>Smart Absensi Guru</strong> lahir dari penugasan resmi sekolah kepada{' '}
          <strong>Dafa Maulana, S.Pd</strong> selaku Guru Informatika untuk merancang sistem presensi mandiri
          yang modern, akurat, dan transparan tanpa membebani keuangan sekolah.
        </p>

        <div className="space-y-2.5 pt-1">
          <div className="p-3 sm:p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
              1
            </div>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Fase Barcode Fisik:</strong> Pada tahap awal, sistem dirancang sederhana menggunakan pemindaian Barcode &amp; QR Code statis pada kartu ID presensi fisik guru.
            </div>
          </div>

          <div className="p-3 sm:p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
              2
            </div>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Evolusi Biometrik Sidik Jari HP:</strong> Untuk menegakkan integritas dan mencegah kecurangan titip absen, sistem berevolusi mengintegrasikan sensor <strong>Sidik Jari HP (WebAuthn Native Biometric)</strong> langsung dari browser perangkat masing-masing guru.
            </div>
          </div>

          <div className="p-3 sm:p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
              3
            </div>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Ekosistem Digital Lengkap:</strong> Berkembang menjadi platform terintegrasi yang mencakup Radius Geofence GPS presisi, Bel Alarm Cerdas KBM, Lencana Apresiasi &amp; Poin Disiplin, Rekapitulasi Nilai &amp; Ujian, hingga Ruang Wali Kelas Rencana Lanjutan Siswa.
            </div>
          </div>
        </div>
      </div>

      {/* ── AI COLLABORATION CARD ────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#0D7A5F]/5 border border-[#0D7A5F]/20 shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[#0D7A5F]">
            <Sparkles className="w-5 h-5 text-[#0D7A5F]" />
            <h3 className="font-extrabold text-base sm:text-lg">Kolaborasi AI Agent Google</h3>
          </div>
          <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[#0D7A5F]/15 text-[#0D7A5F] border border-[#0D7A5F]/30 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            Gemini &amp; Antigravity
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Seluruh arsitektur, optimasi kode, failover database, dan logika keamanan aplikasi ini dibangun berkat kolaborasi intensif bersama <strong>AI Agent dari Google Gemini &amp; Antigravity</strong>.
        </p>

        <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-[#0D7A5F]/20 space-y-2 text-xs sm:text-sm text-slate-700">
          <div className="font-bold flex items-center gap-2 text-[#023246]">
            <span>💡</span>
            <span>Pengalaman 1 Tahun Bersama AI Agent</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-xs sm:text-[13px]">
            Berbekal pengalaman selama <strong>1 tahun</strong> membangun solusi web secara kolaboratif bersama AI Agent, pengembang membuktikan bahwa integrasi keahlian pendidik lokal dengan kecerdasan buatan Google mampu melahirkan perangkat lunak berstandar profesional tinggi, aman, dan efisien.
          </p>
        </div>
      </div>

      {/* ── ZERO BUDGET COMMITMENT ───────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-50/70 border border-amber-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2 text-amber-900">
          <HeartHandshake className="w-5 h-5 text-amber-700" />
          <h3 className="font-extrabold text-base sm:text-lg">100% Gratis Tanpa Anggaran (Zero Budget)</h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          Aplikasi ini dibangun secara murni tanpa menggunakan dana bantuan operasional sekolah (BOS), anggaran yayasan, ataupun pungutan biaya dari pihak manapun. Memanfaatkan ekosistem teknologi terbuka dan infrastruktur cloud modern secara optimal demi kemaslahatan seluruh rekan guru di sekolah.
        </p>
      </div>

      {/* ── TECHNICAL ARCHITECTURE SPECIFICATIONS ────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50/90 border border-slate-200/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs sm:text-sm uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#023246]" />
            <span>Spesifikasi Arsitektur Sistem</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            PWA RC1
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Frontend Platform</span>
            <span className="font-extrabold text-[#023246] block text-xs sm:text-sm">React 19 • TypeScript • Vite PWA</span>
            <span className="text-[11px] text-slate-500 block">Offline Dexie.js &amp; Service Worker Cache</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Database &amp; Cloud</span>
            <span className="font-extrabold text-[#023246] block text-xs sm:text-sm">Supabase Dual Toren (Failover)</span>
            <span className="text-[11px] text-slate-500 block">In-Memory Egress Cache &amp; RLS Protection</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Keamanan &amp; Autentikasi</span>
            <span className="font-extrabold text-[#023246] block text-xs sm:text-sm">WebAuthn Biometric &amp; Device Lock</span>
            <span className="text-[11px] text-slate-500 block">256-bit CSPRNG Session &amp; Anti-Bruteforce</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">AI Engineering Assistant</span>
            <span className="font-extrabold text-[#023246] block text-xs sm:text-sm">Google Gemini &amp; Antigravity</span>
            <span className="text-[11px] text-slate-500 block">Arsitektur Deterministik &amp; Clean Code</span>
          </div>
        </div>

        <div className="pt-2 text-center text-[11px] text-slate-400 font-mono flex items-center justify-center gap-2">
          <span>Build ID: {APP_VERSION_CONFIG.BUILD_ID}</span>
          <span>•</span>
          <span>Role: {role}</span>
        </div>
      </div>

      {/* ── BOTTOM RETURN BUTTON ─────────────────────────────────────────── */}
      {onBack && (
        <div className="pt-1">
          <Button
            variant="primary"
            onClick={onBack}
            className="w-full font-extrabold text-xs sm:text-sm h-12 rounded-2xl flex items-center justify-center gap-2 bg-[#023246] hover:bg-[#1E5670] text-white shadow-sm cursor-pointer active:scale-98 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span>{backLabel}</span>
          </Button>
        </div>
      )}
    </section>
  );
};
