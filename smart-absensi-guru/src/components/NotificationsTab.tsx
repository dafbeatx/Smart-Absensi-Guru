import React, { useState } from 'react';
import { Bell, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationsTabProps {
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onToggleRead: (id: string) => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  notifications,
  onMarkAllAsRead,
  onClearAll,
  onToggleRead
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifs = filter === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  return (
    <div className="p-5 space-y-4 pb-28">
      
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#023246]">Pusat Notifikasi</h2>
          <p className="text-[10px] text-slate-400 font-medium">Pengumuman & Alert Sistem Absensi</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllAsRead}
            title="Tandai semua dibaca"
            className="p-1.5 bg-emerald-50 text-[#0D7A5F] hover:bg-emerald-100 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all"
          >
            <CheckCheck size={14} />
            <span>Dibaca</span>
          </button>
          <button
            onClick={onClearAll}
            title="Hapus semua"
            className="p-1.5 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all ${
            filter === 'all'
              ? 'bg-[#023246] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Semua ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all ${
            filter === 'unread'
              ? 'bg-[#023246] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Belum Dibaca ({notifications.filter(n => !n.read).length})
        </button>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {filteredNotifs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 text-slate-400 text-xs">
            Tidak ada notifikasi saat ini.
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => onToggleRead(notif.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                notif.read
                  ? 'bg-white border-slate-100'
                  : 'bg-emerald-50/40 border-emerald-200 shadow-2xs'
              }`}
            >
              {!notif.read && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-bl-lg"></div>
              )}

              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                  notif.type === 'success' ? 'bg-emerald-100 text-[#0D7A5F]' :
                  notif.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {notif.type === 'success' ? <CheckCircle2 size={16} /> :
                   notif.type === 'warning' ? <AlertTriangle size={16} /> :
                   <Info size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className={`text-xs font-bold ${notif.read ? 'text-slate-700' : 'text-[#023246]'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[9px] text-slate-400 font-mono">{notif.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {notif.message}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1">
                    {notif.date}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
