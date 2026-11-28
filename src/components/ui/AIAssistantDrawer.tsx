import React, { useState, useEffect, useRef, useId } from 'react';
import { Clock, FileText, HelpCircle, Send, X } from 'lucide-react';
import { GroqAIService } from '../../services/groq-ai.service';
import { isFeatureEnabled } from '../../config/feature-flags.config';
import { useAuthStore } from '../../store/useAuthStore';
import { useBackHandler, BACK_PRIORITIES } from '../../hooks/useBackNavigation';

const GeminiSparkleIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="52%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.25C12.78 7.72 16.28 11.22 21.75 12C16.28 12.78 12.78 16.28 12 21.75C11.22 16.28 7.72 12.78 2.25 12C7.72 11.22 11.22 7.72 12 2.25Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
};

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

  // 🛡️ Mobile Hardware & Gesture Back Button Handler
  useBackHandler({
    id: 'ai_assistant_drawer',
    isOpen,
    priority: BACK_PRIORITIES.DRAWER,
    title: 'AI Assistant Drawer',
    onBack: () => setIsOpen(false),
  });

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
      {/* Compact Circular Gemini AI Launcher */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-3.5 sm:bottom-6 sm:right-6 z-40 w-11 h-11 rounded-full bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 shadow-lg flex items-center justify-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0D5C46]"
          title="Tanya AI"
          aria-label="Buka Tanya AI"
        >
          <GeminiSparkleIcon className="w-6 h-6" />
        </button>
      )}

      {/* Drawer Overlay with Backdrop Click to Exit */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md h-dvh shadow-2xl flex flex-col justify-between border-l border-slate-200"
          >
            {/* Header */}
            <div className="bg-[#0D5C46] text-white p-4 pt-[max(16px,env(safe-area-inset-top))] flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-xs shrink-0">
                  <GeminiSparkleIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5 flex-wrap">
                    <span>Tanya AI</span>
                    <span className="px-1.5 py-0.5 bg-white/15 text-emerald-50 text-[10px] font-semibold rounded-full border border-white/25">
                      Smart Assistant
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100 font-normal truncate">Asisten Pintar Presensi Sekolah</p>
                </div>
              </div>

              {/* Prominent Easy Close Button for Smartphones */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-11 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer border border-white/20 shrink-0"
                aria-label="Tutup Chat AI"
              >
                <X className="w-4 h-4" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-2 overflow-x-auto text-xs shrink-0">
              <button
                type="button"
                onClick={() => handleSendMessage('Bagaimana cara absen jika barcode direject?')}
                className="min-h-9 px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#0D5C46] border border-slate-200 rounded-full shrink-0 font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#0D5C46] shrink-0" />
                <span>Barcode Direject?</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Berapa jam batas masuk terhitung tepat waktu?')}
                className="min-h-9 px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#0D5C46] border border-slate-200 rounded-full shrink-0 font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-[#0D5C46] shrink-0" />
                <span>Batas Jam Absen</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Bagaimana prosedur permohonan izin cuti?')}
                className="min-h-9 px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#0D5C46] border border-slate-200 rounded-full shrink-0 font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#0D5C46] shrink-0" />
                <span>Alur Cuti</span>
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 min-h-0">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-[#0D5C46] text-white font-medium rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <span
                      className={`text-[10px] block text-right mt-1 ${
                        msg.sender === 'user' ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start" aria-live="polite" aria-busy="true">
                  <div className="bg-white text-slate-600 border border-slate-200 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#0D5C46] rounded-full animate-pulse" aria-hidden="true" />
                    <span>AI sedang berpikir...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Box & Mobile Exit Button */}
            <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white border-t border-slate-200 space-y-2 shrink-0">
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
                  className="flex-1 min-h-11 bg-slate-100 text-slate-800 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D5C46] font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  aria-label="Kirim Pesan ke Smart AI Assistant"
                  aria-busy={isLoading ? true : undefined}
                  aria-live={isLoading ? 'polite' : undefined}
                  className="min-h-11 bg-[#0D5C46] hover:bg-[#094736] disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      <span className="sr-only">Sedang mengirim...</span>
                      <span>Kirim</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500 px-1 pt-0.5">
                <span>Tekan Esc atau ketuk luar untuk keluar</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
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
