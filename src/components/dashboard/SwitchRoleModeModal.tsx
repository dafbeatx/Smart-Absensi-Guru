import React from 'react';
import type { RoleCode } from '../../types/database.types';

export interface SwitchRoleModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: 'GURU' | 'ADMIN' | 'OPERATOR' | 'KEPSEK';
  userRole?: RoleCode;
  userName?: string;
  onSelectMode: (mode: 'GURU' | 'ADMIN' | 'OPERATOR' | 'KEPSEK') => void;
}

export const SwitchRoleModeModal: React.FC<SwitchRoleModeModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  userRole = 'ADMIN',
  userName = 'Bapak/Ibu Pendidik',
  onSelectMode,
}) => {
  if (!isOpen) return null;

  const isCurrentGuru = currentMode === 'GURU';
  const managementRoleLabel =
    userRole === 'KEPSEK'
      ? 'Kepala Sekolah'
      : userRole === 'OPERATOR'
      ? 'Operator Sekolah'
      : 'Admin Website & TU';

  const managementTargetMode: 'ADMIN' | 'OPERATOR' | 'KEPSEK' =
    userRole === 'KEPSEK' ? 'KEPSEK' : userRole === 'OPERATOR' ? 'OPERATOR' : 'ADMIN';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-role-title"
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center text-xl shrink-0 shadow-xs border border-cyan-200">
              🔄
            </div>
            <div className="min-w-0">
              <h2 id="switch-role-title" className="text-base sm:text-lg font-black text-[#023246] leading-tight">
                Pilih Mode Tampilan
              </h2>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                Pengguna: <strong className="text-slate-700">{userName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
            aria-label="Tutup Dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body / Role Options */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* OPTION 1: MODE GURU (PRESENSI & MENGAJAR) */}
          <div
            className={`rounded-2xl p-4 transition-all border-2 text-left relative ${
              isCurrentGuru
                ? 'bg-emerald-50/60 border-emerald-500 shadow-xs ring-4 ring-emerald-50'
                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50 cursor-pointer'
            }`}
            onClick={() => {
              if (!isCurrentGuru) {
                onSelectMode('GURU');
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl shrink-0 shadow-2xs border border-emerald-200">
                  👨‍🏫
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-[#023246] text-sm sm:text-base leading-tight">
                      Mode Guru Pendidik
                    </h3>
                    {isCurrentGuru && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Aktif Sekarang
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Presensi harian &amp; aktivitas belajar mengajar
                  </p>
                </div>
              </div>
            </div>

            <ul className="mt-3 pt-3 border-t border-slate-100/80 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Scan QR Code &amp; Presensi Geofence Resmi</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Jadwal Mengajar, Jurnal KBM, &amp; Pengajuan Izin</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Poin Disiplin Pendidik &amp; Apresiasi Sekolah</span>
              </li>
            </ul>

            <div className="mt-3.5">
              {isCurrentGuru ? (
                <div className="w-full py-2.5 text-center text-xs font-black text-emerald-800 bg-emerald-100/80 rounded-xl border border-emerald-300">
                  ✓ Anda Sedang Menggunakan Mode Ini
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMode('GURU');
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <span>📱</span> Beralih ke Mode Guru
                </button>
              )}
            </div>
          </div>

          {/* OPTION 2: MODE ADMIN / OPERATOR / KEPSEK */}
          <div
            className={`rounded-2xl p-4 transition-all border-2 text-left relative ${
              !isCurrentGuru
                ? 'bg-cyan-50/60 border-cyan-700 shadow-xs ring-4 ring-cyan-50'
                : 'bg-white border-slate-200 hover:border-cyan-400 hover:bg-slate-50/50 cursor-pointer'
            }`}
            onClick={() => {
              if (isCurrentGuru) {
                onSelectMode(managementTargetMode);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-100 text-cyan-900 flex items-center justify-center text-2xl shrink-0 shadow-2xs border border-cyan-200">
                  ⚙️
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-[#023246] text-sm sm:text-base leading-tight">
                      Mode {managementRoleLabel}
                    </h3>
                    {!isCurrentGuru && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-700 text-white shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Aktif Sekarang
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Panel kontrol dan manajemen sekolah
                  </p>
                </div>
              </div>
            </div>

            <ul className="mt-3 pt-3 border-t border-slate-100/80 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="text-cyan-700 font-bold">✓</span>
                <span>Monitoring Kehadiran &amp; Rekapitulasi Guru</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-700 font-bold">✓</span>
                <span>Verifikasi Koreksi Absensi &amp; Persetujuan Cuti</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-700 font-bold">✓</span>
                <span>Cetak QR Poster, Manajemen Pengguna, &amp; Sistem</span>
              </li>
            </ul>

            <div className="mt-3.5">
              {!isCurrentGuru ? (
                <div className="w-full py-2.5 text-center text-xs font-black text-cyan-900 bg-cyan-100/80 rounded-xl border border-cyan-300">
                  ✓ Anda Sedang Menggunakan Mode Ini
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMode(managementTargetMode);
                  }}
                  className="w-full py-2.5 px-4 bg-[#023246] hover:bg-[#023246]/90 text-white font-black rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <span>🛡️</span> Beralih ke Mode {managementRoleLabel}
                </button>
              )}
            </div>
          </div>

          {/* Quick Helper Note */}
          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2">
            <span className="text-sm shrink-0">💡</span>
            <span className="leading-relaxed">
              Anda dapat beralih peran kapan saja tanpa harus keluar (logout) dari aplikasi. Riwayat presensi guru tetap tercatat resmi di database.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-xl text-xs transition-all cursor-pointer active:scale-95 min-h-[44px]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
