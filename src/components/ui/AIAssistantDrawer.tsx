import React, { useState, useEffect, useRef } from 'react';
import { GroqAIService } from '../../services/groq-ai.service';
import { isFeatureEnabled } from '../../config/feature-flags.config';
import { useAuthStore } from '../../store/useAuthStore';

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
      text: 'Halo! Saya Smart AI Assistant (Groq Engine). Ada yang bisa saya bantu seputar absensi, izin, atau jadwal sekolah hari ini?',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const user = useAuthStore((state) => state.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Auto-focus input when AI drawer opens
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

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
        <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1 bg-linear-to-r from-emerald-600 to-teal-700 p-1 pl-3 rounded-full shadow-2xl ring-4 ring-emerald-500/20 transition-all hover:scale-105">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-white font-bold text-xs cursor-pointer py-1.5 pr-1.5"
            aria-label="Buka Smart AI Assistant"
          >
            <span className="text-lg animate-bounce">✨</span>
            <span className="font-semibold text-xs whitespace-nowrap">Tanya AI</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFloatingHidden(true);
            }}
            className="w-6 h-6 rounded-full bg-slate-900/40 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center transition-colors cursor-pointer border border-white/20 shrink-0"
            title="Sembunyikan Tombol Tanya AI"
            aria-label="Sembunyikan Tombol Tanya AI"
          >
            ✕
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
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-lg">
                  🤖
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                    Smart AI Assistant
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] rounded-full border border-emerald-400/30">
                      Groq Llama 3.3
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Asisten Pintar Presensi Sekolah</p>
                </div>
              </div>

              {/* Prominent Easy Close Button for Smartphones */}
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer border border-white/20"
                aria-label="Tutup Chat AI"
              >
                <span>✕</span>
                <span>Tutup</span>
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto text-[11px]">
              <button
                onClick={() => handleSendMessage('Bagaimana cara absen jika barcode direject?')}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-full shrink-0 font-medium transition-colors cursor-pointer"
              >
                ❓ Barcode Direject?
              </button>
              <button
                onClick={() => handleSendMessage('Berapa jam batas masuk terhitung tepat waktu?')}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-full shrink-0 font-medium transition-colors cursor-pointer"
              >
                🕒 Batas Jam Absen
              </button>
              <button
                onClick={() => handleSendMessage('Bagaimana prosedur permohonan izin cuti?')}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-full shrink-0 font-medium transition-colors cursor-pointer"
              >
                📝 Alur Cuti
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white font-medium rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span
                      className={`text-[9px] block text-right mt-1 ${
                        msg.sender === 'user' ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-slate-500 border border-slate-200 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span>AI sedang berpikir...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Box & Mobile Exit Button */}
            <div className="p-3 bg-white border-t border-slate-200 space-y-2">
              <div className="flex gap-2 items-center">
                <label htmlFor="ai-assistant-input-field" className="sr-only">
                  Tulis pertanyaan atau pesan untuk Smart AI Assistant
                </label>
                <input
                  id="ai-assistant-input-field"
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Tulis pertanyaan seputar absensi..."
                  aria-label="Tulis pertanyaan atau pesan untuk Smart AI Assistant"
                  className="flex-1 bg-slate-100 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  aria-label="Kirim Pesan ke Smart AI Assistant"
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Kirim
                </button>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 px-1 pt-0.5">
                <span>Tekan Esc atau ketuk luar untuk keluar</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:text-slate-900 font-bold underline cursor-pointer"
                >
                  Tutup Chat AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
