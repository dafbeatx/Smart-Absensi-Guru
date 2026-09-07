import React, { useState } from 'react';
import { TelegramService } from '../../../services/telegram.service';
import { useToastStore } from '../../../store/useToastStore';
import { Button } from '../../../components/ui/Button';

export const AuditLogTable: React.FC = () => {
  const { showToast } = useToastStore();
  const [isTesting, setIsTesting] = useState(false);

  const botToken = TelegramService.getBotToken();
  const chatId = TelegramService.getChatId();
  const isConfigured = TelegramService.isConfigured();

  const handleTestTelegram = async () => {
    if (!isConfigured) {
      showToast(
        'warning',
        'Kredensial Belum Diisi',
        'Silakan isi VITE_TELEGRAM_BOT_TOKEN dan VITE_TELEGRAM_CHAT_ID pada file .env terlebih dahulu.'
      );
      return;
    }

    setIsTesting(true);
    try {
      const res = await TelegramService.sendTestMessage();
      if (res.success) {
        showToast('success', 'Telegram Berhasil Terhubung!', 'Pesan uji coba berhasil masuk ke grup/channel Telegram.');
      } else {
        showToast('error', 'Gagal Terhubung ke Telegram', res.error || 'Periksa kembali Bot Token dan Chat ID.');
      }
    } catch (err: any) {
      showToast('error', 'Kendala Jaringan', err?.message || 'Gagal menghubungi server Telegram.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-[#023246] via-[#1E5670] to-[#287094] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
          <span className="text-9xl">✈️</span>
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Real-time Telegram Bot Stream Active
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Audit Log & Notifikasi Telegram</h2>
          <p className="text-sm text-cyan-100 mt-1 leading-relaxed">
            Seluruh catatan presensi guru, akses login web, dan mutasi data sistem kini disalurkan secara real-time langsung ke saluran Telegram sekolah.
          </p>
        </div>
      </div>

      {/* Integration Status Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>📡</span> Status Koneksi Bot Telegram
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Konfigurasi token dan ID obrolan disetel melalui file environment <code>.env</code>
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleTestTelegram}
            disabled={isTesting}
            className="bg-[#287094] hover:bg-[#023246] text-white font-bold flex items-center gap-2"
          >
            {isTesting ? '⏳ Menguji Koneksi...' : '🧪 Uji Coba Kirim ke Telegram'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">BOT TOKEN (VITE_TELEGRAM_BOT_TOKEN)</span>
              {botToken ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Terisi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Belum Diisi
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-gray-700 truncate">
              {botToken ? `${botToken.substring(0, 10)}****************` : 'Belum dikonfigurasi di file .env'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">CHAT ID (VITE_TELEGRAM_CHAT_ID)</span>
              {chatId ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Terisi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Belum Diisi
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-gray-700 truncate">
              {chatId ? `${chatId.substring(0, 4)}****` : 'Belum dikonfigurasi di file .env'}
            </p>
          </div>
        </div>

        {/* Feature Streams Overview */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            🎯 Aktivitas yang Otomatis Masuk ke Saluran Telegram:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 space-y-1">
              <span className="text-lg">📋</span>
              <h5 className="text-xs font-bold text-blue-900">Presensi Masuk & Pulang</h5>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Setiap guru yang melakukan scan presensi (QR, Biometrik, RFID) langsung dilaporkan lengkap dengan nama, jam, dan jarak geofence.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-1">
              <span className="text-lg">🌐</span>
              <h5 className="text-xs font-bold text-emerald-900">Akses Web Guru (Login)</h5>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Notifikasi instan terkirim saat guru masuk atau membuka dashboard aplikasi web presensi.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 space-y-1">
              <span className="text-lg">🛡️</span>
              <h5 className="text-xs font-bold text-amber-900">Mutasi Data & Jadwal</h5>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Perubahan data pengguna, jadwal piket guru, dan persetujuan izin otomatis tercatat sebagai audit trail ke Telegram.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
