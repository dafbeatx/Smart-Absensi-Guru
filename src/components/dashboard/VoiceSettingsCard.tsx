import React, { useState, useEffect } from 'react';
import { SpeechService, DEFAULT_VOICE_CONFIG } from '../../services/speech.service';
import type { VoiceConfig } from '../../services/speech.service';
import { useToastStore } from '../../store/useToastStore';

export interface VoiceSettingsCardProps {
  teacherName?: string;
  institutionName?: string;
}

export const VoiceSettingsCard: React.FC<VoiceSettingsCardProps> = ({
  teacherName = 'Guru',
  institutionName = 'SMP Terpadu Al-Ittihadiyah',
}) => {
  const { showToast } = useToastStore();
  const [config, setConfig] = useState<VoiceConfig>(SpeechService.getConfig());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  useEffect(() => {
    const loadVoices = () => {
      const voices = SpeechService.getAvailableVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleToggle = () => {
    const nextEnabled = !config.isEnabled;
    const updated = SpeechService.updateConfig({ isEnabled: nextEnabled });
    setConfig(updated);
    if (nextEnabled) {
      SpeechService.speak(`Asisten suara AI Bahasa Indonesia diaktifkan.`);
    } else {
      SpeechService.cancel();
    }
  };

  const handleChange = (key: keyof VoiceConfig, value: unknown) => {
    const updated = SpeechService.updateConfig({ [key]: value });
    setConfig(updated);
  };

  const handleTestVoice = (type: 'WELCOME' | 'CHECK_IN' | 'CHECK_OUT') => {
    setIsTesting(true);
    if (type === 'WELCOME') {
      SpeechService.speakWelcomeGreeting(teacherName, institutionName);
    } else if (type === 'CHECK_IN') {
      SpeechService.speakAttendanceSuccess(teacherName, 'CHECK_IN');
    } else {
      SpeechService.speakAttendanceSuccess(teacherName, 'CHECK_OUT');
    }
    setTimeout(() => setIsTesting(false), 3000);
  };

  const handleResetDefault = () => {
    const reset = SpeechService.resetToDefault();
    setConfig(reset);
    showToast('info', 'Pengaturan Suara Direset', 'Semua model suara dan teks ucapan telah kembali ke default.');
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-emerald-50/70 border border-emerald-200 shadow-card space-y-4">
      {/* Top Header & Quick Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 font-black text-[#023246] text-sm sm:text-base">
            <span>🔊 Asisten Suara AI (Bahasa Indonesia)</span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
            Mengucapkan sapaan nama guru & konfirmasi presensi masuk/pulang secara otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          className={`px-4 py-2 rounded-2xl font-black text-xs transition-all shrink-0 cursor-pointer shadow-md flex items-center gap-1.5 ${
            config.isEnabled
              ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-emerald-700/20'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
        >
          <span>{config.isEnabled ? '🔊' : '🔇'}</span>
          <span>{config.isEnabled ? 'AKTIF' : 'OFF'}</span>
        </button>
      </div>

      {config.isEnabled && (
        <div className="pt-2 border-t border-emerald-200/60 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#023246] flex items-center gap-1">
              ⚙️ Pengaturan Model Suara & Teks Sapaan
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-emerald-800 font-bold text-xs hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>{isExpanded ? 'Tutup Pengaturan ▲' : 'Buka Pengaturan & Model Suara ▼'}</span>
            </button>
          </div>

          {/* Quick Test Voice Buttons Bar */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleTestVoice('WELCOME')}
              disabled={isTesting}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-300 shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>🔊 Tes Sapaan</span>
            </button>
            <button
              type="button"
              onClick={() => handleTestVoice('CHECK_IN')}
              disabled={isTesting}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-300 shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>✅ Tes Absen Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => handleTestVoice('CHECK_OUT')}
              disabled={isTesting}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-300 shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>🏠 Tes Absen Pulang</span>
            </button>
          </div>

          {/* Expanded Advanced Voice Model & Text Customization Controls */}
          {isExpanded && (
            <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 space-y-4 shadow-inner animate-fadeIn">
              {/* 1. Voice Model Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-[#023246]">
                  🎙️ Model Suara Synthesizer:
                </label>
                <select
                  value={config.selectedVoiceURI}
                  onChange={(e) => handleChange('selectedVoiceURI', e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="DEFAULT_ID">🇮🇩 Otomatis (Bahasa Indonesia Standard)</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.lang.includes('id') || v.name.toLowerCase().includes('indonesia') ? '⭐ [Bahasa Indonesia]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 font-medium">
                  Sistem otomatis mendeteksi model suara Bahasa Indonesia dari perangkat HP/Laptop Anda.
                </p>
              </div>

              {/* 2. Pitch & Speed Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>🎵 Nada Suara (Pitch)</span>
                    <span className="font-mono text-emerald-700">{config.pitch}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={config.pitch}
                    onChange={(e) => handleChange('pitch', parseFloat(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>Berat / Pria</span>
                    <span>Tinggi / Wanita</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>⚡ Kecepatan Bicara (Rate)</span>
                    <span className="font-mono text-emerald-700">{config.rate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={config.rate}
                    onChange={(e) => handleChange('rate', parseFloat(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>Santai (0.7x)</span>
                    <span>Cepat (1.3x)</span>
                  </div>
                </div>
              </div>

              {/* 3. Text Template Editors */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-[#023246]">
                    ✍️ Kustomisasi Teks Ucapan Suara AI:
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Variable: &#123;nama&#125;, &#123;sapaan&#125;, &#123;sekolah&#125;
                  </span>
                </div>

                {/* Welcome Template */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    1. Teks Sapaan Selamat Datang:
                  </label>
                  <input
                    type="text"
                    value={config.welcomeTemplate}
                    onChange={(e) => handleChange('welcomeTemplate', e.target.value)}
                    placeholder={DEFAULT_VOICE_CONFIG.welcomeTemplate}
                    className="w-full p-2 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Check-In Template */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    2. Teks Konfirmasi Absen Masuk:
                  </label>
                  <input
                    type="text"
                    value={config.checkInTemplate}
                    onChange={(e) => handleChange('checkInTemplate', e.target.value)}
                    placeholder={DEFAULT_VOICE_CONFIG.checkInTemplate}
                    className="w-full p-2 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Check-Out Template */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    3. Teks Konfirmasi Absen Pulang:
                  </label>
                  <input
                    type="text"
                    value={config.checkOutTemplate}
                    onChange={(e) => handleChange('checkOutTemplate', e.target.value)}
                    placeholder={DEFAULT_VOICE_CONFIG.checkOutTemplate}
                    className="w-full p-2 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer"
                >
                  ↺ Reset ke Default
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleTestVoice('WELCOME');
                    showToast('success', 'Pengaturan Disimpan', 'Model & teks suara AI berhasil diperbarui.');
                  }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  💾 Simpan & Tes Suara
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
