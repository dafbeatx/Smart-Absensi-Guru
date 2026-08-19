import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeClass?: string;
  avatarText?: string;
  avatarUrl?: string;
}

interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
  emptyText?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder = '-- Pilih --',
  options,
  value,
  onChange,
  required,
  actionButton,
  emptyText = 'Tidak ditemukan data yang cocok',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, search]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {/* Label and optional action button */}
      {(label || actionButton) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="block text-xs font-bold text-slate-700">
              {label} {required && <span className="text-rose-500">*</span>}
            </label>
          )}
          {actionButton && (
            <button
              type="button"
              onClick={actionButton.onClick}
              className="text-[11px] font-bold text-[#0D7A5F] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {actionButton.label}
            </button>
          )}
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full text-left bg-white border rounded-2xl px-3.5 py-2.5 transition-all flex items-center justify-between gap-2.5 cursor-pointer select-none ${
          isOpen
            ? 'border-[#023246] ring-3 ring-[#023246]/10 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 shadow-2xs'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        {selectedOption ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {selectedOption.avatarUrl ? (
              <img
                src={selectedOption.avatarUrl}
                alt={selectedOption.label}
                className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
              />
            ) : selectedOption.avatarText ? (
              <div className="w-7 h-7 rounded-full bg-[#023246]/10 text-[#023246] font-black flex items-center justify-center text-[10px] shrink-0">
                {selectedOption.avatarText}
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-slate-900 truncate">
                  {selectedOption.label}
                </span>
                {selectedOption.badge && (
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-bold rounded-md shrink-0 ${
                      selectedOption.badgeClass || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedOption.badge}
                  </span>
                )}
              </div>
              {selectedOption.subtitle && (
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  {selectedOption.subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-400 truncate">{placeholder}</span>
        )}

        <span
          className={`text-slate-400 text-xs transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-slate-700' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Floating Dropdown Card */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-64 animate-scale-up">
          {/* Search Box inside dropdown */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Ketik untuk mencari..."
                className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 outline-none focus:border-[#023246] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-slate-50 p-1 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium space-y-1">
                <span className="text-xl block">🔍</span>
                <p>{emptyText}</p>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {opt.avatarUrl ? (
                        <img
                          src={opt.avatarUrl}
                          alt={opt.label}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                        />
                      ) : opt.avatarText ? (
                        <div
                          className={`w-7 h-7 rounded-full font-black flex items-center justify-center text-[10px] shrink-0 ${
                            isSelected
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {opt.avatarText}
                        </div>
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold truncate">{opt.label}</span>
                          {opt.badge && (
                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-bold rounded-md shrink-0 ${
                                opt.badgeClass || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subtitle && (
                          <p className="text-[10px] text-slate-500 font-medium truncate">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-emerald-600 font-black text-xs shrink-0">✓</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
