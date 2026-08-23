import React, { useState } from 'react';
import type { AppNotification } from '../../../types/database.types';

interface TeacherAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const TeacherAnnouncementModal: React.FC<TeacherAnnouncementModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'UNREAD' | 'ANNOUNCEMENT'>('ALL');

  if (!isOpen) return null;

  const filteredList = notifications.filter((item) => {
    if (filterType === 'UNREAD') return !item.is_read;
    if (filterType === 'ANNOUNCEMENT') return item.type === 'INFO' || item.type === 'SYSTEM';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              📢
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Pengumuman & Warta Sekolah</h3>
              <p className="text-[11px] text-amber-300 font-semibold truncate">
                {unreadCount > 0 ? `${unreadCount} Pengumuman Belum Dibaca` : 'Semua Telah Dibaca'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Filter & Action Bar */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterType === 'ALL' ? 'bg-[#023246] text-white font-black' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('UNREAD')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterType === 'UNREAD' ? 'bg-[#023246] text-white font-black' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[11px] font-extrabold text-[#0D7A5F] hover:underline cursor-pointer shrink-0"
            >
              ✓ Tandai Semua Dibaca
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-3xl">📭</span>
              <p className="text-xs font-bold text-slate-700">Tidak Ada Pengumuman</p>
              <p className="text-[11px] text-slate-400">Seluruh warta dan pengumuman sekolah telah Anda baca.</p>
            </div>
          ) : (
            filteredList.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.is_read) onMarkAsRead(item.id);
                  setSelectedNotification(item);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                  !item.is_read
                    ? 'bg-amber-50/70 border-amber-300 shadow-2xs hover:bg-amber-50'
                    : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">
                      {item.type === 'INFO' || item.type === 'SYSTEM' ? '📢' : item.type === 'WARNING' ? '⚠️' : '🔔'}
                    </span>
                    <h4 className="font-extrabold text-xs text-[#023246] leading-snug truncate">
                      {item.title}
                    </h4>
                  </div>
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
                  )}
                </div>

                <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-relaxed pl-6">
                  {item.message}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pl-6 pt-1 border-t border-slate-100">
                  <span>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</span>
                  <span className="text-[#0D7A5F] font-bold">Baca Detail →</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup Pengumuman
          </button>
        </div>
      </div>

      {/* Detail Popup Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-105 rounded-3xl p-5 border border-slate-200 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">📢</span>
                <div>
                  <h3 className="text-sm font-black text-[#023246] leading-tight">
                    {selectedNotification.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(selectedNotification.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-200/80 whitespace-pre-line max-h-60 overflow-y-auto">
              {selectedNotification.message}
            </div>

            <button
              type="button"
              onClick={() => setSelectedNotification(null)}
              className="w-full py-2.5 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center shadow-xs"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
