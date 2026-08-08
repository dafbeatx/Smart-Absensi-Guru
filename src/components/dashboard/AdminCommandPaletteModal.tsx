import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, User, LayoutDashboard, Eye, Users, Calendar, Settings, Shield, QrCode, Edit3, TestTube, ArrowRight } from 'lucide-react';
import type { UserProfile } from '../../types/database.types';

export interface CommandItem {
  id: string;
  title: string;
  category: 'NAVIGATION' | 'TEACHERS' | 'ACTIONS';
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export interface AdminCommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: UserProfile[];
  onSelectTab: (tabId: string) => void;
  onOpenQrGenerator?: () => void;
  onOpenCorrectionModal?: () => void;
  onOpenTestRunner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const AdminCommandPaletteModal: React.FC<AdminCommandPaletteModalProps> = ({
  isOpen,
  onClose,
  teachers,
  onSelectTab,
  onOpenQrGenerator,
  onOpenCorrectionModal,
  onOpenTestRunner,
  onSwitchToGuruView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // 1. Navigation Pages
    const pages = [
      { id: 'DASHBOARD', title: 'Dashboard Eksekutif', subtitle: 'Ringkasan presensi & KPI sekolah', icon: <LayoutDashboard className="w-4 h-4 text-emerald-600" /> },
      { id: 'ATTENDANCE_TRACKING', title: 'Live Tracking Presensi', subtitle: 'Pantau kehadiran real-time hari ini', icon: <Eye className="w-4 h-4 text-teal-600" /> },
      { id: 'TEACHERS', title: 'Kelola Data Guru & Staf', subtitle: 'Manajemen akun, NIP, & status aktif', icon: <Users className="w-4 h-4 text-sky-600" /> },
      { id: 'SCHEDULE', title: 'Jadwal Mengajar Guru', subtitle: 'Atur alokasi kelas & mata pelajaran', icon: <Calendar className="w-4 h-4 text-purple-600" /> },
      { id: 'CALENDAR', title: 'Kalender Akademik', subtitle: 'Atur hari libur & agenda sekolah', icon: <Calendar className="w-4 h-4 text-indigo-600" /> },
      { id: 'AUDIT', title: 'Audit Log Aktivitas', subtitle: 'Catatan jejak sistem & keamanan', icon: <Shield className="w-4 h-4 text-slate-600" /> },
      { id: 'SETTINGS', title: 'Pengaturan Sistem', subtitle: 'Konfigurasi geofence & radius sekolah', icon: <Settings className="w-4 h-4 text-amber-600" /> },
    ];

    pages.forEach((p) => {
      items.push({
        id: `nav_${p.id}`,
        title: p.title,
        subtitle: p.subtitle,
        category: 'NAVIGATION',
        icon: p.icon,
        action: () => {
          onSelectTab(p.id);
          onClose();
        },
      });
    });

    // 2. Quick System Actions
    if (onOpenQrGenerator) {
      items.push({
        id: 'act_qr',
        title: 'Cetak Poster QR Code',
        subtitle: 'Buka generator poster QR lokasi presensi',
        category: 'ACTIONS',
        icon: <QrCode className="w-4 h-4 text-emerald-600" />,
        action: () => {
          onOpenQrGenerator();
          onClose();
        },
      });
    }

    if (onOpenCorrectionModal) {
      items.push({
        id: 'act_correction',
        title: 'Koreksi Presensi Manual',
        subtitle: 'Input / ubah status absensi guru manual',
        category: 'ACTIONS',
        icon: <Edit3 className="w-4 h-4 text-amber-600" />,
        action: () => {
          onOpenCorrectionModal();
          onClose();
        },
      });
    }

    if (onOpenTestRunner) {
      items.push({
        id: 'act_test',
        title: 'Diagnostik & Test Runner',
        subtitle: 'Uji performa database & simulasi absensi',
        category: 'ACTIONS',
        icon: <TestTube className="w-4 h-4 text-rose-600" />,
        action: () => {
          onOpenTestRunner();
          onClose();
        },
      });
    }

    if (onSwitchToGuruView) {
      items.push({
        id: 'act_guru_mode',
        title: 'Beralih ke Tampilan Mode Guru',
        subtitle: 'Masuk ke dashboard presensi mandiri guru',
        category: 'ACTIONS',
        icon: <User className="w-4 h-4 text-emerald-600" />,
        action: () => {
          onSwitchToGuruView();
          onClose();
        },
      });
    }

    // 3. Teachers Search List
    teachers.forEach((t) => {
      items.push({
        id: `teacher_${t.id}`,
        title: t.full_name,
        subtitle: `${t.position || 'Guru Pengajar'} • NIP: ${t.nip || 'Belum diisi'}`,
        category: 'TEACHERS',
        icon: (
          <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
            {t.full_name ? t.full_name.charAt(0) : '👤'}
          </div>
        ),
        action: () => {
          onSelectTab('TEACHERS');
          onClose();
        },
      });
    });

    return items;
  }, [teachers, onSelectTab, onOpenQrGenerator, onOpenCorrectionModal, onOpenTestRunner, onSwitchToGuruView, onClose]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return commandItems;
    const query = searchQuery.toLowerCase().trim();
    return commandItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query))
    );
  }, [commandItems, searchQuery]);

  // Handle Keyboard Navigation (Up, Down, Enter, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Ketik untuk mencari guru, menu, atau aksi cepat... (Esc untuk menutup)"
            className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden xs:inline-block px-2 py-1 text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs">
            ESC
          </span>
        </div>

        {/* Command Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-emerald-50 border border-emerald-200/80 shadow-2xs' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/70">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{item.title}</p>
                      {item.subtitle && <p className="text-[10px] text-slate-500 font-semibold truncate">{item.subtitle}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && <ArrowRight className="w-4 h-4 text-emerald-600 animate-pulse" />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-bold text-slate-700">Tidak ada hasil ditemukan</p>
              <p className="text-[11px]">Coba kata kunci pencarian yang berbeda untuk menu atau nama guru.</p>
            </div>
          )}
        </div>

        {/* Footer Shortcut Tips */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[10px] font-medium text-slate-500 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[9px] bg-white border border-slate-200 rounded-md">↑</kbd>
              <kbd className="px-1.5 py-0.5 font-mono text-[9px] bg-white border border-slate-200 rounded-md">↓</kbd> Navigasi
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[9px] bg-white border border-slate-200 rounded-md">↵</kbd> Pilih
            </span>
          </div>

          <div className="flex items-center gap-1 text-emerald-700 font-bold">
            <span>⚡ Command Palette Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
