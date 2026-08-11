import React, { useState, useEffect, useRef } from 'react';
import { GroqAIService } from '../../services/groq-ai.service';
import { isFeatureEnabled } from '../../config/feature-flags.config';
import { useAuthStore } from '../../store/useAuthStore';
import { Sparkles, X, Send, Bot, HelpCircle, Clock, FileText, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const AIAssistantDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFloatingHidden, setIsFloatingHidden] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Selamat datang di Layanan Asisten Digital Sekolah. Saya siap membantu Bapak/Ibu Dewan Guru mengenai informasi sistem presensi, status kehadiran harian, jadwal mengajar, alur pengajuan izin/cuti, serta ketentuan geofencing sekolah.',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const user = useAuthStore((state) => state.user);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }

      const isAltA = e.altKey && e.key.toLowerCase() === 'a';
      const isCtrlI = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i';

      if (isAltA || isCtrlI) {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

        if (!isTyping || isAltA) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isFeatureEnabled('ENABLE_AI_ASSISTANT')) {
    return null;
  }

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isLoading) return;

    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setIsLoading(true);

    try {
      const response = await GroqAIService.askSmartAssistant(textToSend, user?.role || 'GURU');
      const aiMsg: Message = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        text: response,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: 'err_' + Date.now(),
        sender: 'ai',
        text: 'Mohon maaf, terjadi kendala saat terhubung ke AI Engine. Silakan coba lagi.',
        timestamp: timeStr,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button with Dismiss (X) Control */}
      {!isFloatingHidden && !isOpen && (
        <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-[#023246] p-1.5 pl-4 rounded-full shadow-2xl ring-4 ring-emerald-500/10 transition-all hover:scale-105 border border-emerald-500/30">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-white font-extrabold text-xs cursor-pointer py-1 pr-1"
            aria-label="Buka Asisten Presensi Terpadu (Alt + A)"
            title="Buka Asisten Presensi Terpadu (Alt + A / Ctrl + I)"
          >
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span className="font-bold text-xs tracking-wide whitespace-nowrap uppercase">Tanya Asisten SAG</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFloatingHidden(true);
            }}
            className="w-6 h-6 rounded-full bg-slate-950/45 hover:bg-slate-950 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
            title="Sembunyikan Tombol Asisten"
            aria-label="Sembunyikan Tombol"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Drawer Overlay with Backdrop Click to Exit */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-200"
          >
            {/* Header */}
            <div className="bg-[#023246] text-white p-4 flex items-center justify-between shadow-lg border-b border-b-[#287094]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                  <Bot className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-sm tracking-wide uppercase flex items-center gap-1.5">
                    Asisten Digital SAG
                    <span className="px-2 py-0.5 bg-emerald-600/30 text-emerald-300 text-[9px] font-bold rounded-full border border-emerald-500/30 uppercase tracking-wider">
                      Internal AI
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-300 font-semibold truncate leading-tight">
                    SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam
                  </p>
                </div>
              </div>

              {/* Prominent Easy Close Button for Smartphones */}
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer border border-white/10"
                aria-label="Tutup Asisten"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="p-3 bg-slate-50/50 border-b border-slate-200/60 flex gap-2 overflow-x-auto text-[11px] scrollbar-none">
              <button
                onClick={() => handleSendMessage('Bagaimana cara absen jika barcode direject?')}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#023246] hover:border-emerald-500/50 border border-slate-200 rounded-xl shrink-0 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-[10px]"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Barcode Direject?</span>
              </button>
              <button
                onClick={() => handleSendMessage('Berapa jam batas masuk terhitung tepat waktu?')}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#023246] hover:border-emerald-500/50 border border-slate-200 rounded-xl shrink-0 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-[10px]"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Batas Jam Absen</span>
              </button>
              <button
                onClick={() => handleSendMessage('Bagaimana prosedur permohonan izin cuti?')}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#023246] hover:border-emerald-500/50 border border-slate-200 rounded-xl shrink-0 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-[10px]"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Alur Izin & Cuti</span>
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-xl bg-[#023246]/10 border border-[#023246]/15 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-[#023246]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-[#023246] text-white font-semibold rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none font-medium'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span
                      className={`text-[9px] block text-right mt-1.5 ${
                        msg.sender === 'user' ? 'text-slate-300 font-medium' : 'text-slate-400 font-semibold'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#023246]/10 border border-[#023246]/15 flex items-center justify-center shrink-0 animate-pulse">
                    <Bot className="w-4 h-4 text-[#023246]" />
                  </div>
                  <div className="bg-white text-slate-500 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-2 shadow-xs font-semibold">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span>Asisten sedang memproses data...</span>
                  </div>
                </div>
              )}
              {/* Messages End Anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Box & Mobile Exit Button */}
            <div className="p-3 bg-white border-t border-slate-200/80 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ketik pesan untuk Asisten SAG..."
                  className="flex-1 bg-slate-100 text-slate-800 text-xs px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  className="bg-[#023246] hover:bg-[#1a4b61] disabled:opacity-50 text-white font-extrabold p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-md shadow-slate-900/10 active:scale-95"
                  aria-label="Kirim pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 pt-0.5 font-bold">
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono">Alt + A</span> Pintasan
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:text-[#023246] transition-colors underline cursor-pointer"
                >
                  Tutup Layanan Asisten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
