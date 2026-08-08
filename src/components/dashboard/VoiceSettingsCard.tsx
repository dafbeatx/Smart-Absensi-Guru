import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Bot,
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  LogOut,
  SunMedium,
  RotateCcw,
  Save,
  Mic,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
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
  const [activeTestType, setActiveTestType] = useState<'WELCOME' | 'CHECK_IN' | 'CHECK_OUT' | null>(null);

  // Track currently active text input for inserting placeholder tags on tap
  const [lastFocusedField, setLastFocusedField] = useState<'welcomeTemplate' | 'checkInTemplate' | 'checkOutTemplate'>('welcomeTemplate');

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
      showToast('info', 'Asisten Suara Aktif', 'Suara AI Bahasa Indonesia siap mengucapkan sapaan & presensi.');
    } else {
      SpeechService.cancel();
      showToast('info', 'Asisten Suara Nonaktif', 'Notifikasi suara otomatis dimatikan.');
    }
  };

  const handleChange = (key: keyof VoiceConfig, value: unknown) => {
    const updated = SpeechService.updateConfig({ [key]: value });
    setConfig(updated);
  };

  const handleTestVoice = (type: 'WELCOME' | 'CHECK_IN' | 'CHECK_OUT') => {
    setIsTesting(true);
    setActiveTestType(type);
    if (type === 'WELCOME') {
      SpeechService.speakWelcomeGreeting(teacherName, institutionName);
    } else if (type === 'CHECK_IN') {
      SpeechService.speakAttendanceSuccess(teacherName, 'CHECK_IN');
    } else {
      SpeechService.speakAttendanceSuccess(teacherName, 'CHECK_OUT');
    }
    setTimeout(() => {
      setIsTesting(false);
      setActiveTestType(null);
    }, 3200);
  };

  const handleApplyPreset = (pitch: number, rate: number, label: string) => {
    const updated = SpeechService.updateConfig({ pitch, rate });
    setConfig(updated);
    showToast('success', `Preset ${label} Diterapkan`, `Pitch set ke ${pitch}, Kecepatan set ke ${rate}x`);
  };

  const handleInsertVariable = (variableTag: string) => {
    const currentVal = config[lastFocusedField] || '';
    const updatedVal = currentVal ? `${currentVal} ${variableTag}` : variableTag;
    handleChange(lastFocusedField, updatedVal);
    showToast('info', 'Variabel Disisipkan', `Menambahkan ${variableTag} ke template ucapan.`);
  };

  const handleResetDefault = () => {
    const reset = SpeechService.resetToDefault();
    setConfig(reset);
    showToast('info', 'Pengaturan Suara Direset', 'Semua model suara dan teks ucapan telah kembali ke default.');
  };

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-linear-to-br from-emerald-50/90 via-teal-50/40 to-[#023246]/5 border border-emerald-200/80 shadow-sm hover:shadow-md transition-all space-y-3.5">
      {/* Top Header & Master Quick Toggle */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all ${
              config.isEnabled
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-500/20'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {config.isEnabled ? <Bot className="w-5 h-5 sm:w-5 sm:h-5 text-white animate-pulse" /> : <VolumeX className="w-5 h-5 sm:w-5 sm:h-5" />}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-black text-[#023246] text-xs sm:text-sm tracking-tight leading-none">
                Asisten Suara AI
              </h3>
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-300/60 leading-none">
                🇮🇩 Indonesia
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-600 font-medium leading-tight sm:leading-relaxed truncate sm:whitespace-normal">
              Sapaan nama guru & konfirmasi presensi otomatis.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          aria-label={config.isEnabled ? 'Matikan Asisten Suara' : 'Aktifkan Asisten Suara'}
          className={`h-10 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl font-black text-xs transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 border active:scale-95 ${
            config.isEnabled
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800 shadow-emerald-700/20 ring-2 ring-emerald-500/20'
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'
          }`}
        >
          {config.isEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
          <span>{config.isEnabled ? 'AKTIF' : 'OFF'}</span>
        </button>
      </div>

      {config.isEnabled && (
        <div className="pt-2.5 border-t border-emerald-200/70 space-y-3">
          {/* Sub-header & Expand Drawer Bar */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-bold text-[#023246] flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Settings2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pengaturan Model & Sapaan</span>
            </span>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2.5 py-1 text-emerald-800 hover:text-emerald-900 font-bold text-[11px] sm:text-xs hover:bg-emerald-100/70 rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-emerald-200/60 shrink-0"
            >
              <span>{isExpanded ? 'Tutup Pengaturan' : 'Buka Pengaturan'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Quick Test Voice Buttons Grid (1 row mobile precision) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleTestVoice('WELCOME')}
              disabled={isTesting}
              className={`py-2 px-2 rounded-xl border text-[10px] sm:text-xs font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 ${
                activeTestType === 'WELCOME'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                  : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-200/90 shadow-2xs'
              }`}
            >
              {activeTestType === 'WELCOME' ? (
                <Volume2 className="w-3.5 h-3.5 animate-bounce text-white" />
              ) : (
                <SunMedium className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="truncate">Tes Sapaan</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestVoice('CHECK_IN')}
              disabled={isTesting}
              className={`py-2 px-2 rounded-xl border text-[10px] sm:text-xs font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 ${
                activeTestType === 'CHECK_IN'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                  : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-200/90 shadow-2xs'
              }`}
            >
              {activeTestType === 'CHECK_IN' ? (
                <Volume2 className="w-3.5 h-3.5 animate-bounce text-white" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span className="truncate">Tes Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestVoice('CHECK_OUT')}
              disabled={isTesting}
              className={`py-2 px-2 rounded-xl border text-[10px] sm:text-xs font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 ${
                activeTestType === 'CHECK_OUT'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                  : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-200/90 shadow-2xs'
              }`}
            >
              {activeTestType === 'CHECK_OUT' ? (
                <Volume2 className="w-3.5 h-3.5 animate-bounce text-white" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              )}
              <span className="truncate">Tes Pulang</span>
            </button>
          </div>

          {/* Expanded Advanced Voice Model & Text Customization Controls */}
          {isExpanded && (
            <div className="p-3.5 sm:p-4 bg-white/95 backdrop-blur-xs rounded-xl sm:rounded-2xl border border-emerald-200/80 space-y-4 shadow-sm animate-fadeIn">
              {/* 1. Voice Model Selector */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#023246]">
                  <Mic className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Model Suara Synthesizer:</span>
                </label>
                <select
                  value={config.selectedVoiceURI}
                  onChange={(e) => handleChange('selectedVoiceURI', e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 rounded-xl outline-none ring-offset-1 focus:ring-2 focus:ring-emerald-500 transition-all"
                >
                  <option value="DEFAULT_ID">🇮🇩 Otomatis (Bahasa Indonesia Standard)</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.lang.includes('id') || v.name.toLowerCase().includes('indonesia') ? '⭐ [Bahasa Indonesia]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 font-medium leading-normal flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Sistem otomatis mendeteksi model suara Bahasa Indonesia dari HP/Laptop Anda.</span>
                </p>
              </div>

              {/* 2. Preset Suara Cepat (1-Tap Presets) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-[#023246]">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Preset Karakter Suara:</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">1-Tap Atur Suara</span>
                </div>
                <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(1.0, 0.95, 'Standard')}
                    className="p-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold text-slate-700 hover:text-emerald-900 text-center transition-all cursor-pointer"
                  >
                    🎯 Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(1.25, 1.0, 'Wanita')}
                    className="p-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold text-slate-700 hover:text-emerald-900 text-center transition-all cursor-pointer"
                  >
                    👩 Wanita (Tinggi)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(0.85, 0.9, 'Pria')}
                    className="p-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold text-slate-700 hover:text-emerald-900 text-center transition-all cursor-pointer"
                  >
                    👨 Pria (Berat)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(1.0, 1.15, 'Cepat')}
                    className="p-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold text-slate-700 hover:text-emerald-900 text-center transition-all cursor-pointer"
                  >
                    ⚡ Cepat (1.15x)
                  </button>
                </div>
              </div>

              {/* 3. Pitch & Speed Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="space-y-1.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Nada Suara (Pitch)</span>
                    </span>
                    <span className="font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md text-[11px]">
                      {config.pitch}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={config.pitch}
                    onChange={(e) => handleChange('pitch', parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                    <span>Berat / Pria (0.5)</span>
                    <span>Tinggi / Wanita (1.5)</span>
                  </div>
                </div>

                <div className="space-y-1.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kecepatan (Rate)</span>
                    </span>
                    <span className="font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md text-[11px]">
                      {config.rate}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={config.rate}
                    onChange={(e) => handleChange('rate', parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                    <span>Santai (0.7x)</span>
                    <span>Cepat (1.3x)</span>
                  </div>
                </div>
              </div>

              {/* 4. Text Template Editors */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-extrabold text-xs text-[#023246]">
                      ✍️ Kustomisasi Teks Ucapan Suara AI:
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Ketuk chip untuk menyisipkan variabel:
                    </span>
                  </div>

                  {/* Interactive Variable Tag Chips for Mobile */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{nama}')}
                      className="px-2 py-1 text-[10px] font-mono font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md border border-emerald-300/80 transition-all cursor-pointer active:scale-95"
                    >
                      + &#123;nama&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{sapaan}')}
                      className="px-2 py-1 text-[10px] font-mono font-bold bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-md border border-teal-300/80 transition-all cursor-pointer active:scale-95"
                    >
                      + &#123;sapaan&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertVariable('{sekolah}')}
                      className="px-2 py-1 text-[10px] font-mono font-bold bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-md border border-sky-300/80 transition-all cursor-pointer active:scale-95"
                    >
                      + &#123;sekolah&#125;
                    </button>
                  </div>
                </div>

                {/* Welcome Template Input */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    1. Teks Sapaan Selamat Datang:
                  </label>
                  <input
                    type="text"
                    value={config.welcomeTemplate}
                    onFocus={() => setLastFocusedField('welcomeTemplate')}
                    onChange={(e) => handleChange('welcomeTemplate', e.target.value)}
                    placeholder={DEFAULT_VOICE_CONFIG.welcomeTemplate}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl outline-none ring-offset-1 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Check-In Template Input */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    2. Teks Konfirmasi Absen Masuk:
                  </label>
                  <input
                    type="text"
                    value={config.checkInTemplate}
                    onFocus={() => setLastFocusedField('checkInTemplate')}
                    onChange={(e) => handleChange('checkInTemplate', e.target.value)}
                    placeholder={DEFAULT_VOICE_CONFIG.checkInTemplate}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl outline-none ring-offset-1 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Check-Out Template Input */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    3. Teks Konfirmasi Absen Pulang:
                  </label>
                  <input
                    type="text"
                    value={config.checkOutTemplate}
                    onFocus={() => setLastFocusedField('checkOutTemplate')}
                    onChange={(e) => handleChange('checkOutTemplate', e.target.value)}
                    placeholder={DEFAULT_VOICE_CONFIG.checkOutTemplate}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 rounded-xl outline-none ring-offset-1 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons Footer (Mobile First Flex Row) */}
              <div className="flex flex-col-reverse xs:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="w-full xs:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Default</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleTestVoice('WELCOME');
                    showToast('success', 'Pengaturan Disimpan', 'Model & teks suara AI berhasil diperbarui.');
                  }}
                  className="w-full xs:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5 text-white" />
                  <span>Simpan & Tes Suara</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

